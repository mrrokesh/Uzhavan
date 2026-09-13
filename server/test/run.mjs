// Runs every suite in order against a live server.
//
// These are integration tests on purpose: they exercise the real Express app,
// the real Prisma client and a real Postgres, because almost everything worth
// getting wrong here — permissions, encryption, money — lives in the seams
// between those, not inside a single function.
//
//   cd server && npm run dev      # in one terminal
//   cd server && npm run db:reset  # start from known state
//   cd server && npm test          # in another
//
// The reset matters. Several suites move state that can't be undone through
// the API — a verification decision, a reserved quantity, a trip halfway to a
// warehouse — so a second run without one fails on its own leavings rather
// than on a bug.
//
// Point them elsewhere with UZHAVAN_API=https://api.example.com/api.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const SUITES = [
  ["e2e", "The marketplace loop, role enforcement, stock, trips"],
  ["sec", "Hashing, encryption at rest, KYC, document access, blocking"],
  ["admin", "Permissions, tickets, escalation, remote config, audit"],
  ["phase", "Districts, filters, demand board, announcements, payments"],
  ["feat", "Announcements, demand, driver verification, gateways, tracking"],
  ["payout", "Platform fee, escrow scheduling, payout policy and overrides"],
  ["suggest", "Interest signals, ranking, exclusions, cold start"],
  ["password", "Reset codes, enumeration, replay, guess limits, expiry"],
  ["push", "Device registration, re-use, audience targeting"],
  ["limits", "Account lockout, flood protection, what a user object may contain"],
  ["reviews", "Ratings tied to completed orders, who may rate whom, averages"],
];

const run = (name) =>
  new Promise((resolve) => {
    // --import tsx because one suite reaches into the server's TypeScript to
    // drive the escalation sweeper directly rather than waiting 24 hours.
    const child = spawn(process.execPath, ["--import", "tsx", join(here, `${name}.mjs`)], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });

/**
 * Remove fixtures a previous run left behind.
 *
 * Suites delete what they create, but only on the happy path — a crash or a
 * Ctrl-C leaves rows there, and reserving crop quantity is permanent. Enough of
 * those and later runs fail on debris rather than on a bug, which is worse than
 * failing loudly: it looks like a regression.
 */
async function cleanFixtures() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const titles = { OR: [{ title: { startsWith: "Suite crop" } }, { title: { startsWith: "Review fixture" } }, { title: { startsWith: "Suggest " } }] };
  const crops = await prisma.crop.findMany({ where: titles, select: { id: true } });
  const ids = crops.map((c) => c.id);
  if (ids.length) {
    await prisma.review.deleteMany({ where: { order: { cropId: { in: ids } } } });
    await prisma.payout.deleteMany({ where: { order: { cropId: { in: ids } } } });
    await prisma.truckBooking.deleteMany({ where: { order: { cropId: { in: ids } } } });
    await prisma.order.deleteMany({ where: { cropId: { in: ids } } });
    await prisma.cropRequest.deleteMany({ where: { cropId: { in: ids } } });
    await prisma.crop.deleteMany({ where: { id: { in: ids } } });
    console.log(`swept ${ids.length} leftover fixture listing${ids.length === 1 ? "" : "s"}
`);
  }
  await prisma.paymentGateway.deleteMany({ where: { label: { startsWith: "Suite account" } } });
  await prisma.$disconnect();
}

await cleanFixtures();

let failed = 0;
let total = 0;

for (const [name, what] of SUITES) {
  const { code, out } = await run(name);
  const summary = /(\d+) passed, (\d+) failed/.exec(out);
  const passed = summary ? Number(summary[1]) : 0;
  const bad = summary ? Number(summary[2]) : 1;
  total += passed;
  if (code !== 0 || bad > 0 || !summary) {
    failed += 1;
    console.log(`FAIL  ${name.padEnd(8)} ${what}`);
    console.log(out.split("\n").filter((l) => /FAIL|Crashed|crashed/.test(l)).join("\n"));
  } else {
    console.log(`ok    ${name.padEnd(8)} ${String(passed).padStart(3)} assertions  ${what}`);
  }
}

console.log(`\n${total} assertions, ${failed} suite${failed === 1 ? "" : "s"} failing`);
process.exit(failed ? 1 : 0);
