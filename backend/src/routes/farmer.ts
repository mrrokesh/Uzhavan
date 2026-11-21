import { Router } from "express";
import sharp from "sharp";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireFarm } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";
import { districtsWithin, resolveDistrict } from "../data/districts.js";
import { notify } from "../notifications.js";

export const farmerRouter = Router();

/** Farm profile + headline numbers for the farmer's home screen. */
farmerRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const { farm } = await requireFarm(req);

    const [crops, pending, accepted, orders] = await Promise.all([
      prisma.crop.count({ where: { farmId: farm.id, listed: true } }),
      prisma.cropRequest.count({
        where: { crop: { farmId: farm.id }, status: "PENDING" },
      }),
      prisma.cropRequest.count({
        where: { crop: { farmId: farm.id }, status: "FARMER_ACCEPTED" },
      }),
      prisma.order.findMany({
        where: { crop: { farmId: farm.id } },
        select: { value: true, status: true },
      }),
    ]);

    res.json({
      farm,
      listedCrops: crops,
      pendingRequests: pending,
      awaitingBuyer: accepted,
      orderCount: orders.length,
      salesValue: orders.reduce((sum, o) => sum + o.value, 0),
    });
  }),
);

const farmBody = z.object({
  name: z.string().trim().min(2).optional(),
  district: z.string().trim().min(2).optional(),
  location: z.string().trim().min(2).optional(),
});

farmerRouter.patch(
  "/farm",
  asyncHandler(async (req, res) => {
    const { farm } = await requireFarm(req);
    const data = farmBody.parse(req.body);
    res.json(
      await prisma.farm.update({
        where: { id: farm.id },
        data: {
          ...data,
          // Keep the searchable key in step with whatever they typed.
          ...(data.district ? { districtKey: resolveDistrict(data.district)?.name ?? null } : {}),
        },
      }),
    );
  }),
);

// ---- Listings ------------------------------------------------------------

farmerRouter.get(
  "/crops",
  asyncHandler(async (req, res) => {
    const { farm } = await requireFarm(req);
    const crops = await prisma.crop.findMany({
      where: { farmId: farm.id },
      include: {
        farm: true,
        _count: { select: { requests: true, orders: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(crops);
  }),
);

const IMAGE_KEYS = [
  "pomegranate",
  "turmeric",
  "orange",
  "farm",
  "orchard",
  "grove",
] as const;

const cropBody = z.object({
  title: z.string().trim().min(2, "Enter the crop name"),
  headline: z.string().trim().min(4, "Write a short headline").optional(),
  category: z.string().trim().min(2, "Enter a category"),
  grade: z.string().trim().min(1).default("Grade A"),
  status: z.enum(["upcoming", "ready"]),
  statusLabel: z.string().trim().min(2).optional(),
  expectedKg: z.coerce.number().int().positive("Enter the expected quantity"),
  minOrderKg: z.coerce.number().int().positive("Enter a minimum order"),
  pricePerKg: z.coerce.number().int().positive("Enter a price per kg"),
  harvestDate: z.string().trim().min(4, "Enter the harvest date"),
  about: z.string().trim().min(10, "Describe the crop in a sentence or two"),
  hasVideo: z.boolean().default(false),
  imageKey: z.enum(IMAGE_KEYS).default("farm"),
  galleryKeys: z.array(z.enum(IMAGE_KEYS)).default([]),
  listed: z.boolean().default(true),
});

function derive(body: z.infer<typeof cropBody>) {
  return {
    ...body,
    headline: body.headline?.trim() || `${body.title} from the farm`,
    statusLabel:
      body.statusLabel?.trim() || (body.status === "ready" ? "Ready now" : "Upcoming harvest"),
    harvestDateShort: body.harvestDate.split(",")[0].slice(0, 6).trim(),
    galleryKeys: body.galleryKeys.length ? body.galleryKeys : [body.imageKey],
  };
}

farmerRouter.post(
  "/crops",
  asyncHandler(async (req, res) => {
    const { farm } = await requireFarm(req);
    const body = cropBody.parse(req.body);
    if (body.minOrderKg > body.expectedKg) {
      throw new HttpError(400, "Minimum order can't exceed the expected quantity");
    }
    const crop = await prisma.crop.create({
      data: { ...derive(body), farmId: farm.id },
      include: { farm: true },
    });
    res.status(201).json(crop);
  }),
);

async function ownCrop(req: Parameters<typeof requireFarm>[0], cropId: string) {
  const { farm } = await requireFarm(req);
  const crop = await prisma.crop.findUnique({ where: { id: cropId } });
  if (!crop || crop.farmId !== farm.id) throw new HttpError(404, "Crop not found");
  return crop;
}

farmerRouter.patch(
  "/crops/:id",
  asyncHandler(async (req, res) => {
    const crop = await ownCrop(req, String(req.params.id));
    const body = cropBody.partial().parse(req.body);

    if (body.expectedKg !== undefined && body.expectedKg < crop.reservedKg) {
      throw new HttpError(
        400,
        `${crop.reservedKg} kg is already reserved by buyers — expected quantity can't go below that`,
      );
    }

    const updated = await prisma.crop.update({
      where: { id: crop.id },
      data: {
        ...body,
        ...(body.harvestDate
          ? { harvestDateShort: body.harvestDate.split(",")[0].slice(0, 6).trim() }
          : {}),
      },
      include: { farm: true },
    });
    res.json(updated);
  }),
);

const photoBody = z.object({
  data: z.string().min(16, "That photo didn't come through"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
});

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/**
 * Phones send full-resolution pictures; the apps show them at a few hundred
 * pixels. Shrinking here, once, means every later read from the (remote)
 * database and every download over mobile data is a fraction of the size.
 */
async function shrink(bytes: Buffer, maxEdge: number) {
  try {
    const data = await sharp(bytes)
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    return { data, mimeType: "image/jpeg" as const };
  } catch {
    throw new HttpError(400, "That file isn't a picture we can read");
  }
}

farmerRouter.put(
  "/crops/:id/photo",
  asyncHandler(async (req, res) => {
    const crop = await ownCrop(req, String(req.params.id));
    const body = photoBody.parse(req.body);
    const bytes = Buffer.from(body.data, "base64");
    if (bytes.length < 32 || bytes.length > MAX_PHOTO_BYTES) {
      throw new HttpError(400, "Photo must be a picture under 2 MB");
    }
    const img = await shrink(bytes, 1000);
    await prisma.cropPhoto.upsert({
      where: { cropId: crop.id },
      create: { cropId: crop.id, mimeType: img.mimeType, data: img.data },
      update: { mimeType: img.mimeType, data: img.data },
    });
    const updated = await prisma.crop.update({
      where: { id: crop.id },
      data: { hasCustomPhoto: true, photoUpdatedAt: new Date() },
      include: { farm: true },
    });
    res.json(updated);
  }),
);

farmerRouter.delete(
  "/crops/:id/photo",
  asyncHandler(async (req, res) => {
    const crop = await ownCrop(req, String(req.params.id));
    await prisma.cropPhoto.deleteMany({ where: { cropId: crop.id } });
    const updated = await prisma.crop.update({
      where: { id: crop.id },
      data: { hasCustomPhoto: false, photoUpdatedAt: null },
      include: { farm: true },
    });
    res.json(updated);
  }),
);

farmerRouter.put(
  "/farm/avatar",
  asyncHandler(async (req, res) => {
    const { farm } = await requireFarm(req);
    const body = photoBody.parse(req.body);
    const bytes = Buffer.from(body.data, "base64");
    if (bytes.length < 32 || bytes.length > MAX_PHOTO_BYTES) {
      throw new HttpError(400, "Photo must be a picture under 2 MB");
    }
    const img = await shrink(bytes, 400);
    await prisma.farmAvatar.upsert({
      where: { farmId: farm.id },
      create: { farmId: farm.id, mimeType: img.mimeType, data: img.data },
      update: { mimeType: img.mimeType, data: img.data },
    });
    res.json(
      await prisma.farm.update({
        where: { id: farm.id },
        data: { hasAvatar: true, avatarUpdatedAt: new Date() },
      }),
    );
  }),
);

farmerRouter.delete(
  "/farm/avatar",
  asyncHandler(async (req, res) => {
    const { farm } = await requireFarm(req);
    await prisma.farmAvatar.deleteMany({ where: { farmId: farm.id } });
    res.json(
      await prisma.farm.update({
        where: { id: farm.id },
        data: { hasAvatar: false, avatarUpdatedAt: null },
      }),
    );
  }),
);

farmerRouter.delete(
  "/crops/:id",
  asyncHandler(async (req, res) => {
    const crop = await ownCrop(req, String(req.params.id));
    const live = await prisma.cropRequest.count({
      where: { cropId: crop.id, status: { in: ["PENDING", "FARMER_ACCEPTED"] } },
    });
    if (live > 0) {
      throw new HttpError(
        409,
        "This crop has open buyer requests. Respond to them first, or just unlist it.",
      );
    }
    // Keep sold history intact — unlist rather than destroy.
    if (crop.reservedKg > 0) {
      const updated = await prisma.crop.update({
        where: { id: crop.id },
        data: { listed: false },
        include: { farm: true },
      });
      return res.json({ unlisted: true, crop: updated });
    }
    await prisma.crop.delete({ where: { id: crop.id } });
    res.json({ deleted: true });
  }),
);

// ---- Incoming buyer requests --------------------------------------------

farmerRouter.get(
  "/requests",
  asyncHandler(async (req, res) => {
    const { farm } = await requireFarm(req);
    const requests = await prisma.cropRequest.findMany({
      where: { crop: { farmId: farm.id } },
      include: {
        crop: { include: { farm: true } },
        buyer: {
          select: { id: true, name: true, business: true, district: true, phone: true, avatarKey: true },
        },
        order: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(requests);
  }),
);

const acceptBody = z.object({
  finalPricePerKg: z.coerce.number().int().positive().optional(),
});

farmerRouter.post(
  "/requests/:id/accept",
  asyncHandler(async (req, res) => {
    const { farm } = await requireFarm(req);
    const { finalPricePerKg } = acceptBody.parse(req.body ?? {});

    const request = await prisma.cropRequest.findUnique({
      where: { id: String(req.params.id) },
      include: { crop: true },
    });
    if (!request || request.crop.farmId !== farm.id) throw new HttpError(404, "Request not found");
    if (request.status !== "PENDING") {
      throw new HttpError(409, `This request is already ${request.status.toLowerCase()}`);
    }

    const available = request.crop.expectedKg - request.crop.reservedKg;
    if (request.quantityKg > available) {
      throw new HttpError(400, `Only ${available} kg is still unreserved on this listing`);
    }

    const updated = await prisma.cropRequest.update({
      where: { id: request.id },
      data: {
        status: "FARMER_ACCEPTED",
        finalPricePerKg: finalPricePerKg ?? request.crop.pricePerKg,
        respondedAt: new Date(),
      },
      include: { crop: { include: { farm: true } } },
    });
    await notify(request.buyerId, "REQUEST_ACCEPTED", {
      title: "Request accepted",
      body: `${farm.name} priced ${updated.crop.title} at ₹${updated.finalPricePerKg}/kg — confirm to place the order.`,
      data: { requestId: request.id },
    });
    res.json(updated);
  }),
);

const declineBody = z.object({ reason: z.string().trim().max(200).optional() });

farmerRouter.post(
  "/requests/:id/decline",
  asyncHandler(async (req, res) => {
    const { farm } = await requireFarm(req);
    const { reason } = declineBody.parse(req.body ?? {});

    const request = await prisma.cropRequest.findUnique({
      where: { id: String(req.params.id) },
      include: { crop: true },
    });
    if (!request || request.crop.farmId !== farm.id) throw new HttpError(404, "Request not found");
    if (request.status !== "PENDING") {
      throw new HttpError(409, `This request is already ${request.status.toLowerCase()}`);
    }

    const updated = await prisma.cropRequest.update({
      where: { id: request.id },
      data: {
        status: "FARMER_DECLINED",
        declineReason: reason || "The farmer can't fulfil this quantity right now",
        respondedAt: new Date(),
      },
      include: { crop: { include: { farm: true } } },
    });
    await notify(request.buyerId, "REQUEST_DECLINED", {
      title: "Request declined",
      body: `${farm.name} declined your request for ${updated.crop.title}: ${updated.declineReason}`,
      data: { requestId: request.id },
    });
    res.json(updated);
  }),
);

// ---- Sales ---------------------------------------------------------------

farmerRouter.get(
  "/orders",
  asyncHandler(async (req, res) => {
    const { farm } = await requireFarm(req);
    const orders = await prisma.order.findMany({
      where: { crop: { farmId: farm.id } },
      include: {
        crop: { include: { farm: true } },
        buyer: { select: { id: true, name: true, business: true, district: true, phone: true } },
        booking: { include: { driver: true, truck: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  }),
);

// ---- Demand board --------------------------------------------------------

const demandQuery = z.object({
  radiusKm: z.coerce.number().int().min(25).max(800).default(200),
});

/**
 * What buyers in the region are actually buying — the mirror of the buyer's
 * crop feed, so a farmer can decide what's worth listing.
 *
 * The totals stay aggregate. A farm can see who asked for a crop, so they
 * can list it or reply, but not the quantity or price of any one deal.
 */
farmerRouter.get(
  "/demand",
  asyncHandler(async (req, res) => {
    const { farm } = await requireFarm(req);
    const { radiusKm } = demandQuery.parse(req.query);

    const origin = resolveDistrict(farm.districtKey ?? farm.district);
    const nearby = origin ? districtsWithin(origin, radiusKm) : [];
    const nearbyNames = nearby.map((d) => d.name);
    const kmByDistrict = new Map(nearby.map((d) => [d.name, d.km]));

    const scope = origin ? { districtKey: { in: nearbyNames } } : {};

    const [requests, buyers, myCategories] = await Promise.all([
      // Every request raised by a buyer in range, whoever the seller was.
      prisma.cropRequest.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
          buyer: { ...scope, status: "ACTIVE" },
        },
        select: {
          quantityKg: true,
          estimatedValue: true,
          finalPricePerKg: true,
          status: true,
          crop: { select: { category: true, title: true, pricePerKg: true } },
          buyer: { select: { id: true, name: true, business: true, district: true } },
        },
      }),
      prisma.user.findMany({
        where: { role: "BUYER", status: "ACTIVE", ...scope },
        select: {
          id: true,
          name: true,
          business: true,
          district: true,
          districtKey: true,
          market: true,
          verification: true,
          _count: { select: { orders: true } },
        },
        take: 50,
      }),
      prisma.crop.findMany({ where: { farmId: farm.id }, select: { category: true } }),
    ]);

    // Roll requests up by category. Buyers are named so the farm can reply,
    // but not with the quantity or price of any one deal.
    const byCategory = new Map<
      string,
      { category: string; requests: number; totalKg: number; priceSum: number; priceN: number; accepted: number }
    >();
    const buyersByCategory = new Map<
      string,
      Map<string, { id: string; name: string; business: string | null; district: string | null }>
    >();
    for (const r of requests) {
      const key = r.crop.category;
      const row =
        byCategory.get(key) ??
        { category: key, requests: 0, totalKg: 0, priceSum: 0, priceN: 0, accepted: 0 };
      row.requests += 1;
      row.totalKg += r.quantityKg;
      const price = r.finalPricePerKg ?? r.crop.pricePerKg;
      row.priceSum += price;
      row.priceN += 1;
      if (r.status === "CONFIRMED" || r.status === "FARMER_ACCEPTED") row.accepted += 1;
      byCategory.set(key, row);
      const people = buyersByCategory.get(key) ?? new Map();
      people.set(r.buyer.id, {
        id: r.buyer.id,
        name: r.buyer.name,
        business: r.buyer.business,
        district: r.buyer.district,
      });
      buyersByCategory.set(key, people);
    }

    const mine = new Set(myCategories.map((c) => c.category));
    const trends = [...byCategory.values()]
      .map((t) => ({
        category: t.category,
        requests: t.requests,
        totalKg: t.totalKg,
        avgPricePerKg: t.priceN ? Math.round(t.priceSum / t.priceN) : null,
        acceptRate: t.requests ? Math.round((t.accepted / t.requests) * 100) : 0,
        /// True when this farm doesn't list anything in a category buyers want.
        gap: !mine.has(t.category),
        buyers: [...(buyersByCategory.get(t.category)?.values() ?? [])].slice(0, 5),
      }))
      .sort((a, b) => b.totalKg - a.totalKg);

    res.json({
      origin: origin?.name ?? null,
      radiusKm,
      districtsInRange: nearbyNames.length,
      trends,
      buyers: buyers
        .map((b) => ({
          id: b.id,
          name: b.name,
          business: b.business,
          district: b.district,
          market: b.market,
          verified: b.verification === "VERIFIED",
          orders: b._count.orders,
          distanceKm: b.districtKey ? (kmByDistrict.get(b.districtKey) ?? null) : null,
        }))
        .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)),
    });
  }),
);
