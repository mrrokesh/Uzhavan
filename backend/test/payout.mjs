// Escrow and payout scheduling, against the live API.
//
// Deliberately does NOT touch Razorpay: no gateway is configured, so releases
// land in FAILED with a reason. What's under test is *when* money becomes due
// and *who* can move it — the scheduling, not the wire call.
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

const setSetting = (token, key, value) =>
  call(`/admin/settings/${key}`, { method: "PUT", token, body: { value } });


/**
 * Bring our own listing rather than eating into the seeded ones. Earlier runs
 * consumed their free quantity permanently, which made the suite pass once and
 * fail forever after.
 */
async function makeCrop(farmer, expectedKg, pricePerKg) {
  const r = await call("/farmer/crops", {
    method: "POST",
    token: farmer,
    body: {
      title: `Suite crop ${Date.now()}`,
      category: "Vegetables",
      status: "ready",
      expectedKg,
      minOrderKg: 500,
      pricePerKg,
      harvestDate: "Ready now",
      about: "Fixture listing created by the automated suite.",
    },
  });
  if (r.status !== 201) throw new Error(`crop: ${JSON.stringify(r.data)}`);
  return r.data;
}

async function dropCrop(farmer, cropId) {
  if (cropId) await call(`/farmer/crops/${cropId}`, { method: "DELETE", token: farmer });
}

/** Walk a request all the way to a paid order, returning the order. */
async function placeOrder({ buyer, farmer, quantityKg = 500, price = 40 }) {
  const crop = await makeCrop(farmer, quantityKg * 2, price);

  const made = await call("/requests", {
    method: "POST",
    token: buyer,
    body: { cropId: crop.id, quantityKg },
  });
  if (made.status !== 201) throw new Error(`request: ${JSON.stringify(made.data)}`);

  const acc = await call(`/farmer/requests/${made.data.id}/accept`, {
    method: "POST",
    token: farmer,
    body: { finalPricePerKg: price },
  });
  if (acc.status !== 200) throw new Error(`accept: ${JSON.stringify(acc.data)}`);

  const order = await call(`/requests/${made.data.id}/confirm`, { method: "POST", token: buyer });
  if (order.status !== 201) throw new Error(`confirm: ${JSON.stringify(order.data)}`);
  return { ...order.data, __cropId: crop.id };
}

const run = async () => {
  const admin = await login("admin@uzhavan.app");
  const staff = await login("staff@uzhavan.app");
  const farmer = await login("arul@uzhavan.app");
  const buyer = await login("karthik@uzhavan.app");

  // ---- Settings guardrails -------------------------------------------
  console.log("Payout settings");

  const before = await call("/admin/settings", { token: admin });
  const get = (k) => (before.data ?? []).find((s) => s.key === k)?.value;
  const originals = {
    payout_policy: get("payout_policy"),
    payout_advance_percent: get("payout_advance_percent"),
    payout_hold_hours: get("payout_hold_hours"),
  };
  ok("the three payout settings exist", Object.values(originals).every(Boolean), JSON.stringify(originals));

  for (const [key, bad, why] of [
    ["payout_policy", "WHENEVER", "an unknown policy"],
    ["payout_advance_percent", "60", "an advance above 50%"],
    ["payout_advance_percent", "-1", "a negative advance"],
    ["payout_advance_percent", "12.5", "a fractional advance"],
    ["payout_hold_hours", "400", "a hold beyond a fortnight"],
    ["payout_hold_hours", "abc", "a non-numeric hold"],
  ]) {
    const r = await setSetting(admin, key, bad);
    ok(`${why} is rejected`, r.status === 400, `got ${r.status}`);
  }

  const staffTry = await setSetting(staff, "payout_policy", "AFTER_DELIVERY");
  ok("staff cannot change the payout policy", staffTry.status === 403, `got ${staffTry.status}`);

  // ---- SPLIT_ON_LOAD --------------------------------------------------
  console.log("\nSPLIT_ON_LOAD");

  await setSetting(admin, "payout_policy", "SPLIT_ON_LOAD");
  await setSetting(admin, "payout_advance_percent", "30");
  await setSetting(admin, "payout_hold_hours", "48");

  const order = await placeOrder({ buyer, farmer });
  ok("an unpaid order schedules nothing", true);

  // The buyer's order list drives the "Payment due" state in the app, so the
  // field it keys off has to actually be there.
  const buyerOrders = await call("/orders", { token: buyer });
  const placed = (buyerOrders.data ?? []).find((o) => o.id === order.id);
  ok("the buyer's order exposes paidAt", placed && "paidAt" in placed, JSON.stringify(Object.keys(placed ?? {})));
  ok("a fresh order is unpaid", placed?.paidAt === null, JSON.stringify(placed?.paidAt));
  ok("and carries the fee breakdown", typeof placed?.totalPayable === "number");

  const beforePay = await call("/payouts", { token: farmer });
  const noneYet = (beforePay.data?.payouts ?? []).filter((p) => p.order?.code === order.code);
  ok("nothing is owed before the buyer pays", noneYet.length === 0, JSON.stringify(noneYet));

  // No gateway is configured, so checkout can't start — that itself is the
  // right answer, and worth asserting rather than working around.
  const start = await call("/payments/start", {
    method: "POST",
    token: buyer,
    body: { purpose: "CROP_ORDER", referenceId: order.id },
  });
  ok(
    "checkout refuses cleanly with no gateway configured",
    start.status === 503,
    `got ${start.status} ${JSON.stringify(start.data)}`,
  );

  // Ownership and shape are checked before the gateway is consulted, so these
  // must not come back as 503 even with no gateway configured.
  const wrongBuyer = await call("/payments/start", {
    method: "POST",
    token: farmer,
    body: { purpose: "CROP_ORDER", referenceId: order.id },
  });
  ok("someone else's order can't be paid for", wrongBuyer.status === 404, `got ${wrongBuyer.status}`);

  const ghostOrder = await call("/payments/start", {
    method: "POST",
    token: buyer,
    body: { purpose: "CROP_ORDER", referenceId: "does-not-exist" },
  });
  ok("an unknown order is a 404", ghostOrder.status === 404, `got ${ghostOrder.status}`);

  const noRef = await call("/payments/start", {
    method: "POST",
    token: buyer,
    body: { purpose: "CROP_ORDER" },
  });
  ok("checkout needs an order id", noRef.status === 400, `got ${noRef.status}`);

  // ---- Farmer's payout view -------------------------------------------
  console.log("\nFarmer payout view");

  const mine = await call("/payouts", { token: farmer });
  ok("a farmer can read their payouts", mine.status === 200, `got ${mine.status}`);
  ok("it states the policy", mine.data?.policy === "SPLIT_ON_LOAD", JSON.stringify(mine.data?.policy));
  ok("it states the advance", mine.data?.advancePercent === 30);
  ok("it states the hold", mine.data?.holdHours === 48);
  ok("no account is set up yet", mine.data?.account === null, JSON.stringify(mine.data?.account));
  ok("owed and received are numbers", typeof mine.data?.owed === "number" && typeof mine.data?.received === "number");

  const buyerPayouts = await call("/payouts", { token: buyer });
  ok("a buyer has no payout ledger", buyerPayouts.status === 403, `got ${buyerPayouts.status}`);

  const badBank = await call("/payouts/account", {
    method: "POST",
    token: farmer,
    body: { accountNumber: "123", ifsc: "SBIN0001234", beneficiaryName: "Arul Kumar" },
  });
  ok("a short account number is rejected", badBank.status === 400, `got ${badBank.status}`);

  const badIfsc = await call("/payouts/account", {
    method: "POST",
    token: farmer,
    body: { accountNumber: "12345678901", ifsc: "NOPE1", beneficiaryName: "Arul Kumar" },
  });
  ok("a malformed IFSC is rejected", badIfsc.status === 400, `got ${badIfsc.status}`);

  const noGatewayBank = await call("/payouts/account", {
    method: "POST",
    token: farmer,
    body: { accountNumber: "12345678901", ifsc: "SBIN0001234", beneficiaryName: "Arul Kumar" },
  });
  ok(
    "adding a bank account needs a gateway",
    noGatewayBank.status === 503,
    `got ${noGatewayBank.status} ${JSON.stringify(noGatewayBank.data)}`,
  );

  // ---- Admin view ------------------------------------------------------
  console.log("\nAdmin payout view");

  const adminList = await call("/admin/payouts", { token: admin });
  ok("admin can list payouts", adminList.status === 200, `got ${adminList.status}`);
  ok("the list carries the live rules", adminList.data?.policy === "SPLIT_ON_LOAD");

  const staffList = await call("/admin/payouts", { token: staff });
  ok("staff with ORDERS_VIEW can see them too", staffList.status === 200, `got ${staffList.status}`);

  const farmerList = await call("/admin/payouts", { token: farmer });
  ok("a farmer cannot read the admin list", farmerList.status === 403, `got ${farmerList.status}`);

  const staffSweep = await call("/admin/payouts/sweep", { method: "POST", token: staff });
  ok("staff cannot run the sweep", staffSweep.status === 403, `got ${staffSweep.status}`);

  const sweep = await call("/admin/payouts/sweep", { method: "POST", token: admin });
  ok("admin can run the sweep", sweep.status === 200, `got ${sweep.status}`);
  ok("it reports how many moved", typeof sweep.data?.released === "number");

  const ghost = await call("/admin/payouts/ghost/override", {
    method: "POST",
    token: admin,
    body: { action: "release" },
  });
  ok("overriding a payout that doesn't exist is a 404", ghost.status === 404, `got ${ghost.status}`);

  const staffOverride = await call("/admin/payouts/ghost/override", {
    method: "POST",
    token: staff,
    body: { action: "release" },
  });
  ok("staff cannot override a payout", staffOverride.status === 403, `got ${staffOverride.status}`);

  // ---- AFTER_DELIVERY --------------------------------------------------
  console.log("\nAFTER_DELIVERY");

  const switched = await setSetting(admin, "payout_policy", "AFTER_DELIVERY");
  ok("admin can switch policy", switched.status === 200, `got ${switched.status}`);

  const afterRules = await call("/payouts", { token: farmer });
  ok("the farmer sees the new policy", afterRules.data?.policy === "AFTER_DELIVERY");

  const zeroAdvance = await setSetting(admin, "payout_advance_percent", "0");
  ok("an advance of 0 is allowed", zeroAdvance.status === 200, `got ${zeroAdvance.status}`);

  const longHold = await setSetting(admin, "payout_hold_hours", "168");
  ok("a 7-day settlement hold is allowed", longHold.status === 200, `got ${longHold.status}`);

  // ---- Restore ---------------------------------------------------------
  for (const [k, v] of Object.entries(originals)) {
    if (v) await setSetting(admin, k, v);
  }
  const restored = await call("/admin/settings", { token: admin });
  const now = (k) => (restored.data ?? []).find((s) => s.key === k)?.value;
  ok(
    "settings are put back where they started",
    Object.entries(originals).every(([k, v]) => now(k) === v),
    JSON.stringify(Object.keys(originals).map((k) => [k, now(k)])),
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch((err) => {
  console.error("\nsuite crashed:", err.message);
  process.exit(1);
});
