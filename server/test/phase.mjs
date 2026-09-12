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

const B = process.env.UZHAVAN_API ?? "http://localhost:4000/api";
let pass = 0, fail = 0;
const ok = (l, c, x = "") => { c ? pass++ : fail++; console.log(`  ${c ? "PASS" : "FAIL"}  ${l}${x ? ` — ${x}` : ""}`); };
const callOnce = async (p, o = {}) => {
  const r = await fetch(`${B}${p}`, {
    method: o.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) },
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
  const t = await r.text();
  let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { status: r.status, data: d };
};

const call = (p, o) => withRetry(() => callOnce(p, o));
const login = async (e) => (await call("/auth/login", { method: "POST", body: { email: e, password: "uzhavan123" } })).data.token;

const admin = await login("admin@uzhavan.app");
const staff = await login("staff@uzhavan.app");
const buyer = await login("karthik@uzhavan.app");
const farmer = await login("muthu@uzhavan.app");
const driver = await login("selvam@uzhavan.app");
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const { PrismaClient } = await import("@prisma/client");
const p = new PrismaClient();

console.log("\n1. Driver verification");
const need = await call("/verification", { token: driver });
ok("driver asked for licence + vehicle papers", need.data?.required?.identifier === "licence", need.data?.required?.documents?.join(", "));
const badL = await call("/verification", { method: "POST", token: driver, body: { licence: "NOTALICENCE", documents: [{ type: "DRIVING_LICENCE", filename: "dl.png", mimeType: "image/png", data: PNG }] } });
ok("malformed licence rejected", badL.status === 400, badL.data?.error);
const sub = await call("/verification", { method: "POST", token: driver, body: {
  licence: "TN37 20190001234", rcNumber: "TN30AB4821", insuranceExpiry: "2027-03-31", permitExpiry: "2027-06-30",
  documents: [
    { type: "DRIVING_LICENCE", filename: "dl.png", mimeType: "image/png", data: PNG },
    { type: "VEHICLE_RC", filename: "rc.png", mimeType: "image/png", data: PNG },
    { type: "VEHICLE_INSURANCE", filename: "ins.png", mimeType: "image/png", data: PNG },
  ] } });
ok("driver submits licence + RC + insurance", sub.status === 201, `last4 ${sub.data?.idLast4}`);
const q = await call("/verification/queue", { token: staff });
ok("driver appears in the review queue", q.data?.some?.((u) => u.role === "DRIVER"), `${q.data?.length} pending`);
const truck = await p.truck.findFirst({ where: { plate: "TN 30 AB 4821" } });
ok("insurance expiry recorded on the truck", !!truck?.insuranceExpiry, truck?.insuranceExpiry?.toISOString().slice(0, 10));
const drvRow = await p.user.findUnique({ where: { email: "selvam@uzhavan.app" } });
ok("licence encrypted, not plaintext", !JSON.stringify(drvRow).includes("TN3720190001234"));

console.log("\n2. Staff vehicle tracking");
const tr = await call("/admin/track?plate=TN30AB4821", { token: staff });
ok("finds the vehicle from a plate typed without spaces", tr.status === 200, tr.data?.[0]?.truck?.plate);
ok("shows who is driving it", tr.data?.[0]?.driver?.name === "Selvam", tr.data?.[0]?.driver?.phone);
ok("reports paperwork expiry status", tr.data?.[0]?.truck?.insuranceExpired === false);
ok("no live trip right now", tr.data?.[0]?.currentTrip === null);
ok("unknown plate 404s", (await call("/admin/track?plate=ZZ99", { token: staff })).status === 404);
ok("buyer cannot use the tracker", (await call("/admin/track?plate=TN30", { token: buyer })).status === 403);

console.log("\n3. Announcements");
const draft = await call("/admin/announcements", { method: "POST", token: admin, body: { title: "Monsoon pickup delays", body: "Heavy rain across Salem and Dindigul may delay pickups by a day.", audience: "ALL", publish: false } });
ok("admin can save a draft", draft.status === 201);
ok("draft is not published", draft.data?.publishedAt === null);
ok("nobody sees a draft", (await call("/announcements", { token: buyer })).data?.length === 0);

const farmersOnly = await call("/admin/announcements", { method: "POST", token: admin, body: { title: "New: demand board", body: "See what buyers near you are looking for, in the Home tab.", audience: "FARMERS", pinned: true } });
ok("published to farmers only", farmersOnly.status === 201);
ok("farmer sees it", (await call("/announcements", { token: farmer })).data?.length === 1);
ok("buyer does not", (await call("/announcements", { token: buyer })).data?.length === 0);
ok("driver does not", (await call("/announcements", { token: driver })).data?.length === 0);

await call("/admin/announcements", { method: "POST", token: admin, body: { title: "Scheduled maintenance", body: "The app will be briefly unavailable on Sunday at 2am.", audience: "ALL" } });
const forBuyer = await call("/announcements", { token: buyer });
ok("ALL reaches everyone", forBuyer.data?.length === 1, forBuyer.data?.[0]?.title);
ok("unread count is real", (await call("/announcements/unread-count", { token: farmer })).data?.count === 2);
ok("pinned sorts first", (await call("/announcements", { token: farmer })).data?.[0]?.pinned === true);
await call(`/announcements/${farmersOnly.data.id}/read`, { method: "POST", token: farmer });
ok("marking read decrements", (await call("/announcements/unread-count", { token: farmer })).data?.count === 1);
await call("/announcements/read-all", { method: "POST", token: farmer });
ok("read-all clears it", (await call("/announcements/unread-count", { token: farmer })).data?.count === 0);
ok("staff without CONFIG_WRITE cannot publish", (await call("/admin/announcements", { method: "POST", token: staff, body: { title: "should fail", body: "this must be refused" } })).status === 403);

console.log("\n4. Razorpay gateway management");
ok("payments report as unconfigured", (await call("/payments/config", { token: buyer })).data?.enabled === false);
ok("starting a payment fails cleanly", (await call("/payments/start", { method: "POST", token: buyer, body: { purpose: "PLUS_SUBSCRIPTION" } })).status === 503);

const gw = await call("/admin/gateways", { method: "POST", token: admin, body: { label: "Primary (test)", keyId: "rzp_test_1DP5mmOlF5G5ag", keySecret: "thisisatestsecret123", webhookSecret: "whsec_test_abc123" } });
ok("admin adds a Razorpay account", gw.status === 201, `${gw.data?.mode} mode`);
ok("test key detected as TEST", gw.data?.mode === "TEST");
ok("staff cannot add one", (await call("/admin/gateways", { method: "POST", token: staff, body: { label: "x", keyId: "rzp_test_zzzzzzzz", keySecret: "secret12345" } })).status === 403);
const list = await call("/admin/gateways", { token: admin });
ok("secret never returned to the console", !JSON.stringify(list.data).includes("thisisatestsecret123"));
ok("but the console knows a webhook secret exists", list.data?.[0]?.hasWebhookSecret === true);
const cfg = await call("/payments/config", { token: buyer });
ok("app gets the public key only", cfg.data?.enabled === true && cfg.data?.keyId === "rzp_test_1DP5mmOlF5G5ag");
ok("Plus price exposed to the app", cfg.data?.plus?.amountPaise === 49900);
const stored = await p.paymentGateway.findFirst({ where: { keyId: "rzp_test_1DP5mmOlF5G5ag" } });
ok("secret encrypted at rest", !stored.keySecretEnc.includes("thisisatestsecret123"));

const gw2 = await call("/admin/gateways", { method: "POST", token: admin, body: { label: "Backup (test)", keyId: "rzp_test_2ndaccount99", keySecret: "secondsecret4567", activate: false } });
ok("second account added inactive", gw2.data?.active === false);
await call(`/admin/gateways/${gw2.data.id}/activate`, { method: "POST", token: admin });
ok("switching account takes effect at once", (await call("/payments/config", { token: buyer })).data?.keyId === "rzp_test_2ndaccount99");
ok("exactly one gateway active", (await p.paymentGateway.count({ where: { active: true } })) === 1);
ok("cannot delete the active account", (await call(`/admin/gateways/${gw2.data.id}`, { method: "DELETE", token: admin })).status === 409);

console.log("\n5. Payment integrity");
ok("unknown order rejected", (await call("/payments/confirm", { method: "POST", token: buyer, body: { razorpayOrderId: "order_fake", razorpayPaymentId: "pay_fake", signature: "deadbeef" } })).status === 404);
const noSecret = await fetch(`${B}/webhooks/razorpay`, { method: "POST", headers: { "Content-Type": "application/json", "x-razorpay-signature": "bogus" }, body: JSON.stringify({ event: "payment.captured" }) });
ok("no webhook secret configured -> 503 so Razorpay retries", noSecret.status === 503);
// Attach a secret to the active account, then a forged signature must be rejected.
const activeGw = await p.paymentGateway.findFirst({ where: { active: true } });
await call(`/admin/gateways/${activeGw.id}`, { method: "PATCH", token: admin, body: { webhookSecret: "whsec_live_test_secret" } });
const forged = await fetch(`${B}/webhooks/razorpay`, { method: "POST", headers: { "Content-Type": "application/json", "x-razorpay-signature": "deadbeef" }, body: JSON.stringify({ event: "payment.captured" }) });
ok("forged webhook signature refused", forged.status === 400);
const crypto = await import("node:crypto");
const payload = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_x", order_id: "order_unknown" } } } });
const goodSig = crypto.createHmac("sha256", "whsec_live_test_secret").update(payload).digest("hex");
const genuine = await fetch(`${B}/webhooks/razorpay`, { method: "POST", headers: { "Content-Type": "application/json", "x-razorpay-signature": goodSig }, body: payload });
ok("genuine signature accepted", genuine.status === 200);
const audit = await call("/admin/audit", { token: admin });
const acts = audit.data.map((e) => e.action);
ok("gateway changes audited", acts.includes("PAYMENT_GATEWAY_ADDED") && acts.includes("PAYMENT_GATEWAY_SWITCHED"));
ok("announcements audited", acts.includes("ANNOUNCEMENT_PUBLISHED"));

await p.announcement.deleteMany({});
await p.paymentGateway.deleteMany({});
await p.kycDocument.deleteMany({});
await p.user.updateMany({ where: { role: { in: ["FARMER", "BUYER", "DRIVER"] } }, data: { verification: "UNVERIFIED", licenceEnc: null, licenceIndex: null, idLast4: null, verificationSubmittedAt: null } });
await p.truck.updateMany({ data: { rcNumber: null, insuranceExpiry: null, permitExpiry: null } });
await p.$disconnect();

console.log(`\n${"=".repeat(44)}\n  ${pass} passed, ${fail} failed\n${"=".repeat(44)}`);
process.exit(fail ? 1 : 0);
