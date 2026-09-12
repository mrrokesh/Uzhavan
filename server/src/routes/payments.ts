import { Router, raw } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { audit } from "../audit.js";
import { currentUser } from "../session.js";
import { asyncHandler, HttpError } from "../http.js";
import {
  activeGateway,
  createOrder,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "../payments/razorpay.js";

export const paymentsRouter = Router();

/** Price of Uzhavan Plus, in paise. ₹499 for 12 months. */
const PLUS_PAISE = 49900;
const PLUS_MONTHS = 12;

/** What the app needs to open Razorpay checkout. Never returns the secret. */
paymentsRouter.get(
  "/config",
  asyncHandler(async (req, res) => {
    await currentUser(req);
    const gateway = await prisma.paymentGateway.findFirst({ where: { active: true } });
    res.json({
      enabled: !!gateway,
      keyId: gateway?.keyId ?? null,
      mode: gateway?.mode ?? null,
      plus: { amountPaise: PLUS_PAISE, months: PLUS_MONTHS },
    });
  }),
);

const startBody = z.object({
  purpose: z.enum(["TRUCK_BOOKING", "PLUS_SUBSCRIPTION"]),
  /** Booking id when paying for a trip. */
  referenceId: z.string().optional(),
});

/**
 * Create a Razorpay order. The amount is decided here, never sent by the
 * client — otherwise anyone could pay ₹1 for a ₹4,000 trip.
 */
paymentsRouter.post(
  "/start",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const { purpose, referenceId } = startBody.parse(req.body);
    const gateway = await activeGateway();

    let amountPaise: number;
    if (purpose === "TRUCK_BOOKING") {
      if (!referenceId) throw new HttpError(400, "Which booking is this for?");
      const booking = await prisma.truckBooking.findUnique({
        where: { id: referenceId },
        include: { order: true },
      });
      if (!booking || booking.order.buyerId !== user.id) {
        throw new HttpError(404, "Booking not found");
      }
      if (booking.status !== "PENDING") throw new HttpError(409, "This booking is already paid");
      amountPaise = booking.total * 100;
    } else {
      if (user.plusUntil && user.plusUntil > new Date()) {
        throw new HttpError(409, "You already have Uzhavan Plus");
      }
      amountPaise = PLUS_PAISE;
    }

    const receipt = `${purpose === "TRUCK_BOOKING" ? "trip" : "plus"}_${Date.now()}`;
    const order = await createOrder(gateway, amountPaise, receipt, {
      userId: user.id,
      purpose,
      ...(referenceId ? { referenceId } : {}),
    });

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        purpose,
        amountPaise,
        gatewayId: gateway.row.id,
        mode: gateway.row.mode,
        razorpayOrderId: order.id,
        referenceId,
      },
    });

    res.status(201).json({
      paymentId: payment.id,
      orderId: order.id,
      amountPaise,
      currency: "INR",
      keyId: gateway.keyId,
      mode: gateway.row.mode,
    });
  }),
);

const confirmBody = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  signature: z.string().min(1),
});

/**
 * Called by the app after checkout succeeds. The signature is what makes this
 * trustworthy — without it a client could simply claim it paid.
 */
paymentsRouter.post(
  "/confirm",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const body = confirmBody.parse(req.body);
    const gateway = await activeGateway();

    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId: body.razorpayOrderId },
    });
    if (!payment || payment.userId !== user.id) throw new HttpError(404, "Payment not found");
    if (payment.status === "PAID") return res.json({ status: "PAID", alreadyRecorded: true });

    const valid = verifyCheckoutSignature(
      gateway,
      body.razorpayOrderId,
      body.razorpayPaymentId,
      body.signature,
    );
    if (!valid) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", failureReason: "Signature mismatch" },
      });
      throw new HttpError(400, "That payment couldn't be verified");
    }

    await applyPayment(payment.id, body.razorpayPaymentId);
    res.json({ status: "PAID" });
  }),
);

/**
 * Move whatever the payment was for. Idempotent, because the webhook and the
 * client callback both land here and either may arrive first.
 */
async function applyPayment(paymentId: string, razorpayPaymentId: string) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status === "PAID") return;

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", razorpayPaymentId, paidAt: new Date() },
    });

    if (payment.purpose === "PLUS_SUBSCRIPTION") {
      const user = await tx.user.findUniqueOrThrow({ where: { id: payment.userId } });
      // Extend from whichever is later, so renewing early doesn't lose time.
      const from = user.plusUntil && user.plusUntil > new Date() ? user.plusUntil : new Date();
      const until = new Date(from);
      until.setMonth(until.getMonth() + PLUS_MONTHS);
      await tx.user.update({ where: { id: user.id }, data: { plusUntil: until } });
    }

    if (payment.purpose === "TRUCK_BOOKING" && payment.referenceId) {
      const booking = await tx.truckBooking.findUnique({ where: { id: payment.referenceId } });
      if (booking && booking.status === "PENDING") {
        await tx.truckBooking.update({
          where: { id: booking.id },
          data: { status: "PAID", paidAt: new Date() },
        });
        await tx.bookingEvent.create({
          data: {
            bookingId: booking.id,
            status: "PAID",
            note: "Payment received · waiting for a driver",
          },
        });
      }
    }
  });
}

/** My payment history. */
paymentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = await currentUser(req);
    const rows = await prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        purpose: true,
        status: true,
        amountPaise: true,
        mode: true,
        referenceId: true,
        createdAt: true,
        paidAt: true,
      },
    });
    res.json(rows);
  }),
);

/**
 * Razorpay webhook. Mounted with a raw body parser because the signature is
 * over the exact bytes — re-serialising parsed JSON would change them and
 * every signature would fail.
 */
export const webhookRouter = Router();

webhookRouter.post(
  "/razorpay",
  raw({ type: "application/json", limit: "1mb" }),
  asyncHandler(async (req, res) => {
    const signature = req.header("x-razorpay-signature");
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    if (!signature || !rawBody) return res.status(400).json({ error: "Bad webhook" });

    const gateway = await activeGateway();
    if (!gateway.webhookSecret) {
      console.error("Webhook received but no webhook secret is configured");
      return res.status(503).json({ error: "Webhooks not configured" });
    }
    if (!verifyWebhookSignature(gateway.webhookSecret, rawBody, signature)) {
      // Never reveal why. An attacker probing signatures learns nothing.
      return res.status(400).json({ error: "Bad webhook" });
    }

    const event = JSON.parse(rawBody) as {
      event: string;
      payload?: { payment?: { entity?: { id: string; order_id: string; error_description?: string } } };
    };
    const entity = event.payload?.payment?.entity;

    if (entity?.order_id) {
      const payment = await prisma.payment.findUnique({
        where: { razorpayOrderId: entity.order_id },
      });
      if (payment) {
        if (event.event === "payment.captured") {
          await applyPayment(payment.id, entity.id);
        } else if (event.event === "payment.failed" && payment.status !== "PAID") {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "FAILED",
              razorpayPaymentId: entity.id,
              failureReason: entity.error_description ?? "Payment failed",
            },
          });
        }
      }
    }

    // Always 200 once verified — Razorpay retries anything else, and a retry
    // storm over an event we don't handle helps nobody.
    res.json({ ok: true });
  }),
);

// ---- Admin: manage gateways ----------------------------------

export const gatewayRouter = Router();

const gatewayBody = z.object({
  label: z.string().trim().min(2, "Give this account a name"),
  keyId: z.string().trim().min(8, "Enter the Razorpay Key ID"),
  keySecret: z.string().trim().min(8, "Enter the Key Secret"),
  webhookSecret: z.string().trim().optional(),
  activate: z.boolean().default(true),
});

export function registerGatewayRoutes(
  router: Router,
  deps: {
    requireAdmin: (req: Parameters<typeof currentUser>[0]) => Promise<{ id: string }>;
    encrypt: (v: string) => string;
    modeForKey: (k: string) => "TEST" | "LIVE";
  },
) {
  router.get(
    "/gateways",
    asyncHandler(async (req, res) => {
      await deps.requireAdmin(req);
      const rows = await prisma.paymentGateway.findMany({ orderBy: { createdAt: "desc" } });
      // Secrets never leave the server, not even to an admin.
      res.json(
        rows.map((g) => ({
          id: g.id,
          label: g.label,
          mode: g.mode,
          keyId: g.keyId,
          hasWebhookSecret: !!g.webhookSecretEnc,
          active: g.active,
          createdAt: g.createdAt,
        })),
      );
    }),
  );

  router.post(
    "/gateways",
    asyncHandler(async (req, res) => {
      const admin = await deps.requireAdmin(req);
      const body = gatewayBody.parse(req.body);
      const mode = deps.modeForKey(body.keyId);

      const gateway = await prisma.$transaction(async (tx) => {
        if (body.activate) {
          await tx.paymentGateway.updateMany({ where: { active: true }, data: { active: false } });
        }
        return tx.paymentGateway.create({
          data: {
            label: body.label,
            keyId: body.keyId,
            keySecretEnc: deps.encrypt(body.keySecret),
            webhookSecretEnc: body.webhookSecret ? deps.encrypt(body.webhookSecret) : null,
            mode,
            active: body.activate,
          },
        });
      });

      await audit({
        actorId: admin.id,
        action: "PAYMENT_GATEWAY_ADDED",
        targetType: "PaymentGateway",
        targetId: gateway.id,
        summary: `Added ${mode} Razorpay account "${body.label}"${body.activate ? " and made it active" : ""}`,
        metadata: { keyId: body.keyId, mode },
      });

      res.status(201).json({ id: gateway.id, label: gateway.label, mode, active: gateway.active });
    }),
  );

  const patchBody = z.object({
    label: z.string().trim().min(2).optional(),
    webhookSecret: z.string().trim().min(8).optional(),
  });

  /**
   * Update a stored account. Mainly for attaching a webhook secret after the
   * fact — without one, Razorpay's callbacks can't be verified and payment
   * confirmation falls back to the client callback alone.
   */
  router.patch(
    "/gateways/:id",
    asyncHandler(async (req, res) => {
      const admin = await deps.requireAdmin(req);
      const id = String(req.params.id);
      const target = await prisma.paymentGateway.findUnique({ where: { id } });
      if (!target) throw new HttpError(404, "No such account");
      const b = patchBody.parse(req.body);

      const updated = await prisma.paymentGateway.update({
        where: { id },
        data: {
          ...(b.label ? { label: b.label } : {}),
          ...(b.webhookSecret ? { webhookSecretEnc: deps.encrypt(b.webhookSecret) } : {}),
        },
      });

      await audit({
        actorId: admin.id,
        action: "PAYMENT_GATEWAY_UPDATED",
        targetType: "PaymentGateway",
        targetId: id,
        summary: b.webhookSecret
          ? `Set a webhook secret on "${updated.label}"`
          : `Renamed a Razorpay account to "${updated.label}"`,
      });

      res.json({ id: updated.id, label: updated.label, hasWebhookSecret: !!updated.webhookSecretEnc });
    }),
  );

  router.post(
    "/gateways/:id/activate",
    asyncHandler(async (req, res) => {
      const admin = await deps.requireAdmin(req);
      const id = String(req.params.id);
      const target = await prisma.paymentGateway.findUnique({ where: { id } });
      if (!target) throw new HttpError(404, "No such account");

      await prisma.$transaction([
        prisma.paymentGateway.updateMany({ where: { active: true }, data: { active: false } }),
        prisma.paymentGateway.update({ where: { id }, data: { active: true } }),
      ]);

      await audit({
        actorId: admin.id,
        action: "PAYMENT_GATEWAY_SWITCHED",
        targetType: "PaymentGateway",
        targetId: id,
        summary: `Switched payments to "${target.label}" (${target.mode})`,
      });

      res.json({ activated: id });
    }),
  );

  router.delete(
    "/gateways/:id",
    asyncHandler(async (req, res) => {
      const admin = await deps.requireAdmin(req);
      const id = String(req.params.id);
      const target = await prisma.paymentGateway.findUnique({ where: { id } });
      if (!target) throw new HttpError(404, "No such account");
      if (target.active) {
        throw new HttpError(409, "Activate another account before removing this one");
      }
      const used = await prisma.payment.count({ where: { gatewayId: id } });
      if (used > 0) {
        throw new HttpError(
          409,
          `${used} payment${used === 1 ? "" : "s"} were taken through this account — it can't be deleted`,
        );
      }
      await prisma.paymentGateway.delete({ where: { id } });
      await audit({
        actorId: admin.id,
        action: "PAYMENT_GATEWAY_REMOVED",
        targetType: "PaymentGateway",
        targetId: id,
        summary: `Removed Razorpay account "${target.label}"`,
      });
      res.json({ removed: true });
    }),
  );
}
