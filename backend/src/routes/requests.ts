import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { code, requireRole } from "../session.js";
import { platformFeeBps, quote } from "../fees.js";
import { asyncHandler, HttpError } from "../http.js";

export const requestsRouter = Router();

const withRelations = {
  crop: { include: { farm: true } },
  order: true,
} as const;

type RequestRow = { quantityKg: number; finalPricePerKg: number | null; crop: { pricePerKg: number } };

/**
 * Attach what the buyer will actually pay. The fee isn't stored on a request —
 * only on the order it becomes — so it's computed live here, and the buyer sees
 * it before they commit rather than after.
 */
function withQuote<T extends RequestRow>(row: T, feeBps: number) {
  const price = row.finalPricePerKg ?? row.crop.pricePerKg;
  const goods = row.quantityKg * price;
  const fee = Math.round((goods * feeBps) / 10000);
  return { ...row, goodsValue: goods, feeBps, platformFee: fee, totalPayable: goods + fee };
}

requestsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const requests = await prisma.cropRequest.findMany({
      where: { buyerId: buyer.id },
      include: withRelations,
      orderBy: { createdAt: "desc" },
    });
    const feeBps = await platformFeeBps();
    res.json(requests.map((r) => withQuote(r, feeBps)));
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
    res.json(withQuote(request, await platformFeeBps()));
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

const editBody = z.object({
  quantityKg: z.coerce.number().int().positive(),
});

/**
 * Change the quantity on a request that's still waiting on the farmer.
 *
 * Restricted to PENDING on purpose. Once the farmer has priced it, they priced
 * *that* quantity — silently changing it under them isn't an edit, it's a new
 * negotiation wearing the old one's code. A buyer who wants a different amount
 * after acceptance declines and requests again, same as changing their mind
 * about the price would require.
 *
 * "Edit" was previously wired to the create flow, which correctly refused with
 * a duplicate-request error — there was no edit path at all, client or server.
 */
requestsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const buyer = await requireRole(req, "BUYER");
    const { quantityKg } = editBody.parse(req.body);

    const request = await prisma.cropRequest.findUnique({
      where: { id: String(req.params.id) },
      include: { crop: true },
    });
    if (!request || request.buyerId !== buyer.id) throw new HttpError(404, "Request not found");
    if (request.status !== "PENDING") {
      throw new HttpError(
        409,
        request.status === "FARMER_ACCEPTED"
          ? "The farmer has already priced this request — decline it and request again to change the quantity"
          : "This request is no longer open",
      );
    }

    const crop = request.crop;
    if (!crop.listed) throw new HttpError(404, "This crop is no longer listed");
    if (quantityKg < crop.minOrderKg) {
      throw new HttpError(400, `Minimum order is ${crop.minOrderKg} kg`);
    }
    // This request hasn't reserved anything yet — only CONFIRMED ones have —
    // so the ceiling is the crop's free stock, same check as creating one.
    const available = crop.expectedKg - crop.reservedKg;
    if (quantityKg > available) {
      throw new HttpError(400, `Only ${available} kg is still available`);
    }

    const updated = await prisma.cropRequest.update({
      where: { id: request.id },
      data: { quantityKg, estimatedValue: quantityKg * crop.pricePerKg },
      include: withRelations,
    });
    res.json(withQuote(updated, await platformFeeBps()));
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

    // The farmer's number is untouched; the fee sits on top and the buyer pays
    // it. Rate is stored on the order so a later change can't rewrite history.
    const goods = request.quantityKg * price;
    const { feeBps, fee, total } = await quote(goods);

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
          value: goods,
          feeBps,
          platformFee: fee,
          totalPayable: total,
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
