import { Router } from "express";
import { prisma } from "../db.js";
import { currentUser } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";

export const notificationsRouter = Router();

/** My own activity feed — request accepted, order confirmed, and so on. */
notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const rows = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(rows);
  }),
);

/** What the bell adds on top of unread announcements. */
notificationsRouter.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const count = await prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    res.json({ count });
  }),
);

notificationsRouter.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const id = String(req.params.id);
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) throw new HttpError(404, "Notification not found");

    if (!existing.readAt) {
      await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    }
    res.json({ read: true });
  }),
);

notificationsRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const { count } = await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ marked: count });
  }),
);
