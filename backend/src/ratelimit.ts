import type { Request } from "express";
import { HttpError } from "./http.js";

/**
 * Throttling the endpoints an anonymous stranger can reach.
 *
 * Deliberately in memory. A shared store would survive restarts and span
 * instances, and if this ever runs on more than one process it will need one —
 * but a Redis dependency to slow down password guessing on a single box is
 * a lot of moving parts for a job a Map does. The durable half of the defence
 * is the per-account lockout, which does live in the database.
 *
 * Two things are being defended here and they are not the same:
 *
 *   guessing   someone working through passwords against one account
 *   flooding   someone triggering thousands of SMS at our expense
 *
 * The first wants a per-account limit, the second a per-IP one, so both exist.
 */

type Window = { hits: number; resetAt: number };

const windows = new Map<string, Window>();

/** Stop the map growing without bound on a long-lived process. */
function sweep(now: number): void {
  if (windows.size < 5000) return;
  for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key);
}

export type Limit = { max: number; windowMs: number };

/**
 * Count one hit. Returns how long to wait, in seconds, or 0 when it's allowed.
 */
export function hit(key: string, limit: Limit): number {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { hits: 1, resetAt: now + limit.windowMs });
    return 0;
  }

  existing.hits += 1;
  if (existing.hits > limit.max) {
    return Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  }
  return 0;
}

/** Forget a key — called after a success, so one good login clears the count. */
export function clear(key: string): void {
  windows.delete(key);
}

/**
 * The caller's address.
 *
 * X-Forwarded-For only when a proxy is actually in front, which Express knows
 * from `trust proxy`. Reading it unconditionally would let anyone set their own
 * address with a header and walk straight past every limit here.
 */
export function callerIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function enforce(req: Request, name: string, limit: Limit, extra?: string): void {
  const key = `${name}:${callerIp(req)}${extra ? `:${extra}` : ""}`;
  const retryAfter = hit(key, limit);
  if (retryAfter > 0) {
    throw new HttpError(
      429,
      `Too many attempts. Try again in ${
        retryAfter < 60 ? `${retryAfter} seconds` : `${Math.ceil(retryAfter / 60)} minutes`
      }.`,
    );
  }
}

/**
 * Per-IP ceilings are deliberately generous.
 *
 * Carrier-grade NAT is the norm on Indian mobile networks, so one address can
 * be thousands of unrelated people — a tight per-IP limit doesn't stop an
 * attacker with a phone, it locks out a whole carrier. The per-IP numbers here
 * are an abuse ceiling; the real protection is per-account, where the identity
 * is what's being defended rather than the route in.
 */
export const LIMITS = {
  /** One address, all accounts. The per-account lockout does the real work. */
  login: { max: 60, windowMs: 5 * 60 * 1000 },
  /** Abuse ceiling for reset requests from one address. */
  forgot: { max: 30, windowMs: 15 * 60 * 1000 },
  /** Per target account. Each one costs an SMS and an email to a real person. */
  forgotTarget: { max: 10, windowMs: 15 * 60 * 1000 },
  resetAttempt: { max: 30, windowMs: 15 * 60 * 1000 },
  register: { max: 20, windowMs: 60 * 60 * 1000 },
} as const;

// ---- Per-account lockout ---------------------------------------------------

/**
 * How long an account is frozen after n consecutive failures.
 *
 * Progressive rather than a flat ban, and it always expires. A permanent lock
 * would hand anyone a way to deny a farmer access to their own account just by
 * failing their password enough times — a real attack on a marketplace where
 * you know your competitors' email addresses.
 */
export function lockoutSeconds(failures: number): number {
  if (failures < 5) return 0;
  if (failures < 8) return 60;
  if (failures < 12) return 5 * 60;
  return 30 * 60;
}

export function describeWait(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const mins = Math.ceil(seconds / 60);
  return `${mins} minute${mins === 1 ? "" : "s"}`;
}
