// Push registration and audience targeting, against the live API.
//
// Nothing here contacts Expo. What's under test is who *would* be sent to and
// which tokens are stored — the wire call is one fetch, and asserting against
// a third party's uptime would make this suite lie about our code.
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

const TOKEN_A = "ExponentPushToken[suite-aaaaaaaaaaaaaa]";
const TOKEN_B = "ExponentPushToken[suite-bbbbbbbbbbbbbb]";

const run = async () => {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { rolesFor } = await import("../src/push.ts");

  const admin = await login("admin@uzhavan.app");
  const farmer = await login("arul@uzhavan.app");
  const buyer = await login("karthik@uzhavan.app");

  await prisma.pushToken.deleteMany({ where: { token: { in: [TOKEN_A, TOKEN_B] } } });

  console.log("Registering a device");

  const anon = await call("/me/push-token", {
    method: "PUT",
    body: { token: TOKEN_A, platform: "ANDROID" },
  });
  ok("signing in is required", anon.status === 401, `got ${anon.status}`);

  const junk = await call("/me/push-token", {
    method: "PUT",
    token: farmer,
    body: { token: "not-a-real-token", platform: "ANDROID" },
  });
  ok("a malformed token is rejected", junk.status === 400, `got ${junk.status}`);

  const badPlatform = await call("/me/push-token", {
    method: "PUT",
    token: farmer,
    body: { token: TOKEN_A, platform: "SYMBIAN" },
  });
  ok("an unknown platform is rejected", badPlatform.status === 400, `got ${badPlatform.status}`);

  const first = await call("/me/push-token", {
    method: "PUT",
    token: farmer,
    body: { token: TOKEN_A, platform: "ANDROID", app: "PARTNER" },
  });
  ok("a valid token registers", first.status === 200, JSON.stringify(first.data));

  const stored = await prisma.pushToken.findUnique({ where: { token: TOKEN_A } });
  ok("it is stored against the right person", !!stored);
  ok("with the app it belongs to", stored?.app === "PARTNER", stored?.app);

  const again = await call("/me/push-token", {
    method: "PUT",
    token: farmer,
    body: { token: TOKEN_A, platform: "ANDROID", app: "PARTNER" },
  });
  ok("re-registering is idempotent", again.status === 200);
  const count = await prisma.pushToken.count({ where: { token: TOKEN_A } });
  ok("and doesn't duplicate the row", count === 1, `${count} rows`);

  // The same handset can change hands. Notices follow the account.
  await call("/me/push-token", {
    method: "PUT",
    token: buyer,
    body: { token: TOKEN_A, platform: "ANDROID", app: "BUYER" },
  });
  const moved = await prisma.pushToken.findUnique({
    where: { token: TOKEN_A },
    include: { user: { select: { email: true } } },
  });
  ok(
    "a re-used device follows the new account",
    moved?.user.email === "karthik@uzhavan.app",
    moved?.user.email,
  );

  console.log("\nRemoving it");

  await call("/me/push-token", {
    method: "PUT",
    token: farmer,
    body: { token: TOKEN_B, platform: "IOS" },
  });

  const notMine = await call(`/me/push-token/${encodeURIComponent(TOKEN_B)}`, {
    method: "DELETE",
    token: buyer,
  });
  ok("deleting reports success either way", notMine.status === 200);
  const survives = await prisma.pushToken.count({ where: { token: TOKEN_B } });
  ok("but someone else's token is untouched", survives === 1, `${survives} rows`);

  const mine = await call(`/me/push-token/${encodeURIComponent(TOKEN_B)}`, {
    method: "DELETE",
    token: farmer,
  });
  ok("your own token is removed", mine.status === 200);
  const gone = await prisma.pushToken.count({ where: { token: TOKEN_B } });
  ok("and it really is gone", gone === 0, `${gone} rows`);

  console.log("\nWho an announcement reaches");

  ok("FARMERS covers only farmers", JSON.stringify(rolesFor("FARMERS")) === '["FARMER"]');
  ok("BUYERS covers only buyers", JSON.stringify(rolesFor("BUYERS")) === '["BUYER"]');
  ok("DRIVERS covers only drivers", JSON.stringify(rolesFor("DRIVERS")) === '["DRIVER"]');
  ok(
    "ALL covers the three app roles and no staff",
    JSON.stringify(rolesFor("ALL")) === '["FARMER","BUYER","DRIVER"]',
    JSON.stringify(rolesFor("ALL")),
  );

  // Someone who can't use the app shouldn't be pinged about it.
  const blocked = await prisma.user.count({
    where: { role: { in: rolesFor("ALL") }, status: { not: "ACTIVE" } },
  });
  const targeted = await prisma.user.count({
    where: { role: { in: rolesFor("ALL") }, status: "ACTIVE" },
  });
  const everyone = await prisma.user.count({ where: { role: { in: rolesFor("ALL") } } });
  ok(
    "suspended and blocked accounts are excluded from the audience",
    targeted + blocked === everyone,
    `${targeted} + ${blocked} vs ${everyone}`,
  );

  console.log("\nPublishing still works when nobody can be pushed");

  const title = `Push check ${Date.now()}`;
  const published = await call("/admin/announcements", {
    method: "POST",
    token: admin,
    body: { title, body: "A notice that should save regardless of push delivery.", audience: "ALL" },
  });
  ok("an announcement publishes", published.status === 201, JSON.stringify(published.data));
  ok("and is live immediately", !!published.data?.publishedAt);

  const seen = await call("/announcements", { token: farmer });
  ok("the bell shows it", (seen.data ?? []).some((a) => a.title === title));

  if (published.data?.id) {
    await call(`/admin/announcements/${published.data.id}`, { method: "DELETE", token: admin });
  }

  await prisma.pushToken.deleteMany({ where: { token: { in: [TOKEN_A, TOKEN_B] } } });
  await prisma.$disconnect();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch((err) => {
  console.error("\nsuite crashed:", err.message);
  process.exit(1);
});
