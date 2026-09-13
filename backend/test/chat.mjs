// Farmer/buyer messaging, against the live API.
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

const run = async () => {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const buyer = await login("karthik@uzhavan.app");
  const otherBuyer = await login("kannan@uzhavan.app"); // farmer account; only used to prove role rules below
  const farmer = await login("arul@uzhavan.app");
  const otherFarmer = await login("muthu@uzhavan.app");

  const summary = await call("/farmer/summary", { token: farmer });
  const farmId = summary.data?.farm?.id;
  ok("the fixture farm exists", !!farmId, JSON.stringify(summary.data).slice(0, 100));

  // The REST API has no delete — a conversation is meant to persist — so a
  // leftover from an earlier run (or an ad-hoc script hitting these same
  // seeded accounts) has to be swept directly. Cascades to its messages.
  await prisma.conversation.deleteMany({ where: { farmId, buyer: { email: "karthik@uzhavan.app" } } });

  console.log("Starting a conversation");

  const noAccess = await call("/conversations", { method: "POST", body: { farmId } });
  ok("signing in is required", noAccess.status === 401, `got ${noAccess.status}`);

  const wrongRole = await call("/conversations", {
    method: "POST",
    token: farmer,
    body: { farmId },
  });
  ok("a farmer cannot start a conversation", wrongRole.status === 403, `got ${wrongRole.status}`);

  const ghostFarm = await call("/conversations", {
    method: "POST",
    token: buyer,
    body: { farmId: "does-not-exist" },
  });
  ok("an unknown farm is a 404", ghostFarm.status === 404, `got ${ghostFarm.status}`);

  const started = await call("/conversations", { method: "POST", token: buyer, body: { farmId } });
  ok("a buyer can start one", started.status === 201, JSON.stringify(started.data).slice(0, 120));
  ok("it names who it's with", started.data?.with?.kind === "farm" && started.data.with.id === farmId);
  const convoId = started.data?.id;

  const again = await call("/conversations", { method: "POST", token: buyer, body: { farmId } });
  ok("opening the same farm again returns the same thread", again.data?.id === convoId);

  console.log("\nSending messages");

  const tooLong = await call(`/conversations/${convoId}/messages`, {
    method: "POST",
    token: buyer,
    body: { body: "x".repeat(3000) },
  });
  ok("an overlong message is rejected", tooLong.status === 400, `got ${tooLong.status}`);

  const empty = await call(`/conversations/${convoId}/messages`, {
    method: "POST",
    token: buyer,
    body: { body: "   " },
  });
  ok("a blank message is rejected", empty.status === 400, `got ${empty.status}`);

  const first = await call(`/conversations/${convoId}/messages`, {
    method: "POST",
    token: buyer,
    body: { body: "Is this still available?" },
  });
  ok("the buyer sends the first message", first.status === 201, first.data?.body);

  const reply = await call(`/conversations/${convoId}/messages`, {
    method: "POST",
    token: farmer,
    body: { body: "Yes, plenty left." },
  });
  ok("the farmer replies", reply.status === 201, reply.data?.body);

  const thread = await call(`/conversations/${convoId}/messages`, { token: buyer });
  ok("the thread has both messages", thread.data?.length === 2, `${thread.data?.length}`);
  ok(
    "oldest first",
    thread.data?.[0]?.body === "Is this still available?" &&
      thread.data?.[1]?.body === "Yes, plenty left.",
    JSON.stringify(thread.data?.map((m) => m.body)),
  );

  console.log("\nWho can see what");

  const strangerFarmer = await call(`/conversations/${convoId}/messages`, {
    method: "POST",
    token: otherFarmer,
    body: { body: "sneaky" },
  });
  ok(
    "a farmer who isn't part of this thread is refused",
    strangerFarmer.status === 404,
    `got ${strangerFarmer.status}`,
  );

  const strangerRead = await call(`/conversations/${convoId}/messages`, { token: otherFarmer });
  ok("and can't read it either", strangerRead.status === 404, `got ${strangerRead.status}`);

  const list = await call("/conversations", { token: farmer });
  ok(
    "it appears in the farmer's conversation list",
    (list.data ?? []).some((c) => c.id === convoId),
  );
  const row = (list.data ?? []).find((c) => c.id === convoId);
  ok("the preview shows the buyer's side", row?.with?.kind === "buyer");
  ok("with the latest message", row?.lastMessageBody === "Yes, plenty left.");

  console.log("\nUnread and read receipts");

  const buyerList = await call("/conversations", { token: buyer });
  const buyerRow = (buyerList.data ?? []).find((c) => c.id === convoId);
  ok(
    "the buyer sees it as unread after the farmer's reply",
    buyerRow?.unread === true,
    JSON.stringify(buyerRow),
  );

  await call(`/conversations/${convoId}/read`, { method: "POST", token: buyer });
  const afterRead = await call("/conversations", { token: buyer });
  const afterReadRow = (afterRead.data ?? []).find((c) => c.id === convoId);
  ok("marking it read clears the flag", afterReadRow?.unread === false);

  console.log("\nLookup by crop");

  const crops = await call(`/farmer/crops`, { token: farmer });
  const anyCrop = (crops.data ?? [])[0];
  if (anyCrop) {
    const byCrop = await call(`/conversations/by-crop/${anyCrop.id}`, { token: buyer });
    ok(
      "the by-crop lookup finds the existing thread with this farm",
      byCrop.data?.id === convoId,
      JSON.stringify(byCrop.data),
    );
  }

  const noThreadYet = await call(`/conversations/by-crop/${anyCrop?.id ?? "x"}`, {
    token: otherBuyer, // a farmer account — has no thread with anyone, so this must read null, not error
  });
  ok(
    "someone with no thread on that farm gets null, not an error",
    noThreadYet.status === 200 && noThreadYet.data === null,
    `${noThreadYet.status} ${JSON.stringify(noThreadYet.data)}`,
  );

  // Leave the thread as it was found — a fresh empty pair for the next run.
  await prisma.conversation.deleteMany({ where: { id: convoId } });
  await prisma.$disconnect();

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch((err) => {
  console.error("\nsuite crashed:", err.message);
  process.exit(1);
});
