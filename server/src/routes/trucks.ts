import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireRole } from "../session.js";
import { asyncHandler } from "../http.js";

export const trucksRouter = Router();

const listQuery = z.object({
  /** Each truck is flagged `tooSmall` if it cannot carry this load. */
  loadKg: z.coerce.number().int().positive().optional(),
});

/**
 * Trucks a buyer can book: every online, un-busy driver. Trucks too small for
 * the load stay in the list (disabled, with a reason) — a product rule.
 */
trucksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    await requireRole(req, "BUYER");
    const { loadKg } = listQuery.parse(req.query);

    const trucks = await prisma.truck.findMany({
      where: {
        driver: {
          online: true,
          bookings: {
            none: {
              status: { in: ["PAID", "ACCEPTED", "ARRIVED_PICKUP", "LOADED", "IN_TRANSIT"] },
            },
          },
        },
      },
      include: { driver: true },
      orderBy: { capacityKg: "asc" },
    });

    res.json(
      trucks.map((t) => {
        const tooSmall = loadKg ? t.capacityKg < loadKg : false;
        return {
          ...t,
          tooSmall,
          reason: tooSmall ? `Not enough for ${loadKg?.toLocaleString("en-IN")} kg` : null,
          recommended:
            !tooSmall && loadKg ? t.capacityKg >= loadKg && t.capacityKg < loadKg * 1.6 : false,
        };
      }),
    );
  }),
);
