// The rule-based Q&A assistant, against the live API.
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

const ask = (token, question) => call("/assistant/ask", { method: "POST", token, body: { question } });

const run = async () => {
  const buyer = await login("karthik@uzhavan.app");
  const farmer = await login("arul@uzhavan.app");
  const driver = await login("selvam@uzhavan.app");

  console.log("The three questions it exists to answer");

  const crops = await ask(buyer, "what crops are available");
  ok("crops question resolves to the crops intent", crops.data?.intent === "crops_available");
  ok("with an actual answer", typeof crops.data?.text === "string" && crops.data.text.length > 0);
  ok(
    "no fixture-invented crop — every price is a real number",
    !Array.isArray(crops.data?.data) || crops.data.data.every((c) => typeof c.pricePerKg === "number"),
  );

  const delivery = await ask(buyer, "who is available for delivery");
  ok("delivery question resolves to the delivery intent", delivery.data?.intent === "delivery_availability");
  ok("mentions the word driver or online, not an invented service", /driver|online/i.test(delivery.data?.text ?? ""));

  const payment = await ask(buyer, "what's my payment status");
  ok("payment question resolves to the payment intent", payment.data?.intent === "payment_status");

  console.log("\nIt only answers from the asker's own data");

  const buyerOrders = await call("/orders", { token: buyer });
  const paymentAgain = await ask(buyer, "payment status");
  if ((buyerOrders.data ?? []).length > 0) {
    const code = buyerOrders.data[0].code;
    ok(
      "a buyer's payment answer references one of their own orders",
      paymentAgain.data?.text?.includes(code),
      paymentAgain.data?.text,
    );
  }

  const farmerAsksPayment = await ask(farmer, "what's the payment status");
  ok(
    "a farmer asking about 'payment status' is redirected rather than shown a buyer's orders",
    farmerAsksPayment.data?.intent === "payment_status" &&
      !/UZH-ORD/.test(farmerAsksPayment.data?.text ?? ""),
    farmerAsksPayment.data?.text,
  );

  console.log("\nHonesty about its own limits");

  const unknown = await ask(buyer, "what's the weather like today");
  ok("an out-of-scope question says so rather than guessing", unknown.data?.intent === "unknown");
  ok(
    "and doesn't invent data to answer with",
    !/₹\d|\d+\s*kg/i.test(unknown.data?.text ?? ""),
    unknown.data?.text,
  );

  console.log("\nAccess and input");

  const anon = await call("/assistant/ask", { method: "POST", body: { question: "crops?" } });
  ok("signing in is required", anon.status === 401, `got ${anon.status}`);

  const empty = await ask(buyer, "");
  ok("an empty question is rejected", empty.status === 400, `got ${empty.status}`);

  const tooLong = await ask(buyer, "x".repeat(500));
  ok("an absurdly long question is rejected", tooLong.status === 400, `got ${tooLong.status}`);

  const driverAsks = await ask(driver, "what crops are available");
  ok("a driver can use it too — it's not buyer-only", driverAsks.status === 200, `got ${driverAsks.status}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch((err) => {
  console.error("\nsuite crashed:", err.message);
  process.exit(1);
});
