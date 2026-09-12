import type { BookingStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireDriver } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";
import { normalisePlate } from "../lib/plate.js";

export const driverRouter = Router();

const tripInclude = {
  truck: true,
  order: {
    include: {
      crop: { include: { farm: true } },
      buyer: { select: { id: true, name: true, business: true, phone: true, district: true } },
    },
  },
  events: { orderBy: { createdAt: "asc" } },
} as const;

const ACTIVE: BookingStatus[] = ["ACCEPTED", "ARRIVED_PICKUP", "LOADED", "IN_TRANSIT"];

driverRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const { driver } = await requireDriver(req);
    const [active, completed, paidTrips] = await Promise.all([
      prisma.truckBooking.count({ where: { driverId: driver.id, status: { in: ACTIVE } } }),
      prisma.truckBooking.count({ where: { driverId: driver.id, status: "DELIVERED" } }),
      prisma.truckBooking.findMany({
        where: { driverId: driver.id, status: "DELIVERED" },
        select: { total: true },
      }),
    ]);
    res.json({
      driver,
      truck: driver.truck,
      activeTrips: active,
      completedTrips: completed,
      earnings: paidTrips.reduce((sum, b) => sum + b.total, 0),
    });
  }),
);

const onlineBody = z.object({ online: z.boolean() });

driverRouter.patch(
  "/availability",
  asyncHandler(async (req, res) => {
    const { driver } = await requireDriver(req);
    const { online } = onlineBody.parse(req.body);
    res.json(await prisma.driver.update({ where: { id: driver.id }, data: { online } }));
  }),
);

/**
 * Open jobs: paid bookings that were routed to this driver's truck and are
 * still waiting for them to accept.
 */
driverRouter.get(
  "/jobs",
  asyncHandler(async (req, res) => {
    const { driver } = await requireDriver(req);
    const jobs = await prisma.truckBooking.findMany({
      where: { driverId: driver.id, status: "PAID" },
      include: tripInclude,
      orderBy: { createdAt: "asc" },
    });
    res.json(jobs);
  }),
);

driverRouter.get(
  "/trips",
  asyncHandler(async (req, res) => {
    const { driver } = await requireDriver(req);
    const trips = await prisma.truckBooking.findMany({
      where: { driverId: driver.id, status: { in: [...ACTIVE, "DELIVERED"] } },
      include: tripInclude,
      orderBy: { createdAt: "desc" },
    });
    res.json(trips);
  }),
);

/** Legal next states — the driver can only move a trip forward one step. */
const NEXT: Partial<Record<BookingStatus, BookingStatus>> = {
  PAID: "ACCEPTED",
  ACCEPTED: "ARRIVED_PICKUP",
  ARRIVED_PICKUP: "LOADED",
  LOADED: "IN_TRANSIT",
  IN_TRANSIT: "DELIVERED",
};

const STAMP: Partial<Record<BookingStatus, string>> = {
  ACCEPTED: "acceptedAt",
  ARRIVED_PICKUP: "arrivedAt",
  LOADED: "loadedAt",
  IN_TRANSIT: "inTransitAt",
  DELIVERED: "deliveredAt",
};

const NOTE: Record<string, string> = {
  ACCEPTED: "Driver accepted the trip",
  ARRIVED_PICKUP: "Driver reached the farm",
  LOADED: "Crop loaded",
  IN_TRANSIT: "On the way to the warehouse",
  DELIVERED: "Delivered",
};

const advanceBody = z.object({
  /** Optional explicit target, so a mis-tap can't skip a step. */
  to: z
    .enum(["ACCEPTED", "ARRIVED_PICKUP", "LOADED", "IN_TRANSIT", "DELIVERED"])
    .optional(),
  receivedBy: z.string().trim().min(2).max(80).optional(),
});

driverRouter.post(
  "/trips/:id/advance",
  asyncHandler(async (req, res) => {
    const { driver } = await requireDriver(req);
    const { to, receivedBy } = advanceBody.parse(req.body ?? {});

    const booking = await prisma.truckBooking.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!booking || booking.driverId !== driver.id) throw new HttpError(404, "Trip not found");

    const next = NEXT[booking.status];
    if (!next) throw new HttpError(409, `This trip is ${booking.status.toLowerCase()}`);
    if (to && to !== next) {
      throw new HttpError(409, `Next step for this trip is ${next.toLowerCase()}`);
    }
    if (next === "DELIVERED" && !receivedBy) {
      throw new HttpError(400, "Enter who received the crop at the warehouse");
    }

    const stamp = STAMP[next];
    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.truckBooking.update({
        where: { id: booking.id },
        data: {
          status: next,
          ...(stamp ? { [stamp]: new Date() } : {}),
          ...(next === "DELIVERED" ? { proofReceivedBy: receivedBy } : {}),
        },
        include: tripInclude,
      });
      await tx.bookingEvent.create({
        data: { bookingId: b.id, status: next, note: NOTE[next] },
      });
      await tx.order.update({
        where: { id: b.orderId },
        data: { status: next === "DELIVERED" ? "DELIVERED" : "IN_TRANSIT" },
      });
      if (next === "DELIVERED") {
        await tx.driver.update({
          where: { id: driver.id },
          data: { trips: { increment: 1 } },
        });
      }
      return b;
    });

    res.json(updated);
  }),
);

const cancelBody = z.object({ reason: z.string().trim().min(3).max(200) });

driverRouter.post(
  "/trips/:id/cancel",
  asyncHandler(async (req, res) => {
    const { driver } = await requireDriver(req);
    const { reason } = cancelBody.parse(req.body);

    const booking = await prisma.truckBooking.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!booking || booking.driverId !== driver.id) throw new HttpError(404, "Trip not found");
    if (booking.status === "DELIVERED") throw new HttpError(409, "This trip is already delivered");
    if (booking.status === "LOADED" || booking.status === "IN_TRANSIT") {
      throw new HttpError(409, "The crop is already loaded — call support to cancel");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.truckBooking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED", cancelReason: reason },
        include: tripInclude,
      });
      await tx.bookingEvent.create({
        data: { bookingId: b.id, status: "CANCELLED", note: reason },
      });
      await tx.order.update({
        where: { id: b.orderId },
        data: { status: "AWAITING_TRUCK" },
      });
      return b;
    });

    res.json(updated);
  }),
);

const truckBody = z.object({
  name: z.string().trim().min(2).optional(),
  capacityTons: z.coerce.number().positive().optional(),
  price: z.coerce.number().int().positive().optional(),
  body: z.enum(["Open body", "Closed body"]).optional(),
  plate: z.string().trim().min(4).optional(),
  etaMin: z.coerce.number().int().positive().optional(),
});

driverRouter.patch(
  "/truck",
  asyncHandler(async (req, res) => {
    const { driver } = await requireDriver(req);
    if (!driver.truck) throw new HttpError(404, "No truck registered on this account");
    const body = truckBody.parse(req.body);
    const updated = await prisma.truck.update({
      where: { id: driver.truck.id },
      data: {
        ...body,
        ...(body.plate ? { plate: body.plate.toUpperCase(), plateKey: normalisePlate(body.plate) } : {}),
        ...(body.capacityTons
          ? {
              capacityKg: Math.round(body.capacityTons * 1000),
              meta: `${body.body ?? driver.truck.body} · ${body.capacityTons} ton`,
            }
          : {}),
      },
    });
    res.json(updated);
  }),
);
