// Phase 2 + 3: admin console, permissions, remote config, app updates, tickets.
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
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

const call = (path, options) => withRetry(() => callOnce(path, options));
const login = async (email, password = "uzhavan123") => {
  const r = await call("/auth/login", { method: "POST", body: { email, password } });
  return r.data?.token;
};

const run = async () => {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const admin = await login("admin@uzhavan.app");
  const staff = await login("staff@uzhavan.app");
  const buyer = await login("karthik@uzhavan.app");
  const farmer = await login("muthu@uzhavan.app");

  section("1. Identity & permission catalogue");
  const meAdmin = await call("/admin/me", { token: admin });
  ok("admin identified", meAdmin.data?.isAdmin === true);
  ok("admin holds every permission", meAdmin.data?.permissions?.length >= 13, `${meAdmin.data?.permissions?.length} perms`);
  const meStaff = await call("/admin/me", { token: staff });
  ok("staff is not admin", meStaff.data?.isAdmin === false);
  ok("staff has only granted perms", !meStaff.data.permissions.includes("ADMIN_STAFF_MANAGE"));
  ok("buyer locked out of console", (await call("/admin/me", { token: buyer })).status === 403);

  const cat = await call("/admin/permissions", { token: staff });
  ok("catalogue separates grantable from admin-only",
    cat.data?.grantable?.length === 9 && cat.data?.adminOnly?.length === 4);

  section("2. Admin-only powers are not delegable");
  const staffRow = await prisma.user.findUnique({ where: { email: "staff@uzhavan.app" } });
  const escalate = await call(`/admin/staff/${staffRow.id}/permissions`, {
    method: "PUT", token: admin, body: { permissions: ["USERS_VIEW", "ADMIN_PERMISSIONS_GRANT"] } });
  ok("admin cannot grant ADMIN_* to staff", escalate.status === 403, escalate.data?.error);

  const staffLists = await call("/admin/staff", { token: staff });
  ok("staff cannot manage staff", staffLists.status === 403);
  const adminLists = await call("/admin/staff", { token: admin });
  ok("admin can list staff", Array.isArray(adminLists.data), `${adminLists.data?.length} accounts`);

  section("3. Creating a staff member with scoped access");
  const email = `agent${Date.now()}@uzhavan.app`;
  const created = await call("/admin/staff", { method: "POST", token: admin,
    body: { name: "New Agent", email, phone: "+91 91000 00000", password: "agent-strong-pass",
            permissions: ["TICKETS_VIEW", "TICKETS_RESPOND"] } });
  ok("staff created", created.status === 201);
  const agentToken = await login(email, "agent-strong-pass");
  ok("new staff can sign in", !!agentToken);

  const agentKyc = await call("/verification/queue", { token: agentToken });
  ok("agent without KYC_REVIEW is refused", agentKyc.status === 403, agentKyc.data?.error);
  const agentTickets = await call("/tickets/desk/queue", { token: agentToken });
  ok("agent with TICKETS_VIEW is allowed", agentTickets.status === 200);
  const agentBlock = await call(`/admin/users/${(await prisma.user.findUnique({ where: { email: "vikram@uzhavan.app" } })).id}/status`,
    { method: "POST", token: agentToken, body: { status: "BLOCKED", reason: "should not work" } });
  ok("agent without USERS_MODERATE cannot block", agentBlock.status === 403, agentBlock.data?.error);

  section("4. Granting a permission takes effect immediately");
  const agentRow = await prisma.user.findUnique({ where: { email } });
  const grant = await call(`/admin/staff/${agentRow.id}/permissions`, { method: "PUT", token: admin,
    body: { permissions: ["TICKETS_VIEW", "TICKETS_RESPOND", "KYC_REVIEW"] } });
  ok("admin grants KYC_REVIEW", grant.status === 200);
  ok("agent can now see the KYC queue", (await call("/verification/queue", { token: agentToken })).status === 200);

  section("5. Support tickets — raising");
  // Tickets from earlier runs count against the 3-open cap, so a suite that
  // doesn't tidy up eventually fails on its own leftovers rather than on a bug.
  for (const who of [buyer, farmer]) {
    const open = await call("/tickets", { token: who });
    for (const t of open.data ?? []) {
      if (["RESOLVED", "CLOSED"].includes(t.status)) continue;
      await call(`/tickets/desk/${t.code}/status`, {
        method: "POST",
        token: admin,
        body: { status: "CLOSED" },
      });
    }
  }

  const short = await call("/tickets", { method: "POST", token: buyer, body: { category: "OTHER", subject: "hi", message: "too short" } });
  ok("thin ticket rejected", short.status === 400);

  const t1 = await call("/tickets", { method: "POST", token: buyer,
    body: { category: "DELIVERY", subject: "Truck never arrived at the farm",
            message: "The driver accepted my booking two days ago and has not shown up at Muthu Farms." } });
  ok("ticket created", t1.status === 201, t1.data?.code);
  ok("code is short and readable", /^UZ-[A-Z2-9]{5}$/.test(t1.data?.code ?? ""), t1.data?.code);
  ok("auto-assigned on creation", !!t1.data?.assignedTo, `→ ${t1.data?.assignedTo?.name}`);
  ok("delivery issues start at HIGH priority", t1.data?.priority === "HIGH");
  ok("status reflects assignment", t1.data?.status === "ASSIGNED");

  const staffRaise = await call("/tickets", { method: "POST", token: staff,
    body: { category: "OTHER", subject: "Internal question here", message: "Staff should not raise tickets this way." } });
  ok("staff cannot raise support tickets", staffRaise.status === 403);

  section("6. Assignment balances by workload");
  const codes = [t1.data.code];
  for (let i = 0; i < 4; i += 1) {
    const r = await call("/tickets", { method: "POST", token: i % 2 ? farmer : buyer,
      body: { category: "OTHER", subject: `Load balance probe ${i}`, message: "Checking that assignment spreads across staff." } });
    if (r.status === 201) codes.push(r.data.code);
  }
  const assignees = await prisma.ticket.groupBy({ by: ["assignedToId"], _count: true, where: { code: { in: codes } } });
  ok("work spread across more than one agent", assignees.length >= 2,
    assignees.map((a) => a._count).join(" / "));

  section("7. Ticket limits");
  const flood = await call("/tickets", { method: "POST", token: buyer,
    body: { category: "OTHER", subject: "One too many tickets", message: "This should be refused as a rate limit." } });
  ok("open-ticket cap enforced", flood.status === 429, flood.data?.error);

  section("8. Replies, internal notes, visibility");
  const code = t1.data.code;
  const note = await call(`/tickets/${code}/reply`, { method: "POST", token: staff,
    body: { body: "Checking with the driver before replying.", internal: true } });
  ok("staff leaves an internal note", note.status === 201);
  const userNote = await call(`/tickets/${code}/reply`, { method: "POST", token: buyer,
    body: { body: "sneaky", internal: true } });
  ok("user cannot fake an internal note", userNote.status === 403);

  await call(`/tickets/${code}/reply`, { method: "POST", token: staff,
    body: { body: "Sorry about this — we're reassigning a truck now." } });

  const asUser = await call(`/tickets/${code}`, { token: buyer });
  const asStaff = await call(`/tickets/${code}`, { token: staff });
  ok("internal note hidden from the user", !JSON.stringify(asUser.data.messages).includes("Checking with the driver"));
  ok("staff sees every message", asStaff.data.messages.length > asUser.data.messages.length,
    `${asStaff.data.messages.length} vs ${asUser.data.messages.length}`);
  ok("staff reply moves it to waiting-on-user", asUser.data.status === "WAITING_ON_USER");
  ok("first response recorded", !!(await prisma.ticket.findUnique({ where: { code } })).firstResponseAt);

  const stranger = await call(`/tickets/${code}`, { token: farmer });
  ok("another user cannot read the ticket", stranger.status === 404);

  section("9. 24-hour escalation sweep");
  // Backdate an unassigned ticket past the window and run the sweeper.
  // A crashed earlier run can leave this fixed-code row behind, and the unique
  // constraint then fails the whole suite on leftovers rather than on a bug.
  await prisma.ticket.deleteMany({ where: { code: "UZ-TEST1" } });
  const orphan = await prisma.ticket.create({
    data: { code: "UZ-TEST1", raisedById: (await prisma.user.findUnique({ where: { email: "karthik@uzhavan.app" } })).id,
            category: "OTHER", subject: "Sat in the queue too long", status: "OPEN", priority: "LOW",
            createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000) },
  });
  const { escalateStaleTickets } = await import("../src/tickets/assignment.js");
  const swept = await escalateStaleTickets();
  const after = await prisma.ticket.findUnique({ where: { id: orphan.id } });
  ok("stale ticket force-assigned", !!after.assignedToId, `assigned=${!!after.assignedToId}`);
  ok("marked as escalated", !!after.escalatedAt);
  ok("priority raised", after.priority === "NORMAL", `LOW → ${after.priority}`);
  ok("sweeper reports what it did", swept.assigned >= 1, `${swept.assigned} assigned`);

  section("10. Remote config — no code change needed");
  const settings = await call("/admin/settings", { token: staff });
  ok("settings listed", Array.isArray(settings.data) && settings.data.length >= 4);

  const badEmail = await call("/admin/settings/support_email", { method: "PUT", token: admin, body: { value: "not-an-email" } });
  ok("invalid email rejected", badEmail.status === 400, badEmail.data?.error);

  const setEmail = await call("/admin/settings/support_email", { method: "PUT", token: admin, body: { value: "help@uzhavan.in" } });
  ok("admin changes support email", setEmail.data?.value === "help@uzhavan.in");
  const setPhone = await call("/admin/settings/support_phone", { method: "PUT", token: admin, body: { value: "+91 44 4000 1234" } });
  ok("admin changes support phone", setPhone.data?.value === "+91 44 4000 1234");

  const publicCfg = await call("/app/config?app=BUYER&platform=ANDROID&version=1.0.0");
  ok("apps see the new values without a deploy", publicCfg.data?.support?.email === "help@uzhavan.in",
    `${publicCfg.data?.support?.email} / ${publicCfg.data?.support?.phone}`);
  ok("config readable without signing in", publicCfg.status === 200);

  const agentConfig = await call("/admin/settings/support_email", { method: "PUT", token: agentToken, body: { value: "x@y.com" } });
  ok("staff without CONFIG_WRITE refused", agentConfig.status === 403);

  section("11. App updates — soft and force");
  const staffRelease = await call("/admin/releases", { method: "PUT", token: staff,
    body: { app: "BUYER", platform: "ANDROID", latestVersion: "2.0.0", minSupportedVersion: "1.0.0" } });
  ok("only admin can publish releases", staffRelease.status === 403, staffRelease.data?.error);

  const backwards = await call("/admin/releases", { method: "PUT", token: admin,
    body: { app: "BUYER", platform: "ANDROID", latestVersion: "1.5.0", minSupportedVersion: "2.0.0" } });
  ok("minimum newer than latest rejected", backwards.status === 400, backwards.data?.error);

  await call("/admin/releases", { method: "PUT", token: admin,
    body: { app: "BUYER", platform: "ANDROID", latestVersion: "1.5.0", minSupportedVersion: "1.2.0",
            releaseNotes: "Faster search.", storeUrl: "https://play.google.com/store/apps/details?id=com.uzhavan.buyer" } });

  const current = await call("/app/config?app=BUYER&platform=ANDROID&version=1.5.0");
  ok("up-to-date build → ok", current.data?.update?.action === "ok");
  const behind = await call("/app/config?app=BUYER&platform=ANDROID&version=1.3.0");
  ok("older build → soft prompt", behind.data?.update?.action === "soft");
  ok("soft prompt carries notes + store link",
    behind.data?.update?.releaseNotes === "Faster search." && !!behind.data?.update?.storeUrl);
  const ancient = await call("/app/config?app=BUYER&platform=ANDROID&version=1.1.0");
  ok("below minimum → force", ancient.data?.update?.action === "force");

  await call("/admin/releases", { method: "PUT", token: admin,
    body: { app: "BUYER", platform: "ANDROID", latestVersion: "1.5.0", minSupportedVersion: "1.2.0", mandatory: true } });
  const forced = await call("/app/config?app=BUYER&platform=ANDROID&version=1.3.0");
  ok("mandatory flag forces everyone behind latest", forced.data?.update?.action === "force");

  const partner = await call("/app/config?app=PARTNER&platform=ANDROID&version=1.0.0");
  ok("partner app gated independently", partner.data?.update?.action === "ok");

  section("12. Audit trail");
  const auditAsStaff = await call("/admin/audit", { token: staff });
  ok("staff cannot read the audit log", auditAsStaff.status === 403);
  const auditLog = await call("/admin/audit", { token: admin });
  ok("admin reads the audit log", Array.isArray(auditLog.data) && auditLog.data.length > 0, `${auditLog.data?.length} entries`);
  const actions = auditLog.data.map((e) => e.action);
  ok("release publish recorded", actions.includes("APP_RELEASE_PUBLISHED"));
  ok("setting change recorded", actions.includes("SETTING_CHANGED"));
  ok("staff creation recorded", actions.includes("STAFF_CREATED"));
  ok("escalation recorded", actions.includes("TICKET_ESCALATED"));
  const settingEntry = auditLog.data.find((e) => e.action === "SETTING_CHANGED");
  ok("audit keeps before/after", !!settingEntry?.metadata?.before && !!settingEntry?.metadata?.after,
    `${settingEntry?.metadata?.before} → ${settingEntry?.metadata?.after}`);

  section("13. Removing staff returns their work");
  const before = await prisma.ticket.count({ where: { assignedToId: agentRow.id, status: { in: ["ASSIGNED","IN_PROGRESS","WAITING_ON_USER"] } } });
  const removed = await call(`/admin/staff/${agentRow.id}`, { method: "DELETE", token: admin });
  ok("staff removed", removed.data?.removed === true);
  ok("their live tickets went back to the queue", removed.data?.ticketsReturnedToQueue === before, `${removed.data?.ticketsReturnedToQueue} of ${before}`);
  ok("removed staff can't sign in", (await call("/auth/login", { method: "POST", body: { email, password: "agent-strong-pass" } })).status === 403);
  const selfRemove = await call(`/admin/staff/${(await prisma.user.findUnique({ where: { email: "admin@uzhavan.app" } })).id}`, { method: "DELETE", token: admin });
  ok("admin cannot remove an admin", selfRemove.status === 403);

  section("14. Dashboard");
  const overview = await call("/admin/overview", { token: staff });
  ok("overview returns counts", typeof overview.data?.openTickets === "number",
    `${overview.data?.openTickets} open tickets, ${overview.data?.users?.FARMER} farmers`);

  // cleanup
  await prisma.ticketMessage.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.user.deleteMany({ where: { email } });
  await prisma.appSetting.update({ where: { key: "support_email" }, data: { value: "support@uzhavan.app" } });
  await prisma.appSetting.update({ where: { key: "support_phone" }, data: { value: "+91 80000 00000" } });
  await prisma.appRelease.updateMany({ data: { latestVersion: "1.0.0", minSupportedVersion: "1.0.0", mandatory: false, releaseNotes: "First release.", storeUrl: null } });
  await prisma.$disconnect();

  console.log(`\n${"=".repeat(46)}\n  ${pass} passed, ${fail} failed\n${"=".repeat(46)}`);
  process.exit(fail ? 1 : 0);
};

run().catch((e) => { console.error("\nCrashed:", e); process.exit(1); });
