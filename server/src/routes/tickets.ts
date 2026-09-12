import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { audit } from "../audit.js";
import { has, requireAny, requirePermission } from "../permissions.js";
import { currentUser } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";
import { generateTicketCode, pickAssignee } from "../tickets/assignment.js";

export const ticketsRouter = Router();

const CATEGORIES = [
  "ORDER",
  "PAYMENT",
  "DELIVERY",
  "ACCOUNT",
  "VERIFICATION",
  "APP_ISSUE",
  "OTHER",
] as const;

/** What a person who raised the ticket is allowed to see. */
const userView = {
  id: true,
  code: true,
  category: true,
  priority: true,
  status: true,
  subject: true,
  orderCode: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  assignedTo: { select: { id: true, name: true } },
} as const;

// ─── Raising and following your own tickets ───────────────────

const createBody = z.object({
  category: z.enum(CATEGORIES),
  subject: z.string().trim().min(5, "Describe the problem in a few words").max(120),
  message: z.string().trim().min(10, "Tell us a bit more so we can help").max(4000),
  orderCode: z.string().trim().max(40).optional(),
});

ticketsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    if (user.role === "STAFF" || user.role === "ADMIN") {
      throw new HttpError(403, "Staff raise issues internally, not through the support desk");
    }
    const body = createBody.parse(req.body);

    // Rate-limit by hand: three open tickets is plenty for one person.
    const open = await prisma.ticket.count({
      where: { raisedById: user.id, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } },
    });
    if (open >= 3) {
      throw new HttpError(429, "You already have 3 open tickets. We'll get to them shortly.");
    }

    const code = await generateTicketCode();
    const assignee = await pickAssignee();

    const ticket = await prisma.ticket.create({
      data: {
        code,
        raisedById: user.id,
        category: body.category,
        subject: body.subject,
        orderCode: body.orderCode,
        // Anything about money or a missing delivery starts above normal.
        priority: body.category === "PAYMENT" || body.category === "DELIVERY" ? "HIGH" : "NORMAL",
        assignedToId: assignee,
        assignedAt: assignee ? new Date() : null,
        status: assignee ? "ASSIGNED" : "OPEN",
        messages: { create: { authorId: user.id, body: body.message } },
      },
      select: userView,
    });

    await audit({
      actorId: user.id,
      action: "TICKET_CREATED",
      targetType: "Ticket",
      targetId: ticket.id,
      summary: `${ticket.code} raised — ${body.category.toLowerCase()}`,
      metadata: { autoAssigned: !!assignee },
    });

    res.status(201).json(ticket);
  }),
);

ticketsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const tickets = await prisma.ticket.findMany({
      where: { raisedById: user.id },
      select: { ...userView, _count: { select: { messages: true } } },
      orderBy: { updatedAt: "desc" },
    });
    res.json(tickets);
  }),
);

ticketsRouter.get(
  "/:code",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const staffSide = has(user, "TICKETS_VIEW");

    const ticket = await prisma.ticket.findUnique({
      where: { code: String(req.params.code).toUpperCase() },
      include: {
        raisedBy: { select: { id: true, name: true, email: true, phone: true, role: true, business: true } },
        assignedTo: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, role: true } } },
        },
      },
    });
    if (!ticket) throw new HttpError(404, "Ticket not found");

    const isOwner = ticket.raisedById === user.id;
    if (!isOwner && !staffSide) throw new HttpError(404, "Ticket not found");

    res.json({
      ...ticket,
      // Internal notes are for staff eyes only.
      messages: staffSide ? ticket.messages : ticket.messages.filter((m) => !m.internal),
      raisedBy: staffSide ? ticket.raisedBy : { id: ticket.raisedBy.id, name: ticket.raisedBy.name },
    });
  }),
);

const replyBody = z.object({
  body: z.string().trim().min(1).max(4000),
  internal: z.boolean().default(false),
});

ticketsRouter.post(
  "/:code/reply",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const { body, internal } = replyBody.parse(req.body);

    const ticket = await prisma.ticket.findUnique({
      where: { code: String(req.params.code).toUpperCase() },
    });
    if (!ticket) throw new HttpError(404, "Ticket not found");

    const isOwner = ticket.raisedById === user.id;
    const canRespond = has(user, "TICKETS_RESPOND");
    if (!isOwner && !canRespond) throw new HttpError(404, "Ticket not found");
    if (internal && !canRespond) throw new HttpError(403, "Only staff can leave internal notes");
    if (ticket.status === "CLOSED") throw new HttpError(409, "This ticket is closed");

    const staffReply = canRespond && !isOwner && !internal;

    await prisma.$transaction([
      prisma.ticketMessage.create({
        data: { ticketId: ticket.id, authorId: user.id, body, internal },
      }),
      prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          // First staff reply stops the escalation clock.
          firstResponseAt: staffReply && !ticket.firstResponseAt ? new Date() : undefined,
          status: staffReply
            ? "WAITING_ON_USER"
            : isOwner && ticket.status === "WAITING_ON_USER"
              ? "IN_PROGRESS"
              : ticket.status === "OPEN" && canRespond
                ? "IN_PROGRESS"
                : ticket.status,
        },
      }),
    ]);

    res.status(201).json({ ok: true });
  }),
);

// ─── Staff desk ────────────────────────────────────────────────

const queueQuery = z.object({
  status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED"]).optional(),
  mine: z.coerce.boolean().optional(),
  unassigned: z.coerce.boolean().optional(),
});

ticketsRouter.get(
  "/desk/queue",
  asyncHandler(async (req, res) => {
    const staff = await requirePermission(req, "TICKETS_VIEW");
    const { status, mine, unassigned } = queueQuery.parse(req.query);

    const tickets = await prisma.ticket.findMany({
      where: {
        ...(status ? { status } : { status: { notIn: ["CLOSED"] } }),
        ...(mine ? { assignedToId: staff.id } : {}),
        ...(unassigned ? { assignedToId: null } : {}),
      },
      include: {
        raisedBy: { select: { id: true, name: true, role: true, business: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 100,
    });

    res.json(tickets);
  }),
);

const assignBody = z.object({ staffId: z.string().min(1).nullable() });

ticketsRouter.post(
  "/desk/:code/assign",
  asyncHandler(async (req, res) => {
    const actor = await requirePermission(req, "TICKETS_ASSIGN");
    const { staffId } = assignBody.parse(req.body);

    const ticket = await prisma.ticket.findUnique({
      where: { code: String(req.params.code).toUpperCase() },
    });
    if (!ticket) throw new HttpError(404, "Ticket not found");

    if (staffId) {
      const target = await prisma.user.findUnique({ where: { id: staffId } });
      if (!target || (target.role !== "STAFF" && target.role !== "ADMIN")) {
        throw new HttpError(400, "That isn't a staff account");
      }
      if (target.status !== "ACTIVE") throw new HttpError(400, "That staff account isn't active");
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        assignedToId: staffId,
        assignedAt: staffId ? new Date() : null,
        status: staffId ? (ticket.status === "OPEN" ? "ASSIGNED" : ticket.status) : "OPEN",
      },
      select: { ...userView },
    });

    await audit({
      actorId: actor.id,
      action: "TICKET_ASSIGNED",
      targetType: "Ticket",
      targetId: ticket.id,
      summary: staffId ? `${ticket.code} assigned` : `${ticket.code} returned to the queue`,
      metadata: { staffId },
    });

    res.json(updated);
  }),
);

const statusBody = z.object({
  status: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_ON_USER", "RESOLVED", "CLOSED"]),
});

ticketsRouter.post(
  "/desk/:code/status",
  asyncHandler(async (req, res) => {
    const actor = await requireAny(req, ["TICKETS_RESPOND", "TICKETS_ASSIGN"]);
    const { status } = statusBody.parse(req.body);

    const ticket = await prisma.ticket.findUnique({
      where: { code: String(req.params.code).toUpperCase() },
    });
    if (!ticket) throw new HttpError(404, "Ticket not found");

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status,
        resolvedAt: status === "RESOLVED" ? new Date() : ticket.resolvedAt,
        closedAt: status === "CLOSED" ? new Date() : null,
      },
      select: userView,
    });

    await audit({
      actorId: actor.id,
      action: "TICKET_STATUS",
      targetType: "Ticket",
      targetId: ticket.id,
      summary: `${ticket.code} → ${status.toLowerCase().replace(/_/g, " ")}`,
    });

    res.json(updated);
  }),
);

/** Desk summary for the console header. */
ticketsRouter.get(
  "/desk/stats",
  asyncHandler(async (req, res) => {
    const staff = await requirePermission(req, "TICKETS_VIEW");
    const [open, unassigned, mine, escalated] = await Promise.all([
      prisma.ticket.count({ where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } } }),
      prisma.ticket.count({ where: { assignedToId: null, status: "OPEN" } }),
      prisma.ticket.count({
        where: { assignedToId: staff.id, status: { in: ["ASSIGNED", "IN_PROGRESS", "WAITING_ON_USER"] } },
      }),
      prisma.ticket.count({ where: { escalatedAt: { not: null }, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    ]);
    res.json({ open, unassigned, mine, escalated });
  }),
);
