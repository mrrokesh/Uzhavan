import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { currentUser } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";

export const chatRouter = Router();

/**
 * Farmer ↔ buyer messaging.
 *
 * One thread per buyer-farm pair, not one per order — like ordinary messaging
 * apps, and unlike tickets, which are deliberately one-per-issue. A running
 * relationship over months of crops shouldn't fragment into a dozen dead
 * threads just because each one started on a different listing.
 *
 * Text only for now. `Message.kind` already has a VOICE branch in the schema
 * so adding it later is a new field going unused today, not a migration that
 * has to touch every row that came before it.
 */

const withParticipants = {
  buyer: { select: { id: true, name: true, business: true, avatarKey: true } },
  farm: { select: { id: true, name: true, avatarKey: true, ownerId: true } },
  crop: { select: { id: true, title: true, imageKey: true } },
} as const;

function preview(row: {
  id: string;
  buyerId: string;
  farmId: string;
  lastMessageAt: Date;
  lastMessageBody: string | null;
  buyerReadAt: Date | null;
  farmerReadAt: Date | null;
  buyer: { id: string; name: string; business: string | null; avatarKey: string };
  farm: { id: string; name: string; avatarKey: string; ownerId: string };
  crop: { id: string; title: string; imageKey: string } | null;
}, viewerId: string) {
  const isBuyer = viewerId === row.buyerId;
  const readAt = isBuyer ? row.buyerReadAt : row.farmerReadAt;
  return {
    id: row.id,
    // The screen only ever needs "who I'm talking to" — never both.
    with: isBuyer
      ? { kind: "farm" as const, id: row.farm.id, name: row.farm.name, avatarKey: row.farm.avatarKey }
      : {
          kind: "buyer" as const,
          id: row.buyer.id,
          name: row.buyer.business ?? row.buyer.name,
          avatarKey: row.buyer.avatarKey,
        },
    crop: row.crop,
    lastMessageAt: row.lastMessageAt,
    lastMessageBody: row.lastMessageBody,
    unread: !readAt || readAt < row.lastMessageAt,
  };
}

/** My conversations, either side. Newest activity first. */
chatRouter.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const farm = await prisma.farm.findUnique({ where: { ownerId: user.id }, select: { id: true } });

    const rows = await prisma.conversation.findMany({
      where: farm ? { farmId: farm.id } : { buyerId: user.id },
      include: withParticipants,
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    });
    res.json(rows.map((r) => preview(r, user.id)));
  }),
);

const startBody = z.object({
  farmId: z.string().min(1),
  cropId: z.string().min(1).optional(),
});

/**
 * Start a conversation, or return the existing one — a buyer can only ever
 * have one thread per farm, so opening "Message the farmer" a second time
 * must land back on the same thread, not fork it.
 */
chatRouter.post(
  "/conversations",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    if (user.role !== "BUYER") throw new HttpError(403, "Only a buyer can start a conversation");
    const { farmId, cropId } = startBody.parse(req.body);

    const farm = await prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) throw new HttpError(404, "Farm not found");

    if (cropId) {
      const crop = await prisma.crop.findUnique({ where: { id: cropId } });
      if (!crop || crop.farmId !== farmId) throw new HttpError(404, "Crop not found on this farm");
    }

    const convo = await prisma.conversation.upsert({
      where: { buyerId_farmId: { buyerId: user.id, farmId } },
      create: { buyerId: user.id, farmId, cropId },
      // Never overwrite which crop started it once a thread exists.
      update: {},
      include: withParticipants,
    });
    res.status(201).json(preview(convo, user.id));
  }),
);

/** Confirms the caller is a participant, and tells them which side they're on. */
async function loadMine(conversationId: string, userId: string) {
  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { farm: { select: { id: true, ownerId: true } } },
  });
  if (!convo) throw new HttpError(404, "Conversation not found");
  const isBuyer = convo.buyerId === userId;
  const isFarmer = convo.farm.ownerId === userId;
  if (!isBuyer && !isFarmer) throw new HttpError(404, "Conversation not found");
  return { convo, isBuyer };
}

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

chatRouter.get(
  "/conversations/:id/messages",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    await loadMine(String(req.params.id), user.id);
    const { limit } = listQuery.parse(req.query);

    const rows = await prisma.message.findMany({
      where: { conversationId: String(req.params.id) },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { sender: { select: { id: true, name: true } } },
    });
    // Oldest first for the thread — the query above takes the newest N, so the
    // page has to be reversed rather than sorted ascending with a limit, or a
    // long thread would show its first N messages forever.
    res.json(rows.reverse());
  }),
);

const sendBody = z.object({
  body: z.string().trim().min(1).max(2000),
});

chatRouter.post(
  "/conversations/:id/messages",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const { convo, isBuyer } = await loadMine(String(req.params.id), user.id);
    const { body } = sendBody.parse(req.body);

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { conversationId: convo.id, senderId: user.id, kind: "TEXT", body },
      });
      await tx.conversation.update({
        where: { id: convo.id },
        data: {
          lastMessageAt: created.createdAt,
          lastMessageBody: body,
          // Sending a message is itself reading up to that point.
          ...(isBuyer ? { buyerReadAt: created.createdAt } : { farmerReadAt: created.createdAt }),
        },
      });
      return created;
    });
    res.status(201).json(message);
  }),
);

chatRouter.post(
  "/conversations/:id/read",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const { convo, isBuyer } = await loadMine(String(req.params.id), user.id);
    await prisma.conversation.update({
      where: { id: convo.id },
      data: isBuyer ? { buyerReadAt: new Date() } : { farmerReadAt: new Date() },
    });
    res.json({ read: true });
  }),
);

/** For a crop-detail screen: "Message the farmer" without knowing a farmId. */
chatRouter.get(
  "/conversations/by-crop/:cropId",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const crop = await prisma.crop.findUnique({ where: { id: String(req.params.cropId) } });
    if (!crop) throw new HttpError(404, "Crop not found");
    const existing = await prisma.conversation.findUnique({
      where: { buyerId_farmId: { buyerId: user.id, farmId: crop.farmId } },
      include: withParticipants,
    });
    res.json(existing ? preview(existing, user.id) : null);
  }),
);
