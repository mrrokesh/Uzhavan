// A showcase marketplace: realistic crops and one deal at every stage, so every
// screen in both apps has something to show.
//
//   npm run db:demo              add it (safe to run twice — it skips if already there)
//   npm run db:demo -- --remove  take it back out
//
// It goes through the real API rather than writing rows, so fees, stock
// reservations, notifications and ratings all behave exactly as they do for a
// real user. Needs the API running and the seed loaded (npm run db:seed).
//
// Everything is created for the seeded demo accounts, and the crop names are
// deliberately ordinary, so the test suite's cleanup never touches them.
const BASE = process.env.UZHAVAN_API ?? "http://127.0.0.1:4000/api";

const DEMO_CROPS = [
  { owner: "arul", title: "Kodaikanal Strawberries", category: "Fruits · Strawberry", status: "ready", expectedKg: 3000, pricePerKg: 140, harvestDate: "12 Oct 2026", imageKey: "grove", about: "Sweet, firm strawberries from the Kodaikanal hills, picked at dawn and packed in cold punnets. Sorted by size and suited to retail chains and juice bars." },
  { owner: "arul", title: "Sweet Corn", category: "Vegetables · Sweet corn", status: "ready", expectedKg: 4000, pricePerKg: 28, harvestDate: "8 Oct 2026", imageKey: "orchard", about: "Tender sweet corn cobs, harvested the same morning and sold in the husk. A short shelf life, so it suits quick wholesale turnaround." },
  { owner: "muthu", title: "Dry Red Chillies", category: "Spices · Chilli", status: "ready", expectedKg: 3000, pricePerKg: 210, harvestDate: "5 Oct 2026", imageKey: "farm", about: "Sun-dried Guntur-type chillies, stems on, moisture under 10%. Bright colour and good heat for masala and powder making." },
  { owner: "muthu", title: "Sona Masoori Paddy", category: "Grains · Paddy", status: "upcoming", statusLabel: "Harvest in 4 weeks", expectedKg: 12000, pricePerKg: 24, harvestDate: "2 Nov 2026", imageKey: "orchard", about: "Sona Masoori paddy from a 20-acre field, harvest expected in the first week of November." },
  { owner: "kannan", title: "Hill Garlic", category: "Vegetables · Garlic", status: "ready", expectedKg: 2500, pricePerKg: 85, harvestDate: "6 Oct 2026", imageKey: "farm", about: "Nilgiri hill garlic with large cloves and a strong flavour. Cured for ten days and graded." },
  { owner: "kannan", title: "Nilgiri Carrots", category: "Vegetables · Carrot", status: "ready", expectedKg: 5000, pricePerKg: 32, harvestDate: "4 Oct 2026", imageKey: "farm", about: "Sweet, even-sized carrots from the Nilgiri highlands, washed and bagged on the day of harvest." },
];

let failed = 0;
const say = (m) => console.log(m);
async function call(path, { method = "GET", token, body } = {}) {
  for (let i = 0; i < 4; i += 1) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 503) { await new Promise((r) => setTimeout(r, 300 * (i + 1))); continue; }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  }
  return { status: 503, data: null };
}
const login = async (who) => {
  const r = await call("/auth/login", { method: "POST", body: { email: `${who}@uzhavan.app`, password: "uzhavan123" } });
  if (r.status !== 200) throw new Error(`could not sign in as ${who}: ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.token;
};
const must = (r, what) => {
  if (r.status >= 300) { failed += 1; throw new Error(`${what} failed: ${r.status} ${JSON.stringify(r.data)}`); }
  return r.data;
};

async function remove() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const crops = await prisma.crop.findMany({ where: { title: { in: DEMO_CROPS.map((c) => c.title) } }, select: { id: true } });
  const ids = crops.map((c) => c.id);
  await prisma.review.deleteMany({ where: { order: { cropId: { in: ids } } } });
  await prisma.payout.deleteMany({ where: { order: { cropId: { in: ids } } } });
  await prisma.truckBooking.deleteMany({ where: { order: { cropId: { in: ids } } } });
  await prisma.order.deleteMany({ where: { cropId: { in: ids } } });
  await prisma.cropRequest.deleteMany({ where: { cropId: { in: ids } } });
  await prisma.conversation.deleteMany({ where: { OR: [{ cropId: { in: ids } }, { crop: null, buyer: { email: "karthik@uzhavan.app" } }] } });
  await prisma.notification.deleteMany({ where: { user: { email: { in: ["karthik", "arul", "muthu", "kannan", "selvam", "ramesh", "vikram"].map((n) => `${n}@uzhavan.app`) } } } });
  await prisma.crop.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
  say(`removed ${ids.length} showcase crops and the deals, chats and notifications built on them`);
}

async function add() {
  const tokens = {};
  for (const who of ["karthik", "arul", "muthu", "kannan", "selvam", "ramesh", "vikram"]) tokens[who] = await login(who);
  const buyer = tokens.karthik;

  // Three drivers on the board looks like a real marketplace, and a second
  // booking needs a free truck while the first is still on the road.
  for (const who of ["selvam", "ramesh", "vikram"]) {
    await call("/driver/availability", { method: "PATCH", token: tokens[who], body: { online: true } });
  }

  const mine = must(await call("/farmer/crops", { token: tokens.arul }), "list crops");
  if ((mine ?? []).some((c) => c.title === "Kodaikanal Strawberries")) {
    say("The showcase is already loaded. Run with --remove first to rebuild it.");
    return;
  }

  say("Listing crops...");
  const crop = {};
  for (const c of DEMO_CROPS) {
    const { owner, ...body } = c;
    const made = must(await call("/farmer/crops", { method: "POST", token: tokens[owner], body: { ...body, minOrderKg: 500, galleryKeys: [body.imageKey] } }), `list ${c.title}`);
    crop[c.title] = { ...made, owner };
  }
  // The seeded turmeric ships unlisted; show it too.
  const muthuCrops = must(await call("/farmer/crops", { token: tokens.muthu }), "muthu crops");
  const turmeric = muthuCrops.find((c) => c.title === "Salem Turmeric");
  if (turmeric && !turmeric.listed) await call(`/farmer/crops/${turmeric.id}`, { method: "PATCH", token: tokens.muthu, body: { listed: true } });

  const request = async (title, kg) => must(await call("/requests", { method: "POST", token: buyer, body: { cropId: crop[title].id, quantityKg: kg } }), `request ${title}`);
  const accept = async (title, id, price) => must(await call(`/farmer/requests/${id}/accept`, { method: "POST", token: tokens[crop[title].owner], body: price ? { finalPricePerKg: price } : {} }), `accept ${title}`);
  const confirm = async (id) => must(await call(`/requests/${id}/confirm`, { method: "POST", token: buyer }), "confirm");

  say("1. A request waiting on the farmer (Kodaikanal Strawberries)");
  await request("Kodaikanal Strawberries", 1000);

  say("2. A request the farmer has priced, waiting on the buyer (Dry Red Chillies)");
  const chilli = await request("Dry Red Chillies", 600);
  await accept("Dry Red Chillies", chilli.id, 215);

  say("3. A request the farmer declined (Sona Masoori Paddy)");
  const paddy = await request("Sona Masoori Paddy", 4000);
  must(await call(`/farmer/requests/${paddy.id}/decline`, { method: "POST", token: tokens.muthu, body: { reason: "Harvest has moved to next month. Please request again then." } }), "decline");

  say("4. A confirmed order, payment due (Sweet Corn)");
  const guava = await request("Sweet Corn", 800);
  await accept("Sweet Corn", guava.id);
  await confirm(guava.id);

  const bookAndPay = async (orderId, loadKg) => {
    const trucks = must(await call(`/trucks?loadKg=${loadKg}`, { token: buyer }), "trucks");
    const truck = trucks.find((t) => !t.tooSmall);
    if (!truck) throw new Error(`no free truck can carry ${loadKg} kg`);
    const booking = must(await call("/bookings", { method: "POST", token: buyer, body: { orderId, truckId: truck.id } }), "book truck");
    must(await call(`/bookings/${booking.id}/pay`, { method: "POST", token: buyer }), "pay booking");
    for (const who of ["selvam", "ramesh", "vikram"]) {
      const jobs = await call("/driver/jobs", { token: tokens[who] });
      if ((jobs.data ?? []).some((j) => j.id === booking.id)) return { booking, driver: tokens[who] };
    }
    throw new Error("no driver received the job");
  };
  const advance = async (id, driver, body = {}) => must(await call(`/driver/trips/${id}/advance`, { method: "POST", token: driver, body }), "advance trip");

  say("5. A truck booked and the trip under way (Hill Garlic)");
  const garlicReq = await request("Hill Garlic", 600);
  await accept("Hill Garlic", garlicReq.id);
  const garlicOrder = await confirm(garlicReq.id);
  const trip = await bookAndPay(garlicOrder.id, 600);
  for (let i = 0; i < 4; i += 1) await advance(trip.booking.id, trip.driver);

  say("6. A finished delivery with ratings both ways (Nilgiri Carrots)");
  const carrotReq = await request("Nilgiri Carrots", 700);
  await accept("Nilgiri Carrots", carrotReq.id);
  const carrotOrder = await confirm(carrotReq.id);
  const done = await bookAndPay(carrotOrder.id, 700);
  for (let i = 0; i < 4; i += 1) await advance(done.booking.id, done.driver);
  await advance(done.booking.id, done.driver, { receivedBy: "Rajesh, Salem Agro Warehouse" });
  must(await call(`/orders/${carrotOrder.id}/reviews`, { method: "POST", token: buyer, body: { subject: "FARM", stars: 5, comment: "Fresh, evenly sized and exactly as described." } }), "rate farm");
  must(await call(`/orders/${carrotOrder.id}/reviews`, { method: "POST", token: buyer, body: { subject: "DRIVER", stars: 5, comment: "On time and the load arrived intact." } }), "rate driver");
  must(await call(`/orders/${carrotOrder.id}/reviews`, { method: "POST", token: tokens.kannan, body: { subject: "BUYER", stars: 5, comment: "Collected promptly and paid on time." } }), "rate buyer");

  say("7. A conversation between the buyer and Arul Farms");
  const summary = must(await call("/farmer/summary", { token: tokens.arul }), "farm");
  const convo = must(await call("/conversations", { method: "POST", token: buyer, body: { farmId: summary.farm.id, cropId: crop["Kodaikanal Strawberries"].id } }), "start chat");
  const say2 = async (who, body) => must(await call(`/conversations/${convo.id}/messages`, { method: "POST", token: tokens[who], body: { body } }), "message");
  await say2("karthik", "Good morning. Are the strawberries fresh enough for a three-day trip to Chennai?");
  await say2("arul", "Good morning. Yes, they are picked at dawn and packed cold, so they travel well. I can set aside the larger berries for you.");
  await say2("karthik", "Great. I have sent a request for 1,000 kg. Can you do a better price at 2,000 kg?");

  say("\nShowcase ready. Sign in as karthik@uzhavan.app (buyer) or arul@, muthu@, kannan@ (farmers) or selvam@ (driver). Password: uzhavan123");
}

try {
  if (process.argv.includes("--remove")) await remove();
  else await add();
} catch (err) {
  console.error(`\n${err.message}`);
  process.exit(1);
}
