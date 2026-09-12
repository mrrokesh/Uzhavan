/**
 * Format and checksum validation for the Indian identifiers we accept as
 * proof of business. Catching a mistyped GSTIN here saves a staff member a
 * pointless rejection later.
 */

const GSTIN_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Two-digit state codes issued under GST (01 J&K … 38 Ladakh). */
const GST_STATE_CODES = new Set(
  Array.from({ length: 38 }, (_, i) => String(i + 1).padStart(2, "0")),
);

/**
 * GSTIN: 15 characters — 2 state + 10 PAN + 1 entity + 'Z' + 1 check digit.
 * The check digit is a mod-36 weighted sum, alternating weights 1 and 2, with
 * each product's quotient and remainder added together.
 */
export function isValidGSTIN(raw: string): boolean {
  const gstin = raw.trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return false;
  if (!GST_STATE_CODES.has(gstin.slice(0, 2))) return false;

  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const value = GSTIN_CHARSET.indexOf(gstin[i]);
    if (value < 0) return false;
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  const expected = GSTIN_CHARSET[(36 - (sum % 36)) % 36];
  return gstin[14] === expected;
}

/** PAN: 5 letters + 4 digits + 1 letter. The 4th letter encodes holder type. */
export function isValidPAN(raw: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(raw.trim().toUpperCase());
}

/** Udyam (MSME) registration: UDYAM-XX-00-0000000 */
export function isValidUdyam(raw: string): boolean {
  return /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/.test(raw.trim().toUpperCase());
}

/**
 * Farmer / Kisan card numbers have no single national format — states issue
 * their own. So we only sanity-check shape; a staff member confirms it
 * against the uploaded document.
 */
export function isPlausibleFarmerCard(raw: string): boolean {
  const value = raw.trim().toUpperCase();
  return /^[A-Z0-9/-]{6,30}$/.test(value);
}

/**
 * Driving licences are issued by each state's RTO and the formats vary a lot
 * (TN37 20190001234, MH12 20110012345, DL-1420110012345). Check the shape only
 * and let a staff member confirm it against the uploaded licence.
 */
export function isPlausibleLicence(raw: string): boolean {
  const v = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z]{2}[0-9]{9,14}$/.test(v);
}

/** The GSTIN embeds the holder’s PAN at positions 3–12. */
export function panFromGSTIN(gstin: string): string {
  return gstin.trim().toUpperCase().slice(2, 12);
}

export function normalise(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** Last 4 characters, shown in the UI so a user can recognise their own entry. */
export function last4(value: string): string {
  const v = normalise(value);
  return v.slice(-4);
}
