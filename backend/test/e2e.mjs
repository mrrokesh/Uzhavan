// End-to-end test of the three-sided marketplace against the live API.
const BASE = process.env.UZHAVAN_API ?? "http://localhost:4000/api";

let pass = 0;
let fail = 0;

function ok(label, cond, extra = "") {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${label}${extra ? ` — ${extra}` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${label}${extra ? ` — ${extra}` : ""}`);
  }
}

/**
 * 503 is our own "busy, try again" — the shared Postgres host runs out of lock
 * table under load and the API says so deliberately. Honour that contract here
 * too, or the suite measures the database's mood rather than the product.
 */
async function withRetry(fn, tries = 4) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    last = await fn();
    if (last.status !== 503) return last;
    await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  return last;
}

async function callOnce(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { status: res.status, data };
}

const call = (path, options) => withRetry(() => callOnce(path, options));

async function login(email) {
  const r = await call("/auth/login", {
    method: "POST",
    body: { email, password: "uzhavan123" },
  });
  if (r.status !== 200) throw new Error(`login ${email} failed: ${JSON.stringify(r.data)}`);
  return r.token ?? r.data.token;
}

const section = (s) => console.log(`\n${s}`);

const run = async () => {
  section("1. Authentication & roles");
  const buyer = await login("karthik@uzhavan.app");
  const farmer = await login("muthu@uzhavan.app");
  const driver = await login("selvam@uzhavan.app");
  ok("buyer, farmer, driver all sign in", !!buyer && !!farmer && !!driver);

  const badPw = await call("/auth/login", {
    method: "POST",
    body: { email: "karthik@uzhavan.app", password: "wrong" },
  });
  ok("wrong password rejected", badPw.status === 401, badPw.data?.error);

  const noAuth = await call("/orders");
  ok("unauthenticated request rejected", noAuth.status === 401);

  section("2. Role enforcement");
  const buyerOnFarmer = await call("/farmer/crops", { token: buyer });
  ok("buyer blocked from farmer routes", buyerOnFarmer.status === 403, buyerOnFarmer.data?.error);

  const driverOnOrders = await call("/orders", { token: driver });
  ok("driver blocked from buyer routes", driverOnOrders.status === 403, driverOnOrders.data?.error);

  const farmerOnDriver = await call("/driver/jobs", { token: farmer });
  ok("farmer blocked from driver routes", farmerOnDriver.status === 403);

  section("3. Farmer lists a crop");
  const created = await call("/farmer/crops", {
    method: "POST",
    token: farmer,
    body: {
      title: "Test Millet",
      category: "Grains · Millet",
      grade: "Grade A",
      status: "ready",
      expectedKg: 4000,
      minOrderKg: 500,
      pricePerKg: 60,
      harvestDate: "20 Sep 2026",
      about: "Test listing created by the automated end-to-end check.",
      imageKey: "farm",
      galleryKeys: ["farm"],
      listed: true,
      hasVideo: false,
    },
  });
  ok("farmer creates a listing", created.status === 201, created.data?.title);
  const cropId = created.data?.id;

  const badCrop = await call("/farmer/crops", {
    method: "POST",
    token: farmer,
    body: {
      title: "Bad", category: "X", status: "ready", expectedKg: 100,
      minOrderKg: 500, pricePerKg: 10, harvestDate: "x", about: "too short here ok",
    },
  });
  ok("min order > expected rejected", badCrop.status === 400, badCrop.data?.error);

  section("4. Buyer browses");
  const feed = await call("/crops", { token: buyer });
  ok("new listing visible to buyer", feed.data?.crops?.some((c) => c.id === cropId), `${feed.data?.count} crops`);

  const search = await call("/crops?q=millet", { token: buyer });
  ok("search finds it", search.data?.count >= 1);

  const readyOnly = await call("/crops?status=ready", { token: buyer });
  ok("status filter works", readyOnly.data?.crops?.every((c) => c.status === "ready"));

  section("5. Buyer requests a quantity");
  const tooSmall = await call("/requests", {
    method: "POST", token: buyer, body: { cropId, quantityKg: 100 },
  });
  ok("below minimum order rejected", tooSmall.status === 400, tooSmall.data?.error);

  const tooBig = await call("/requests", {
    method: "POST", token: buyer, body: { cropId, quantityKg: 99999 },
  });
  ok("above availability rejected", tooBig.status === 400, tooBig.data?.error);

  const req = await call("/requests", {
    method: "POST", token: buyer, body: { cropId, quantityKg: 2000 },
  });
  ok("request created", req.status === 201, req.data?.code);
  const requestId = req.data?.id;

  const dupe = await call("/requests", {
    method: "POST", token: buyer, body: { cropId, quantityKg: 500 },
  });
  ok("duplicate open request blocked", dupe.status === 409, dupe.data?.error);

  section("5b. Buyer edits the quantity on their own request");
  // "Edit" used to be wired to this same create route, which is exactly what
  // just got refused above — there was no edit path at all, client or server.
  const editTooSmall = await call(`/requests/${requestId}`, {
    method: "PATCH", token: buyer, body: { quantityKg: 100 },
  });
  ok("edit below minimum order rejected", editTooSmall.status === 400, editTooSmall.data?.error);

  const editTooBig = await call(`/requests/${requestId}`, {
    method: "PATCH", token: buyer, body: { quantityKg: 99999 },
  });
  ok("edit above availability rejected", editTooBig.status === 400, editTooBig.data?.error);

  const wrongRole = await call(`/requests/${requestId}`, {
    method: "PATCH", token: farmer, body: { quantityKg: 1500 },
  });
  ok("a farmer cannot edit a buyer's request", wrongRole.status === 403, wrongRole.data?.error);

  const edited = await call(`/requests/${requestId}`, {
    method: "PATCH", token: buyer, body: { quantityKg: 1500 },
  });
  ok("edit succeeds while pending", edited.status === 200, `${edited.data?.quantityKg} kg`);
  ok("quantity actually changed", edited.data?.quantityKg === 1500);
  ok("estimatedValue recomputed at the crop's listed price", edited.data?.estimatedValue === 1500 * 60);

  // Restore, so the rest of the suite sees the quantity it expects.
  await call(`/requests/${requestId}`, { method: "PATCH", token: buyer, body: { quantityKg: 2000 } });

  section("6. Buyer cannot self-approve (the old demo shortcut)");
  const selfAccept = await call(`/farmer/requests/${requestId}/accept`, {
    method: "POST", token: buyer, body: {},
  });
  ok("buyer cannot accept their own request", selfAccept.status === 403, selfAccept.data?.error);

  const earlyConfirm = await call(`/requests/${requestId}/confirm`, { method: "POST", token: buyer });
  ok("cannot confirm before farmer accepts", earlyConfirm.status === 409, earlyConfirm.data?.error);

  section("7. Farmer prices and accepts");
  const inbox = await call("/farmer/requests", { token: farmer });
  ok("request appears in farmer inbox", inbox.data?.some((r) => r.id === requestId));

  const otherFarmer = await login("arul@uzhavan.app");
  const wrongFarmer = await call(`/farmer/requests/${requestId}/accept`, {
    method: "POST", token: otherFarmer, body: {},
  });
  ok("another farmer cannot touch it", wrongFarmer.status === 404);

  const accepted = await call(`/farmer/requests/${requestId}/accept`, {
    method: "POST", token: farmer, body: { finalPricePerKg: 65 },
  });
  ok("farmer accepts with a final price", accepted.status === 200, `₹${accepted.data?.finalPricePerKg}/kg`);

  const editAfterAccept = await call(`/requests/${requestId}`, {
    method: "PATCH", token: buyer, body: { quantityKg: 1800 },
  });
  ok(
    "editing is refused once the farmer has priced it",
    editAfterAccept.status === 409,
    editAfterAccept.data?.error,
  );

  section("8. Buyer confirms → order created, stock reserved");
  const order = await call(`/requests/${requestId}/confirm`, { method: "POST", token: buyer });
  ok("order created", order.status === 201, `${order.data?.code} ₹${order.data?.value}`);
  ok("order value uses the farmer's final price", order.data?.value === 2000 * 65);
  const orderId = order.data?.id;

  const cropNow = await call(`/crops/${cropId}`, { token: buyer });
  ok("crop stock reserved", cropNow.data?.reservedKg === 2000, `reservedKg=${cropNow.data?.reservedKg}`);

  section("9. Truck selection");
  const trucks = await call(`/trucks?loadKg=2000`, { token: buyer });
  const small = trucks.data?.find((t) => t.capacityKg < 2000);
  ok("undersized truck flagged, not hidden", !!small && small.tooSmall === true, small?.name);
  const bigEnough = trucks.data?.filter((t) => !t.tooSmall) ?? [];
  ok("suitable trucks offered", bigEnough.length > 0, `${bigEnough.length} trucks`);

  const tooSmallTruck = small ? await call("/bookings", {
    method: "POST", token: buyer, body: { orderId, truckId: small.id },
  }) : { status: 400 };
  ok("booking an undersized truck rejected", tooSmallTruck.status === 400, tooSmallTruck.data?.error);

  section("10. Buyer books and pays");
  const truckId = bigEnough[0].id;
  const fare = await call(`/bookings/quote/fare?truckId=${truckId}`, { token: buyer });
  ok("fare quoted from the real truck price", fare.data?.total === fare.data.baseFare + 350 + 200,
    `₹${fare.data?.total}`);

  const booking = await call("/bookings", {
    method: "POST", token: buyer, body: { orderId, truckId },
  });
  ok("booking created", booking.status === 201, booking.data?.code);
  const bookingId = booking.data?.id;
  ok("booking starts unpaid", booking.data?.status === "PENDING");

  const paid = await call(`/bookings/${bookingId}/pay`, { method: "POST", token: buyer });
  ok("payment moves it to PAID", paid.data?.status === "PAID");

  section("11. Buyer cannot drive the truck (old demo shortcut)");
  const buyerAdvance = await call(`/driver/trips/${bookingId}/advance`, { method: "POST", token: buyer, body: {} });
  ok("buyer cannot advance trip status", buyerAdvance.status === 403, buyerAdvance.data?.error);

  section("12. Driver runs the trip");
  const whichDriver = bigEnough[0].driver;
  const driverEmails = { Selvam: "selvam@uzhavan.app", "Ramesh Kumar": "ramesh@uzhavan.app", "Vikram Raj": "vikram@uzhavan.app" };
  const tripDriver = await login(driverEmails[whichDriver.name]);

  const jobs = await call("/driver/jobs", { token: tripDriver });
  ok("job appears on the right driver's board", jobs.data?.some((j) => j.id === bookingId), whichDriver.name);

  const wrongDriver = await call(`/driver/trips/${bookingId}/advance`, {
    method: "POST", token: await login(driverEmails[Object.keys(driverEmails).find((n) => n !== whichDriver.name)]), body: {},
  });
  ok("another driver cannot take it", wrongDriver.status === 404);

  const steps = ["ACCEPTED", "ARRIVED_PICKUP", "LOADED", "IN_TRANSIT"];
  let okSteps = true;
  for (const expected of steps) {
    const r = await call(`/driver/trips/${bookingId}/advance`, { method: "POST", token: tripDriver, body: {} });
    if (r.data?.status !== expected) { okSteps = false; console.log(`      got ${r.data?.status}, wanted ${expected}`); }
  }
  ok("driver steps accept → reached → loaded → in transit", okSteps);

  const noProof = await call(`/driver/trips/${bookingId}/advance`, { method: "POST", token: tripDriver, body: {} });
  ok("delivery requires proof of receipt", noProof.status === 400, noProof.data?.error);

  const delivered = await call(`/driver/trips/${bookingId}/advance`, {
    method: "POST", token: tripDriver, body: { receivedBy: "Ramesh Kumar" },
  });
  ok("delivered with proof", delivered.data?.status === "DELIVERED", delivered.data?.proofReceivedBy);

  const afterEnd = await call(`/driver/trips/${bookingId}/advance`, { method: "POST", token: tripDriver, body: {} });
  ok("cannot advance past delivered", afterEnd.status === 409);

  section("13. Buyer sees the finished trip");
  const finalOrder = await call(`/orders/${orderId}`, { token: buyer });
  ok("order marked delivered", finalOrder.data?.status === "DELIVERED");
  ok("proof visible to buyer", finalOrder.data?.booking?.proofReceivedBy === "Ramesh Kumar");
  ok("trip timeline recorded", (finalOrder.data?.booking?.events?.length ?? 0) >= 6,
    `${finalOrder.data?.booking?.events?.length} events`);

  section("14. Driver stats updated");
  const dsum = await call("/driver/summary", { token: tripDriver });
  ok("completed trip counted", dsum.data?.completedTrips >= 1);
  ok("earnings recorded", dsum.data?.earnings >= fare.data.total);

  section("15. Farmer sees the sale");
  const fsum = await call("/farmer/summary", { token: farmer });
  ok("sale shows in farmer summary", fsum.data?.orderCount >= 1, `₹${fsum.data?.salesValue}`);

  section("16. Cleanup");
  const del = await call(`/farmer/crops/${cropId}`, { method: "DELETE", token: farmer });
  ok("crop with sales is unlisted, not destroyed", del.data?.unlisted === true);

  console.log(`\n${"=".repeat(46)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log("=".repeat(46));
  process.exit(fail > 0 ? 1 : 0);
};

run().catch((e) => {
  console.error("\nTest run crashed:", e.message);
  process.exit(1);
});
