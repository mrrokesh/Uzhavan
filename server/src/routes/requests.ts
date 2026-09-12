import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { code, requireRole } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";

export const requestsRouter = Router();

const withRelations = {
  crop: { include: { farm: true } },
  order: true,
} as const;

requestsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const requests = await prisma.cropRequest.findMany({
      where: { buyerId: buyer.id },
      include: withRelations,
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  }),
);

requestsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const request = await prisma.cropRequest.findUnique({
      where: { id: String(req.params.id) },
      include: withRelations,
    });
    if (!request || request.buyerId !== buyer.id) throw new HttpError(404, "Request not found");
    res.json(request);
  }),
);

const createBody = z.object({
  cropId: z.string().min(1),
  quantityKg: z.coerce.number().int().positive(),
});

requestsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const { cropId, quantityKg } = createBody.parse(req.body);

    const crop = await prisma.crop.findUnique({ where: { id: cropId } });
    if (!crop || !crop.listed) throw new HttpError(404, "Crop not found");
    if (quantityKg < crop.minOrderKg) {
      throw new HttpError(400, `Minimum order is ${crop.minOrderKg} kg`);
    }
    const available = crop.expectedKg - crop.reservedKg;
    if (quantityKg > available) {
      throw new HttpError(400, `Only ${available} kg is still available`);
    }

    const duplicate = await prisma.cropRequest.findFirst({
      where: { buyerId: buyer.id, cropId, status: { in: ["PENDING", "FARMER_ACCEPTED"] } },
    });
    if (duplicate) {
      throw new HttpError(409, "You already have an open request for this crop");
    }

    const request = await prisma.cropRequest.create({
      data: {
        code: code("UZH-REQ"),
        cropId,
        buyerId: buyer.id,
        quantityKg,
        estimatedValue: quantityKg * crop.pricePerKg,
      },
      include: withRelations,
    });
    res.status(201).json(request);
  }),
);

/** Buyer accepts the farmer's final price — this is what creates the order. */
requestsRouter.post(
  "/:id/confirm",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const request = await prisma.cropRequest.findUnique({
      where: { id: String(req.params.id) },
      include: { crop: { include: { farm: true } }, order: true },
    });
    if (!request || request.buyerId !== buyer.id) throw new HttpError(404, "Request not found");
    if (request.order) return res.json(request.order);
    if (request.status !== "FARMER_ACCEPTED") {
      throw new HttpError(409, "The farmer hasn't accepted this request yet");
    }

    const price = request.finalPricePerKg ?? request.crop.pricePerKg;
    const available = request.crop.expectedKg - request.crop.reservedKg;
    if (request.quantityKg > available) {
      throw new HttpError(400, `Only ${available} kg is still available on this listing`);
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          code: code("UZH-ORD"),
          requestId: request.id,
          cropId: request.cropId,
          buyerId: buyer.id,
          product: request.crop.title,
          quantityKg: request.quantityKg,
          pricePerKg: price,
          value: request.quantityKg * price,
          pickup: `${request.crop.farm.name}, ${request.crop.farm.location}`,
          destination: buyer.warehouse ?? buyer.market ?? "Buyer warehouse",
          harvestDate: request.crop.harvestDate,
          status: "AWAITING_TRUCK",
        },
        include: { crop: { include: { farm: true } } },
      });
      await tx.cropRequest.update({
        where: { id: request.id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      await tx.crop.update({
        where: { id: request.cropId },
        data: { reservedKg: { increment: request.quantityKg } },
      });
      return created;
    });

    res.status(201).json(order);
  }),
);

/** Buyer turns down the farmer's final price. */
requestsRouter.post(
  "/:id/decline",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const request = await prisma.cropRequest.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!request || request.buyerId !== buyer.id) throw new HttpError(404, "Request not found");
    if (request.status !== "FARMER_ACCEPTED") {
      throw new HttpError(409, "There is no offer to decline on this request");
    }
    const updated = await prisma.cropRequest.update({
      where: { id: request.id },
      data: { status: "BUYER_DECLINED" },
      include: withRelations,
    });
    res.json(updated);
  }),
);

requestsRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const request = await prisma.cropRequest.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!request || request.buyerId !== buyer.id) throw new HttpError(404, "Request not found");
    if (request.status === "CONFIRMED") {
      throw new HttpError(409, "This request is already confirmed as an order");
    }
    const updated = await prisma.cropRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED" },
      include: withRelations,
    });
    res.json(updated);
  }),
);
