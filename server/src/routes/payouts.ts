import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { audit } from "../audit.js";
import { encrypt } from "../crypto.js";
import { requireAdmin, requireFarm } from "../session.js";
import { requirePermission } from "../permissions.js";
import { asyncHandler, HttpError } from "../http.js";
import { activeGateway, createLinkedAccount, modeForKey } from "../payments/razorpay.js";
import { overridePayout, payoutRules, releaseDuePayouts } from "../payouts.js";

export const payoutsRouter = Router();

/** IFSC is four letters, a zero, then six alphanumerics. */
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const STAGE_LABEL: Record<string, string> = {
  ADVANCE: "Advance on loading",
  BALANCE: "Balance after delivery",
};

// ---- Farmer ----------------------------------------------------------------

/** What I'm owed and when it lands. */
payoutsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { user } = await requireFarm(req);
    const [rows, rules, account] = await Promise.all([
      prisma.payout.findMany({
        where: { farmerId: user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { order: { select: { code: true, product: true, quantityKg: true } } },
      }),
      payoutRules(),
      prisma.linkedAccount.findUnique({ where: { userId: user.id } }),
    ]);

    const owed = rows
      .filter((p) => p.state === "HELD" || p.state === "RELEASED")
      .reduce((sum, p) => sum + p.amount, 0);
    const received = rows.filter((p) => p.state === "PAID").reduce((sum, p) => sum + p.amount, 0);

    res.json({
      // Never the account number, not even the last four — the farmer knows
      // their own bank, and this list is one XSS away from being someone else's.
      account: account ? { ready: !!account.activatedAt, addedAt: account.createdAt } : null,
      policy: rules.policy,
      advancePercent: rules.advancePercent,
      holdHours: rules.holdHours,
      owed,
      received,
      payouts: rows.map((p) => ({
        id: p.id,
        stage: p.stage,
        stageLabel: STAGE_LABEL[p.stage] ?? p.stage,
        state: p.state,
        amount: p.amount,
        releaseAfter: p.releaseAfter,
        releasedAt: p.releasedAt,
        paidAt: p.paidAt,
        note: p.note,
        failureReason: p.failureReason,
        order: p.order,
      })),
    });
  }),
);

const bankBody = z.object({
  accountNumber: z.string().trim().regex(/^[0-9]{6,20}$/, "Account number should be 6–20 digits"),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => IFSC.test(v), "That IFSC doesn't look right, e.g. SBIN0001234"),
  beneficiaryName: z.string().trim().min(3).max(80),
});

/**
 * Register a farmer for payouts. The bank details go straight to Razorpay and
 * are never stored here — we keep the account id it hands back and nothing else,
 * so a breach of our database leaks nobody's bank account.
 */
payoutsRouter.post(
  "/account",
  asyncHandler(async (req, res) => {
    const { user, farm } = await requireFarm(req);
    const body = bankBody.parse(req.body);

    const existing = await prisma.linkedAccount.findUnique({ where: { userId: user.id } });
    if (existing) throw new HttpError(409, "A payout account is already set up");

    const gateway = await activeGateway();
    const account = await createLinkedAccount(gateway, {
      email: user.email,
      phone: user.phone,
      legalName: farm.name,
      accountNumber: body.accountNumber,
      ifsc: body.ifsc,
      beneficiaryName: body.beneficiaryName,
    });

    const saved = await prisma.linkedAccount.create({
      data: {
        userId: user.id,
        routeAccountId: account.id,
        mode: modeForKey(gateway.keyId),
        // Razorpay activates asynchronously; a webhook or a retry flips this.
        activatedAt: account.status === "activated" ? new Date() : null,
      },
    });

    // Encrypted, and only so support can answer "which account did it go to?"
    // without asking the farmer to read their number down a phone line.
    await audit({
      actorId: user.id,
      action: "PAYOUT_ACCOUNT_ADDED",
      targetType: "LinkedAccount",
      targetId: saved.id,
      summary: `${farm.name} added a payout account`,
      metadata: { last4: encrypt(body.accountNumber.slice(-4)) },
    });

    res.status(201).json({ ready: !!saved.activatedAt, addedAt: saved.createdAt });
  }),
);

// ---- Admin / staff ---------------------------------------------------------

export const adminPayoutsRouter = Router();

const listQuery = z.object({
  state: z.enum(["HELD", "RELEASED", "PAID", "FAILED", "CANCELLED"]).optional(),
});

adminPayoutsRouter.get(
  "/payouts",
  asyncHandler(async (req, res) => {
    await requirePermission(req, "ORDERS_VIEW");
    const { state } = listQuery.parse(req.query);

    const rows = await prisma.payout.findMany({
      where: state ? { state } : {},
      orderBy: [{ state: "asc" }, { releaseAfter: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        farmer: {
          select: { id: true, name: true, verification: true, linkedAccount: true },
        },
        order: { select: { id: true, code: true, product: true, status: true, paidAt: true } },
      },
    });

    const rules = await payoutRules();
    res.json({
      ...rules,
      payouts: rows.map((p) => ({
        id: p.id,
        stage: p.stage,
        stageLabel: STAGE_LABEL[p.stage] ?? p.stage,
        state: p.state,
        amount: p.amount,
        policy: p.policy,
        releaseAfter: p.releaseAfter,
        releasedAt: p.releasedAt,
        paidAt: p.paidAt,
        note: p.note,
        failureReason: p.failureReason,
        farmer: {
          id: p.farmer.id,
          name: p.farmer.name,
          verified: p.farmer.verification === "VERIFIED",
          hasAccount: !!p.farmer.linkedAccount,
        },
        order: p.order,
      })),
    });
  }),
);

const overrideBody = z.object({
  action: z.enum(["release", "hold"]),
  note: z.string().trim().max(200).optional(),
});

/**
 * Let a payout go early, or stop one that's about to leave. Admin only: this is
 * moving money, and it's the lever someone would reach for under pressure from
 * whoever is shouting loudest.
 */
adminPayoutsRouter.post(
  "/payouts/:id/override",
  asyncHandler(async (req, res) => {
    const admin = await requireAdmin(req);
    const { action, note } = overrideBody.parse(req.body);
    const id = String(req.params.id);

    const payout = await prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new HttpError(404, "No such payout");
    if (payout.state !== "HELD") {
      throw new HttpError(409, `This payout is already ${payout.state.toLowerCase()}`);
    }

    await overridePayout(id, action, admin.id, note);
    res.json(await prisma.payout.findUnique({ where: { id } }));
  }),
);

/** Run the sweep now rather than waiting for the timer. */
adminPayoutsRouter.post(
  "/payouts/sweep",
  asyncHandler(async (req, res) => {
    const admin = await requireAdmin(req);
    const released = await releaseDuePayouts();
    await audit({
      actorId: admin.id,
      action: "PAYOUT_SWEEP_RUN",
      targetType: "Payout",
      targetId: null,
      summary: `Ran the payout sweep by hand — ${released} released`,
    });
    res.json({ released });
  }),
);
