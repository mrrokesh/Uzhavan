import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { currentUser, publicUser, requireRole } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";
import { resolveDistrict } from "../data/districts.js";

export const meRouter = Router();

meRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const [follows, saves] = await Promise.all([
      prisma.follow.findMany({ where: { userId: user.id } }),
      prisma.savedCrop.findMany({ where: { userId: user.id } }),
    ]);
    res.json({
      ...publicUser(user),
      following: follows.map((f) => f.cropId),
      saved: saves.map((s) => s.cropId),
    });
  }),
);

const profileBody = z.object({
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().min(8).optional(),
  business: z.string().trim().min(2).optional(),
  district: z.string().trim().min(2).optional(),
  warehouse: z.string().trim().min(2).optional(),
  market: z.string().trim().min(2).optional(),
});

meRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const body = profileBody.parse(req.body);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...body,
        ...(body.district
          ? {
              warehouseAddress: `${body.district}, Tamil Nadu`,
              districtKey: resolveDistrict(body.district)?.name ?? null,
            }
          : {}),
      },
    });
    res.json(publicUser(updated));
  }),
);

async function assertCrop(cropId: string) {
  const crop = await prisma.crop.findUnique({ where: { id: cropId } });
  if (!crop) throw new HttpError(404, "Crop not found");
}

meRouter.put(
  "/follows/:cropId",
  asyncHandler(async (req, res) => {
    const user = await requireRole(req, "BUYER");
    const cropId = String(req.params.cropId);
    await assertCrop(cropId);
    await prisma.follow.upsert({
      where: { userId_cropId: { userId: user.id, cropId } },
      create: { userId: user.id, cropId },
      update: {},
    });
    const rows = await prisma.follow.findMany({ where: { userId: user.id } });
    res.json({ following: rows.map((f) => f.cropId) });
  }),
);

meRouter.delete(
  "/follows/:cropId",
  asyncHandler(async (req, res) => {
    const user = await requireRole(req, "BUYER");
    await prisma.follow.deleteMany({
      where: { userId: user.id, cropId: String(req.params.cropId) },
    });
    const rows = await prisma.follow.findMany({ where: { userId: user.id } });
    res.json({ following: rows.map((f) => f.cropId) });
  }),
);

meRouter.put(
  "/saved/:cropId",
  asyncHandler(async (req, res) => {
    const user = await requireRole(req, "BUYER");
    const cropId = String(req.params.cropId);
    await assertCrop(cropId);
    await prisma.savedCrop.upsert({
      where: { userId_cropId: { userId: user.id, cropId } },
      create: { userId: user.id, cropId },
      update: {},
    });
    const rows = await prisma.savedCrop.findMany({ where: { userId: user.id } });
    res.json({ saved: rows.map((s) => s.cropId) });
  }),
);

meRouter.delete(
  "/saved/:cropId",
  asyncHandler(async (req, res) => {
    const user = await requireRole(req, "BUYER");
    await prisma.savedCrop.deleteMany({
      where: { userId: user.id, cropId: String(req.params.cropId) },
    });
    const rows = await prisma.savedCrop.findMany({ where: { userId: user.id } });
    res.json({ saved: rows.map((s) => s.cropId) });
  }),
);
