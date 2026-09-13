# Uzhavan

A three-sided farm-to-buyer marketplace for Tamil Nadu. Farmers list a harvest, wholesale buyers request a quantity and confirm the price the farmer sets, and local truck drivers move the crop from farm to warehouse. No middlemen.

**Two apps** — independent projects sharing the same design and API contract — backed by a Node/Postgres API and a web console for admin and support staff.

| App | For | Package |
| --- | --- | --- |
| **Uzhavan** | Farmers and truck drivers — the supply side | `com.uzhavan.app` |
| **Uzhavan Buy** | Wholesale dealers and buyers | `com.uzhavan.buy` |

Farmers and drivers share one app deliberately: they're often the same household, and one login that can both list a harvest and accept a haul beats two installs. A buyer wants a completely different home screen, which is the split that earns its keep.

## Repo layout

| Folder | What it is |
| --- | --- |
| [`Uzhavan/`](Uzhavan) | The farmer/driver mobile app (Expo/React Native) |
| [`Uzhavanbuy/`](Uzhavanbuy) | The buyer mobile app (Expo/React Native) — an independent project, not a build target of `Uzhavan/` |
| [`backend/`](backend) | The Node/Express/Prisma API both apps and the console talk to |
| [`frontend/`](frontend) | The web console (Vite/React) for admin and support staff |

**Repo:** [github.com/mrrokesh/Uzhavan](https://github.com/mrrokesh/Uzhavan)

---

## The three sides

| Role | What they do |
| --- | --- |
| 🛒 **Buyer** | Browse and filter listings, request a quantity, confirm the farmer's final price, book a truck, track delivery |
| 🌱 **Farmer** | Own a farm, list and price crops, accept or decline requests, watch demand nearby |
| 🚚 **Driver** | Own a truck, go online, accept jobs, drive the trip forward, capture proof of delivery |

Plus a **web console** for admin and support staff: verification review, account moderation, a support desk, announcements, farmer payouts, payment settings, vehicle tracking and app release control.

Sign into the wrong app and you're told which one you want, rather than shown a broken home screen. Staff and admin accounts are sent to the console — they have no mobile app.

**Each side only controls what it owns.** A buyer cannot accept their own request or advance a trip. A farmer cannot touch another farm's listings. A driver cannot take another driver's job. Staff cannot grant themselves admin. All of it is enforced server-side and covered by tests — not merely hidden in the UI.

---

## Run

Four parts. Start the API first; the rest talk to it.

### 1. API (`backend/`)

```bash
cd backend
npm install
cp .env.example .env      # fill in DATABASE_URL and generate the secrets
npm run db:push           # create the tables
npm run db:seed           # demo accounts, farms, crops and trucks
npm run dev               # http://localhost:4000
```

`GET /api/health` should return `{"ok":true,"db":"up"}`.

Every secret in `.env.example` is documented inline, including how to generate one. The server refuses to boot on a malformed key, and refuses to run in production with `CORS_ORIGIN=*`.

### 2. Admin console (`frontend/`)

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Sign in with a staff or admin account. Vite proxies `/api` to the server, so there's no CORS to configure. `npm run build` produces a static bundle (~78 KB gzipped).

### 3. Farmer/driver app (`Uzhavan/`)

```bash
cd Uzhavan
npm install
npm start            # port 8082
```

### 4. Buyer app (`Uzhavanbuy/`)

```bash
cd Uzhavanbuy
npm install
npm start            # port 8083
```

Scan the QR with **Expo Go**, or press `a` / `i` for an emulator. Requires Node 22+. Both apps can run at once, on their own ports — they're independent Expo projects now, not two build targets of one codebase, so each gets its own `npm install`.

Each app's identity (name, scheme, bundle id, `extra.appKind`) is hardcoded in its own `app.config.js`. The two still share one EAS project (slug + updates URL, in each app's `app.json`) deliberately — one dashboard, one set of credentials — and [`eas.json`](Uzhavan/eas.json) in each folder carries that app's own store and internal-APK profile.

The app finds the API at `http://<your-machine's-LAN-IP>:4000`, derived from the Expo dev-server host, so a phone on the same Wi-Fi just works. Override with `EXPO_PUBLIC_API_URL` when pointing at a deployed API.

<details>
<summary><b>Testing on a phone over USB instead of Wi-Fi</b></summary>

```bash
adb reverse tcp:8082 tcp:8082 && adb reverse tcp:4000 tcp:4000
npm start
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8082"
```

Don't pass `--localhost` to `expo start` — it binds Metro to IPv6 only, and `adb reverse` connects over IPv4, so the device gets connection-refused on Metro while the API still works.
</details>

### Demo accounts

Every seeded account uses the password **`uzhavan123`**.

| Role | Email |
| --- | --- |
| Buyer | `karthik@uzhavan.app` |
| Farmers | `arul@` · `muthu@` · `kannan@uzhavan.app` |
| Drivers | `selvam@` · `ramesh@` · `vikram@uzhavan.app` |
| Admin | `admin@uzhavan.app` — console only |
| Staff | `staff@uzhavan.app` — console only |

Set `ADMIN_PASSWORD` in `backend/.env` before the first seed and the admin gets that instead.

**Once the admin account exists, that variable is not how you change its password.** Re-seeding a live database must never silently reset someone's login, so the seed only applies `ADMIN_PASSWORD` when you set it explicitly. To change any account's password:

```bash
cd backend
npm run set-password -- admin@uzhavan.app 'a long passphrase'
```

It runs against whatever `DATABASE_URL` points at, so it works on production too. A plain SQL `UPDATE` will not do: hashes are HMAC-peppered before bcrypt, and anything written by hand won't verify.

---

## Product rules

1. **Price is never final until the farmer says so.** Pre-acceptance figures are labelled *Estimated*, with "Final price confirmed by farmer."
2. **No payment is collected before the farmer accepts.** Once they have, the buyer pays in full before anything ships — nothing is worth reserving, and no truck worth arranging, until the money is in escrow.
3. **Status only ever comes from whoever owns it.** A request changes when the real farmer responds; a trip advances when the real driver taps the button. Nothing is faked or on a timer.
4. **Listings can't oversell.** Confirming an order reserves that quantity, and the listing shows what's still available.
5. **Transport is optional** and chosen after the order is confirmed — buyers can always use a private truck.
6. **Trucks that can't carry the load stay in the list**, disabled, with the reason shown.
7. **Delivery needs proof.** A driver cannot close a trip without recording who received the crop.
8. **Farmers and drivers are never charged.** No commission, no platform fee. The fee is added on top of the price the farmer agreed and paid by the buyer, so a farmer's payout is exactly the number they accepted.
9. **A farmer's advance is released by the driver, not the farmer.** A farmer saying they shipped is not evidence that they shipped.
10. **You can only rate someone you traded with**, once, after the crop arrived — and all three parties rate each other, not just the customer.
11. **A paid badge is never an identity badge.** *ID Verified* is free and document-backed; *Uzhavan Plus* is a paid subscription with its own separate badge. Selling a trust mark would let a fraudster buy credibility for the price of a subscription.

---

## The full loop

```
FARMER   lists a crop
   ↓
BUYER    filters by distance, price, verified → requests a quantity   (nothing reserved yet)
   ↓
FARMER   sets the final price → accepts, or declines with a reason
   ↓
BUYER    confirms → order created, quantity reserved
   ↓
BUYER    pays in full → the gateway holds it
   ↓
BUYER    picks from trucks that fit and are online
   ↓
DRIVER   accepts → reached farm → loaded → on the way → delivered + proof
   ↓
BUYER    sees each step live, then the delivery receipt
```

Buyer-side screens poll, so a farmer accepting or a driver moving shows up without a refresh.

---

## Finding things

Buyers filter by **distance, price band, category, verified farms only**, and sort by newest, nearest or price. Farmers get the mirror image — a **demand board** showing what buyers nearby are asking for.

Nearby search uses a built-in table of Tamil Nadu's **38 districts** with centroids, and great-circle distance scaled 1.3× for road detour. Salem → Dindigul comes out at 189 km against ~190 actual; Coimbatore → the Nilgiris at 67 km. Accurate enough for wholesale, where nobody picks a farm on 40 km versus 60.

That choice means **no GPS permission, no geocoding bill and no maps SDK** in the build. Free-text districts resolve through the aliases people actually type — "Attur, Salem", "Ooty", "Trichy", "Tuticorin".

Buyers also get a **Picked for you** row, ranked from what they've actually done — farms they've bought from, categories they keep requesting, distance, verification, readiness. Every card carries the reason it was chosen, and the reason is whichever signal genuinely scored highest rather than a plausible-sounding one added afterwards. No machine learning: with a few hundred buyers there isn't the data for it, and a black box is a poor answer to "why am I seeing this?". Cold start degrades to "verified farms near you with crops ready now" rather than an empty screen.

The demand board is deliberately **aggregate**: volume, average price and accept rate by category, plus a directory of active buyers. An individual request is a private negotiation between one buyer and one farm, and showing it to a competing farm would leak commercial information.

---

## Reputation

Every review hangs off a completed order. An unattached review is one anybody can write about anybody, which is how a ratings system stops meaning anything — here you can only rate a counterparty you actually traded with, once, after the crop arrived.

Three directions, because all three parties take a risk:

| Who | Rates | On |
| --- | --- | --- |
| Buyer | The farm | Was the crop what was described? |
| Buyer | The driver | Did it arrive, on time, intact? |
| Farmer | The buyer | Did they take the load and pay for it? |

That last one matters more than it looks. A marketplace where only customers rate suppliers gives suppliers no way to warn each other about a buyer who cancels on arrival.

A rating can be revised — a first reaction written on the day of a late delivery isn't always the fair one — but it stays one verdict per trade, so a single deal can never move an average as far as two. Averages are recomputed from the reviews rather than adjusted incrementally, because an incremental counter that drifts is worse than no counter. Below three reviews an average is noise dressed as a number, so the app shows "new" instead of a confident 5.0 off one opinion, and the suggestion ranking ignores it entirely.

Reviews show a first name and a district, never a full business name. A wholesale buyer's name beside a one-star review is a grudge with an address on it.

---

## Verification & trust

| Role | Identifier | Documents |
| --- | --- | --- |
| Farmer | Farmer card number | Farmer card, land record |
| Buyer | **GSTIN** (real mod-36 checksum) or **Udyam** | GST / MSME certificate |
| Driver | Driving licence | Licence, RC, insurance, permit |

Insurance and permit **expiry dates** are stored on the truck, because an expired policy means the vehicle shouldn't be carrying goods. Staff see lapsed paperwork on the vehicle tracker.

Flow is `UNVERIFIED → PENDING → VERIFIED / REJECTED`, with a staff review queue that shows the decrypted number beside the document. Rejections require a reason, which the applicant sees.

---

## Security

- **Passwords**: bcrypt at cost 12 over an HMAC-SHA256 **pepper** held only in the environment. A stolen database is not crackable offline. Hashes are version-tagged and silently re-hashed at next login, so the pepper or cost can be rotated without resetting anyone's password.
- **At rest**: AES-256-GCM over GSTIN, Udyam, PAN, farmer card, driving licence and every uploaded document. Deterministic **blind indexes** enforce "this GSTIN is already registered" without storing the plaintext.
- **Documents** live in their own table so a multi-megabyte blob never enters an ordinary query, and are owner-or-reviewer only — a stranger gets a 404, not a 403.
- **Password reset** is a six-digit code, not a link — it arrives over SMS as readily as email, and a farmer with one phone can read it and type it without leaving the app. Only a SHA-256 of the code is stored, it dies after 15 minutes or five wrong guesses, asking again kills the previous one, and a used code can't be replayed. The reply is identical whether or not the account exists, because otherwise this becomes a tool for discovering which of a list of emails are registered — on a marketplace, that's a list of a competitor's suppliers. Blocked accounts are never issued one.
- **Guessing is bounded.** Five consecutive failed sign-ins freeze an account for a minute, then five, then thirty — progressive, and always expiring. A permanent lock would hand anyone a way to freeze a competitor out of their own account by failing their password enough times.
- **Per-IP limits are an abuse ceiling, not the defence.** Carrier-grade NAT is the norm on Indian mobile networks, so one address can be thousands of unrelated people; a tight per-IP limit doesn't stop an attacker with a phone, it locks out a whole carrier. The real protection is per-account. Reset requests are additionally capped per *target* account, because each one costs a real person an SMS.
- **A user object is an allowlist**, not a list of secrets to strip. It used to be the latter, and it failed exactly as denylists do — `licenceEnc` and `licenceIndex` were added to the schema later, nobody updated the strip list, and a driver's encrypted licence and its blind index went out to every client. A blind index is a deterministic HMAC: hand one over and candidate licence numbers can be tested offline until one matches. Listing what may leave means a new column is invisible until somebody decides otherwise, and a test asserts every secret column stays out.
- **Blocking** is immediate: a token already issued stops working on the next request, a blocked driver goes offline, a blocked farmer's listings leave the marketplace.
- **Payments**: amounts are decided server-side, signatures compared in constant time, webhook mounted before the JSON parser because Razorpay signs the exact bytes.
- **Audit log** is append-only, with actor and before/after values on every privileged action.

⚠️ Back up `ENCRYPTION_KEY` somewhere other than the database server. Lose it and every encrypted identifier and document becomes permanently unreadable.

---

## Admin console

**13 permissions in two tiers.** Nine an admin can delegate: view accounts, block/unblock, review KYC, view/reply/assign tickets, view orders, unlist crops, edit support contacts.

Four are **admin-only and structurally non-delegable** — create/remove staff, grant permissions, publish app updates, read the audit log. The grant endpoint rejects them outright, so a staff member can never be given the power to promote themselves.

| Section | What it does |
| --- | --- |
| **Overview** | Pending verifications, unassigned tickets, blocked accounts, GMV |
| **Verification** | Review queue with the decrypted identifier beside the decrypted document |
| **Support** | Ticket desk — assign, reply, internal notes, status |
| **Accounts** | Search, then suspend / block / restore with a reason the user sees |
| **Announcements** | Broadcast to farmers, buyers, drivers or everyone; drafts, pinning, expiry |
| **Settings** | Support phone, email, WhatsApp, hours — read live by the apps |
| **Track a vehicle** | Plate lookup — driver, papers, lapsed insurance, and what's on board now |
| **Farmer payouts** | Every slice of money with its stage, due time and state; release or hold with a reason |
| **App updates** | Force / soft update gating, per app and per platform |
| **Payments** | Razorpay accounts, swappable in a click if one is blocked |
| **Staff** | Create, scope permissions, remove |
| **Audit log** | Every privileged action, append-only |

---

## Getting messages to people

Two channels, each with a driver chosen by environment, and both defaulting to **`log`** — which prints the message to the server console instead of sending it. The whole password-reset flow therefore works on a laptop with no accounts anywhere, and a missing credential shows up as a visible log line rather than a message that silently never arrives.

| Channel | Drivers |
| --- | --- |
| Email | `log` · `smtp` (any SMTP URL) |
| SMS | `log` · `msg91` |
| Push | Expo, no configuration |

**Push** goes through Expo, so there are no APNs certificates to rotate and no per-platform code. Publishing an announcement sends to everyone it targets, skipping suspended and blocked accounts — someone who can't use the app shouldn't be pinged about it. Editing an already-published notice doesn't buzz anyone a second time; only the draft-to-live transition does. Tokens Expo reports as dead are deleted rather than retried forever, and a handset that changes hands follows the new account.

A push is a courtesy on top of an action that already succeeded: the announcement is saved and shows on the bell whether or not any notification lands, and the send isn't awaited so an admin never waits on a push service.

In production the server **refuses to boot** with both email and SMS on `log`, because a locked-out farmer would have no way back in. Delivery never throws into a request — nobody should see a 500 because an SMTP host is slow — and both channels are tried, since we don't know which one a given farmer actually reads.

---

## Support desk

Tickets get short, quotable codes like **`UZ-7F3K2`** — base-32 without the characters that get misheard (`I`, `O`, `0`, `1`).

New tickets are **auto-assigned to the least-loaded eligible agent**. Payment and delivery issues start at HIGH. A sweeper runs every 15 minutes and **force-assigns anything unanswered past 24 hours**, raising its priority and flagging it as escalated. Internal staff notes are filtered server-side and never reach the app.

---

## Payments

Razorpay, over plain REST rather than the SDK — order creation is one POST and signature checking is an HMAC, so a dependency would buy nothing and add supply-chain surface.

Credentials live in the database with secrets encrypted, **swappable from the console** so a blocked or rotated account is replaced with no deploy. Exactly one account is active at a time; one that has taken payments cannot be deleted. Applying a payment is idempotent, because the webhook and the client callback both land there and either may arrive first.

Mode is read from the key id rather than asked for, so `rzp_live_` can't be mislabelled as test, and switching to a live account confirms with different wording than switching to test. Secrets are write-only: the server never returns one and the console never asks to see it. Removing the last remaining account is allowed — refusing would trap an admin who added a single account with a typo'd key.

Buyer checkout runs Razorpay's hosted page in a WebView. Their React Native SDK is a native module and can't run in Expo Go; the hosted page is the same code path, holds no secret, and the server recomputes the signature before believing any of it.

**Uzhavan Plus** is ₹499 for 12 months, renewals extend rather than reset — but it currently buys nothing. There is a price and a payment path and no benefits attached, which is why no screen sells it: shipping that would be selling nothing. It exists as a deliberately separate tier so a paid badge can never be mistaken for a document-backed one; deciding what it should actually include is an open product question.


---

## Money

**Farmers and drivers pay nothing.** No commission, no platform fee. The fee sits on top of the price the farmer agreed and the buyer pays it, so a farmer's payout is exactly the number they accepted. Buyers see the split before they commit:

```
Goes to the farmer      ₹40,000
Platform fee (5%)        ₹2,000
You pay                 ₹42,000
```

The rate is set in the console, floored at **5%** and capped at 30% — without a ceiling a typo'd `500` bills someone five times the order. It's held in basis points, because money here is whole rupees and a percentage wants a decimal, and it is **stamped onto each order when placed** rather than recomputed on read. Raising the fee next month must not rewrite what someone already agreed to pay.

### Escrow and payouts

The buyer always pays in full up front, into the gateway. When the farmer sees it is a policy, switchable in the console:

| Policy | Advance | Balance |
| --- | --- | --- |
| **`SPLIT_ON_LOAD`** | 30% when the **driver** confirms the load | Rest after delivery |
| **`AFTER_DELIVERY`** | None | Everything after delivery |

The advance is triggered by the driver, never by the farmer — a third party with no stake in the payout — and is limited to **verified farmers on booked-truck orders**. Someone arranging their own transport has nobody to vouch for them; someone unverified hasn't proved who they are. Both are paid on delivery instead.

Delivery starts a **hold**, not a release. That window is the buyer's chance to dispute, and when it expires the money goes automatically, so a buyer who simply stops replying cannot strand a farmer's payment. A sweeper runs every ten minutes; nobody waiting on money should depend on an admin opening the console.

Built on **Razorpay Route**. Funds never touch our own account, which is what RBI's payment-aggregator rules require. Bank details go straight to Razorpay and are never stored here — only the account id it returns — so a breach of this database leaks nobody's bank account, and the farmer's own screen won't echo the digits back.

Whether Amazon's shape or ours is right depends on returns. They hold everything until after delivery plus a settlement window because a phone can come back three weeks later; produce is judged once, on arrival, and making farmers wait for a risk that doesn't exist is how you lose them to the mandi.

### Who can change it

Support contacts are delegable through `CONFIG_WRITE` — that permission exists so nobody has to ship a release to change a phone number. The platform fee, the payout policy, the advance, the hold and which Razorpay account takes the money are **admin-only and not delegable**. They're all the same class of decision, and none of them should be reachable by a support account under pressure.

---

## App updates

Per app **and** per platform, checked on every launch:

| Build | Result |
| --- | --- |
| Current | `ok` |
| Behind latest | `soft` — dismissible prompt with release notes and store link |
| Below minimum | `force` — hard block |
| Any, with the mandatory flag | `force` |

If the config request fails the app carries on. A network blip must never lock someone out of a working build.

---

## Screens

**Buyer** — Home feed with filters · crop detail · farmer profile · select quantity · review request · request details (live) · confirm purchase · **checkout** · book a truck · nearby trucks · review booking · track truck (live) · delivery receipt · My Orders · Profile
Tabs: **Home · Book Track · My Orders · Profile**

**Farmer** — dashboard · my listings · new/edit listing · request inbox · set price and accept/decline · **what buyers want** · **your money** · profile & sales
Tabs: **Home · My Crops · Requests · Profile**

**Driver** — job board with online toggle · my trips · trip detail with the status stepper · profile & truck settings
Tabs: **Jobs · My Trips · Profile**

**Shared** — sign in · **forgot password** · choose role · create account · verification · **announcements** · help & support · my issues · raise an issue · ticket thread · wrong-app · reconnect

---

## API

All routes are under `/api`. Everything except `/health`, `/app/config`, `/auth/login`, `/auth/register` and `/webhooks/*` needs a `Bearer` token.

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` · `POST /auth/password/forgot｜reset` |
| Profile | `PUT/DELETE /me/push-token` · `GET/PATCH /me` · `PUT/DELETE /me/follows/:cropId` · `PUT/DELETE /me/saved/:cropId` |
| Suggestions | `GET /crops/suggested?limit=` |
| Reviews | `GET/POST /orders/:id/reviews` · `GET /reviews/:subject/:subjectId` |
| Browse | `GET /crops` (`status` `q` `farmId` `following` `district` `radiusKm` `verifiedOnly` `category` `minPrice` `maxPrice` `sort`) · `GET /crops/:id` · `GET /crops/districts` |
| Verification | `GET/POST /verification` · `GET /verification/documents/:id` · `GET /verification/queue` · `POST /verification/queue/:userId` |
| Farmer | `GET /farmer/summary` · `PATCH /farmer/farm` · `GET/POST /farmer/crops` · `PATCH/DELETE /farmer/crops/:id` · `GET /farmer/requests` · `POST /farmer/requests/:id/accept｜decline` · `GET /farmer/orders` · `GET /farmer/demand` |
| Driver | `GET /driver/summary` · `PATCH /driver/availability｜truck` · `GET /driver/jobs｜trips` · `POST /driver/trips/:id/advance｜cancel` |
| Buyer | `GET/POST /requests` · `POST /requests/:id/confirm｜decline｜cancel` · `GET /orders` · `GET/PATCH /orders/:id` · `GET /trucks?loadKg=` · `GET /bookings/quote/fare` · `POST /bookings` · `POST /bookings/:id/pay｜cancel` |
| Support | `GET/POST /tickets` · `GET /tickets/:code` · `POST /tickets/:code/reply` · `GET /tickets/desk/queue｜stats` · `POST /tickets/desk/:code/assign｜status` |
| Announcements | `GET /announcements` · `GET /announcements/unread-count` · `POST /announcements/:id/read` · `POST /announcements/read-all` |
| Payments | `GET /payments` · `GET /payments/config` · `POST /payments/start｜confirm` · `POST /webhooks/razorpay` |
| Payouts | `GET /payouts` · `POST /payouts/account` |
| Admin | `GET /admin/me｜permissions｜overview｜audit` · `GET /admin/users` · `POST /admin/users/:id/status` · `GET /admin/track?plate=` · `GET /admin/payouts` · `POST /admin/payouts/:id/override｜sweep` · staff, settings, releases, gateways, announcements |
| Public | `GET /api/health` · `GET /api/app/config` |

---

## Data model

`User` (with a `role`) is the single auth identity. A farmer owns one `Farm` which owns many `Crop`s; a driver owns one `Truck`.

```
User ─┬─ Farm ── Crop ──┬── CropRequest ── Order ── TruckBooking ── BookingEvent
      │                 ├── Follow / SavedCrop            │
      ├─ Driver ── Truck ┘                                │
      ├─ KycDocument                                      │
      ├─ Ticket ── TicketMessage                          │
      ├─ Payment ── PaymentGateway                        │
      ├─ LinkedAccount            Payout ─────────────────┤
      ├─ AnnouncementRead ── Announcement                 │
      └─────────── (as buyer) ── Order ───────────────────┘
```

`Crop.reservedKg` rises as orders are confirmed, so availability is always `expectedKg − reservedKg`. `Farm.districtKey` and `Truck.plateKey` hold normalised, indexed forms so search is a lookup rather than a scan.

---

## Design system

| Token | Value |
| --- | --- |
| Background | `#FAF6F0` |
| Cards | `#FFFFFF` |
| Primary green | `#1B5E3B` |
| Success tint | `#E8F3EC` |
| Waiting | `#F5A623` on `#FDF3E0` |
| Destructive (outline only) | `#D64545` |
| Text | `#1A1A1A` / `#6B7280` / `#9CA3AF` |

Indian rupee formatting (`₹1,90,000`), weights in kg. Status colour is consistent everywhere: green = done/ready, amber = waiting, grey = not started.

---

## Stack

- **Mobile:** Expo 57, React Native 0.86, React Navigation 7, TanStack Query, TypeScript
- **API:** Node 22, Express 5, Prisma 6, Zod, JWT, bcrypt — see [`backend/`](backend)
- **Console:** React 18, Vite 6, TanStack Query, plain CSS — see [`frontend/`](frontend)
- **Database:** PostgreSQL

Images stay bundled in the app; the API returns image *keys* that resolve to local assets via `src/lib/images.ts`.

---

## Testing

The API is covered by eleven end-to-end suites — **452 assertions** — run against a live server and a real database:

```bash
cd backend
npm run dev          # in one terminal
npm run db:reset     # start from a known state
npm test             # in another
```

| Suite | Covers |
| --- | --- |
| `e2e` (44) | The full loop, role enforcement, stock reservation, truck capacity, driver trip steps |
| `sec` (47) | Peppered hashing, encryption at rest, KYC, document access, blocking, live revocation |
| `admin` (63) | Permissions, non-delegable rights, tickets, escalation, remote config, update gating, audit |
| `phase` (45) | District distance, filters, demand board, announcements, payments, vehicle tracking |
| `feat` (96) | Announcement audiences, demand privacy, driver verification, gateway switching, plate lookup |
| `payout` (41) | Platform fee floor and ceiling, escrow scheduling, payout policy, overrides |
| `suggest` (22) | Interest signals moving the ranking, exclusions, cold start, honest reasons |
| `password` (22) | Reset codes, account enumeration, replay, guess limits, expiry, blocked accounts |
| `push` (21) | Device registration, re-use by a new account, audience targeting, exclusions |
| `limits` (24) | Account lockout and its expiry, flood protection, what a user object may contain |
| `reviews` (27) | Ratings tied to completed orders, who may rate whom, averages, anonymity |

They're integration tests on purpose: permissions, encryption and money all live in the seams between Express, Prisma and Postgres rather than inside any one function. **Run `db:reset` first** — several suites move state that can't be undone through the API, so a second run without one fails on its own leavings rather than on a bug.

A 503 is retried rather than failed. The API returns it to mean "busy, try again", and a suite that ignored that would measure the database's mood instead of the product.

Typecheck everything:

```bash
cd Uzhavan && npx tsc --noEmit && npx expo-doctor
cd Uzhavanbuy && npx tsc --noEmit && npx expo-doctor
cd backend && npm run typecheck
cd frontend && npm run typecheck
```

---

## Deploying

The API and the console deploy independently of each other, on different hosts if you like — they only need to agree on two environment variables.

**API → Render.** [`render.yaml`](render.yaml) is a Blueprint for it (and optionally the console too, as a static site). [`DEPLOY.md`](DEPLOY.md) has the full walkthrough: the per-database Postgres role, the TLS settings, and every variable Render prompts for.

The database is **not** in the blueprint. It stays on the existing Ubuntu box, and that single decision drives most of what the guide has to say:

- **Render's nearest region to Tamil Nadu is Singapore**, so every query pays 50–80 ms of round trip. Prisma issues several per request, so a screen wanting five spends about a third of a second waiting. Deploying the API onto the same machine as Postgres makes that 0.1 ms. Splitting them is a real cost, not a detail.
- **Port 5432 has to stay open to the internet**, because Render's outbound addresses aren't fixed. Give Uzhavan its own limited Postgres role first — the `postgres` superuser currently unlocks all 43 databases on that box *and* grants shell through `COPY ... FROM PROGRAM`.
- **Render's free plan sleeps** after fifteen minutes, and the next request waits about fifty seconds. Fine for a demo, not for someone standing in a field.

**Console → Vercel** (or any static host that isn't the same origin as the API). Two things it needs, on two different platforms:

| Where | Variable | Value |
| --- | --- | --- |
| Vercel → `frontend` env vars | `VITE_API_URL` | The API's URL, e.g. `https://uzhavan-api.onrender.com` — no trailing slash |
| Render → API env vars | `CORS_ORIGIN` | The console's URL, e.g. `https://uzhavan.vercel.app` |

`VITE_API_URL` is read at **build** time, so setting it doesn't take effect until the next deploy. Without it the console calls `/api/...` as a relative path, which resolves to its own domain and 404s — there is no server there to proxy it, unlike the local dev setup where Vite's dev server does that for you. Set Vercel's **Root Directory** to `frontend` if the project wasn't created from that subfolder directly.

[`frontend/vercel.json`](frontend/vercel.json) rewrites every path to `index.html`, which React Router needs — Vercel serves static files by default and has no reason to know that `/tickets` should fall back to the client-side router rather than 404.

Three things the build needed before it could deploy at all, all fixed:

- The console called `/api` same-origin and relied on Vite's dev proxy, so on any static host every call would 404. It now takes an absolute `VITE_API_URL` when it can't be proxied, and stays same-origin when it can.
- `npm run build` emitted to `dist/src/index.js` while `npm start` looked for `dist/index.js`, because the typecheck config also covers `prisma/*.ts` and that pushes the inferred root up a level. Production would have died on boot with "cannot find module". There's now a separate build config that pins `rootDir`, and typechecking still covers the seed scripts.
- The console had no SPA fallback for a static host, so a direct load or refresh of any route but `/` was a 404 rather than the app.

---

## Maintenance

```bash
cd backend
npm run db:reset     # back to a freshly-seeded state
npm run db:studio    # browse the database
```

`db:reset` clears more than it sounds like it should, on purpose. A KYC decision, a failed-login lockout, a rating, a payout schedule and a push token all survive an ordinary "delete the orders" reset, and each one changes how the app behaves next time. A driver left `PENDING` makes a verification test fail with "already under review" — which reads like a regression and isn't one.

Back up before any destructive migration:

```bash
pg_dump "$DATABASE_URL" -f backup.sql
```

If the database is shared with other applications, keep `connection_limit` in `DATABASE_URL` — Prisma otherwise opens roughly `CPU cores × 2 + 1` connections per process, which crowds out other tenants on a server with the default `max_connections` of 100.

---

## Not done yet

- **Uzhavan Plus in the app.** The subscription works server-side; there's no screen to buy it.
- **A real Razorpay account.** No gateway is configured, so checkout, Route linked accounts and transfers have only ever been exercised against their refusal paths. The suites assert the scheduling and the clean 503 — not a completed payment.
- **Deployment is in progress, not finished.** The console is going up on Vercel and the API on Render; as of writing they haven't been confirmed pointed at each other yet (`VITE_API_URL` / `CORS_ORIGIN`, above). A first deploy attempt also hit an unrelated wall — Vercel's Hobby plan blocks a deploy outright when the triggering commit's author isn't a member of the Vercel team, and has no way to add one for a private repo short of upgrading. The repo was made public to get past that, which is a real tradeoff (the source, including the business rules above, is now visible to anyone) and worth knowing if you're deciding how to host your own fork.
- **Hardware verification is partial.** Both mobile apps launch on a physical device post-reorg, and each shows its own correct name and branding — that much is confirmed, not assumed. A full walkthrough of sign-in, checkout and the newer screens (payouts, reviews, suggestions) hasn't been re-run since the split into independent `Uzhavan/` / `Uzhavanbuy/` projects.

### Known operational issue

The Postgres host intermittently returns `53200, out of shared memory` under load — its lock table filling on a box shared with many databases. The API maps that to a retryable 503 rather than a 500, and clients retry, but the real fix is `max_locks_per_transaction` on the server itself. Symptoms are sporadic 503s and occasional seed failures that succeed on a second run.
