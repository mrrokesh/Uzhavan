import type { Audience, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { audit } from "../audit.js";
import { requirePermission } from "../permissions.js";
import { currentUser } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";

export const announcementsRouter = Router();

/** Which audiences a given role should see. */
function audiencesFor(role: Role): Audience[] {
  if (role === "FARMER") return ["ALL", "FARMERS"];
  if (role === "BUYER") return ["ALL", "BUYERS"];
  if (role === "DRIVER") return ["ALL", "DRIVERS"];
  return ["ALL", "FARMERS", "BUYERS", "DRIVERS"];
}

function liveWhere(role: Role) {
  const now = new Date();
  return {
    audience: { in: audiencesFor(role) },
    publishedAt: { not: null, lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

/** What the bell shows. */
announcementsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const rows = await prisma.announcement.findMany({
      where: liveWhere(user.role),
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: 50,
      include: { reads: { where: { userId: user.id }, select: { readAt: true } } },
    });

    res.json(
      rows.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        audience: a.audience,
        pinned: a.pinned,
        publishedAt: a.publishedAt,
        expiresAt: a.expiresAt,
        read: a.reads.length > 0,
      })),
    );
  }),
);

announcementsRouter.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const count = await prisma.announcement.count({
      where: { ...liveWhere(user.role), reads: { none: { userId: user.id } } },
    });
    res.json({ count });
  }),
);

announcementsRouter.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const id = String(req.params.id);
    const exists = await prisma.announcement.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new HttpError(404, "Announcement not found");

    await prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId: user.id } },
      create: { announcementId: id, userId: user.id },
      update: {},
    });
    res.json({ read: true });
  }),
);

announcementsRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const unread = await prisma.announcement.findMany({
      where: { ...liveWhere(user.role), reads: { none: { userId: user.id } } },
      select: { id: true },
    });
    if (unread.length) {
      await prisma.announcementRead.createMany({
        data: unread.map((a) => ({ announcementId: a.id, userId: user.id })),
        skipDuplicates: true,
      });
    }
    res.json({ marked: unread.length });
  }),
);

// ---- Admin ---------------------------------------------------

export const adminAnnouncementsRouter = Router();

const body = z.object({
  title: z.string().trim().min(4, "Give it a title").max(120),
  body: z.string().trim().min(10, "Write the message").max(2000),
  audience: z.enum(["ALL", "FARMERS", "BUYERS", "DRIVERS"]).default("ALL"),
  pinned: z.boolean().default(false),
  /** Leave null to save a draft; set to publish immediately. */
  publish: z.boolean().default(true),
  expiresAt: z.string().datetime().nullable().optional(),
});

adminAnnouncementsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await requirePermission(req, "CONFIG_WRITE");
    const rows = await prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        author: { select: { id: true, name: true } },
        _count: { select: { reads: true } },
      },
    });

    // How many people each announcement could reach, so "12 of 40 read" means
    // something.
    const counts = await prisma.user.groupBy({
      by: ["role"],
      where: { role: { in: ["FARMER", "BUYER", "DRIVER"] }, status: "ACTIVE" },
      _count: true,
    });
    const byRole = Object.fromEntries(counts.map((c) => [c.role, c._count]));
    const reach = (a: Audience) =>
      a === "FARMERS"
        ? (byRole.FARMER ?? 0)
        : a === "BUYERS"
          ? (byRole.BUYER ?? 0)
          : a === "DRIVERS"
            ? (byRole.DRIVER ?? 0)
            : (byRole.FARMER ?? 0) + (byRole.BUYER ?? 0) + (byRole.DRIVER ?? 0);

    res.json(
      rows.map((a) => ({
        ...a,
        reads: a._count.reads,
        audienceSize: reach(a.audience),
        _count: undefined,
      })),
    );
  }),
);

adminAnnouncementsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const actor = await requirePermission(req, "CONFIG_WRITE");
    const b = body.parse(req.body);

    const created = await prisma.announcement.create({
      data: {
        title: b.title,
        body: b.body,
        audience: b.audience,
        pinned: b.pinned,
        authorId: actor.id,
        publishedAt: b.publish ? new Date() : null,
        expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
      },
    });

    await audit({
      actorId: actor.id,
      action: b.publish ? "ANNOUNCEMENT_PUBLISHED" : "ANNOUNCEMENT_DRAFTED",
      targetType: "Announcement",
      targetId: created.id,
      summary: `${b.publish ? "Published" : "Drafted"} "${b.title}" to ${b.audience.toLowerCase()}`,
    });

    res.status(201).json(created);
  }),
);

adminAnnouncementsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const actor = await requirePermission(req, "CONFIG_WRITE");
    const b = body.partial().parse(req.body);
    const id = String(req.params.id);

    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Announcement not found");

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(b.title ? { title: b.title } : {}),
        ...(b.body ? { body: b.body } : {}),
        ...(b.audience ? { audience: b.audience } : {}),
        ...(b.pinned !== undefined ? { pinned: b.pinned } : {}),
        ...(b.expiresAt !== undefined
          ? { expiresAt: b.expiresAt ? new Date(b.expiresAt) : null }
          : {}),
        ...(b.publish !== undefined
          ? { publishedAt: b.publish ? (existing.publishedAt ?? new Date()) : null }
          : {}),
      },
    });

    await audit({
      actorId: actor.id,
      action: "ANNOUNCEMENT_UPDATED",
      targetType: "Announcement",
      targetId: id,
      summary: `Updated "${updated.title}"`,
    });

    res.json(updated);
  }),
);

adminAnnouncementsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const actor = await requirePermission(req, "CONFIG_WRITE");
    const id = String(req.params.id);
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Announcement not found");

    await prisma.announcement.delete({ where: { id } });
    await audit({
      actorId: actor.id,
      action: "ANNOUNCEMENT_DELETED",
      targetType: "Announcement",
      targetId: id,
      summary: `Deleted "${existing.title}"`,
    });
    res.json({ deleted: true });
  }),
);
