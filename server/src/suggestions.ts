import { prisma } from "./db.js";
import { distanceKm, resolveDistrict, type District } from "./data/districts.js";

/**
 * What to show a buyer, based on what they've actually done.
 *
 * No machine learning and no collaborative filtering — with a few hundred
 * buyers there isn't the data for either, and both would be a black box in a
 * business where people ask "why am I being shown this?". This is a handful of
 * legible signals with weights you can read, and every suggestion carries the
 * reason it was picked.
 *
 * Signals, strongest first:
 *
 *   REPEAT FARM      they've bought from this farm before. In wholesale a
 *                    working relationship beats a marginally better price, so
 *                    this outranks everything.
 *   CATEGORY         they buy tomatoes; here are tomatoes. Weighted by how
 *                    often, and an order counts for more than a saved listing
 *                    because money is a stronger signal than a bookmark.
 *   NEARBY           closer is cheaper to haul and quicker to arrive.
 *   VERIFIED         a checked farm is a safer first order with a stranger.
 *   READY NOW        a harvest they can buy today beats one in three weeks.
 *
 * Cold start matters more than the clever case: most buyers most of the time
 * have little history, so with no signals at all this degrades to "verified
 * farms near you with crops ready now", which is a decent answer rather than
 * an empty screen.
 */

const WEIGHT = {
  repeatFarm: 50,
  /**
   * Per unit of category affinity — see AFFINITY below.
   *
   * Deliberately above `verified` and `readyNow`. Those are quality signals
   * that apply to everyone; this is the one that makes the list *theirs*. A
   * buyer who only deals in tomatoes should not be shown onions first because
   * the onion farm happens to be verified.
   */
  category: 14,
  /** Full marks at 0 km, nothing beyond this. */
  nearbyMax: 30,
  nearbyRangeKm: 300,
  verified: 12,
  readyNow: 10,
  /**
   * Full marks at five stars, nothing at three. Only counted once a farm has
   * enough reviews to mean something — one five-star review is not evidence,
   * and letting it act like evidence rewards whoever asks a friend first.
   */
  ratedWell: 16,
  ratingMinReviews: 3,
  /** A farm they follow, without having bought yet. */
  followedFarm: 15,
} as const;

/** How much each past action says about what someone wants next. */
const AFFINITY = {
  order: 3,
  request: 2,
  saved: 1,
  follow: 1,
} as const;

export type Suggestion = {
  cropId: string;
  score: number;
  /** Shown to the buyer. Never more than one line. */
  reason: string;
};

type Signals = {
  categoryScore: Map<string, number>;
  farmsBoughtFrom: Set<string>;
  farmsFollowed: Set<string>;
  /** Crops they've already asked about — don't suggest those back. */
  seenCropIds: Set<string>;
  origin: District | null;
};

/** Everything we know about one buyer's taste, in one pass. */
export async function readSignals(userId: string): Promise<Signals> {
  const [user, orders, requests, saves, follows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { district: true, districtKey: true },
    }),
    prisma.order.findMany({
      where: { buyerId: userId },
      select: { cropId: true, crop: { select: { category: true, farmId: true } } },
      take: 200,
    }),
    prisma.cropRequest.findMany({
      where: { buyerId: userId },
      select: { cropId: true, crop: { select: { category: true, farmId: true } } },
      take: 200,
    }),
    prisma.savedCrop.findMany({
      where: { userId },
      select: { cropId: true, crop: { select: { category: true, farmId: true } } },
    }),
    prisma.follow.findMany({
      where: { userId },
      select: { cropId: true, crop: { select: { category: true, farmId: true } } },
    }),
  ]);

  const categoryScore = new Map<string, number>();
  const farmsBoughtFrom = new Set<string>();
  const farmsFollowed = new Set<string>();
  const seenCropIds = new Set<string>();

  const note = (
    rows: { cropId: string; crop: { category: string; farmId: string } | null }[],
    weight: number,
    boughtFrom: boolean,
    followed = false,
  ) => {
    for (const r of rows) {
      seenCropIds.add(r.cropId);
      if (!r.crop) continue;
      categoryScore.set(r.crop.category, (categoryScore.get(r.crop.category) ?? 0) + weight);
      if (boughtFrom) farmsBoughtFrom.add(r.crop.farmId);
      if (followed) farmsFollowed.add(r.crop.farmId);
    }
  };

  note(orders, AFFINITY.order, true);
  note(requests, AFFINITY.request, false);
  note(saves, AFFINITY.saved, false);
  note(follows, AFFINITY.follow, false, true);

  return {
    categoryScore,
    farmsBoughtFrom,
    farmsFollowed,
    seenCropIds,
    origin: resolveDistrict(user?.districtKey ?? user?.district ?? null),
  };
}

type Candidate = {
  id: string;
  category: string;
  farmId: string;
  status: string;
  expectedKg: number;
  reservedKg: number;
  farm: { name: string; district: string; districtKey: string | null };
  sellerVerified: boolean;
  rating: number;
  ratingCount: number;
};

/**
 * Score one listing. Returned reason is whichever signal contributed most, so
 * the explanation is always the real reason rather than a plausible-sounding
 * one picked afterwards.
 */
export function score(crop: Candidate, s: Signals): Suggestion | null {
  // Never suggest something they can't buy, or have already engaged with.
  if (crop.expectedKg - crop.reservedKg <= 0) return null;
  if (s.seenCropIds.has(crop.id)) return null;

  const parts: { points: number; reason: string }[] = [];

  if (s.farmsBoughtFrom.has(crop.farmId)) {
    parts.push({ points: WEIGHT.repeatFarm, reason: `You've bought from ${crop.farm.name} before` });
  } else if (s.farmsFollowed.has(crop.farmId)) {
    parts.push({ points: WEIGHT.followedFarm, reason: `From ${crop.farm.name}, a farm you follow` });
  }

  const affinity = s.categoryScore.get(crop.category) ?? 0;
  if (affinity > 0) {
    // Diminishing returns: someone who bought tomatoes twenty times isn't
    // twenty times more interested than someone who bought them twice.
    const points = Math.round(WEIGHT.category * Math.log2(1 + affinity));
    parts.push({ points, reason: `You buy ${crop.category.toLowerCase()}` });
  }

  const farmDistrict = resolveDistrict(crop.farm.districtKey ?? crop.farm.district);
  const km = s.origin && farmDistrict ? distanceKm(s.origin, farmDistrict) : null;
  if (km !== null && km <= WEIGHT.nearbyRangeKm) {
    const points = Math.round(WEIGHT.nearbyMax * (1 - km / WEIGHT.nearbyRangeKm));
    if (points > 0) {
      parts.push({
        points,
        reason: km <= 1 ? `In ${crop.farm.district}` : `About ${km} km away`,
      });
    }
  }

  if (crop.ratingCount >= WEIGHT.ratingMinReviews && crop.rating > 3) {
    const points = Math.round(WEIGHT.ratedWell * ((crop.rating - 3) / 2));
    if (points > 0) {
      parts.push({
        points,
        reason: `Rated ${crop.rating.toFixed(1)} by ${crop.ratingCount} buyers`,
      });
    }
  }

  if (crop.sellerVerified) {
    parts.push({ points: WEIGHT.verified, reason: "Verified farm" });
  }
  if (crop.status === "ready") {
    parts.push({ points: WEIGHT.readyNow, reason: "Ready to collect now" });
  }

  if (parts.length === 0) return null;

  const total = parts.reduce((sum, p) => sum + p.points, 0);
  const best = parts.reduce((a, b) => (b.points > a.points ? b : a));
  return { cropId: crop.id, score: total, reason: best.reason };
}

export function rank(crops: Candidate[], s: Signals, limit: number): Suggestion[] {
  return crops
    .map((c) => score(c, s))
    .filter((x): x is Suggestion => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
