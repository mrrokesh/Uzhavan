import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { currentUser } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";
import {
  DISTRICT_NAMES,
  distanceKm,
  districtsWithin,
  resolveDistrict,
} from "../data/districts.js";

export const cropsRouter = Router();

const withFarm = { farm: { include: { owner: { select: { verification: true } } } } } as const;

/** Districts the app offers in its filter dropdown. */
cropsRouter.get(
  "/districts",
  asyncHandler(async (_req, res) => {
    res.json(DISTRICT_NAMES);
  }),
);

const listQuery = z.object({
  status: z.enum(["upcoming", "ready"]).optional(),
  following: z.coerce.boolean().optional(),
  q: z.string().trim().optional(),
  farmId: z.string().optional(),
  category: z.string().trim().optional(),
  /** Search origin. Defaults to the signed-in buyer's own district. */
  district: z.string().trim().optional(),
  /** Only farms within this many road-km of the origin. */
  radiusKm: z.coerce.number().int().min(10).max(800).optional(),
  /** Only farms whose owner passed KYC. */
  verifiedOnly: z.coerce.boolean().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(1).optional(),
  sort: z.enum(["newest", "distance", "priceLow", "priceHigh"]).default("newest"),
});

cropsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const p = listQuery.parse(req.query);
    const user = await currentUser(req);

    let followedIds: string[] | undefined;
    if (p.following) {
      const rows = await prisma.follow.findMany({ where: { userId: user.id } });
      followedIds = rows.map((r) => r.cropId);
    }

    // Where are we searching from? An explicit district wins, otherwise the
    // buyer's own — so "nearby" works before they touch a filter.
    const origin = resolveDistrict(p.district ?? user.district);
    const nearbyNames =
      origin && p.radiusKm ? districtsWithin(origin, p.radiusKm).map((d) => d.name) : null;

    const crops = await prisma.crop.findMany({
      where: {
        listed: true,
        ...(p.status ? { status: p.status } : {}),
        ...(p.farmId ? { farmId: p.farmId } : {}),
        ...(followedIds ? { id: { in: followedIds } } : {}),
        ...(p.category ? { category: { contains: p.category, mode: "insensitive" } } : {}),
        ...(p.minPrice !== undefined || p.maxPrice !== undefined
          ? { pricePerKg: { ...(p.minPrice !== undefined ? { gte: p.minPrice } : {}), ...(p.maxPrice !== undefined ? { lte: p.maxPrice } : {}) } }
          : {}),
        // A blocked farmer's crops are already unlisted, but this also hides
        // listings from anyone suspended mid-session.
        farm: {
          owner: {
            status: "ACTIVE",
            ...(p.verifiedOnly ? { verification: "VERIFIED" } : {}),
          },
          ...(nearbyNames ? { districtKey: { in: nearbyNames } } : {}),
        },
        ...(p.q
          ? {
              OR: [
                { title: { contains: p.q, mode: "insensitive" } },
                { category: { contains: p.q, mode: "insensitive" } },
                { farm: { district: { contains: p.q, mode: "insensitive" } } },
                { farm: { name: { contains: p.q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: withFarm,
      orderBy:
        p.sort === "priceLow"
          ? { pricePerKg: "asc" }
          : p.sort === "priceHigh"
            ? { pricePerKg: "desc" }
            : { createdAt: "desc" },
    });

    // Attach distance and the seller's verified flag, then sort by distance
    // here — it depends on the district table, not a column.
    const decorated = crops.map((c) => {
      const farmDistrict = resolveDistrict(c.farm.districtKey ?? c.farm.district);
      return {
        ...c,
        farm: { ...c.farm, owner: undefined },
        sellerVerified: c.farm.owner.verification === "VERIFIED",
        distanceKm: origin && farmDistrict ? distanceKm(origin, farmDistrict) : null,
      };
    });

    if (p.sort === "distance") {
      decorated.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    }

    res.json({
      origin: origin?.name ?? null,
      radiusKm: p.radiusKm ?? null,
      count: decorated.length,
      crops: decorated,
    });
  }),
);

cropsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const crop = await prisma.crop.findUnique({
      where: { id: String(req.params.id) },
      include: withFarm,
    });
    if (!crop) throw new HttpError(404, "Crop not found");

    const origin = resolveDistrict(user.district);
    const farmDistrict = resolveDistrict(crop.farm.districtKey ?? crop.farm.district);

    res.json({
      ...crop,
      farm: { ...crop.farm, owner: undefined },
      sellerVerified: crop.farm.owner.verification === "VERIFIED",
      distanceKm: origin && farmDistrict ? distanceKm(origin, farmDistrict) : null,
    });
  }),
);
