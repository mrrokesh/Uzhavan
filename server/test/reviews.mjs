// Ratings and reviews, against the live API.
const BASE = process.env.UZHAVAN_API ?? "http://127.0.0.1:4000/api";

let pass = 0;
let fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

async function withRetry(fn, tries = 4) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    last = await fn();
    if (last.status !== 503) return last;
    await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  return last;
}

async function callOnce(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const call = (path, options) => withRetry(() => callOnce(path, options));

const login = async (email, password = "uzhavan123") => {
  const r = await call("/auth/login", { method: "POST", body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status}`);
  return r.data.token;
};

const run = async () => {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const farmer = await login("arul@uzhavan.app");
  const otherFarmer = await login("muthu@uzhavan.app");
  const buyer = await login("karthik@uzhavan.app");

  // A listing of our own, so this suite doesn't eat into the seeded ones.
  const cropRes = await call("/farmer/crops", {
    method: "POST",
    token: farmer,
    body: {
      title: `Review fixture ${Date.now()}`,
      category: "Vegetables",
      status: "ready",
      expectedKg: 4000,
      minOrderKg: 500,
      pricePerKg: 30,
      harvestDate: "Ready now",
      about: "Fixture listing created by the automated suite.",
    },
  });
  const crop = cropRes.data;

  const made = await call("/requests", {
    method: "POST",
    token: buyer,
    body: { cropId: crop.id, quantityKg: 1000 },
  });
  await call(`/farmer/requests/${made.data.id}/accept`, {
    method: "POST",
    token: farmer,
    body: { finalPricePerKg: 30 },
  });
  const orderRes = await call(`/requests/${made.data.id}/confirm`, {
    method: "POST",
    token: buyer,
  });
  const order = orderRes.data;

  console.log("Before delivery");

  const early = await call(`/orders/${order.id}/reviews`, {
    method: "POST",
    token: buyer,
    body: { subject: "FARM", stars: 5 },
  });
  ok("an undelivered order can't be reviewed", early.status === 409, `got ${early.status}`);

  const state = await call(`/orders/${order.id}/reviews`, { token: buyer });
  ok("and the server says so", state.data?.canReview === false, JSON.stringify(state.data));

  // Mark it delivered directly. The delivery path itself is covered by e2e;
  // what's under test here is what becomes possible afterwards.
  await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });

  console.log("\nAfter delivery");

  const now = await call(`/orders/${order.id}/reviews`, { token: buyer });
  ok("the buyer may now review", now.data?.canReview === true, JSON.stringify(now.data));
  ok(
    "and is offered the farm",
    (now.data?.subjects ?? []).some((s) => s.subject === "FARM"),
    JSON.stringify(now.data?.subjects),
  );
  ok(
    "but not the driver, since nobody carried it",
    !(now.data?.subjects ?? []).some((s) => s.subject === "DRIVER"),
  );

  const farmerView = await call(`/orders/${order.id}/reviews`, { token: farmer });
  ok(
    "the farmer is offered the buyer",
    (farmerView.data?.subjects ?? []).some((s) => s.subject === "BUYER"),
    JSON.stringify(farmerView.data?.subjects),
  );

  const stranger = await call(`/orders/${order.id}/reviews`, { token: otherFarmer });
  ok("someone not on the order sees nothing", stranger.status === 404, `got ${stranger.status}`);

  console.log("\nWriting one");

  const zero = await call(`/orders/${order.id}/reviews`, {
    method: "POST",
    token: buyer,
    body: { subject: "FARM", stars: 0 },
  });
  ok("zero stars is rejected", zero.status === 400, `got ${zero.status}`);

  const six = await call(`/orders/${order.id}/reviews`, {
    method: "POST",
    token: buyer,
    body: { subject: "FARM", stars: 6 },
  });
  ok("six stars is rejected", six.status === 400, `got ${six.status}`);

  const wrongWay = await call(`/orders/${order.id}/reviews`, {
    method: "POST",
    token: buyer,
    body: { subject: "BUYER", stars: 5 },
  });
  ok("a buyer can't review themselves", wrongWay.status === 403, `got ${wrongWay.status}`);

  const farmerRatingFarm = await call(`/orders/${order.id}/reviews`, {
    method: "POST",
    token: farmer,
    body: { subject: "FARM", stars: 5 },
  });
  ok("a farmer can't rate their own farm", farmerRatingFarm.status === 403, `got ${farmerRatingFarm.status}`);

  const noDriver = await call(`/orders/${order.id}/reviews`, {
    method: "POST",
    token: buyer,
    body: { subject: "DRIVER", stars: 5 },
  });
  ok("no driver means no driver review", noDriver.status === 409, `got ${noDriver.status}`);

  const written = await call(`/orders/${order.id}/reviews`, {
    method: "POST",
    token: buyer,
    body: { subject: "FARM", stars: 4, comment: "Good size, arrived a day late." },
  });
  ok("a real review is accepted", written.status === 201, JSON.stringify(written.data));

  const farm1 = await prisma.farm.findUnique({ where: { id: crop.farmId } });
  ok("the farm average updates", farm1?.rating === 4, `${farm1?.rating}`);
  ok("and counts one review", farm1?.ratingCount === 1, `${farm1?.ratingCount}`);

  console.log("\nOne verdict per trade");

  const edited = await call(`/orders/${order.id}/reviews`, {
    method: "POST",
    token: buyer,
    body: { subject: "FARM", stars: 5, comment: "They called to explain. Fair enough." },
  });
  ok("the same review can be revised", edited.status === 201);

  const farm2 = await prisma.farm.findUnique({ where: { id: crop.farmId } });
  ok("the average follows the revision", farm2?.rating === 5, `${farm2?.rating}`);
  ok("and it is still one review, not two", farm2?.ratingCount === 1, `${farm2?.ratingCount}`);

  console.log("\nWhat other people see");

  const farmerRatesBuyer = await call(`/orders/${order.id}/reviews`, {
    method: "POST",
    token: farmer,
    body: { subject: "BUYER", stars: 5, comment: "Paid on the day, no fuss." },
  });
  ok("a farmer can rate the buyer", farmerRatesBuyer.status === 201, `got ${farmerRatesBuyer.status}`);

  const buyerRep = await prisma.user.findFirst({ where: { email: "karthik@uzhavan.app" } });
  ok("the buyer's own rating updates", buyerRep?.buyerRatingCount >= 1, `${buyerRep?.buyerRatingCount}`);

  const listed = await call(`/reviews/FARM/${crop.farmId}`, { token: buyer });
  ok("reviews are readable", listed.status === 200, `got ${listed.status}`);
  ok("with an average", listed.data?.rating === 5, `${listed.data?.rating}`);
  ok(
    "flagged as not yet established on one review",
    listed.data?.established === false,
    `count=${listed.data?.count}`,
  );
  ok(
    "the reviewer is only a first name",
    (listed.data?.reviews ?? []).every((r) => !r.author.includes(" ")),
    JSON.stringify((listed.data?.reviews ?? []).map((r) => r.author)),
  );
  ok(
    "no business name is attached to a review",
    !JSON.stringify(listed.data ?? {}).includes("Karthik Traders"),
  );

  const badSubject = await call(`/reviews/EVERYONE/${crop.farmId}`, { token: buyer });
  ok("an unknown subject is rejected", badSubject.status === 400, `got ${badSubject.status}`);

  const anon = await call(`/reviews/FARM/${crop.farmId}`);
  ok("signing in is required to read them", anon.status === 401, `got ${anon.status}`);

  // Tidy up: the fixture crop, its order and the reviews cascade with it.
  await prisma.review.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
  await prisma.cropRequest.deleteMany({ where: { cropId: crop.id } });
  await prisma.crop.delete({ where: { id: crop.id } }).catch(() => {});
  await prisma.farm.update({
    where: { id: crop.farmId },
    data: { rating: 5, ratingCount: 0 },
  });
  await prisma.$disconnect();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch((err) => {
  console.error("\nsuite crashed:", err.message);
  process.exit(1);
});
