import type { Permission, User } from "@prisma/client";
import type { Request } from "express";
import { currentUser } from "./session.js";
import { HttpError } from "./http.js";

/**
 * Rights that exist only for the admin. They are never grantable to staff —
 * handing out `ADMIN_PERMISSIONS_GRANT` would let a staff member promote
 * themselves, so the grant endpoint rejects anything in this set outright.
 */
export const ADMIN_ONLY: Permission[] = [
  "ADMIN_STAFF_MANAGE",
  "ADMIN_PERMISSIONS_GRANT",
  "ADMIN_APP_RELEASE",
  "ADMIN_AUDIT_VIEW",
];

/** Everything an admin may hand to a staff member. */
export const GRANTABLE: Permission[] = [
  "USERS_VIEW",
  "USERS_MODERATE",
  "KYC_REVIEW",
  "TICKETS_VIEW",
  "TICKETS_RESPOND",
  "TICKETS_ASSIGN",
  "ORDERS_VIEW",
  "CROPS_MODERATE",
  "CONFIG_WRITE",
];

/** Sensible starting set for a new support hire. */
export const DEFAULT_STAFF: Permission[] = [
  "USERS_VIEW",
  "TICKETS_VIEW",
  "TICKETS_RESPOND",
  "ORDERS_VIEW",
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  USERS_VIEW: "View accounts",
  USERS_MODERATE: "Block & unblock accounts",
  KYC_REVIEW: "Review verification documents",
  TICKETS_VIEW: "View support tickets",
  TICKETS_RESPOND: "Reply to tickets",
  TICKETS_ASSIGN: "Assign tickets to staff",
  ORDERS_VIEW: "View orders & trips",
  CROPS_MODERATE: "Unlist crops",
  CONFIG_WRITE: "Edit support contact details",
  ADMIN_STAFF_MANAGE: "Create & remove staff",
  ADMIN_PERMISSIONS_GRANT: "Grant permissions",
  ADMIN_APP_RELEASE: "Publish app updates",
  ADMIN_AUDIT_VIEW: "View the audit log",
};

/** An admin implicitly holds every permission. */
export function has(user: User, permission: Permission): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role !== "STAFF") return false;
  return user.permissions.includes(permission);
}

export function effectivePermissions(user: User): Permission[] {
  if (user.role === "ADMIN") return [...ADMIN_ONLY, ...GRANTABLE];
  if (user.role !== "STAFF") return [];
  return user.permissions;
}

/** Resolve the caller and assert one permission. */
export async function requirePermission(req: Request, permission: Permission): Promise<User> {
  const user = await currentUser(req);
  if (!has(user, permission)) {
    throw new HttpError(403, `You don't have permission to ${PERMISSION_LABELS[permission].toLowerCase()}`);
  }
  return user;
}

/** Assert any one of several permissions. */
export async function requireAny(req: Request, permissions: Permission[]): Promise<User> {
  const user = await currentUser(req);
  if (!permissions.some((p) => has(user, p))) {
    throw new HttpError(403, "You don't have permission to do this");
  }
  return user;
}
