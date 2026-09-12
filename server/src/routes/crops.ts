import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { currentUser } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";

export const cropsRouter = Router();

const withFarm = { farm: true } as const;

const listQuery = z.object({
  status: z.enum(["upcoming", "ready"]).optional(),
  following: z.coerce.boolean().optional(),
  q: z.string().trim().optional(),
  farmId: z.string().optional(),
});

cropsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { status, following, q, farmId } = listQuery.parse(req.query);

    let followedIds: string[] | undefined;
    if (following) {
      const user = await currentUser(req);
      const rows = await prisma.follow.findMany({ where: { userId: user.id } });
      followedIds = rows.map((r) => r.cropId);
    }

    const crops = await prisma.crop.findMany({
      where: {
        listed: true,
        ...(status ? { status } : {}),
        ...(farmId ? { farmId } : {}),
        ...(followedIds ? { id: { in: followedIds } } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
                { farm: { district: { contains: q, mode: "insensitive" } } },
                { farm: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: withFarm,
      orderBy: { createdAt: "desc" },
    });
    res.json(crops);
  }),
);

cropsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const crop = await prisma.crop.findUnique({
      where: { id: String(req.params.id) },
      include: withFarm,
    });
    if (!crop) throw new HttpError(404, "Crop not found");
    res.json(crop);
  }),
);
