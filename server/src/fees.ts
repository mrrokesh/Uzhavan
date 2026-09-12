import { prisma } from "./db.js";

/**
 * Who pays what.
 *
 * Farmers and drivers pay nothing — no commission, no platform fee. They are
 * the supply, and charging them is how you lose them. The fee falls entirely on
 * the buyer, on top of the price the farmer agreed, so a farmer's payout is
 * always exactly the number they accepted.
 *
 * Held in basis points because money here is whole rupees and percentages want
 * a decimal: 5% is 500 bps, 7.5% is 750. No floats touch an amount.
 */
export const FEE_SETTING_KEY = "platform_fee_percent";

/** The floor. Admin can raise the fee but never set it below this. */
export const MIN_FEE_PERCENT = 5;

/** A ceiling, so a typo can't bill someone 500%. */
export const MAX_FEE_PERCENT = 30;

export const DEFAULT_FEE_BPS = MIN_FEE_PERCENT * 100;

/** "5" → 500, "7.5" → 750. Returns null when it isn't a usable percentage. */
export function percentToBps(value: string): number | null {
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  const bps = Math.round(n * 100);
  if (bps < MIN_FEE_PERCENT * 100 || bps > MAX_FEE_PERCENT * 100) return null;
  return bps;
}

export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/**
 * The live fee. A missing or corrupt setting falls back to the floor rather
 * than to zero — a misconfiguration should never silently make the platform
 * free, and it should never overcharge either.
 */
export async function platformFeeBps(): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: FEE_SETTING_KEY } });
  if (!row) return DEFAULT_FEE_BPS;
  return percentToBps(row.value) ?? DEFAULT_FEE_BPS;
}

/** Fee on an amount in whole rupees, rounded to the nearest rupee. */
export function feeOn(amountRupees: number, bps: number): number {
  return Math.round((amountRupees * bps) / 10000);
}

/** What the buyer owes: the farmer's price plus the platform's cut. */
export async function quote(amountRupees: number): Promise<{
  goods: number;
  feeBps: number;
  feePercent: number;
  fee: number;
  total: number;
}> {
  const feeBps = await platformFeeBps();
  const fee = feeOn(amountRupees, feeBps);
  return {
    goods: amountRupees,
    feeBps,
    feePercent: bpsToPercent(feeBps),
    fee,
    total: amountRupees + fee,
  };
}
