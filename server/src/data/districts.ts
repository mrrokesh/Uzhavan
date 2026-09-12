/**
 * Tamil Nadu's 38 districts with approximate centroids.
 *
 * "Nearby" is computed between district centres rather than exact addresses.
 * For wholesale produce that's the right granularity — a buyer choosing
 * between farms 40 km and 60 km away decides on price and quality, not
 * kilometres — and it means no GPS permission, no geocoding bill, and no
 * maps provider in the build.
 *
 * Straight-line distance is scaled by a road factor to approximate real
 * driving distance on Tamil Nadu's road network.
 */

export type District = { name: string; lat: number; lon: number };

export const DISTRICTS: District[] = [
  { name: "Ariyalur", lat: 11.14, lon: 79.08 },
  { name: "Chengalpattu", lat: 12.69, lon: 79.98 },
  { name: "Chennai", lat: 13.08, lon: 80.27 },
  { name: "Coimbatore", lat: 11.02, lon: 76.96 },
  { name: "Cuddalore", lat: 11.75, lon: 79.77 },
  { name: "Dharmapuri", lat: 12.13, lon: 78.16 },
  { name: "Dindigul", lat: 10.36, lon: 77.98 },
  { name: "Erode", lat: 11.34, lon: 77.72 },
  { name: "Kallakurichi", lat: 11.74, lon: 78.96 },
  { name: "Kancheepuram", lat: 12.84, lon: 79.7 },
  { name: "Kanyakumari", lat: 8.19, lon: 77.41 },
  { name: "Karur", lat: 10.96, lon: 78.08 },
  { name: "Krishnagiri", lat: 12.53, lon: 78.21 },
  { name: "Madurai", lat: 9.93, lon: 78.12 },
  { name: "Mayiladuthurai", lat: 11.1, lon: 79.65 },
  { name: "Nagapattinam", lat: 10.77, lon: 79.84 },
  { name: "Namakkal", lat: 11.22, lon: 78.17 },
  { name: "Nilgiris", lat: 11.41, lon: 76.7 },
  { name: "Perambalur", lat: 11.23, lon: 78.88 },
  { name: "Pudukkottai", lat: 10.38, lon: 78.82 },
  { name: "Ramanathapuram", lat: 9.37, lon: 78.83 },
  { name: "Ranipet", lat: 12.93, lon: 79.33 },
  { name: "Salem", lat: 11.66, lon: 78.15 },
  { name: "Sivaganga", lat: 9.85, lon: 78.48 },
  { name: "Tenkasi", lat: 8.96, lon: 77.31 },
  { name: "Thanjavur", lat: 10.79, lon: 79.14 },
  { name: "Theni", lat: 10.01, lon: 77.48 },
  { name: "Thoothukudi", lat: 8.76, lon: 78.13 },
  { name: "Tiruchirappalli", lat: 10.79, lon: 78.7 },
  { name: "Tirunelveli", lat: 8.71, lon: 77.76 },
  { name: "Tirupathur", lat: 12.5, lon: 78.57 },
  { name: "Tiruppur", lat: 11.11, lon: 77.34 },
  { name: "Tiruvallur", lat: 13.14, lon: 79.91 },
  { name: "Tiruvannamalai", lat: 12.23, lon: 79.07 },
  { name: "Tiruvarur", lat: 10.77, lon: 79.64 },
  { name: "Vellore", lat: 12.92, lon: 79.13 },
  { name: "Viluppuram", lat: 11.94, lon: 79.49 },
  { name: "Virudhunagar", lat: 9.57, lon: 77.96 },
];

/** Common spellings and older names people actually type. */
const ALIASES: Record<string, string> = {
  trichy: "Tiruchirappalli",
  tiruchi: "Tiruchirappalli",
  trichinopoly: "Tiruchirappalli",
  ooty: "Nilgiris",
  udhagamandalam: "Nilgiris",
  "the nilgiris": "Nilgiris",
  nilgiri: "Nilgiris",
  madras: "Chennai",
  tuticorin: "Thoothukudi",
  nellai: "Tirunelveli",
  kanniyakumari: "Kanyakumari",
  nagercoil: "Kanyakumari",
  kovai: "Coimbatore",
  conjeevaram: "Kancheepuram",
  kanchipuram: "Kancheepuram",
  vellore: "Vellore",
  tirupur: "Tiruppur",
  villupuram: "Viluppuram",
  tanjore: "Thanjavur",
  tirupathur: "Tirupathur",
  tiruppathur: "Tirupathur",
};

const normalise = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

const BY_NAME = new Map(DISTRICTS.map((d) => [normalise(d.name), d]));

/**
 * Resolve free text to a district. People type "Attur, Salem", "Ooty",
 * "salem dt" — match the whole string first, then look for any district name
 * inside it.
 */
export function resolveDistrict(input: string | null | undefined): District | null {
  if (!input) return null;
  const value = normalise(input);

  const direct = BY_NAME.get(value);
  if (direct) return direct;

  const aliased = ALIASES[value];
  if (aliased) return BY_NAME.get(normalise(aliased)) ?? null;

  for (const [alias, target] of Object.entries(ALIASES)) {
    if (value.includes(alias)) return BY_NAME.get(normalise(target)) ?? null;
  }
  // Longest name first, so "Tirunelveli" isn't shadowed by a shorter match.
  const sorted = [...DISTRICTS].sort((a, b) => b.name.length - a.name.length);
  for (const d of sorted) {
    if (value.includes(normalise(d.name))) return d;
  }
  return null;
}

const EARTH_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
function haversine(a: District, b: District): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(s));
}

/**
 * Roads are never straight. 1.3 is the usual detour factor for Indian state
 * highways and lands within ~10% of real driving distance across Tamil Nadu.
 */
const ROAD_FACTOR = 1.3;

export function distanceKm(from: District, to: District): number {
  if (from.name === to.name) return 0;
  return Math.round(haversine(from, to) * ROAD_FACTOR);
}

/** Every district within `radiusKm` by road, nearest first. Includes itself. */
export function districtsWithin(
  origin: District,
  radiusKm: number,
): { name: string; km: number }[] {
  return DISTRICTS.map((d) => ({ name: d.name, km: distanceKm(origin, d) }))
    .filter((d) => d.km <= radiusKm)
    .sort((a, b) => a.km - b.km);
}

/** Distance between two free-text place strings, or null if either is unknown. */
export function distanceBetween(
  a: string | null | undefined,
  b: string | null | undefined,
): number | null {
  const from = resolveDistrict(a);
  const to = resolveDistrict(b);
  if (!from || !to) return null;
  return distanceKm(from, to);
}

export const DISTRICT_NAMES = DISTRICTS.map((d) => d.name);
