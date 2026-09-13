// Personal activity notifications - request accepted/declined, order
// confirmed, driver accepted, delivered - against the live API.
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

const listFor = (token) => call("/notifications", { token });
const latestFor = async (token, kind) => {
  const { data } = await listFor(token);
  return (data ?? []).find((n) => n.kind === kind);
};

const run = async () => {
  const buyer = await login("karthik@uzhavan.app");
  const otherBuyer = await login("kannan@uzhavan.app"); // farmer account; used only to prove access rules
  const farmer = await login("arul@uzhavan.app");
  const driverEmails = { Selvam: "selvam@uzhavan.app", "Ramesh Kumar": "ramesh@uzhavan.app", "Vikram Raj": "vikram@uzhavan.app" };

  console.log("Setting up a fresh crop and requests");

  const crop = await call("/farmer/crops", {
    method: "POST",
    token: farmer,
    body: {
      title: "Suite crop — notifications",
      category: "Grains · Millet",
      grade: "Grade A",
      status: "ready",
      expectedKg: 4000,
      minOrderKg: 500,
      pricePerKg: 60,
      harvestDate: "20 Sep 2026",
      about: "Test listing created by the notifications suite.",
      imageKey: "farm",
      listed: true,
    },
  });
  const cropId = crop.data?.id;
  ok("test crop created", crop.status === 201, cropId);

  console.log("\nRequest declined notifies the buyer");

  const declinedReq = await call("/requests", {
    method: "POST", token: buyer, body: { cropId, quantityKg: 800 },
  });
  const declinedId = declinedReq.data?.id;
  const decline = await call(`/farmer/requests/${declinedId}/decline`, {
    method: "POST", token: farmer, body: { reason: "Sold out to another buyer" },
  });
  ok("farmer declines", decline.status === 200);

  const declineNotice = await latestFor(buyer, "REQUEST_DECLINED");
  ok("the buyer got a REQUEST_DECLINED notification", !!declineNotice, JSON.stringify(declineNotice));
  ok(
    "it names the reason",
    declineNotice?.body?.includes("Sold out to another buyer"),
    declineNotice?.body,
  );
  ok("it starts unread", declineNotice && declineNotice.readAt === null);

  console.log("\nRequest accepted notifies the buyer");

  const req = await call("/requests", {
    method: "POST", token: buyer, body: { cropId, quantityKg: 2000 },
  });
  const requestId = req.data?.id;
  ok("request created", req.status === 201, req.data?.code);

  const accepted = await call(`/farmer/requests/${requestId}/accept`, {
    method: "POST", token: farmer, body: { finalPricePerKg: 65 },
  });
  ok("farmer accepts", accepted.status === 200);

  const acceptNotice = await latestFor(buyer, "REQUEST_ACCEPTED");
  ok("the buyer got a REQUEST_ACCEPTED notification", !!acceptNotice, JSON.stringify(acceptNotice));
  ok("it mentions the price", acceptNotice?.body?.includes("65"), acceptNotice?.body);
  ok("it carries the request id for the tap target", acceptNotice?.data?.requestId === requestId);

  console.log("\nOrder confirmed notifies the farmer");

  const order = await call(`/requests/${requestId}/confirm`, { method: "POST", token: buyer });
  const orderId = order.data?.id;
  ok("order created", order.status === 201, order.data?.code);

  const confirmNotice = await latestFor(farmer, "ORDER_CONFIRMED");
  ok("the farmer got an ORDER_CONFIRMED notification", !!confirmNotice, JSON.stringify(confirmNotice));
  ok("it names the buyer", confirmNotice?.body?.includes("Karthik"), confirmNotice?.body);
  ok("it carries the order id", confirmNotice?.data?.orderId === orderId);

  console.log("\nDriver accepting and delivering notifies the buyer");

  const trucks = await call(`/trucks?loadKg=2000`, { token: buyer });
  const truck = (trucks.data ?? []).find((t) => !t.tooSmall);
  const booking = await call("/bookings", { method: "POST", token: buyer, body: { orderId, truckId: truck.id } });
  const bookingId = booking.data?.id;
  await call(`/bookings/${bookingId}/pay`, { method: "POST", token: buyer });

  const tripDriver = await login(driverEmails[truck.driver.name]);
  const driverAccept = await call(`/driver/trips/${bookingId}/advance`, { method: "POST", token: tripDriver, body: {} });
  ok("driver accepts the job", driverAccept.data?.status === "ACCEPTED");

  const driverNotice = await latestFor(buyer, "DRIVER_ACCEPTED");
  ok("the buyer got a DRIVER_ACCEPTED notification", !!driverNotice, JSON.stringify(driverNotice));
  ok("it names the driver", driverNotice?.body?.includes(truck.driver.name), driverNotice?.body);

  for (const step of ["ARRIVED_PICKUP", "LOADED", "IN_TRANSIT"]) {
    await call(`/driver/trips/${bookingId}/advance`, { method: "POST", token: tripDriver, body: {} });
  }
  const delivered = await call(`/driver/trips/${bookingId}/advance`, {
    method: "POST", token: tripDriver, body: { receivedBy: "Test Warehouse" },
  });
  ok("delivered with proof", delivered.data?.status === "DELIVERED");

  const deliveredNotice = await latestFor(buyer, "DELIVERED");
  ok("the buyer got a DELIVERED notification", !!deliveredNotice, JSON.stringify(deliveredNotice));
  ok("it names who received it", deliveredNotice?.body?.includes("Test Warehouse"), deliveredNotice?.body);

  console.log("\nThe list, unread count, and read state");

  const list = await listFor(buyer);
  ok("the buyer's feed lists their own notifications", (list.data ?? []).length >= 3, `${list.data?.length}`);
  ok("newest first", new Date(list.data[0].createdAt) >= new Date(list.data[1].createdAt));

  const unreadBefore = await call("/notifications/unread-count", { token: buyer });
  ok("unread count matches unread rows", unreadBefore.data?.count >= 3, JSON.stringify(unreadBefore.data));

  const noAccess = await call(`/notifications/${deliveredNotice.id}/read`, { method: "POST", token: otherBuyer });
  ok("someone else's notification can't be marked read", noAccess.status === 404, `got ${noAccess.status}`);

  const markOne = await call(`/notifications/${deliveredNotice.id}/read`, { method: "POST", token: buyer });
  ok("marking one read succeeds", markOne.data?.read === true);
  const afterOne = await listFor(buyer);
  ok(
    "that one now shows read",
    afterOne.data?.find((n) => n.id === deliveredNotice.id)?.readAt !== null,
  );

  const markAll = await call("/notifications/read-all", { method: "POST", token: buyer });
  ok("read-all marks the rest", markAll.data?.marked >= 2, JSON.stringify(markAll.data));
  const unreadAfter = await call("/notifications/unread-count", { token: buyer });
  ok("unread count is now zero", unreadAfter.data?.count === 0);

  console.log("\nAccess and input");

  const anon = await call("/notifications");
  ok("signing in is required", anon.status === 401, `got ${anon.status}`);

  const ghost = await call("/notifications/does-not-exist/read", { method: "POST", token: buyer });
  ok("marking an unknown notification 404s", ghost.status === 404, `got ${ghost.status}`);

  console.log("\nCleanup");
  const del = await call(`/farmer/crops/${cropId}`, { method: "DELETE", token: farmer });
  ok("crop with sales is unlisted, not destroyed", del.data?.unlisted === true);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

run().catch((err) => {
  console.error("\nsuite crashed:", err.message);
  process.exit(1);
});
