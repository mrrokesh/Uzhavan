import type { Order, PayoutPolicy, PayoutState } from "@prisma/client";
import { prisma } from "./db.js";
import { audit } from "./audit.js";
import { activeGateway, createTransfer } from "./payments/razorpay.js";

/**
 * When a farmer sees the money.
 *
 * The buyer always pays the full amount up front, into the gateway — never into
 * our own account, because holding other people's money there is exactly what
 * RBI's payment-aggregator rules forbid. Razorpay Route holds it and we say
 * when to let go.
 *
 * Two policies, switchable from the console:
 *
 *   SPLIT_ON_LOAD    an advance the moment the *driver* marks the load picked
 *                    up, balance after delivery. The trigger is deliberately a
 *                    third party — a farmer claiming they shipped is not
 *                    evidence that they shipped.
 *
 *   AFTER_DELIVERY   nothing until delivered, then a settlement hold. This is
 *                    the Amazon / Flipkart shape, and it exists here because
 *                    disputes are cheaper to handle before the money is gone.
 *
 * Whichever applies is stamped onto each payout row when the order is paid, so
 * changing the policy tomorrow never rewrites what today's order was promised.
 */

export const POLICY_KEY = "payout_policy";
export const ADVANCE_KEY = "payout_advance_percent";
export const HOLD_KEY = "payout_hold_hours";

export const DEFAULT_POLICY: PayoutPolicy = "SPLIT_ON_LOAD";
export const DEFAULT_ADVANCE_PERCENT = 30;
export const DEFAULT_HOLD_HOURS = 48;

/** An advance is a bet on a load nobody has inspected yet. Keep it modest. */
export const MAX_ADVANCE_PERCENT = 50;
/** A settlement hold longer than a fortnight isn't a hold, it's a problem. */
export const MAX_HOLD_HOURS = 336;

export function isPolicy(value: string): value is PayoutPolicy {
  return value === "SPLIT_ON_LOAD" || value === "AFTER_DELIVERY";
}

export function parseAdvancePercent(value: string): number | null {
  const n = Number(String(value).trim());
  if (!Number.isInteger(n) || n < 0 || n > MAX_ADVANCE_PERCENT) return null;
  return n;
}

export function parseHoldHours(value: string): number | null {
  const n = Number(String(value).trim());
  if (!Number.isInteger(n) || n < 0 || n > MAX_HOLD_HOURS) return null;
  return n;
}

async function setting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function payoutRules(): Promise<{
  policy: PayoutPolicy;
  advancePercent: number;
  holdHours: number;
}> {
  const [rawPolicy, rawAdvance, rawHold] = await Promise.all([
    setting(POLICY_KEY),
    setting(ADVANCE_KEY),
    setting(HOLD_KEY),
  ]);
  return {
    policy: rawPolicy && isPolicy(rawPolicy) ? rawPolicy : DEFAULT_POLICY,
    advancePercent: (rawAdvance === null ? null : parseAdvancePercent(rawAdvance)) ?? DEFAULT_ADVANCE_PERCENT,
    holdHours: (rawHold === null ? null : parseHoldHours(rawHold)) ?? DEFAULT_HOLD_HOURS,
  };
}

const hoursFromNow = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);

/**
 * Called once the buyer's payment clears. Writes the schedule; releases nothing.
 *
 * An advance only makes sense when somebody independent will confirm the load,
 * so it's limited to VERIFIED farmers on orders moving by a booked truck. A
 * farmer arranging their own transport has no driver to vouch for them, and an
 * unverified one hasn't yet proved who they are — both get paid on delivery.
 */
export async function schedulePayouts(order: Order, paymentId: string): Promise<void> {
  const existing = await prisma.payout.count({ where: { orderId: order.id } });
  if (existing > 0) return; // idempotent: a webhook and a callback can both land

  const crop = await prisma.crop.findUnique({
    where: { id: order.cropId },
    select: { farm: { select: { owner: true } } },
  });
  const farmer = crop?.farm?.owner;
  if (!farmer) return;

  const { policy, advancePercent, holdHours } = await payoutRules();
  const owed = order.value; // the farmer's money; the platform fee is not theirs

  const advanceEligible =
    policy === "SPLIT_ON_LOAD" &&
    advancePercent > 0 &&
    order.transport === "BOOK" &&
    farmer.verification === "VERIFIED";

  const advance = advanceEligible ? Math.round((owed * advancePercent) / 100) : 0;
  const balance = owed - advance;

  const rows: {
    stage: "ADVANCE" | "BALANCE";
    amount: number;
    releaseAfter: Date | null;
  }[] = [];

  if (advance > 0) {
    // No timer. This one waits for the driver, however long that takes.
    rows.push({ stage: "ADVANCE", amount: advance, releaseAfter: null });
  }
  if (balance > 0) {
    rows.push({ stage: "BALANCE", amount: balance, releaseAfter: null });
  }

  await prisma.payout.createMany({
    data: rows.map((r) => ({
      orderId: order.id,
      farmerId: farmer.id,
      paymentId,
      stage: r.stage,
      amount: r.amount,
      policy,
      releaseAfter: r.releaseAfter,
      note:
        r.stage === "ADVANCE"
          ? `${advancePercent}% advance, due when the driver confirms the load`
          : policy === "SPLIT_ON_LOAD"
            ? `Balance, due ${holdHours}h after delivery`
            : `Full amount, due ${holdHours}h after delivery`,
    })),
  });
}

/** The driver has the load on board. Frees any advance. */
export async function onLoaded(orderId: string): Promise<void> {
  await prisma.payout.updateMany({
    where: { orderId, stage: "ADVANCE", state: "HELD" },
    data: { releaseAfter: new Date() },
  });
}

/**
 * Delivered. Starts the settlement clock on whatever is left.
 *
 * The hold is the dispute window: a buyer who received the wrong thing has
 * until it expires to say so, and after that the money goes automatically so a
 * silent buyer can't strand a farmer's payment indefinitely.
 */
export async function onDelivered(orderId: string): Promise<void> {
  const { holdHours } = await payoutRules();
  const due = hoursFromNow(holdHours);
  await prisma.payout.updateMany({
    where: { orderId, state: "HELD" },
    data: { releaseAfter: due },
  });
}

/** Order fell over before the money moved. */
export async function cancelPayouts(orderId: string, reason: string): Promise<void> {
  await prisma.payout.updateMany({
    where: { orderId, state: "HELD" },
    data: { state: "CANCELLED", note: reason },
  });
}

/**
 * Push one payout to the gateway. Route wants paise and a linked account; a
 * farmer without one can't be paid, and that's a FAILED row rather than a
 * silent skip so somebody notices.
 */
export async function releasePayout(payoutId: string, actorId?: string): Promise<PayoutState> {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { farmer: { include: { linkedAccount: true } }, order: true },
  });
  if (!payout || payout.state !== "HELD") return payout?.state ?? "FAILED";

  const account = payout.farmer.linkedAccount;
  if (!account) {
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        state: "FAILED",
        failureReason: "The farmer has no payout account set up yet",
      },
    });
    return "FAILED";
  }

  try {
    const gateway = await activeGateway();
    const transfer = await createTransfer(gateway, {
      accountId: account.routeAccountId,
      amountPaise: payout.amount * 100,
      notes: {
        orderCode: payout.order.code,
        stage: payout.stage,
      },
    });
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        state: "RELEASED",
        releasedAt: new Date(),
        routeTransferId: transfer.id,
        failureReason: null,
        ...(actorId ? { overriddenById: actorId } : {}),
      },
    });
    return "RELEASED";
  } catch (err) {
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        state: "FAILED",
        failureReason: err instanceof Error ? err.message : "The gateway refused the transfer",
      },
    });
    return "FAILED";
  }
}

/** Everything now due. Returns how many moved. */
export async function releaseDuePayouts(): Promise<number> {
  const due = await prisma.payout.findMany({
    where: { state: "HELD", releaseAfter: { not: null, lte: new Date() } },
    select: { id: true },
    take: 100,
  });
  let moved = 0;
  for (const p of due) {
    const state = await releasePayout(p.id);
    if (state === "RELEASED") moved += 1;
  }
  return moved;
}

/**
 * Runs alongside the ticket sweeper. Payouts must not depend on someone opening
 * the console — a farmer waiting on money is the last person who should be
 * blocked by an admin being asleep.
 */
export function startPayoutSweeper(everyMinutes = 10): NodeJS.Timeout {
  const tick = () => {
    releaseDuePayouts().catch((err) => {
      console.error("[payouts] sweep failed:", err instanceof Error ? err.message : err);
    });
  };
  tick();
  const timer = setInterval(tick, everyMinutes * 60 * 1000);
  timer.unref?.();
  return timer;
}

/** Someone with authority let a payout go early, or stopped one. */
export async function overridePayout(
  payoutId: string,
  action: "release" | "hold",
  actorId: string,
  note?: string,
): Promise<void> {
  if (action === "release") {
    const state = await releasePayout(payoutId, actorId);
    await audit({
      actorId,
      action: "PAYOUT_RELEASED_EARLY",
      targetType: "Payout",
      targetId: payoutId,
      summary: state === "RELEASED" ? "Released a payout early" : `Early release failed (${state})`,
      ...(note ? { metadata: { note } } : {}),
    });
    return;
  }

  await prisma.payout.update({
    where: { id: payoutId },
    data: { releaseAfter: null, overriddenById: actorId, ...(note ? { note } : {}) },
  });
  await audit({
    actorId,
    action: "PAYOUT_HELD",
    targetType: "Payout",
    targetId: payoutId,
    summary: "Held a payout back pending review",
    ...(note ? { metadata: { note } } : {}),
  });
}
