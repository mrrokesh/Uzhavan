import type { Role, User } from "@prisma/client";
import type { Request } from "express";
import { bearerToken, verifyToken } from "./auth.js";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { HttpError } from "./http.js";

/**
 * Resolve the signed-in user from the Bearer token, and refuse anyone whose
 * account has been suspended or blocked. This is the single choke point — no
 * authenticated route can accidentally skip the check.
 */
export async function currentUser(req: Request): Promise<User> {
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, "Sign in to continue");
  const userId = verifyToken(token);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(401, "Account not found");

  if (user.status === "BLOCKED") {
    throw new HttpError(
      403,
      user.statusReason
        ? `Your account is blocked: ${user.statusReason}. Contact ${env.supportEmail} to appeal.`
        : `Your account is blocked. Contact ${env.supportEmail} to appeal.`,
    );
  }
  if (user.status === "SUSPENDED") {
    throw new HttpError(
      403,
      user.statusReason
        ? `Your account is temporarily suspended: ${user.statusReason}.`
        : "Your account is temporarily suspended. Contact support.",
    );
  }

  return user;
}

const ROLE_LABEL: Record<Role, string> = {
  BUYER: "buyers",
  FARMER: "farmers",
  DRIVER: "drivers",
  STAFF: "staff",
  ADMIN: "admins",
};

/** Resolve the signed-in user and assert their role. */
export async function requireRole(req: Request, role: Role): Promise<User> {
  const user = await currentUser(req);
  if (user.role !== role) {
    throw new HttpError(403, `Only ${ROLE_LABEL[role]} can do this`);
  }
  return user;
}

/** Admin, or staff — used for the moderation and KYC surfaces. */
export async function requireStaff(req: Request): Promise<User> {
  const user = await currentUser(req);
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    throw new HttpError(403, "Staff access required");
  }
  return user;
}

/** Admin only — staff management, permissions, app releases. */
export async function requireAdmin(req: Request): Promise<User> {
  const user = await currentUser(req);
  if (user.role !== "ADMIN") throw new HttpError(403, "Admin access required");
  return user;
}

/** The farmer's farm — created at registration, so this should always exist. */
export async function requireFarm(req: Request) {
  const user = await requireRole(req, "FARMER");
  const farm = await prisma.farm.findUnique({ where: { ownerId: user.id } });
  if (!farm) throw new HttpError(404, "No farm on this account");
  return { user, farm };
}

/** The driver profile plus their truck (truck may not be registered yet). */
export async function requireDriver(req: Request) {
  const user = await requireRole(req, "DRIVER");
  const driver = await prisma.driver.findUnique({
    where: { userId: user.id },
    include: { truck: true },
  });
  if (!driver) throw new HttpError(404, "No driver profile on this account");
  return { user, driver };
}

/**
 * What a user object looks like once it leaves the server.
 *
 * An allowlist, deliberately. This was a denylist of secrets to strip, and it
 * failed exactly the way denylists do: `licenceEnc` and `licenceIndex` were
 * added to the schema months later, nobody thought to add them here, and the
 * driver's encrypted licence and its blind index went out to every client. The
 * ciphertext is AES-GCM and not readable, but a blind index is a deterministic
 * HMAC — hand someone that and they can test candidate licence numbers offline
 * against a small, well-structured space until one matches.
 *
 * Listing what may leave means a new column is invisible until somebody
 * decides otherwise. Forgetting is then a missing field in the app, which
 * someone notices, rather than a silent leak, which nobody does.
 */
const PUBLIC_FIELDS = [
  "id",
  "email",
  "role",
  "name",
  "phone",
  "avatarKey",
  "business",
  "district",
  "districtKey",
  "warehouse",
  "warehouseAddress",
  "market",
  "status",
  "statusReason",
  "verification",
  "verificationSubmittedAt",
  "verificationReviewedAt",
  "rejectionReason",
  // Last four of whichever identifier they verified with — kept so the owner
  // recognises it. Never the identifier itself.
  "idLast4",
  "plusUntil",
  "permissions",
  "createdAt",
] as const satisfies readonly (keyof User)[];

export type PublicUser = Pick<User, (typeof PUBLIC_FIELDS)[number]>;

export function publicUser(user: User): PublicUser {
  const out = {} as Record<string, unknown>;
  for (const field of PUBLIC_FIELDS) out[field] = user[field];
  return out as PublicUser;
}

/** Human-readable reference codes: UZH-REQ-7F3K2 etc. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function code(prefix: string) {
  let out = "";
  for (let i = 0; i < 5; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}-${out}`;
}
