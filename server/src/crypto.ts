import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "./env.js";

// ─── Passwords ────────────────────────────────────────────────
//
// Two layers:
//   1. PEPPER  — HMAC-SHA256(password, PASSWORD_PEPPER). The pepper lives in
//      the environment, never in the database, so a stolen dump cannot be
//      cracked offline even with a weak password.
//   2. BCRYPT  — cost 12, with its own per-user random salt.
//
// bcrypt silently truncates at 72 bytes, so the HMAC is base64'd to a fixed
// 44 characters first. That also means an arbitrarily long password is
// fully covered rather than cut short.
//
// Stored format:  v<pepperVersion>$<bcrypt hash>
// The version prefix lets a future pepper rotation verify old and new hashes
// side by side instead of locking everyone out.

const LEGACY = 0; // hashes written before peppering existed

function pepper(password: string, version: number): string {
  if (version === LEGACY) return password;
  return crypto
    .createHmac("sha256", env.passwordPepper)
    .update(password, "utf8")
    .digest("base64");
}

export async function hashPassword(password: string): Promise<string> {
  const version = env.passwordPepperVersion;
  const hash = await bcrypt.hash(pepper(password, version), env.bcryptRounds);
  return `v${version}$${hash}`;
}

function parse(stored: string): { version: number; hash: string } {
  const match = /^v(\d+)\$(.+)$/.exec(stored);
  if (!match) return { version: LEGACY, hash: stored };
  return { version: Number(match[1]), hash: match[2] };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const { version, hash } = parse(stored);
  try {
    return await bcrypt.compare(pepper(password, version), hash);
  } catch {
    return false;
  }
}

/**
 * True when a valid password should be re-hashed — the pepper was rotated, or
 * BCRYPT_ROUNDS was raised. Callers upgrade the stored hash on next login, so
 * the whole user base migrates without anyone resetting a password.
 */
export function needsRehash(stored: string): boolean {
  const { version, hash } = parse(stored);
  if (version !== env.passwordPepperVersion) return true;
  const rounds = Number(hash.split("$")[2]);
  return Number.isFinite(rounds) && rounds < env.bcryptRounds;
}

// ─── Field & document encryption ──────────────────────────────
//
// AES-256-GCM. GCM is authenticated, so tampering is detected on decrypt
// rather than silently returning garbage.
//
// Layout:  [12-byte IV][16-byte auth tag][ciphertext]
// Strings are stored base64; documents keep the raw Buffer.

const IV_BYTES = 12;
const TAG_BYTES = 16;

export function encryptBuffer(plain: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", env.encryptionKey, iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decryptBuffer(packed: Buffer): Buffer {
  if (packed.length < IV_BYTES + TAG_BYTES) throw new Error("Ciphertext is truncated");
  const iv = packed.subarray(0, IV_BYTES);
  const tag = packed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = packed.subarray(IV_BYTES + TAG_BYTES);
  const decipher = crypto.createDecipheriv("aes-256-gcm", env.encryptionKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

export function encrypt(plain: string): string {
  return encryptBuffer(Buffer.from(plain, "utf8")).toString("base64");
}

export function decrypt(packed: string): string {
  return decryptBuffer(Buffer.from(packed, "base64")).toString("utf8");
}

/** Decrypt without throwing — for display paths where a bad value shouldn't 500. */
export function tryDecrypt(packed: string | null | undefined): string | null {
  if (!packed) return null;
  try {
    return decrypt(packed);
  } catch {
    return null;
  }
}

/**
 * Deterministic HMAC of a normalised identifier, so we can enforce "this GSTIN
 * is already registered" without ever storing or querying the plaintext.
 * Unlike the ciphertext (random IV each time) this is stable and indexable.
 */
export function blindIndex(value: string): string {
  return crypto
    .createHmac("sha256", env.encryptionKey)
    .update(value.trim().toUpperCase(), "utf8")
    .digest("hex");
}

/** Constant-time string compare, for tokens and codes. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
