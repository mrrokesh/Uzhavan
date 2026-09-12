// Brute-force protection and what a user object is allowed to contain.
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

// No 503 retry here on purpose: this suite counts responses, and silently
// repeating a request would corrupt every count it makes.
async function call(path, { method = "GET", token, body } = {}) {
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

const login = (email, password) =>
  call("/auth/login", { method: "POST", body: { email, password } });

const run = async () => {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const EMAIL = "vikram@uzhavan.app";
  const PASSWORD = "uzhavan123";

  const unlock = () =>
    prisma.user.update({
      where: { email: EMAIL },
      data: { failedLogins: 0, lockedUntil: null },
    });

  console.log("What a user object may contain");

  await unlock();
  const session = await login("selvam@uzhavan.app", PASSWORD);
  const fields = Object.keys(session.data?.user ?? {});

  // The exact leak that prompted this: a blind index is a deterministic HMAC,
  // so handing one out lets someone test candidate licence numbers offline.
  for (const secret of [
    "passwordHash",
    "licenceEnc",
    "licenceIndex",
    "gstinEnc",
    "gstinIndex",
    "udyamEnc",
    "udyamIndex",
    "panEnc",
    "farmerCardEnc",
    "farmerCardIndex",
  ]) {
    ok(`${secret} never leaves the server`, !fields.includes(secret), fields.join(" "));
  }
  ok("nor do the lockout counters", !fields.includes("failedLogins") && !fields.includes("lockedUntil"));
  ok("but the useful fields survive", fields.includes("email") && fields.includes("role"));
  ok("including the last four of a verified id", fields.includes("idLast4"));

  console.log("\nAccount lockout");

  await unlock();
  const wrong = { email: EMAIL, password: "definitely-not-it" };

  // Four failures should still leave the door open.
  for (let i = 0; i < 4; i += 1) await call("/auth/login", { method: "POST", body: wrong });
  const stillFine = await login(EMAIL, PASSWORD);
  ok("four wrong tries doesn't lock the account", stillFine.status === 200, `got ${stillFine.status}`);

  const cleared = await prisma.user.findUnique({ where: { email: EMAIL } });
  ok("and a success resets the counter", cleared?.failedLogins === 0, `${cleared?.failedLogins}`);

  // Five should.
  for (let i = 0; i < 5; i += 1) await call("/auth/login", { method: "POST", body: wrong });
  const locked = await login(EMAIL, PASSWORD);
  ok(
    "five locks it, even with the right password",
    locked.status === 429,
    `got ${locked.status} ${JSON.stringify(locked.data)}`,
  );
  ok(
    "and the message says how long and offers a way out",
    /try again in/i.test(locked.data?.error ?? "") && /reset/i.test(locked.data?.error ?? ""),
    locked.data?.error,
  );

  const row = await prisma.user.findUnique({ where: { email: EMAIL } });
  ok("the lock is recorded", !!row?.lockedUntil);
  ok(
    "and it always expires — a permanent lock would be a way to freeze someone out",
    row?.lockedUntil && row.lockedUntil.getTime() - Date.now() <= 60 * 60 * 1000,
    String(row?.lockedUntil),
  );

  // Expire it by hand rather than waiting a minute.
  await prisma.user.update({
    where: { email: EMAIL },
    data: { lockedUntil: new Date(Date.now() - 1000) },
  });
  const after = await login(EMAIL, PASSWORD);
  ok("once it expires the right password works", after.status === 200, `got ${after.status}`);

  const reset = await prisma.user.findUnique({ where: { email: EMAIL } });
  ok("and the counter is cleared", reset?.failedLogins === 0);
  ok("last sign-in is recorded", !!reset?.lastLoginAt);

  console.log("\nFlood protection");

  // /forgot costs an SMS and an email each time.
  let limited = 0;
  for (let i = 0; i < 14; i += 1) {
    const r = await call("/auth/password/forgot", {
      method: "POST",
      body: { email: "kannan@uzhavan.app" },
    });
    if (r.status === 429) limited += 1;
  }
  ok("repeated reset requests get throttled", limited > 0, `${limited} of 14 refused`);

  const throttled = await call("/auth/password/forgot", {
    method: "POST",
    body: { email: "kannan@uzhavan.app" },
  });
  ok("with a 429 and a wait time", throttled.status === 429 && /try again in/i.test(throttled.data?.error ?? ""),
    JSON.stringify(throttled.data));

  await unlock();
  await prisma.$disconnect();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch((err) => {
  console.error("\nsuite crashed:", err.message);
  process.exit(1);
});
