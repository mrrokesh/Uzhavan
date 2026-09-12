import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { audit } from "../audit.js";
import { requirePermission } from "../permissions.js";
import { publicUser, requireStaff } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";

export const moderationRouter = Router();

const listQuery = z.object({
  role: z.enum(["BUYER", "FARMER", "DRIVER", "STAFF", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "BLOCKED"]).optional(),
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Account list for the admin console. */
moderationRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    await requireStaff(req);
    const { role, status, q, limit } = listQuery.parse(req.query);

    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { business: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        farm: { select: { name: true } },
        driver: { select: { id: true, online: true, trips: true } },
        _count: { select: { orders: true, requests: true } },
      },
    });

    res.json(
      users.map((u) => ({
        ...publicUser(u),
        farmName: u.farm?.name ?? null,
        driver: u.driver,
        orderCount: u._count.orders,
        requestCount: u._count.requests,
      })),
    );
  }),
);

moderationRouter.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    await requireStaff(req);
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      include: {
        farm: true,
        driver: { include: { truck: true } },
        statusChangedBy: { select: { id: true, name: true, role: true } },
        verificationReviewedBy: { select: { id: true, name: true } },
        documents: { select: { id: true, type: true, filename: true, mimeType: true } },
      },
    });
    if (!user) throw new HttpError(404, "Account not found");
    res.json({
      ...publicUser(user),
      farm: user.farm,
      driver: user.driver,
      statusChangedBy: user.statusChangedBy,
      verificationReviewedBy: user.verificationReviewedBy,
      documents: user.documents,
    });
  }),
);

const statusBody = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "BLOCKED"]),
  reason: z.string().trim().min(3, "Give a reason").max(300).optional(),
});

/**
 * Block, suspend, or restore an account. Used when a seller takes an order and
 * never delivers, or a driver abandons a trip. The reason is shown to the user
 * on their next request, so it should read like something a person wrote.
 */
moderationRouter.post(
  "/users/:id/status",
  asyncHandler(async (req, res) => {
    const staff = await requirePermission(req, "USERS_MODERATE");
    const { status, reason } = statusBody.parse(req.body);

    const target = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
    if (!target) throw new HttpError(404, "Account not found");

    if (target.id === staff.id) throw new HttpError(400, "You can't change your own access");
    if (target.role === "ADMIN") throw new HttpError(403, "Admin accounts can't be blocked");
    // Staff moderate users, not each other — that's an admin decision.
    if (target.role === "STAFF" && staff.role !== "ADMIN") {
      throw new HttpError(403, "Only an admin can change a staff account");
    }
    if (status !== "ACTIVE" && !reason) {
      throw new HttpError(400, "Give a reason when blocking or suspending");
    }
    if (target.status === status) {
      throw new HttpError(409, `This account is already ${status.toLowerCase()}`);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: target.id },
        data: {
          status,
          statusReason: status === "ACTIVE" ? null : reason,
          statusChangedAt: new Date(),
          statusChangedById: staff.id,
        },
      });

      // A blocked driver must not keep receiving jobs, and a blocked farmer's
      // listings should come off the marketplace immediately.
      if (status !== "ACTIVE") {
        if (u.role === "DRIVER") {
          await tx.driver.updateMany({ where: { userId: u.id }, data: { online: false } });
        }
        if (u.role === "FARMER") {
          const farm = await tx.farm.findUnique({ where: { ownerId: u.id } });
          if (farm) await tx.crop.updateMany({ where: { farmId: farm.id }, data: { listed: false } });
        }
      }

      return u;
    });

    await audit({
      actorId: staff.id,
      action: status === "ACTIVE" ? "ACCOUNT_RESTORED" : `ACCOUNT_${status}`,
      targetType: "User",
      targetId: target.id,
      summary:
        status === "ACTIVE"
          ? `Restored access for ${target.email}`
          : `${status === "BLOCKED" ? "Blocked" : "Suspended"} ${target.email} — ${reason}`,
      metadata: { role: target.role, previousStatus: target.status, reason: reason ?? null },
    });

    res.json(publicUser(updated));
  }),
);
