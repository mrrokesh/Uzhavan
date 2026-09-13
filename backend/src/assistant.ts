import type { Role } from "@prisma/client";
import { prisma } from "./db.js";

// Matches the client's src/lib/format.ts, but this text is composed
// server-side into a sentence, not a UI field the client formats itself.
const inr = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
const kg = (v: number) => `${new Intl.NumberFormat("en-IN").format(v)} kg`;

/**
 * Answering "what crops are available", "who's available for delivery",
 * "what's my payment status" — and nothing else, on purpose.
 *
 * No language model. Every one of those is a lookup we already have an exact
 * answer for; running a question like that through an LLM buys nothing but
 * the chance of it inventing a crop that isn't listed or a status that never
 * happened. Rule-based means the assistant only ever says what our own data
 * says, which for questions with exact answers is worth more than fluency.
 *
 * The extension point is deliberate: an intent is a test on the question plus
 * a handler that returns real data. A future step — for the phrasing users
 * type rather than the facts they get told — is having a small model choose
 * *which* handler applies to a looser sentence than the keyword matches below
 * catch. It would still only ever call these same handlers; it would never
 * generate the answer itself. That's a separate service (needs its own host,
 * unlike this file) and doesn't change anything here when it arrives — a new
 * matcher gets to reuse every handler that already exists.
 */

export type AssistantAnswer = {
  intent: string;
  text: string;
  data?: unknown;
};

type Intent = {
  name: string;
  /** Cheap keyword test. First match wins, so order is most-specific first. */
  test: (q: string) => boolean;
  handle: (q: string, userId: string, role: Role) => Promise<AssistantAnswer>;
};

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

const INTENTS: Intent[] = [
  {
    name: "payment_status",
    test: (q) => has(q, "payment", "paid", "pay ") || q.startsWith("pay"),
    handle: async (_q, userId, role) => {
      if (role !== "BUYER") {
        return {
          intent: "payment_status",
          text: "Payment status is something a buyer asks about their own order — try asking about your sales or payouts instead.",
        };
      }
      const orders = await prisma.order.findMany({
        where: { buyerId: userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { code: true, product: true, totalPayable: true, paidAt: true, status: true },
      });
      if (orders.length === 0) {
        return { intent: "payment_status", text: "You don't have any orders yet." };
      }
      const lines = orders.map(
        (o) =>
          `${o.code} (${o.product}) — ${o.paidAt ? `paid, ${inr(o.totalPayable)}` : "payment due"}, ${o.status.toLowerCase()}`,
      );
      return {
        intent: "payment_status",
        text: `Your most recent order${orders.length > 1 ? "s" : ""}:\n${lines.join("\n")}`,
        data: orders,
      };
    },
  },
  {
    name: "delivery_availability",
    test: (q) => has(q, "delivery", "deliver", "driver", "truck"),
    handle: async () => {
      const drivers = await prisma.driver.findMany({
        where: { online: true, user: { status: "ACTIVE" } },
        select: {
          name: true,
          rating: true,
          truck: { select: { capacityKg: true, body: true } },
          user: { select: { district: true } },
        },
        take: 10,
      });
      if (drivers.length === 0) {
        return {
          intent: "delivery_availability",
          text: "No drivers are online right now. Check back shortly, or book a truck and one will be offered when you confirm an order.",
        };
      }
      const lines = drivers.map(
        (d) =>
          `${d.name} — ★${d.rating.toFixed(1)}${d.truck ? `, ${kg(d.truck.capacityKg)} ${d.truck.body.toLowerCase()}` : ""}`,
      );
      return {
        intent: "delivery_availability",
        text: `${drivers.length} driver${drivers.length === 1 ? " is" : "s are"} online now:\n${lines.join("\n")}`,
        data: drivers,
      };
    },
  },
  {
    name: "crops_available",
    test: (q) => has(q, "crop", "produce", "vegetable", "listing", "available"),
    handle: async () => {
      const crops = await prisma.crop.findMany({
        where: { listed: true, farm: { owner: { status: "ACTIVE" } } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          title: true,
          category: true,
          pricePerKg: true,
          expectedKg: true,
          reservedKg: true,
          farm: { select: { name: true, district: true } },
        },
      });
      const inStock = crops.filter((c) => c.expectedKg - c.reservedKg > 0);
      if (inStock.length === 0) {
        return { intent: "crops_available", text: "Nothing is listed with stock left right now." };
      }
      const lines = inStock
        .slice(0, 8)
        .map((c) => `${c.title} — ${inr(c.pricePerKg)}/kg, ${c.farm.name} (${c.farm.district})`);
      return {
        intent: "crops_available",
        text: `${inStock.length} crop${inStock.length === 1 ? "" : "s"} available:\n${lines.join("\n")}`,
        data: inStock,
      };
    },
  },
];

const FALLBACK =
  "I can answer questions about available crops, driver availability, and your payment status — try one of those.";

export async function askAssistant(question: string, userId: string, role: Role): Promise<AssistantAnswer> {
  const q = question.trim().toLowerCase();
  const intent = INTENTS.find((i) => i.test(q));
  if (!intent) return { intent: "unknown", text: FALLBACK };
  return intent.handle(q, userId, role);
}
