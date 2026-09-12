import type { PrismaClient, TicketPriority } from "@prisma/client";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { audit } from "../audit.js";

/**
 * Short ticket references people can read out over the phone. Base-32 without
 * the characters that get misheard or mistyped (I, O, 0, 1).
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function candidate(): string {
  let out = "";
  for (let i = 0; i < 5; i += 1) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `UZ-${out}`;
}

/**
 * 32^5 ≈ 33.5 million codes, so collisions are rare — but "rare" isn't "never",
 * and a duplicate would break a unique constraint at insert time. Check first,
 * and widen to 6 characters if we somehow keep colliding.
 */
export async function generateTicketCode(client: PrismaClient = prisma): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = candidate();
    const taken = await client.ticket.findUnique({ where: { code }, select: { id: true } });
    if (!taken) return code;
  }
  const wide = `UZ-${Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("")}`;
  return wide;
}

/** Tickets that still occupy a staff member's attention. */
const LIVE_STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_ON_USER"] as const;

/**
 * Pick the least-loaded eligible person. "Eligible" means an active staff
 * account that can actually reply to tickets. Admins are the fallback so a
 * ticket is never stranded just because no staff exist yet.
 */
export async function pickAssignee(
  client: PrismaClient = prisma,
  { includeAdmins = false }: { includeAdmins?: boolean } = {},
): Promise<string | null> {
  const staff = await client.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { role: "STAFF", permissions: { has: "TICKETS_RESPOND" } },
        ...(includeAdmins ? [{ role: "ADMIN" as const }] : []),
      ],
    },
    select: {
      id: true,
      role: true,
      _count: { select: { ticketsAssigned: { where: { status: { in: [...LIVE_STATUSES] } } } } },
    },
  });

  if (staff.length === 0) return null;

  // Fewest open tickets wins; prefer staff over admins on a tie so admins
  // aren't drowned in routine work.
  staff.sort((a, b) => {
    const diff = a._count.ticketsAssigned - b._count.ticketsAssigned;
    if (diff !== 0) return diff;
    if (a.role === b.role) return 0;
    return a.role === "STAFF" ? -1 : 1;
  });

  return staff[0].id;
}

/**
 * Sweep for tickets that have been left too long, and force-assign them.
 *
 * Two cases:
 *   • never assigned, older than TICKET_ESCALATION_HOURS
 *   • assigned but nobody has replied within the same window
 *
 * Admins are included as assignees here — at this point getting the ticket to
 * *somebody* matters more than protecting anyone's queue.
 */
export async function escalateStaleTickets(): Promise<{ assigned: number; bumped: number }> {
  const cutoff = new Date(Date.now() - env.ticketEscalationHours * 60 * 60 * 1000);

  const stale = await prisma.ticket.findMany({
    where: {
      status: { in: ["OPEN", "ASSIGNED"] },
      createdAt: { lt: cutoff },
      firstResponseAt: null,
    },
    select: { id: true, code: true, assignedToId: true, priority: true },
  });

  let assigned = 0;
  let bumped = 0;

  for (const ticket of stale) {
    const assignee = ticket.assignedToId ?? (await pickAssignee(prisma, { includeAdmins: true }));
    if (!assignee) continue;

    // Nudge priority up so it surfaces at the top of the queue.
    const priority: TicketPriority =
      ticket.priority === "LOW" ? "NORMAL" : ticket.priority === "NORMAL" ? "HIGH" : ticket.priority;

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        assignedToId: assignee,
        assignedAt: ticket.assignedToId ? undefined : new Date(),
        status: "ASSIGNED",
        priority,
        escalatedAt: new Date(),
      },
    });

    if (!ticket.assignedToId) assigned += 1;
    else bumped += 1;

    await audit({
      actorId: null,
      action: "TICKET_ESCALATED",
      targetType: "Ticket",
      targetId: ticket.id,
      summary: ticket.assignedToId
        ? `${ticket.code} had no reply in ${env.ticketEscalationHours}h — priority raised to ${priority}`
        : `${ticket.code} was unassigned for ${env.ticketEscalationHours}h — auto-assigned`,
      metadata: { assignee, priority },
    });
  }

  if (assigned || bumped) {
    console.log(`Ticket sweep: ${assigned} auto-assigned, ${bumped} escalated`);
  }
  return { assigned, bumped };
}

/**
 * Run the sweep on an interval. Every 15 minutes is frequent enough to honour
 * a 24-hour promise without hammering the database.
 */
export function startTicketSweeper(): NodeJS.Timeout {
  const everyMs = 15 * 60 * 1000;
  // Kick off shortly after boot so a restart doesn't reset the clock.
  setTimeout(() => void escalateStaleTickets(), 30_000);
  return setInterval(() => void escalateStaleTickets(), everyMs);
}
