import { PrismaClient } from "@prisma/client";

/**
 * Puts the database back to how it looks straight after a seed.
 *
 * Accounts, farms, crops and trucks stay; everything that accumulates through
 * use goes. That second list is wider than it first appears — a KYC decision, a
 * failed-login lockout, a rating, a payout schedule and a push token all
 * survive an ordinary "clear the orders" reset, and every one of them changes
 * how the app behaves on the next run.
 *
 * Getting this wrong is quietly expensive: a driver left PENDING makes a
 * verification test fail with "already under review", which reads like a
 * regression and isn't one.
 *
 * Run: `npm run db:reset`
 */
const prisma = new PrismaClient();

async function main() {
  // Transactional: trips, orders and the requests that led to them.
  await prisma.bookingEvent.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.payout.deleteMany({});
  await prisma.truckBooking.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.cropRequest.deleteMany({});
  await prisma.follow.deleteMany({});
  await prisma.savedCrop.deleteMany({});
  await prisma.crop.updateMany({ data: { reservedKg: 0 } });

  // Reputation is derived from reviews, which have just gone.
  await prisma.farm.updateMany({ data: { rating: 5, ratingCount: 0 } });
  await prisma.driver.updateMany({ data: { rating: 5, ratingCount: 0 } });

  // KYC. The seed creates nobody verified, so any state here came from use.
  await prisma.kycDocument.deleteMany({});
  await prisma.user.updateMany({
    data: {
      verification: "UNVERIFIED",
      verificationSubmittedAt: null,
      verificationReviewedAt: null,
      verificationReviewedById: null,
      rejectionReason: null,
      gstinEnc: null,
      gstinIndex: null,
      udyamEnc: null,
      udyamIndex: null,
      panEnc: null,
      farmerCardEnc: null,
      farmerCardIndex: null,
      licenceEnc: null,
      licenceIndex: null,
      idLast4: null,
      plusUntil: null,
      buyerRating: 5,
      buyerRatingCount: 0,
      // A lockout outlives a reset otherwise, and the next run can't sign in.
      failedLogins: 0,
      lockedUntil: null,
    },
  });

  // Per-install and per-session leftovers.
  await prisma.passwordReset.deleteMany({});
  await prisma.pushToken.deleteMany({});
  await prisma.linkedAccount.deleteMany({});
  // Personal activity notifications - tied to the requests/orders/trips just cleared above.
  await prisma.notification.deleteMany({});

  console.log(
    "Cleared orders, trips, requests, reviews, payouts, KYC, lockouts, tokens. Reservations released.",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
