// Phase 1 verification: password security, KYC, blocking.
const BASE = process.env.UZHAVAN_API ?? "http://localhost:4000/api";
let pass = 0, fail = 0;
const ok = (l, c, x = "") => { c ? pass++ : fail++; console.log(`  ${c ? "PASS" : "FAIL"}  ${l}${x ? ` — ${x}` : ""}`); };
const section = (s) => console.log(`\n${s}`);

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
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, raw: text };
}

const call = (path, options) => withRetry(() => callOnce(path, options));
const login = async (email, password = "uzhavan123") => {
  const r = await call("/auth/login", { method: "POST", body: { email, password } });
  return { token: r.data?.token, status: r.status, data: r.data };
};

// A tiny valid PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
).toString("base64");

const run = async () => {
  section("1. Password security");
  const admin = (await login("admin@uzhavan.app")).token;
  const staff = (await login("staff@uzhavan.app")).token;
  const farmer = (await login("kannan@uzhavan.app")).token;
  const buyer = (await login("karthik@uzhavan.app")).token;
  ok("all roles sign in", !!admin && !!staff && !!farmer && !!buyer);

  const wrong = await login("karthik@uzhavan.app", "uzhavan124");
  ok("wrong password rejected", wrong.status === 401);
  const noUser = await login("nobody@uzhavan.app");
  ok("unknown email gives the same error (no enumeration)",
    noUser.status === 401 && noUser.data?.error === wrong.data?.error, wrong.data?.error);

  section("2. Hashes at rest");
  // Read straight from the database to confirm what's actually stored.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const row = await prisma.user.findUnique({ where: { email: "karthik@uzhavan.app" } });
  ok("hash is pepper-versioned", row.passwordHash.startsWith("v1$"), row.passwordHash.slice(0, 8) + "…");
  ok("bcrypt cost is 12", row.passwordHash.split("$")[3] === "12");
  ok("plaintext password not present", !row.passwordHash.includes("uzhavan123"));

  section("3. New buyer registration uses the same protections");
  const email = `test${Date.now()}@uzhavan.app`;
  const reg = await call("/auth/register", {
    method: "POST",
    body: { role: "BUYER", email, password: "a-strong-passphrase", name: "Test Buyer",
            phone: "+91 90000 00000", business: "Test Traders", district: "Erode" },
  });
  ok("registers", reg.status === 201);
  const newRow = await prisma.user.findUnique({ where: { email } });
  ok("new hash also peppered at cost 12",
    newRow.passwordHash.startsWith("v1$") && newRow.passwordHash.split("$")[3] === "12");
  ok("short password rejected", (await call("/auth/register", {
    method: "POST", body: { role: "BUYER", email: "x" + email, password: "short", name: "X",
      phone: "+91 90000 00000", business: "B", district: "D" } })).status === 400);
  const testToken = reg.data.token;

  section("4. KYC — buyer (GSTIN)");
  const before = await call("/verification", { token: testToken });
  ok("starts unverified", before.data?.status === "UNVERIFIED");
  ok("tells the client what's required", before.data?.required?.identifier === "gstinOrUdyam");

  const badGst = await call("/verification", { method: "POST", token: testToken,
    body: { gstin: "27AAPFU0939F1ZX", documents: [{ type: "GST_CERTIFICATE", filename: "gst.png", mimeType: "image/png", data: PNG }] } });
  ok("invalid GSTIN checksum rejected", badGst.status === 400, badGst.data?.error);

  const noDoc = await call("/verification", { method: "POST", token: testToken,
    body: { gstin: "27AAPFU0939F1ZV", documents: [] } });
  ok("submission without documents rejected", noDoc.status === 400);

  const sub = await call("/verification", { method: "POST", token: testToken,
    body: { gstin: "27AAPFU0939F1ZV", pan: "AABCU9603R",
            documents: [{ type: "GST_CERTIFICATE", filename: "gst.png", mimeType: "image/png", data: PNG }] } });
  ok("valid GSTIN accepted", sub.status === 201, `status=${sub.data?.status}`);
  ok("only last 4 shown back", sub.data?.idLast4 === "F1ZV");

  section("5. Identifiers are encrypted at rest");
  const kyc = await prisma.user.findUnique({ where: { email } });
  ok("GSTIN not stored in plaintext", !JSON.stringify(kyc).includes("27AAPFU0939F1ZV"));
  ok("gstinEnc populated", !!kyc.gstinEnc, kyc.gstinEnc?.slice(0, 16) + "…");
  ok("blind index populated for uniqueness", !!kyc.gstinIndex);
  const doc = await prisma.kycDocument.findFirst({ where: { ownerId: kyc.id } });
  ok("document stored in its own table", !!doc);
  const rawPng = Buffer.from(PNG, "base64");
  ok("document bytes encrypted at rest", !Buffer.from(doc.data).equals(rawPng));
  ok("ciphertext longer than plaintext (IV+tag)", doc.data.length === rawPng.length + 28);

  section("6. Duplicate identifier blocked");
  const email2 = `dupe${Date.now()}@uzhavan.app`;
  const reg2 = await call("/auth/register", { method: "POST",
    body: { role: "BUYER", email: email2, password: "another-strong-pass", name: "Dupe",
            phone: "+91 90000 00001", business: "Dupe Co", district: "Salem" } });
  const dupe = await call("/verification", { method: "POST", token: reg2.data.token,
    body: { gstin: "27AAPFU0939F1ZV", documents: [{ type: "GST_CERTIFICATE", filename: "g.png", mimeType: "image/png", data: PNG }] } });
  ok("same GSTIN on another account rejected", dupe.status === 409, dupe.data?.error);

  section("7. Document access control");
  const asOwner = await call(`/verification/documents/${doc.id}`, { token: testToken });
  ok("owner can fetch their document", asOwner.status === 200);
  const asStaff = await call(`/verification/documents/${doc.id}`, { token: staff });
  ok("staff reviewer can fetch it", asStaff.status === 200);
  const asStranger = await call(`/verification/documents/${doc.id}`, { token: buyer });
  ok("unrelated user cannot (404, not 403)", asStranger.status === 404);
  const anon = await call(`/verification/documents/${doc.id}`);
  ok("anonymous cannot", anon.status === 401);

  section("8. KYC — farmer card");
  const fsub = await call("/verification", { method: "POST", token: farmer,
    body: { farmerCard: "TN/NLG/2021/889231",
            documents: [{ type: "FARMER_CARD", filename: "card.png", mimeType: "image/png", data: PNG }] } });
  ok("farmer submits card", fsub.status === 201);
  const gstAsFarmer = await call("/verification", { method: "POST", token: farmer,
    body: { gstin: "24AAACC1206D1ZM", documents: [{ type: "GST_CERTIFICATE", filename: "g.png", mimeType: "image/png", data: PNG }] } });
  ok("cannot resubmit while pending", gstAsFarmer.status === 409);

  section("9. Staff review queue");
  const queue = await call("/verification/queue", { token: staff });
  ok("queue lists pending accounts", Array.isArray(queue.data) && queue.data.length >= 2, `${queue.data?.length} pending`);
  const entry = queue.data.find((u) => u.email === email);
  ok("reviewer sees the decrypted GSTIN", entry?.gstin === "27AAPFU0939F1ZV");
  const queueAsBuyer = await call("/verification/queue", { token: buyer });
  ok("normal user cannot see the queue", queueAsBuyer.status === 403);

  const rejectNoReason = await call(`/verification/queue/${kyc.id}`, { method: "POST", token: staff, body: { decision: "REJECTED" } });
  ok("rejection needs a reason", rejectNoReason.status === 400);

  const approve = await call(`/verification/queue/${kyc.id}`, { method: "POST", token: staff, body: { decision: "VERIFIED" } });
  ok("staff approves", approve.data?.verification === "VERIFIED");
  const twice = await call(`/verification/queue/${kyc.id}`, { method: "POST", token: staff, body: { decision: "VERIFIED" } });
  ok("cannot review the same account twice", twice.status === 409);

  const verifiedOnly = await call("/admin/users?verification=VERIFIED", { token: staff });
  ok(
    "the accounts list can be filtered to verified only",
    (verifiedOnly.data ?? []).some((u) => u.id === kyc.id),
  );
  const unverifiedOnly = await call("/admin/users?verification=UNVERIFIED", { token: staff });
  ok(
    "and filtering to unverified excludes the one just approved",
    !(unverifiedOnly.data ?? []).some((u) => u.id === kyc.id),
  );

  section("10. Account blocking");
  const users = await call("/admin/users?role=DRIVER", { token: staff });
  ok("staff can list accounts", Array.isArray(users.data) && users.data.length >= 1);
  ok("password hash never leaves the server", !JSON.stringify(users.data).includes("passwordHash"));

  const driver = users.data.find((u) => u.email === "vikram@uzhavan.app");
  const noReason = await call(`/admin/users/${driver.id}/status`, { method: "POST", token: staff, body: { status: "BLOCKED" } });
  ok("blocking requires a reason", noReason.status === 400);

  const blocked = await call(`/admin/users/${driver.id}/status`, { method: "POST", token: staff,
    body: { status: "BLOCKED", reason: "Accepted a trip and never collected the crop" } });
  ok("staff blocks the driver", blocked.data?.status === "BLOCKED");

  const blockedLogin = await login("vikram@uzhavan.app");
  ok("blocked user cannot sign in", blockedLogin.status === 403, blockedLogin.data?.error);

  const drv = await prisma.driver.findFirst({ where: { user: { email: "vikram@uzhavan.app" } } });
  ok("blocked driver forced offline", drv.online === false);

  section("11. Blocking guardrails");
  const selfBlock = await call(`/admin/users/${(await prisma.user.findUnique({ where: { email: "staff@uzhavan.app" } })).id}/status`,
    { method: "POST", token: staff, body: { status: "BLOCKED", reason: "test" } });
  ok("staff cannot block themselves", selfBlock.status === 400, selfBlock.data?.error);

  const adminRow = await prisma.user.findUnique({ where: { email: "admin@uzhavan.app" } });
  const blockAdmin = await call(`/admin/users/${adminRow.id}/status`, { method: "POST", token: staff, body: { status: "BLOCKED", reason: "test" } });
  ok("admin accounts cannot be blocked", blockAdmin.status === 403, blockAdmin.data?.error);

  const buyerBlocks = await call(`/admin/users/${driver.id}/status`, { method: "POST", token: buyer, body: { status: "ACTIVE" } });
  ok("normal user cannot moderate", buyerBlocks.status === 403);

  section("12. Restoring access");
  const restored = await call(`/admin/users/${driver.id}/status`, { method: "POST", token: admin, body: { status: "ACTIVE" } });
  ok("admin restores the account", restored.data?.status === "ACTIVE");
  ok("reason cleared", restored.data?.statusReason === null);
  const backIn = await login("vikram@uzhavan.app");
  ok("driver can sign in again", backIn.status === 200);

  section("13. Blocked mid-session");
  const victim = await login("ramesh@uzhavan.app");
  await call(`/admin/users/${(await prisma.user.findUnique({ where: { email: "ramesh@uzhavan.app" } })).id}/status`,
    { method: "POST", token: staff, body: { status: "BLOCKED", reason: "Testing live revocation" } });
  const withOldToken = await call("/driver/summary", { token: victim.token });
  ok("existing token stops working immediately", withOldToken.status === 403, withOldToken.data?.error);
  await call(`/admin/users/${(await prisma.user.findUnique({ where: { email: "ramesh@uzhavan.app" } })).id}/status`,
    { method: "POST", token: admin, body: { status: "ACTIVE" } });

  // cleanup
  await prisma.kycDocument.deleteMany({ where: { owner: { email: { in: [email, email2] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [email, email2] } } });
  await prisma.user.update({ where: { email: "kannan@uzhavan.app" },
    data: { verification: "UNVERIFIED", farmerCardEnc: null, farmerCardIndex: null, idLast4: null, verificationSubmittedAt: null } });
  await prisma.kycDocument.deleteMany({ where: { owner: { email: "kannan@uzhavan.app" } } });
  await prisma.$disconnect();

  console.log(`\n${"=".repeat(46)}\n  ${pass} passed, ${fail} failed\n${"=".repeat(46)}`);
  process.exit(fail ? 1 : 0);
};

run().catch((e) => { console.error("\nCrashed:", e); process.exit(1); });
