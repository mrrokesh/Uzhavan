// Announcements, demand board and driver verification, against the live API.
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
  if (r.status !== 200) throw new Error(`login ${email} failed: ${r.status} ${JSON.stringify(r.data)}`);
  return r.token ?? r.data.token;
};

// A 1x1 PNG, so uploads are real bytes rather than a placeholder string.
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const run = async () => {
  const admin = await login("admin@uzhavan.app");
  const farmer = await login("arul@uzhavan.app");
  const buyer = await login("karthik@uzhavan.app");
  const driver = await login("selvam@uzhavan.app");

  // ---- Announcements -------------------------------------------------
  console.log("\nAnnouncements");

  const title = `Test notice ${Date.now()}`;
  const created = await call("/admin/announcements", {
    method: "POST",
    token: admin,
    body: { title, body: "Mandi holiday on Friday. Plan your dispatches.", audience: "FARMERS" },
  });
  ok("admin can publish to farmers", created.status === 201, JSON.stringify(created.data));
  const id = created.data?.id;

  const farmerList = await call("/announcements", { token: farmer });
  ok("farmer sees it", farmerList.data?.some((a) => a.title === title));

  const buyerList = await call("/announcements", { token: buyer });
  ok(
    "buyer does NOT see a farmers-only notice",
    !buyerList.data?.some((a) => a.title === title),
  );

  const unread = await call("/announcements/unread-count", { token: farmer });
  ok("farmer has an unread count", (unread.data?.count ?? 0) > 0, JSON.stringify(unread.data));

  const marked = await call("/announcements/read-all", { method: "POST", token: farmer });
  ok("read-all marks them", (marked.data?.marked ?? 0) > 0);

  const after = await call("/announcements/unread-count", { token: farmer });
  ok("unread count drops to zero", after.data?.count === 0, JSON.stringify(after.data));

  const reread = await call("/announcements", { token: farmer });
  ok("the notice now reads as read", reread.data?.find((a) => a.title === title)?.read === true);

  const asFarmer = await call("/admin/announcements", { token: farmer });
  ok("a farmer cannot list the admin view", asFarmer.status === 403, `got ${asFarmer.status}`);

  const farmerPublish = await call("/admin/announcements", {
    method: "POST",
    token: farmer,
    body: { title: "Nope", body: "Should never publish.", audience: "ALL" },
  });
  ok("a farmer cannot publish", farmerPublish.status === 403, `got ${farmerPublish.status}`);

  // An expired notice must not reach the bell.
  const expired = await call("/admin/announcements", {
    method: "POST",
    token: admin,
    body: {
      title: `Expired ${Date.now()}`,
      body: "This one lapsed yesterday and should stay hidden.",
      audience: "ALL",
      expiresAt: new Date(Date.now() - 86400000).toISOString(),
    },
  });
  const feedAfterExpiry = await call("/announcements", { token: farmer });
  ok(
    "an expired notice is hidden",
    !feedAfterExpiry.data?.some((a) => a.id === expired.data?.id),
  );

  // A draft (publish:false) must not reach the bell either.
  const draft = await call("/admin/announcements", {
    method: "POST",
    token: admin,
    body: { title: `Draft ${Date.now()}`, body: "Not published yet, stay hidden.", publish: false },
  });
  const feedAfterDraft = await call("/announcements", { token: farmer });
  ok("a draft is hidden", !feedAfterDraft.data?.some((a) => a.id === draft.data?.id));

  if (id) await call(`/admin/announcements/${id}`, { method: "DELETE", token: admin });
  if (expired.data?.id)
    await call(`/admin/announcements/${expired.data.id}`, { method: "DELETE", token: admin });
  if (draft.data?.id)
    await call(`/admin/announcements/${draft.data.id}`, { method: "DELETE", token: admin });

  // ---- Demand board --------------------------------------------------
  console.log("\nDemand board");

  const demand = await call("/farmer/demand?radiusKm=200", { token: farmer });
  ok("farmer can load it", demand.status === 200, JSON.stringify(demand.data).slice(0, 120));
  ok("it names the origin district", typeof demand.data?.origin === "string");
  ok("trends is an array", Array.isArray(demand.data?.trends));
  ok("buyers is an array", Array.isArray(demand.data?.buyers));
  ok(
    "buyers are sorted nearest first",
    (demand.data?.buyers ?? [])
      .map((b) => b.distanceKm ?? 1e9)
      .every((km, i, a) => i === 0 || a[i - 1] <= km),
  );
  ok(
    "no individual buyer request leaks through",
    !JSON.stringify(demand.data ?? {}).includes("quantityKg"),
  );

  const wide = await call("/farmer/demand?radiusKm=800", { token: farmer });
  ok(
    "a wider radius covers at least as many districts",
    (wide.data?.districtsInRange ?? 0) >= (demand.data?.districtsInRange ?? 0),
  );

  const buyerDemand = await call("/farmer/demand", { token: buyer });
  ok("a buyer cannot read the demand board", buyerDemand.status === 403, `got ${buyerDemand.status}`);

  const badRadius = await call("/farmer/demand?radiusKm=99999", { token: farmer });
  ok("an absurd radius is rejected", badRadius.status === 400, `got ${badRadius.status}`);

  // ---- Driver verification -------------------------------------------
  console.log("\nDriver verification");

  // Leave no state behind from a previous run: a driver stuck in PENDING would
  // make every submission below fail with a 409 that means nothing.
  const meFirst = await call("/auth/me", { token: driver });
  const driverIdEarly = meFirst.data?.user?.id;
  const before = await call("/verification", { token: driver });
  if (before.data?.status === "PENDING") {
    await call(`/verification/queue/${driverIdEarly}`, {
      method: "POST",
      token: admin,
      body: { decision: "REJECTED", reason: "Resetting test fixture." },
    });
  }

  const state = await call("/verification", { token: driver });
  ok("driver verification state loads", state.status === 200);
  ok("it asks for a licence", state.data?.required?.identifier === "licence");
  ok(
    "it asks for all four vehicle papers",
    ["DRIVING_LICENCE", "VEHICLE_RC", "VEHICLE_INSURANCE", "VEHICLE_PERMIT"].every((d) =>
      state.data?.required?.documents?.includes(d),
    ),
    JSON.stringify(state.data?.required),
  );

  const docs = [
    { type: "DRIVING_LICENCE", filename: "dl.png", mimeType: "image/png", data: PNG },
    { type: "VEHICLE_INSURANCE", filename: "ins.png", mimeType: "image/png", data: PNG },
  ];

  const badLicence = await call("/verification", {
    method: "POST",
    token: driver,
    body: { licence: "12345", documents: docs },
  });
  ok("a malformed licence is rejected", badLicence.status === 400, `got ${badLicence.status}`);

  const noLicence = await call("/verification", {
    method: "POST",
    token: driver,
    body: { documents: docs },
  });
  ok("a missing licence is rejected", noLicence.status === 400, `got ${noLicence.status}`);

  const badDate = await call("/verification", {
    method: "POST",
    token: driver,
    body: { licence: "TN3720190001234", insuranceExpiry: "31-03-2027", documents: docs },
  });
  ok("a non-ISO expiry date is rejected", badDate.status === 400, `got ${badDate.status}`);

  const good = await call("/verification", {
    method: "POST",
    token: driver,
    body: {
      licence: "TN3720190001234",
      rcNumber: "TN30AB4821",
      insuranceExpiry: "2027-03-31",
      permitExpiry: "2027-06-30",
      documents: docs,
    },
  });
  ok("a valid driver submission is accepted", good.status === 200 || good.status === 201,
    `${good.status} ${JSON.stringify(good.data)}`);

  const pending = await call("/verification", { token: driver });
  ok("it goes to PENDING", pending.data?.status === "PENDING", JSON.stringify(pending.data?.status));
  ok("both documents are stored", (pending.data?.documents ?? []).length >= 2);
  ok(
    "the licence number is never echoed back",
    !JSON.stringify(pending.data ?? {}).includes("TN3720190001234"),
  );
  ok("only the last 4 are shown", typeof pending.data?.idLast4 === "string");

  const twice = await call("/verification", {
    method: "POST",
    token: driver,
    body: { licence: "TN3720190001234", documents: docs },
  });
  ok("resubmitting while pending is refused", twice.status === 409, `got ${twice.status}`);

  // ---- Review round-trip ---------------------------------------------
  console.log("\nDriver review round-trip");

  const me = await call("/auth/me", { token: driver });
  const driverId = me.data?.user?.id;

  const queue = await call("/verification/queue", { token: admin });
  const row = (queue.data ?? []).find?.((r) => r.id === driverId) ??
    (queue.data?.rows ?? []).find?.((r) => r.id === driverId);
  ok("the driver reaches the review queue", !!row, JSON.stringify(queue.data).slice(0, 160));

  const byDriver = await call("/verification/queue", { token: driver });
  ok("a driver cannot read the queue", byDriver.status === 403, `got ${byDriver.status}`);

  const noReason = await call(`/verification/queue/${driverId}`, {
    method: "POST",
    token: admin,
    body: { decision: "REJECTED" },
  });
  ok("rejecting without a reason is refused", noReason.status === 400, `got ${noReason.status}`);

  const rejected = await call(`/verification/queue/${driverId}`, {
    method: "POST",
    token: admin,
    body: { decision: "REJECTED", reason: "Insurance photo is unreadable — send a clearer one." },
  });
  ok("a reviewer can reject", rejected.status === 200, JSON.stringify(rejected.data).slice(0, 120));

  const back = await call("/verification", { token: driver });
  ok("the driver sees REJECTED", back.data?.status === "REJECTED");
  ok(
    "and is told why",
    (back.data?.rejectionReason ?? "").includes("unreadable"),
    JSON.stringify(back.data?.rejectionReason),
  );

  const again = await call(`/verification/queue/${driverId}`, {
    method: "POST",
    token: admin,
    body: { decision: "VERIFIED" },
  });
  ok("re-deciding a settled account is refused", again.status === 409, `got ${again.status}`);

  // ---- Payment gateways ----------------------------------------------
  console.log("\nPayment gateways");

  const staff = await login("staff@uzhavan.app");

  const staffList = await call("/admin/gateways", { token: staff });
  ok("staff cannot list payment accounts", staffList.status === 403, `got ${staffList.status}`);

  // Sweep anything a previous run left behind, so "leaves no accounts behind"
  // measures this run and not the history of every run before it. Inactive
  // first — the active one may only be deletable once it's the last standing.
  const stale = await call("/admin/gateways", { token: admin });
  for (const g of (stale.data ?? []).filter((x) => x.label.startsWith("Suite account"))) {
    if (!g.active) await call(`/admin/gateways/${g.id}`, { method: "DELETE", token: admin });
  }
  const stale2 = await call("/admin/gateways", { token: admin });
  for (const g of (stale2.data ?? []).filter((x) => x.label.startsWith("Suite account"))) {
    await call(`/admin/gateways/${g.id}`, { method: "DELETE", token: admin });
  }

  const before2 = await call("/admin/gateways", { token: admin });
  const priorActive = (before2.data ?? []).find((g) => g.active)?.id ?? null;

  const addA = await call("/admin/gateways", {
    method: "POST",
    token: admin,
    body: {
      label: "Suite account A",
      keyId: "rzp_test_AAAAAAAAAAAAAA",
      keySecret: "suite-secret-aaaaaaaa",
      activate: false,
    },
  });
  ok("admin can add an account", addA.status === 201, JSON.stringify(addA.data));
  ok("mode is inferred from the key id", addA.data?.mode === "TEST", JSON.stringify(addA.data?.mode));
  const idA = addA.data?.id;

  const addB = await call("/admin/gateways", {
    method: "POST",
    token: admin,
    body: {
      label: "Suite account B",
      keyId: "rzp_live_BBBBBBBBBBBBBB",
      keySecret: "suite-secret-bbbbbbbb",
      activate: false,
    },
  });
  ok("a live key id reads as LIVE", addB.data?.mode === "LIVE", JSON.stringify(addB.data?.mode));
  const idB = addB.data?.id;

  const listed = await call("/admin/gateways", { token: admin });
  const rowA = (listed.data ?? []).find((g) => g.id === idA);
  ok("the account is listed", !!rowA);
  ok(
    "no secret is ever returned",
    !JSON.stringify(listed.data ?? []).includes("suite-secret"),
  );
  ok("webhook secret reads as missing", rowA?.hasWebhookSecret === false);

  const patched = await call(`/admin/gateways/${idA}`, {
    method: "PATCH",
    token: admin,
    body: { webhookSecret: "whsec-suite-12345678" },
  });
  ok("a webhook secret can be attached", patched.status === 200);
  ok("and it is not echoed back", !JSON.stringify(patched.data).includes("whsec-suite"));

  const shortSecret = await call(`/admin/gateways/${idA}`, {
    method: "PATCH",
    token: admin,
    body: { webhookSecret: "short" },
  });
  ok("a too-short webhook secret is rejected", shortSecret.status === 400, `got ${shortSecret.status}`);

  await call(`/admin/gateways/${idA}/activate`, { method: "POST", token: admin });
  const afterA = await call("/admin/gateways", { token: admin });
  ok(
    "activating makes exactly one account active",
    (afterA.data ?? []).filter((g) => g.active).length === 1,
  );
  ok("and it is the right one", (afterA.data ?? []).find((g) => g.active)?.id === idA);

  const deleteActive = await call(`/admin/gateways/${idA}`, { method: "DELETE", token: admin });
  ok(
    "the active account cannot be deleted while another exists",
    deleteActive.status === 409,
    `got ${deleteActive.status}`,
  );

  await call(`/admin/gateways/${idB}/activate`, { method: "POST", token: admin });
  const afterB = await call("/admin/gateways", { token: admin });
  ok("switching moves active across", (afterB.data ?? []).find((g) => g.active)?.id === idB);

  const staffSwitch = await call(`/admin/gateways/${idA}/activate`, { method: "POST", token: staff });
  ok("staff cannot switch the account", staffSwitch.status === 403, `got ${staffSwitch.status}`);

  const removedA = await call(`/admin/gateways/${idA}`, { method: "DELETE", token: admin });
  ok("an unused inactive account can be removed", removedA.status === 200, `got ${removedA.status}`);

  // Put the console back exactly how it was found. When nothing was configured
  // to begin with, B is the last account standing and active — deleting it must
  // still work, or an admin who typo'd their only key would be stuck with it.
  if (priorActive) await call(`/admin/gateways/${priorActive}/activate`, { method: "POST", token: admin });
  const removedLast = await call(`/admin/gateways/${idB}`, { method: "DELETE", token: admin });
  if (!priorActive) {
    ok(
      "the last remaining account can be removed even while active",
      removedLast.status === 200,
      `got ${removedLast.status} ${JSON.stringify(removedLast.data)}`,
    );
  }
  const restored = await call("/admin/gateways", { token: admin });
  ok(
    "the suite leaves no accounts behind",
    !(restored.data ?? []).some((g) => g.label.startsWith("Suite account")),
    JSON.stringify(restored.data),
  );

  // ---- Vehicle tracking ----------------------------------------------
  console.log("\nVehicle tracking");

  const plate = "TN 54 CD 9022";
  const spaced = await call(`/admin/track?plate=${encodeURIComponent(plate)}`, { token: staff });
  ok("staff can track by a spaced plate", spaced.status === 200, JSON.stringify(spaced.data).slice(0, 120));

  const bare2 = await call("/admin/track?plate=TN54CD9022", { token: staff });
  ok("and by the same plate without spaces", bare2.status === 200);
  ok(
    "both find the same truck",
    spaced.data?.[0]?.truck?.id && spaced.data[0].truck.id === bare2.data?.[0]?.truck?.id,
  );

  const partial = await call("/admin/track?plate=9022", { token: staff });
  ok("a partial plate works", partial.status === 200, `got ${partial.status}`);

  const row0 = spaced.data?.[0];
  ok("it names the driver", typeof row0?.driver?.name === "string");
  ok("it reports paper expiry", "insuranceExpired" in (row0?.truck ?? {}));
  ok("currentTrip is present or explicitly null", "currentTrip" in (row0 ?? {}));

  const missing = await call("/admin/track?plate=ZZ99ZZ9999", { token: staff });
  ok("an unknown plate is a clean 404", missing.status === 404, `got ${missing.status}`);

  const tooShort = await call("/admin/track?plate=A", { token: staff });
  ok("a one-character search is rejected", tooShort.status === 400, `got ${tooShort.status}`);

  const buyerTrack = await call("/admin/track?plate=TN54CD9022", { token: buyer });
  ok("a buyer cannot track vehicles", buyerTrack.status === 403, `got ${buyerTrack.status}`);

  // ---- Platform fee --------------------------------------------------
  console.log("\nPlatform fee");

  const FEE_KEY = "platform_fee_percent";
  const settings = await call("/admin/settings", { token: admin });
  const feeRow = (settings.data ?? []).find((s) => s.key === FEE_KEY);
  ok("the fee setting exists", !!feeRow, JSON.stringify((settings.data ?? []).map((s) => s.key)));
  ok("it is not exposed to unauthenticated apps", feeRow?.isPublic === false);

  const original = feeRow?.value ?? "5";

  for (const [label, bad] of [
    ["below the 5% floor", "4.9"],
    ["zero", "0"],
    ["negative", "-5"],
    ["above the 30% ceiling", "31"],
    ["not a number", "five"],
  ]) {
    const r = await call(`/admin/settings/${FEE_KEY}`, {
      method: "PUT",
      token: admin,
      body: { value: bad },
    });
    ok(`a fee ${label} is rejected`, r.status === 400, `got ${r.status}`);
  }

  const atFloor = await call(`/admin/settings/${FEE_KEY}`, {
    method: "PUT",
    token: admin,
    body: { value: "5" },
  });
  ok("exactly 5% is allowed", atFloor.status === 200, `got ${atFloor.status}`);

  const decimal = await call(`/admin/settings/${FEE_KEY}`, {
    method: "PUT",
    token: admin,
    body: { value: "7.5" },
  });
  ok("a decimal rate is allowed", decimal.status === 200, `got ${decimal.status}`);

  // Buyer raises a request on one of the farmer's crops and walks it to an order.
  // Bring our own listing. Reserving quantity is permanent, so consuming a
  // seeded crop would make this suite pass once and fail on every rerun.
  const madeCrop = await call("/farmer/crops", {
    method: "POST",
    token: farmer,
    body: {
      title: `Suite crop ${Date.now()}`,
      category: "Vegetables",
      status: "ready",
      expectedKg: 3000,
      minOrderKg: 500,
      pricePerKg: 40,
      harvestDate: "Ready now",
      about: "Fixture listing created by the automated suite.",
    },
  });
  ok("a fixture crop can be listed", madeCrop.status === 201, JSON.stringify(madeCrop.data).slice(0, 160));
  const crop = madeCrop.data;
  if (!crop?.id) {
    await call(`/farmer/crops/${crop.id}`, { method: "DELETE", token: farmer });

  console.log(`
${pass} passed, ${fail} failed`);
    process.exit(1);
  }

  const QTY = 1000;
  const made = await call("/requests", {
    method: "POST",
    token: buyer,
    body: { cropId: crop.id, quantityKg: QTY },
  });
  ok("buyer can raise a request", made.status === 201, JSON.stringify(made.data).slice(0, 140));
  const reqId = made.data?.id;

  const PRICE = 40;
  const accepted = await call(`/farmer/requests/${reqId}/accept`, {
    method: "POST",
    token: farmer,
    body: { finalPricePerKg: PRICE },
  });
  ok("farmer can accept at a price", accepted.status === 200, `got ${accepted.status}`);

  const goods = QTY * PRICE;
  const expectFee = Math.round((goods * 750) / 10000);

  const buyerView = await call(`/requests/${reqId}`, { token: buyer });
  ok("buyer sees the goods value", buyerView.data?.goodsValue === goods, JSON.stringify(buyerView.data?.goodsValue));
  ok("buyer sees the fee before confirming", buyerView.data?.platformFee === expectFee,
    `${buyerView.data?.platformFee} vs ${expectFee}`);
  ok("buyer sees the total", buyerView.data?.totalPayable === goods + expectFee);
  ok("the rate is 7.5%", buyerView.data?.feeBps === 750, JSON.stringify(buyerView.data?.feeBps));

  const farmerView = await call("/farmer/requests", { token: farmer });
  const mine = (farmerView.data ?? []).find((r) => r.id === reqId);
  ok("the farmer is never shown a fee", mine && mine.platformFee === undefined, JSON.stringify(mine?.platformFee));

  const order = await call(`/requests/${reqId}/confirm`, { method: "POST", token: buyer });
  ok("the order is created", order.status === 201, JSON.stringify(order.data).slice(0, 140));
  ok("the farmer's amount is untouched by the fee", order.data?.value === goods,
    `${order.data?.value} vs ${goods}`);
  ok("the fee is stored on the order", order.data?.platformFee === expectFee);
  ok("the total is stored", order.data?.totalPayable === goods + expectFee);
  ok("the rate is stamped on the order", order.data?.feeBps === 750);

  // Changing the rate must not rewrite an order already placed.
  await call(`/admin/settings/${FEE_KEY}`, { method: "PUT", token: admin, body: { value: "20" } });
  const orders = await call("/orders", { token: buyer });
  const placed = (orders.data ?? []).find((o) => o.id === order.data?.id);
  ok("a later rate change does not rewrite a placed order", placed?.platformFee === expectFee,
    `${placed?.platformFee} vs ${expectFee}`);
  ok("nor its total", placed?.totalPayable === goods + expectFee);

  const farmerSales = await call("/farmer/orders", { token: farmer });
  const sale = (farmerSales.data ?? []).find((o) => o.id === order.data?.id);
  ok("the farmer's sale records their price, not the buyer's total", !sale || sale.value === goods,
    JSON.stringify(sale?.value));

  // The fee is admin-only and not delegable, so even a staffer holding
  // CONFIG_WRITE — which is enough for the support contacts — must be refused.
  const staffFee = await call(`/admin/settings/${FEE_KEY}`, {
    method: "PUT",
    token: staff,
    body: { value: "10" },
  });
  ok("staff cannot change the fee", staffFee.status === 403, `got ${staffFee.status}`);

  const grant = await call("/admin/staff", { token: admin });
  const staffRow = (grant.data ?? []).find((u) => u.email === "staff@uzhavan.app");
  if (staffRow) {
    const withConfig = await call(`/admin/staff/${staffRow.id}/permissions`, {
      method: "PUT",
      token: admin,
      body: { permissions: [...(staffRow.permissions ?? []), "CONFIG_WRITE"] },
    });
    if (withConfig.status === 200) {
      const stillNo = await call(`/admin/settings/${FEE_KEY}`, {
        method: "PUT",
        token: staff,
        body: { value: "10" },
      });
      ok(
        "even CONFIG_WRITE does not unlock the fee",
        stillNo.status === 403,
        `got ${stillNo.status}`,
      );
      const canSupport = await call("/admin/settings/support_hours", {
        method: "PUT",
        token: staff,
        body: { value: "Mon–Sat, 9am – 7pm IST" },
      });
      ok("but CONFIG_WRITE still edits support contacts", canSupport.status === 200,
        `got ${canSupport.status}`);
      await call(`/admin/staff/${staffRow.id}/permissions`, {
        method: "PUT",
        token: admin,
        body: { permissions: staffRow.permissions ?? [] },
      });
    }
  }

  await call(`/admin/settings/${FEE_KEY}`, { method: "PUT", token: admin, body: { value: original } });
  const restoredFee = await call("/admin/settings", { token: admin });
  ok(
    "the fee is put back where it started",
    (restoredFee.data ?? []).find((s) => s.key === FEE_KEY)?.value === original,
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch((err) => {
  console.error("\nsuite crashed:", err.message);
  process.exit(1);
});
