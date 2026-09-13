import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { code, requireRole } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";

export const bookingsRouter = Router();

const LOADING_FEE = 350;
const PROTECTION_FEE = 200;

const withRelations = {
  truck: true,
  driver: { include: { user: { select: { phone: true } } } },
  order: { include: { crop: { include: { farm: true } } } },
  events: { orderBy: { createdAt: "asc" as const } },
} as const;

bookingsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const booking = await prisma.truckBooking.findUnique({
      where: { id: String(req.params.id) },
      include: withRelations,
    });
    if (!booking || booking.order.buyerId !== buyer.id) {
      throw new HttpError(404, "Booking not found");
    }
    res.json(booking);
  }),
);

const quoteQuery = z.object({ truckId: z.string().min(1) });

/** Fare breakdown shown on the review screen before the buyer pays. */
bookingsRouter.get(
  "/quote/fare",
  asyncHandler(async (req, res) => {
    await requireRole(req, "BUYER");
    const { truckId } = quoteQuery.parse(req.query);
    const truck = await prisma.truck.findUnique({ where: { id: truckId } });
    if (!truck) throw new HttpError(404, "Truck not found");
    res.json({
      baseFare: truck.price,
      loadingFee: LOADING_FEE,
      protectionFee: PROTECTION_FEE,
      total: truck.price + LOADING_FEE + PROTECTION_FEE,
    });
  }),
);

const createBody = z.object({
  orderId: z.string().min(1),
  truckId: z.string().min(1),
});

bookingsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const { orderId, truckId } = createBody.parse(req.body);

    const [order, truck] = await Promise.all([
      prisma.order.findUnique({ where: { id: orderId }, include: { booking: true } }),
      prisma.truck.findUnique({ where: { id: truckId }, include: { driver: true } }),
    ]);
    if (!order || order.buyerId !== buyer.id) throw new HttpError(404, "Order not found");
    if (!truck) throw new HttpError(404, "Truck not found");
    if (order.booking && order.booking.status !== "CANCELLED") {
      throw new HttpError(409, "This order already has a truck booked");
    }
    if (truck.capacityKg < order.quantityKg) {
      throw new HttpError(400, `${truck.name} cannot carry ${order.quantityKg} kg`);
    }
    if (!truck.driver.online) throw new HttpError(409, "That driver just went offline");

    const busy = await prisma.truckBooking.count({
      where: {
        driverId: truck.driverId,
        status: { in: ["PAID", "ACCEPTED", "ARRIVED_PICKUP", "LOADED", "IN_TRANSIT"] },
      },
    });
    if (busy > 0) throw new HttpError(409, "That driver just took another trip");

    const booking = await prisma.truckBooking.create({
      data: {
        code: code("UZH-TRP"),
        orderId: order.id,
        truckId: truck.id,
        driverId: truck.driverId,
        pickup: order.pickup,
        destination: order.destination,
        baseFare: truck.price,
        loadingFee: LOADING_FEE,
        protectionFee: PROTECTION_FEE,
        total: truck.price + LOADING_FEE + PROTECTION_FEE,
      },
      include: withRelations,
    });
    res.status(201).json(booking);
  }),
);

/**
 * Buyer pays. This is the last buyer-driven transition — from here the
 * assigned driver moves the trip forward from their own app.
 */
bookingsRouter.post(
  "/:id/pay",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const booking = await prisma.truckBooking.findUnique({
      where: { id: String(req.params.id) },
      include: { order: true },
    });
    if (!booking || booking.order.buyerId !== buyer.id) {
      throw new HttpError(404, "Booking not found");
    }
    if (booking.status !== "PENDING") {
      throw new HttpError(409, "This booking is already paid");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.truckBooking.update({
        where: { id: booking.id },
        data: { status: "PAID", paidAt: new Date() },
        include: withRelations,
      });
      await tx.bookingEvent.create({
        data: { bookingId: b.id, status: "PAID", note: "Payment received · waiting for a driver" },
      });
      return b;
    });
    res.json(updated);
  }),
);

bookingsRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const booking = await prisma.truckBooking.findUnique({
      where: { id: String(req.params.id) },
      include: { order: true },
    });
    if (!booking || booking.order.buyerId !== buyer.id) {
      throw new HttpError(404, "Booking not found");
    }
    if (!["PENDING", "PAID"].includes(booking.status)) {
      throw new HttpError(409, "The driver has already started this trip");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.truckBooking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED", cancelReason: "Cancelled by buyer" },
        include: withRelations,
      });
      await tx.bookingEvent.create({
        data: { bookingId: b.id, status: "CANCELLED", note: "Cancelled by buyer" },
      });
      await tx.order.update({ where: { id: b.orderId }, data: { status: "AWAITING_TRUCK" } });
      return b;
    });
    res.json(updated);
  }),
);
