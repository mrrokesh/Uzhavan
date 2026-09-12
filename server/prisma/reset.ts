import { PrismaClient } from "@prisma/client";

/**
 * Clears transactional data (trips, orders, requests, follows, saves) but keeps
 * accounts, farms, crops and trucks. Run: `npm run db:reset`
 */
const prisma = new PrismaClient();

async function main() {
  await prisma.bookingEvent.deleteMany({});
  await prisma.truckBooking.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.cropRequest.deleteMany({});
  await prisma.follow.deleteMany({});
  await prisma.savedCrop.deleteMany({});
  await prisma.crop.updateMany({ data: { reservedKg: 0 } });
  console.log("Cleared trips, orders, requests, follows, saves. Reservations released.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
