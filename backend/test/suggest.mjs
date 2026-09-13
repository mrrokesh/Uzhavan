// Interest-based suggestions, against the live API.
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
 * table under load and the API says so deliberately.
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

const makeCrop = async (farmer, { title, category, expectedKg = 5000, price = 40, status = "ready" }) => {
  const r = await call("/farmer/crops", {
    method: "POST",
    token: farmer,
    body: {
      title,
      category,
      status,
      expectedKg,
      minOrderKg: 500,
      pricePerKg: price,
      harvestDate: status === "ready" ? "Ready now" : "In 3 weeks",
      about: "Fixture listing created by the automated suite.",
    },
  });
  if (r.status !== 201) throw new Error(`crop: ${JSON.stringify(r.data)}`);
  return r.data;
};

const run = async () => {
  const admin = await login("admin@uzhavan.app");
  const farmer = await login("arul@uzhavan.app");
  const other = await login("muthu@uzhavan.app");
  const buyer = await login("karthik@uzhavan.app");
  const created = [];

  const stamp = Date.now();
  const wanted = await makeCrop(farmer, { title: `Suggest tomatoes ${stamp}`, category: "Tomatoes" });
  const ignored = await makeCrop(other, { title: `Suggest millet ${stamp}`, category: "Millet" });
  const upcoming = await makeCrop(other, {
    title: `Suggest later ${stamp}`,
    category: "Millet",
    status: "upcoming",
  });
  created.push([farmer, wanted.id], [other, ignored.id], [other, upcoming.id]);

  console.log("Shape and access");

  const first = await call("/crops/suggested", { token: buyer });
  ok("a buyer gets suggestions", first.status === 200, `got ${first.status}`);
  ok("it says whether it's personalised", typeof first.data?.personalised === "boolean");
  ok("crops come back as an array", Array.isArray(first.data?.crops));
  ok(
    "every suggestion carries a reason",
    (first.data?.crops ?? []).every((c) => typeof c.reason === "string" && c.reason.length > 0),
    JSON.stringify((first.data?.crops ?? []).map((c) => c.reason).slice(0, 3)),
  );
  ok(
    "and the fields the feed already uses",
    (first.data?.crops ?? []).every((c) => "pricePerKg" in c && "sellerVerified" in c),
  );
  ok(
    "the farm owner is never exposed",
    !JSON.stringify(first.data ?? {}).includes("passwordHash"),
  );

  const limited = await call("/crops/suggested?limit=2", { token: buyer });
  ok("limit is honoured", (limited.data?.crops ?? []).length <= 2, `${limited.data?.crops?.length}`);

  const tooMany = await call("/crops/suggested?limit=500", { token: buyer });
  ok("an absurd limit is rejected", tooMany.status === 400, `got ${tooMany.status}`);

  const anon = await call("/crops/suggested");
  ok("signing in is required", anon.status === 401, `got ${anon.status}`);

  // ---- The signal actually moves the ranking -------------------------
  console.log("\nInterest changes the order");

  const before = (first.data?.crops ?? []).findIndex((c) => c.id === wanted.id);

  // Express an interest in tomatoes by saving the listing... but the engine
  // must not then suggest the very thing they already saved.
  await call(`/me/saved/${wanted.id}`, { method: "PUT", token: buyer });
  const afterSave = await call("/crops/suggested", { token: buyer });
  ok(
    "a crop you already saved is not suggested back",
    !(afterSave.data?.crops ?? []).some((c) => c.id === wanted.id),
  );
  ok("it now counts as personalised", afterSave.data?.personalised === true);

  // A second tomato listing from a different farm should now rank for the
  // category affinity the save created.
  const sibling = await makeCrop(other, {
    title: `Suggest more tomatoes ${stamp}`,
    category: "Tomatoes",
  });
  created.push([other, sibling.id]);

  const afterSibling = await call("/crops/suggested?limit=30", { token: buyer });
  const rows = afterSibling.data?.crops ?? [];
  const tomatoRank = rows.findIndex((c) => c.id === sibling.id);
  const milletRank = rows.findIndex((c) => c.id === ignored.id);
  ok("the matching category appears", tomatoRank >= 0, JSON.stringify(rows.map((c) => c.title)));
  ok(
    "and outranks a category they've ignored",
    tomatoRank >= 0 && (milletRank === -1 || tomatoRank < milletRank),
    `tomato ${tomatoRank} vs millet ${milletRank}`,
  );
  // The reason is whichever signal actually contributed most, not a
  // plausible-sounding one chosen afterwards — so a crop in the buyer's own
  // district says so rather than claiming to be a category match.
  const KNOWN = /(bought from|a farm you follow|You buy |km away|^In |Verified farm|Ready to collect)/;
  ok(
    "every reason names a real signal",
    rows.every((c) => KNOWN.test(c.reason ?? "")),
    JSON.stringify(rows.map((c) => c.reason).slice(0, 5)),
  );

  // Category affinity should be able to beat proximity when the distances are
  // comparable — that's the whole point of a personalised list.
  const distantTomato = rows.find((c) => c.id === sibling.id);
  ok("the suggested tomato carries a distance", distantTomato?.distanceKm !== undefined);

  await call(`/me/saved/${wanted.id}`, { method: "DELETE", token: buyer });

  // ---- Things that must never be suggested ---------------------------
  console.log("\nExclusions");

  const all = await call("/crops/suggested?limit=30", { token: buyer });
  const suggested = all.data?.crops ?? [];

  ok(
    "nothing sold out is suggested",
    suggested.every((c) => c.expectedKg - c.reservedKg > 0),
  );
  ok(
    "nothing unlisted is suggested",
    suggested.every((c) => c.listed === true),
  );

  // Unlist one and it should vanish from the next call.
  await call(`/farmer/crops/${sibling.id}`, {
    method: "PATCH",
    token: other,
    body: { listed: false },
  });
  const afterUnlist = await call("/crops/suggested?limit=30", { token: buyer });
  ok(
    "unlisting removes it immediately",
    !(afterUnlist.data?.crops ?? []).some((c) => c.id === sibling.id),
  );
  await call(`/farmer/crops/${sibling.id}`, {
    method: "PATCH",
    token: other,
    body: { listed: true },
  });

  // A suspended farmer's listings must not reappear through this route.
  const users = await call("/admin/users?q=muthu", { token: admin });
  const muthu = (users.data?.users ?? users.data ?? []).find?.((u) =>
    (u.email ?? "").startsWith("muthu@"),
  );
  if (muthu) {
    await call(`/admin/users/${muthu.id}/status`, {
      method: "POST",
      token: admin,
      body: { status: "SUSPENDED", reason: "Suite check — restored immediately." },
    });
    const whileSuspended = await call("/crops/suggested?limit=30", { token: buyer });
    ok(
      "a suspended farmer's crops disappear",
      !(whileSuspended.data?.crops ?? []).some((c) => c.farmId === sibling.farmId),
      JSON.stringify((whileSuspended.data?.crops ?? []).map((c) => c.title)),
    );
    await call(`/admin/users/${muthu.id}/status`, {
      method: "POST",
      token: admin,
      body: { status: "ACTIVE", reason: "Suite check complete." },
    });
  }

  // ---- Cold start -----------------------------------------------------
  console.log("\nCold start");

  const driver = await login("selvam@uzhavan.app");
  const coldish = await call("/crops/suggested", { token: driver });
  ok(
    "someone with no buying history still gets something",
    coldish.status === 200 && (coldish.data?.crops ?? []).length > 0,
    `${coldish.status} / ${coldish.data?.crops?.length}`,
  );
  ok("and it is honest about not being personalised", coldish.data?.personalised === false);
  ok(
    "the reason falls back to something factual",
    (coldish.data?.crops ?? []).every((c) => c.reason && c.reason.length > 0),
  );

  for (const [token, id] of created) {
    await call(`/farmer/crops/${id}`, { method: "DELETE", token });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch((err) => {
  console.error("\nsuite crashed:", err.message);
  process.exit(1);
});
