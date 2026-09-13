import type { Request } from "express";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "./env.js";
import { HttpError } from "./http.js";

// Password hashing and field encryption live in crypto.ts. Re-exported here so
// callers have one import for "auth things".
export {
  hashPassword,
  verifyPassword,
  needsRehash,
  encrypt,
  decrypt,
  tryDecrypt,
  blindIndex,
} from "./crypto.js";

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): string {
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (typeof payload === "string" || !payload.sub) throw new Error("bad token");
    return String(payload.sub);
  } catch {
    throw new HttpError(401, "Session expired. Sign in again.");
  }
}

export function bearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}
