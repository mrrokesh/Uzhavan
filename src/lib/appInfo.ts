import Constants from "expo-constants";
import type { Role } from "../api/types";

/**
 * Which of the two apps this build is. Set by app.config.js from UZHAVAN_APP,
 * so a build declares itself without a code change.
 *
 *   PARTNER → "Uzhavan"     — farmers listing harvests, drivers hauling them
 *   BUYER   → "Uzhavan Buy" — wholesale dealers buying from farmers
 *
 * The enum values are the server's, and older than the names above; treat this
 * file as the one place the two vocabularies meet.
 */
export const APP_KIND: "BUYER" | "PARTNER" =
  (Constants.expoConfig?.extra?.appKind as "BUYER" | "PARTNER") ?? "PARTNER";

export const IS_BUYER_APP = APP_KIND === "BUYER";

/** Matches `expo.version` in app.json — what the server compares against. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "1.0.0";

export const APP_NAME = IS_BUYER_APP ? "Uzhavan Buy" : "Uzhavan";

/** The app someone should be using instead, when they land in the wrong one. */
export const OTHER_APP_NAME = IS_BUYER_APP ? "Uzhavan" : "Uzhavan Buy";

/** Who this build is for. A signed-in user outside this set is in the wrong app. */
export const APP_ROLES: Role[] = IS_BUYER_APP ? ["BUYER"] : ["FARMER", "DRIVER"];

/**
 * Deliberately takes a plain string, not Role. The server can hand back STAFF
 * or ADMIN — accounts the mobile Role union doesn't model — and those must fail
 * this check rather than fall through to the buyer app.
 */
export function servesRole(role: string | null | undefined): boolean {
  return !!role && (APP_ROLES as string[]).includes(role);
}
