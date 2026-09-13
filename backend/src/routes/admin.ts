import { Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword } from "../auth.js";
import { audit } from "../audit.js";
import {
  ADMIN_ONLY,
  DEFAULT_STAFF,
  GRANTABLE,
  PERMISSION_LABELS,
  effectivePermissions,
  requirePermission,
} from "../permissions.js";
import { FEE_SETTING_KEY, MAX_FEE_PERCENT, MIN_FEE_PERCENT, percentToBps } from "../fees.js";
import {
  ADVANCE_KEY,
  HOLD_KEY,
  MAX_ADVANCE_PERCENT,
  MAX_HOLD_HOURS,
  POLICY_KEY,
  isPolicy,
  parseAdvancePercent,
  parseHoldHours,
} from "../payouts.js";
import { currentUser, publicUser, requireAdmin, requireStaff } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";

export const adminRouter = Router();

const PERMISSION_VALUES = [...ADMIN_ONLY, ...GRANTABLE] as [string, ...string[]];

/** Who am I and what can I do — drives which nav items the console renders. */
adminRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await requireStaff(req);
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: effectivePermissions(user),
      isAdmin: user.role === "ADMIN",
    });
  }),
);

/** The permission catalogue, so the console never hardcodes this list. */
adminRouter.get(
  "/permissions",
  asyncHandler(async (req, res) => {
    await requireStaff(req);
    res.json({
      grantable: GRANTABLE.map((p) => ({ key: p, label: PERMISSION_LABELS[p] })),
      adminOnly: ADMIN_ONLY.map((p) => ({ key: p, label: PERMISSION_LABELS[p] })),
      defaults: DEFAULT_STAFF,
    });
  }),
);

// ─── Staff management (admin only) ─────────────────────────────

adminRouter.get(
  "/staff",
  asyncHandler(async (req, res) => {
    await requirePermission(req, "ADMIN_STAFF_MANAGE");
    const staff = await prisma.user.findMany({
      where: { role: { in: ["STAFF", "ADMIN"] } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        permissions: true,
        createdAt: true,
        _count: {
          select: {
            ticketsAssigned: { where: { status: { in: ["ASSIGNED", "IN_PROGRESS", "WAITING_ON_USER"] } } },
          },
        },
      },
    });
    res.json(staff.map((s) => ({ ...s, openTickets: s._count.ticketsAssigned })));
  }),
);

const createStaffBody = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().min(8),
  password: z.string().min(8, "Password must be at least 8 characters"),
  permissions: z.array(z.enum(PERMISSION_VALUES)).default([]),
});

adminRouter.post(
  "/staff",
  asyncHandler(async (req, res) => {
    const admin = await requireAdmin(req);
    const body = createStaffBody.parse(req.body);

    const illegal = body.permissions.filter((p) => (ADMIN_ONLY as string[]).includes(p));
    if (illegal.length) {
      throw new HttpError(403, `These stay with the admin: ${illegal.join(", ")}`);
    }

    try {
      const staff = await prisma.user.create({
        data: {
          name: body.name,
          email: body.email,
          phone: body.phone,
          passwordHash: await hashPassword(body.password),
          role: "STAFF",
          avatarKey: "buyer",
          permissions: (body.permissions.length ? body.permissions : DEFAULT_STAFF) as never,
        },
      });

      await audit({
        actorId: admin.id,
        action: "STAFF_CREATED",
        targetType: "User",
        targetId: staff.id,
        summary: `Created staff account ${staff.email}`,
        metadata: { permissions: staff.permissions },
      });

      res.status(201).json(publicUser(staff));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new HttpError(409, "An account with this email already exists");
      }
      throw err;
    }
  }),
);

const permsBody = z.object({ permissions: z.array(z.enum(PERMISSION_VALUES)) });

adminRouter.put(
  "/staff/:id/permissions",
  asyncHandler(async (req, res) => {
    const admin = await requireAdmin(req);
    const { permissions } = permsBody.parse(req.body);

    const illegal = permissions.filter((p) => (ADMIN_ONLY as string[]).includes(p));
    if (illegal.length) {
      throw new HttpError(
        403,
        `${illegal.map((p) => PERMISSION_LABELS[p as keyof typeof PERMISSION_LABELS]).join(", ")} — admin only, can't be delegated`,
      );
    }

    const target = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
    if (!target) throw new HttpError(404, "Account not found");
    if (target.role === "ADMIN") throw new HttpError(400, "Admins already hold every permission");
    if (target.role !== "STAFF") throw new HttpError(400, "That isn't a staff account");

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { permissions: permissions as never },
      select: { id: true, name: true, email: true, permissions: true },
    });

    await audit({
      actorId: admin.id,
      action: "PERMISSIONS_CHANGED",
      targetType: "User",
      targetId: target.id,
      summary: `Updated permissions for ${target.email}`,
      metadata: { before: target.permissions, after: permissions },
    });

    res.json(updated);
  }),
);

adminRouter.delete(
  "/staff/:id",
  asyncHandler(async (req, res) => {
    const admin = await requireAdmin(req);
    const target = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
    if (!target) throw new HttpError(404, "Account not found");
    if (target.role === "ADMIN") throw new HttpError(403, "Admin accounts can't be removed here");
    if (target.id === admin.id) throw new HttpError(400, "You can't remove yourself");

    // Hand their live tickets back to the queue rather than orphaning them.
    const reopened = await prisma.ticket.updateMany({
      where: { assignedToId: target.id, status: { in: ["ASSIGNED", "IN_PROGRESS", "WAITING_ON_USER"] } },
      data: { assignedToId: null, assignedAt: null, status: "OPEN" },
    });

    await prisma.user.update({
      where: { id: target.id },
      data: {
        status: "BLOCKED",
        statusReason: "Staff account removed",
        statusChangedAt: new Date(),
        statusChangedById: admin.id,
        permissions: [],
      },
    });

    await audit({
      actorId: admin.id,
      action: "STAFF_REMOVED",
      targetType: "User",
      targetId: target.id,
      summary: `Removed staff account ${target.email}`,
      metadata: { ticketsReturnedToQueue: reopened.count },
    });

    res.json({ removed: true, ticketsReturnedToQueue: reopened.count });
  }),
);

// ─── Runtime settings ──────────────────────────────────────────

adminRouter.get(
  "/settings",
  asyncHandler(async (req, res) => {
    await requireStaff(req);
    res.json(await prisma.appSetting.findMany({ orderBy: { key: "asc" } }));
  }),
);

const settingBody = z.object({ value: z.string().trim().min(1).max(200) });

adminRouter.put(
  "/settings/:key",
  asyncHandler(async (req, res) => {
    const key = String(req.params.key);
    // Support contacts are delegable — that's the point of CONFIG_WRITE. How
    // much the platform takes and when farmers get paid are not: they're the
    // same class of decision as switching which Razorpay account takes the
    // money, so they stay with the admin and can't be granted away.
    const MONEY_KEYS = [FEE_SETTING_KEY, POLICY_KEY, ADVANCE_KEY, HOLD_KEY];
    const actor = MONEY_KEYS.includes(key)
      ? await requireAdmin(req)
      : await requirePermission(req, "CONFIG_WRITE");
    const { value } = settingBody.parse(req.body);

    const existing = await prisma.appSetting.findUnique({ where: { key } });
    if (!existing) throw new HttpError(404, "No such setting");

    if (key === "support_email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      throw new HttpError(400, "That isn't a valid email address");
    }
    if (key === "support_phone" && !/^[+0-9 ()-]{8,20}$/.test(value)) {
      throw new HttpError(400, "That isn't a valid phone number");
    }
    // The floor is a business rule, not a UI nicety — reject it here so it
    // holds however the setting is written.
    if (key === FEE_SETTING_KEY && percentToBps(value) === null) {
      throw new HttpError(
        400,
        `The platform fee must be a number between ${MIN_FEE_PERCENT}% and ${MAX_FEE_PERCENT}%`,
      );
    }
    if (key === POLICY_KEY && !isPolicy(value)) {
      throw new HttpError(400, "Payout policy must be SPLIT_ON_LOAD or AFTER_DELIVERY");
    }
    if (key === ADVANCE_KEY && parseAdvancePercent(value) === null) {
      throw new HttpError(
        400,
        `The advance must be a whole number between 0 and ${MAX_ADVANCE_PERCENT}%`,
      );
    }
    if (key === HOLD_KEY && parseHoldHours(value) === null) {
      throw new HttpError(
        400,
        `The hold must be a whole number of hours between 0 and ${MAX_HOLD_HOURS}`,
      );
    }

    const updated = await prisma.appSetting.update({
      where: { key },
      data: { value, updatedById: actor.id },
    });

    await audit({
      actorId: actor.id,
      action: "SETTING_CHANGED",
      targetType: "AppSetting",
      targetId: key,
      summary: `${existing.label} changed`,
      metadata: { before: existing.value, after: value },
    });

    res.json(updated);
  }),
);

// ─── App releases (admin only) ─────────────────────────────────

adminRouter.get(
  "/releases",
  asyncHandler(async (req, res) => {
    await requireStaff(req);
    res.json(await prisma.appRelease.findMany({ orderBy: [{ app: "asc" }, { platform: "asc" }] }));
  }),
);

const SEMVER = /^\d+\.\d+\.\d+$/;

const releaseBody = z.object({
  app: z.enum(["BUYER", "PARTNER"]),
  platform: z.enum(["ANDROID", "IOS"]),
  latestVersion: z.string().regex(SEMVER, "Use a version like 1.4.0"),
  minSupportedVersion: z.string().regex(SEMVER, "Use a version like 1.2.0"),
  releaseNotes: z.string().trim().max(500).optional(),
  storeUrl: z.string().trim().url().optional(),
  mandatory: z.boolean().default(false),
});

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

adminRouter.put(
  "/releases",
  asyncHandler(async (req, res) => {
    const admin = await requirePermission(req, "ADMIN_APP_RELEASE");
    const body = releaseBody.parse(req.body);

    if (compareVersions(body.minSupportedVersion, body.latestVersion) > 0) {
      throw new HttpError(400, "The minimum supported version can't be newer than the latest version");
    }

    const release = await prisma.appRelease.upsert({
      where: { app_platform: { app: body.app, platform: body.platform } },
      create: { ...body, updatedById: admin.id },
      update: { ...body, updatedById: admin.id },
    });

    await audit({
      actorId: admin.id,
      action: "APP_RELEASE_PUBLISHED",
      targetType: "AppRelease",
      targetId: release.id,
      summary: `${body.app} ${body.platform} → ${body.latestVersion}${body.mandatory ? " (forced)" : ""}, minimum ${body.minSupportedVersion}`,
      metadata: { ...body },
    });

    res.json(release);
  }),
);

// ─── Audit log (admin only) ────────────────────────────────────

adminRouter.get(
  "/audit",
  asyncHandler(async (req, res) => {
    await requirePermission(req, "ADMIN_AUDIT_VIEW");
    const limit = z.coerce.number().int().min(1).max(200).default(100).parse(req.query.limit ?? 100);
    const entries = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { id: true, name: true, role: true } } },
    });
    res.json(entries);
  }),
);

// ─── Dashboard ─────────────────────────────────────────────────

adminRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    await requireStaff(req);
    const [users, pendingKyc, blocked, openTickets, unassigned, orders] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: true }),
      prisma.user.count({ where: { verification: "PENDING" } }),
      prisma.user.count({ where: { status: { in: ["BLOCKED", "SUSPENDED"] } } }),
      prisma.ticket.count({ where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } } }),
      prisma.ticket.count({ where: { assignedToId: null, status: "OPEN" } }),
      prisma.order.aggregate({ _count: true, _sum: { value: true } }),
    ]);

    res.json({
      users: Object.fromEntries(users.map((u) => [u.role, u._count])),
      pendingKyc,
      blocked,
      openTickets,
      unassignedTickets: unassigned,
      orderCount: orders._count,
      gmv: orders._sum.value ?? 0,
    });
  }),
);
