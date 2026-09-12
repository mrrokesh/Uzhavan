/**
 * Number plates get written every possible way — "TN 30 AB 4821",
 * "tn30ab4821", "TN-30-AB-4821". Store the display form as the driver typed
 * it, and search against this.
 */
export function normalisePlate(plate: string): string {
  return plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
