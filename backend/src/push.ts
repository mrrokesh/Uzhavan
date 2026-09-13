import type { Audience, Role } from "@prisma/client";
import { prisma } from "./db.js";

/**
 * Push notifications, through Expo's service.
 *
 * Expo sits between us and APNs/FCM, which means no certificates to rotate and
 * no per-platform code — worth the dependency for a two-app project. It takes
 * up to 100 messages per request and answers with a ticket per message; a
 * DeviceNotRegistered ticket means that install is gone for good, so the token
 * is deleted rather than retried nightly forever.
 *
 * Nothing here throws into a request. A notification is a courtesy on top of
 * an action that already succeeded — an announcement is published whether or
 * not the pushes land, and the bell will show it either way.
 */

const ENDPOINT = "https://exp.host/--/api/v2/push/send";
const BATCH = 100;

/** Expo's own format. Anything else will be rejected, so check before storing. */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token);
}

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  channelId?: string;
};

type Ticket = { status: "ok" | "error"; id?: string; details?: { error?: string } };

const chunk = <T,>(rows: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, i) =>
    rows.slice(i * size, i * size + size),
  );

/**
 * Hand a batch to Expo and clean up whatever it tells us is dead.
 * Returns how many were accepted.
 */
async function deliver(messages: PushMessage[]): Promise<number> {
  let accepted = 0;

  for (const batch of chunk(messages, BATCH)) {
    let tickets: Ticket[] = [];
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      if (!res.ok) throw new Error(`Expo responded ${res.status}`);
      const body = (await res.json()) as { data?: Ticket[] };
      tickets = body.data ?? [];
    } catch (err) {
      console.error("[push] batch failed:", err instanceof Error ? err.message : err);
      continue;
    }

    const dead: string[] = [];
    tickets.forEach((t, i) => {
      if (t.status === "ok") {
        accepted += 1;
        return;
      }
      if (t.details?.error === "DeviceNotRegistered") dead.push(batch[i].to);
      else console.error("[push] rejected:", t.details?.error ?? "unknown");
    });

    if (dead.length) {
      await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
      console.log(`[push] dropped ${dead.length} dead token${dead.length === 1 ? "" : "s"}`);
    }
  }

  return accepted;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Read by the app to decide where tapping should land. */
  data?: Record<string, unknown>;
};

/** Send to specific people. Silently does nothing when none of them have the app. */
export async function pushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (userIds.length === 0) return 0;

  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
    select: { token: true },
  });
  if (tokens.length === 0) return 0;

  return deliver(
    tokens.map((t) => ({
      to: t.token,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      sound: "default",
      channelId: "default",
    })),
  );
}

/** Which roles an announcement audience covers. */
export function rolesFor(audience: Audience): Role[] {
  if (audience === "FARMERS") return ["FARMER"];
  if (audience === "BUYERS") return ["BUYER"];
  if (audience === "DRIVERS") return ["DRIVER"];
  return ["FARMER", "BUYER", "DRIVER"];
}

/**
 * Everyone an announcement is aimed at.
 *
 * Blocked and suspended accounts are excluded: someone who can't use the app
 * should not be pinged about a feature they can't reach.
 */
export async function pushToAudience(audience: Audience, payload: PushPayload): Promise<number> {
  const users = await prisma.user.findMany({
    where: { role: { in: rolesFor(audience) }, status: "ACTIVE" },
    select: { id: true },
  });
  return pushToUsers(
    users.map((u) => u.id),
    payload,
  );
}
