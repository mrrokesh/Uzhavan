// Password reset, against the live API.
//
// Reads the reset code out of the database rather than the log, so it tests
// what was stored rather than what was printed.
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

const run = async () => {
  const { PrismaClient } = await import("@prisma/client");
  const crypto = await import("node:crypto");
  const prisma = new PrismaClient();

  const EMAIL = "kannan@uzhavan.app";
  const ORIGINAL = "uzhavan123";
  const NEW = "brand-new-passphrase-9";

  const hash = (code) => crypto.createHash("sha256").update(code).digest("hex");

  /** Ask for a code, then read the row it wrote and brute the six digits back. */
  const requestCode = async (email = EMAIL) => {
    await call("/auth/password/forgot", { method: "POST", body: { email } });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    const row = await prisma.passwordReset.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return null;
    for (let n = 0; n < 1_000_000; n += 1) {
      const candidate = String(n).padStart(6, "0");
      if (hash(candidate) === row.codeHash) return { code: candidate, row, user };
    }
    return null;
  };

  const login = (email, password) =>
    call("/auth/login", { method: "POST", body: { email, password } });

  console.log("Asking for a code");

  const unknown = await call("/auth/password/forgot", {
    method: "POST",
    body: { email: "nobody-at-all@uzhavan.app" },
  });
  ok("an unknown address gets the same answer", unknown.status === 200 && unknown.data?.sent === true);

  const known = await call("/auth/password/forgot", { method: "POST", body: { email: EMAIL } });
  ok("a real address gets the same answer", known.status === 200 && known.data?.sent === true);
  ok(
    "the two replies are identical — no account enumeration",
    JSON.stringify(unknown.data) === JSON.stringify(known.data),
    `${JSON.stringify(unknown.data)} vs ${JSON.stringify(known.data)}`,
  );

  const malformed = await call("/auth/password/forgot", { method: "POST", body: { email: "nope" } });
  ok("a malformed address is rejected", malformed.status === 400, `got ${malformed.status}`);

  const issued = await requestCode();
  ok("a code was issued", !!issued, "no reset row found");
  ok("the plaintext code is never stored", issued && !("code" in issued.row));
  ok("it expires within the hour", issued && issued.row.expiresAt - Date.now() <= 60 * 60 * 1000);
  ok("it records where it was sent", issued?.row.sentTo === EMAIL);

  console.log("\nUsing it");

  const wrongCode = await call("/auth/password/reset", {
    method: "POST",
    body: { email: EMAIL, code: "000000", password: NEW },
  });
  ok("a wrong code is refused", wrongCode.status === 400, `got ${wrongCode.status}`);
  ok(
    "and the message doesn't say which part was wrong",
    /wrong or has expired/i.test(wrongCode.data?.error ?? ""),
    wrongCode.data?.error,
  );

  const shortPassword = await call("/auth/password/reset", {
    method: "POST",
    body: { email: EMAIL, code: issued.code, password: "short" },
  });
  ok("a weak new password is refused", shortPassword.status === 400, `got ${shortPassword.status}`);

  const done = await call("/auth/password/reset", {
    method: "POST",
    body: { email: EMAIL, code: issued.code, password: NEW },
  });
  ok("the right code works", done.status === 200, JSON.stringify(done.data));

  const withNew = await login(EMAIL, NEW);
  ok("the new password signs in", withNew.status === 200, `got ${withNew.status}`);

  const withOld = await login(EMAIL, ORIGINAL);
  ok("the old password no longer works", withOld.status === 401, `got ${withOld.status}`);

  const replay = await call("/auth/password/reset", {
    method: "POST",
    body: { email: EMAIL, code: issued.code, password: "another-passphrase-1" },
  });
  ok("the same code can't be used twice", replay.status === 400, `got ${replay.status}`);

  console.log("\nGuessing is bounded");

  const second = await requestCode();
  ok("asking again issues a fresh code", second && second.code !== issued.code);

  const stillOld = await call("/auth/password/reset", {
    method: "POST",
    body: { email: EMAIL, code: issued.code, password: "yet-another-one-2" },
  });
  ok("the previous code is dead once replaced", stillOld.status === 400, `got ${stillOld.status}`);

  for (let i = 0; i < 5; i += 1) {
    await call("/auth/password/reset", {
      method: "POST",
      body: { email: EMAIL, code: "111111", password: "guessing-away-here" },
    });
  }
  const exhausted = await call("/auth/password/reset", {
    method: "POST",
    body: { email: EMAIL, code: second.code, password: "should-not-work-3" },
  });
  ok(
    "five wrong guesses kills the code, even a correct one after",
    exhausted.status === 429,
    `got ${exhausted.status} ${JSON.stringify(exhausted.data)}`,
  );

  console.log("\nExpiry and blocked accounts");

  const third = await requestCode();
  await prisma.passwordReset.update({
    where: { id: third.row.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const expired = await call("/auth/password/reset", {
    method: "POST",
    body: { email: EMAIL, code: third.code, password: "too-late-friend-4" },
  });
  ok("an expired code is refused", expired.status === 400, `got ${expired.status}`);

  // A blocked account must not be recoverable — that's what blocking is for.
  await prisma.user.update({ where: { email: EMAIL }, data: { status: "BLOCKED" } });
  const blockedAsk = await call("/auth/password/forgot", { method: "POST", body: { email: EMAIL } });
  ok("a blocked account still gets the generic reply", blockedAsk.data?.sent === true);
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  const issuedWhileBlocked = await prisma.passwordReset.count({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
  });
  ok("but no code is actually issued to it", issuedWhileBlocked === 0, `${issuedWhileBlocked} live`);
  await prisma.user.update({ where: { email: EMAIL }, data: { status: "ACTIVE" } });

  // Put the account back so the rest of the suites still work.
  const restore = await requestCode();
  await call("/auth/password/reset", {
    method: "POST",
    body: { email: EMAIL, code: restore.code, password: ORIGINAL },
  });
  const back = await login(EMAIL, ORIGINAL);
  ok("the account is restored for the other suites", back.status === 200, `got ${back.status}`);

  await prisma.$disconnect();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch((err) => {
  console.error("\nsuite crashed:", err.message);
  process.exit(1);
});
