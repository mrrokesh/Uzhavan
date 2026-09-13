import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireRole } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";

export const ordersRouter = Router();

const withRelations = {
  crop: { include: { farm: true } },
  booking: {
    include: {
      truck: true,
      driver: { include: { user: { select: { phone: true } } } },
      events: { orderBy: { createdAt: "asc" as const } },
    },
  },
} as const;

ordersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const orders = await prisma.order.findMany({
      where: { buyerId: buyer.id },
      include: withRelations,
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  }),
);

ordersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const order = await prisma.order.findUnique({
      where: { id: String(req.params.id) },
      include: withRelations,
    });
    if (!order || order.buyerId !== buyer.id) throw new HttpError(404, "Order not found");
    res.json(order);
  }),
);

const patchBody = z.object({
  transport: z.enum(["BOOK", "PRIVATE"]).optional(),
  destination: z.string().trim().min(3).optional(),
});

ordersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const body = patchBody.parse(req.body);
    const order = await prisma.order.findUnique({
      where: { id: String(req.params.id) },
      include: { booking: true },
    });
    if (!order || order.buyerId !== buyer.id) throw new HttpError(404, "Order not found");
    if (order.booking && body.destination) {
      throw new HttpError(409, "A truck is already booked — destination is locked");
    }
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        ...body,
        ...(body.transport === "PRIVATE" ? { status: "RESERVED" as const } : {}),
      },
      include: withRelations,
    });
    res.json(updated);
  }),
);
