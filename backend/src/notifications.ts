import type { NotificationKind, Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { pushToUsers } from "./push.js";

/**
 * A personal event for exactly one person — a request accepted, an order
 * confirmed, a driver taking the job, a delivery landing. Distinct from
 * Announcement, which is one row many people read; this is one row per
 * recipient, so the in-app list and the unread count are always about one
 * person's own activity.
 *
 * Always writes the row first. The push is a courtesy on top of that, same as
 * announcements: a farmer who accepted a request must see it worked whether
 * or not Expo's service is reachable right now.
 */
export async function notify(
  userId: string,
  kind: NotificationKind,
  payload: { title: string; body: string; data?: Record<string, unknown> },
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      kind,
      title: payload.title,
      body: payload.body,
      data: payload.data as Prisma.InputJsonValue | undefined,
    },
  });
  void pushToUsers([userId], payload).catch((err) =>
    console.error("[notify] push failed:", err instanceof Error ? err.message : err),
  );
}
