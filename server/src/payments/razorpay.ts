import crypto from "node:crypto";
import type { PaymentGateway } from "@prisma/client";
import { prisma } from "../db.js";
import { decrypt } from "../crypto.js";
import { HttpError } from "../http.js";

/**
 * Razorpay over plain REST rather than their SDK — order creation is one POST
 * and signature checking is an HMAC, so a dependency would buy us nothing and
 * cost us a supply-chain surface.
 *
 * Credentials live in the database (secrets encrypted) so a blocked or rotated
 * account can be swapped from the console without a deploy.
 */

const API = "https://api.razorpay.com/v1";

export type ActiveGateway = {
  row: PaymentGateway;
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
};

export async function activeGateway(): Promise<ActiveGateway> {
  const row = await prisma.paymentGateway.findFirst({ where: { active: true } });
  if (!row) {
    throw new HttpError(
      503,
      "Payments aren't set up yet. An admin needs to add a Razorpay account.",
    );
  }
  let keySecret: string;
  try {
    keySecret = decrypt(row.keySecretEnc);
  } catch {
    throw new HttpError(500, "The stored Razorpay secret could not be decrypted");
  }
  return {
    row,
    keyId: row.keyId,
    keySecret,
    webhookSecret: row.webhookSecretEnc ? decrypt(row.webhookSecretEnc) : null,
  };
}

function authHeader(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

type RazorpayOrder = { id: string; amount: number; currency: string; status: string };

/** Create an order. Amount is in paise — Razorpay never takes rupees. */
export async function createOrder(
  gateway: ActiveGateway,
  amountPaise: number,
  receipt: string,
  notes: Record<string, string> = {},
): Promise<RazorpayOrder> {
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(gateway.keyId, gateway.keySecret),
    },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, notes }),
  });

  const body = (await res.json()) as RazorpayOrder & { error?: { description?: string } };
  if (!res.ok) {
    throw new HttpError(
      502,
      body?.error?.description
        ? `Razorpay: ${body.error.description}`
        : "Couldn't start the payment. Try again in a moment.",
    );
  }
  return body;
}

/**
 * Verify a checkout callback. Razorpay signs `orderId|paymentId` with the key
 * secret; a mismatch means the client made it up.
 *
 * Compared in constant time — a fast-fail comparison leaks the signature one
 * byte at a time.
 */
export function verifyCheckoutSignature(
  gateway: ActiveGateway,
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const expected = crypto
    .createHmac("sha256", gateway.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Verify a webhook body against the webhook secret (a different secret). */
export function verifyWebhookSignature(
  webhookSecret: string,
  rawBody: string,
  signature: string,
): boolean {
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Razorpay test keys start `rzp_test_`, live ones `rzp_live_`. */
export function modeForKey(keyId: string): "TEST" | "LIVE" {
  return keyId.startsWith("rzp_live_") ? "LIVE" : "TEST";
}

// ---- Route -----------------------------------------------------------------
//
// Route is how a marketplace pays its sellers without the money ever passing
// through its own current account. Each farmer is a "linked account"; a payment
// is split into "transfers"; a transfer created `on_hold` sits at Razorpay
// until we release it. That hold is our escrow — we never custody the funds.

async function route<T>(
  gateway: ActiveGateway,
  path: string,
  init: { method: "GET" | "POST" | "PATCH"; body?: unknown },
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(gateway.keyId, gateway.keySecret),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const body = (await res.json().catch(() => ({}))) as T & {
    error?: { description?: string; reason?: string };
  };
  if (!res.ok) {
    throw new HttpError(
      502,
      body?.error?.description ? `Razorpay: ${body.error.description}` : `Razorpay refused the request (${res.status})`,
    );
  }
  return body;
}

export type RouteAccount = { id: string; status?: string };

/**
 * Register a farmer as a payee. Razorpay needs a real bank account and a legal
 * name; the name must match the account or settlements bounce.
 */
export async function createLinkedAccount(
  gateway: ActiveGateway,
  input: {
    email: string;
    phone: string;
    legalName: string;
    accountNumber: string;
    ifsc: string;
    beneficiaryName: string;
  },
): Promise<RouteAccount> {
  return route<RouteAccount>(gateway, "/accounts", {
    method: "POST",
    body: {
      email: input.email,
      phone: input.phone.replace(/[^0-9]/g, "").slice(-10),
      type: "route",
      legal_business_name: input.legalName,
      business_type: "individual",
      contact_name: input.beneficiaryName,
      profile: { category: "food", subcategory: "agriculture" },
      settlements: {
        account_number: input.accountNumber,
        ifsc_code: input.ifsc.toUpperCase(),
        beneficiary_name: input.beneficiaryName,
      },
      tnc_accepted: true,
    },
  });
}

export type RouteTransfer = { id: string; status?: string; on_hold?: boolean };

/**
 * Move money to a farmer. Created released, because our hold lives in the
 * Payout table — a transfer only ever gets created once we've decided it's due,
 * which keeps one source of truth for "is this owed yet".
 */
export async function createTransfer(
  gateway: ActiveGateway,
  input: { accountId: string; amountPaise: number; notes?: Record<string, string> },
): Promise<RouteTransfer> {
  return route<RouteTransfer>(gateway, "/transfers", {
    method: "POST",
    body: {
      account: input.accountId,
      amount: input.amountPaise,
      currency: "INR",
      ...(input.notes ? { notes: input.notes } : {}),
    },
  });
}

/** Let go of a transfer that was parked at the gateway. */
export async function releaseHeldTransfer(
  gateway: ActiveGateway,
  transferId: string,
): Promise<RouteTransfer> {
  return route<RouteTransfer>(gateway, `/transfers/${transferId}`, {
    method: "PATCH",
    body: { on_hold: false },
  });
}
