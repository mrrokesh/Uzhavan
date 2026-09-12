# Uzhavan

A three-sided farm-to-buyer marketplace for Tamil Nadu. Farmers list a harvest, wholesale buyers request a quantity and confirm the price the farmer sets, and local truck drivers move the crop from farm to warehouse. No middlemen.

One React Native (Expo) app serves all three sides, backed by a Node/Postgres API and a web console for admin and support staff.

**Repo:** [github.com/mrrokesh/Uzhavan](https://github.com/mrrokesh/Uzhavan)

---

## The three sides

| Role | What they do |
| --- | --- |
| 🛒 **Buyer** | Browse and filter listings, request a quantity, confirm the farmer's final price, book a truck, track delivery |
| 🌱 **Farmer** | Own a farm, list and price crops, accept or decline requests, watch demand nearby |
| 🚚 **Driver** | Own a truck, go online, accept jobs, drive the trip forward, capture proof of delivery |

Plus a **web console** for admin and support staff: verification review, account moderation, a support desk, announcements, payment settings and app release control.

**Each side only controls what it owns.** A buyer cannot accept their own request or advance a trip. A farmer cannot touch another farm's listings. A driver cannot take another driver's job. Staff cannot grant themselves admin. All of it is enforced server-side and covered by tests — not merely hidden in the UI.

---

## Run

Three parts. Start the API first; the other two talk to it.

### 1. API (`server/`)

```bash
cd server
npm install
cp .env.example .env      # fill in DATABASE_URL and generate the secrets
npm run db:push           # create the tables
npm run db:seed           # demo accounts, farms, crops and trucks
npm run dev               # http://localhost:4000
```

`GET /api/health` should return `{"ok":true,"db":"up"}`.

Every secret in `.env.example` is documented inline, including how to generate one. The server refuses to boot on a malformed key, and refuses to run in production with `CORS_ORIGIN=*`.

### 2. Admin console (`admin/`)

```bash
cd admin
npm install
npm run dev               # http://localhost:5173
```

Sign in with a staff or admin account. Vite proxies `/api` to the server, so there's no CORS to configure. `npm run build` produces a static bundle (~78 KB gzipped).

### 3. Mobile app (repo root)

```bash
npm install
npx expo start
```

Scan the QR with **Expo Go**, or press `a` / `i` for an emulator. Requires Node 22+.

The app finds the API at `http://<your-machine's-LAN-IP>:4000`, derived from the Expo dev-server host, so a phone on the same Wi-Fi just works. Override with `EXPO_PUBLIC_API_URL` when pointing at a deployed API.

<details>
<summary><b>Testing on a phone over USB instead of Wi-Fi</b></summary>

```bash
adb reverse tcp:8081 tcp:8081 && adb reverse tcp:4000 tcp:4000
EXPO_PUBLIC_API_URL=http://127.0.0.1:4000 npx expo start
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"
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

Set `ADMIN_PASSWORD` in `server/.env` before going live and the seed uses that for the admin instead.

---

## Product rules

1. **Price is never final until the farmer says so.** Pre-acceptance figures are labelled *Estimated*, with "Final price confirmed by farmer."
2. **No payment is collected before the farmer accepts.**
3. **Status only ever comes from whoever owns it.** A request changes when the real farmer responds; a trip advances when the real driver taps the button. Nothing is faked or on a timer.
4. **Listings can't oversell.** Confirming an order reserves that quantity, and the listing shows what's still available.
5. **Transport is optional** and chosen after the order is confirmed — buyers can always use a private truck.
6. **Trucks that can't carry the load stay in the list**, disabled, with the reason shown.
7. **Delivery needs proof.** A driver cannot close a trip without recording who received the crop.
8. **A paid badge is never an identity badge.** *ID Verified* is free and document-backed; *Uzhavan Plus* is a paid subscription with its own separate badge. Selling a trust mark would let a fraudster buy credibility for the price of a subscription.

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
BUYER    picks from trucks that fit and are online → pays
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

The demand board is deliberately **aggregate**: volume, average price and accept rate by category, plus a directory of active buyers. An individual request is a private negotiation between one buyer and one farm, and showing it to a competing farm would leak commercial information.

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
| **App updates** | Force / soft update gating, per app and per platform |
| **Payments** | Razorpay accounts, swappable if one is blocked |
| **Staff** | Create, scope permissions, remove |
| **Audit log** | Every privileged action, append-only |

---

## Support desk

Tickets get short, quotable codes like **`UZ-7F3K2`** — base-32 without the characters that get misheard (`I`, `O`, `0`, `1`).

New tickets are **auto-assigned to the least-loaded eligible agent**. Payment and delivery issues start at HIGH. A sweeper runs every 15 minutes and **force-assigns anything unanswered past 24 hours**, raising its priority and flagging it as escalated. Internal staff notes are filtered server-side and never reach the app.

---

## Payments

Razorpay, over plain REST rather than the SDK — order creation is one POST and signature checking is an HMAC, so a dependency would buy nothing and add supply-chain surface.

Credentials live in the database with secrets encrypted, **swappable from the console** so a blocked or rotated account is replaced with no deploy. Exactly one account is active at a time; one that has taken payments cannot be deleted. Applying a payment is idempotent, because the webhook and the client callback both land there and either may arrive first.

**Uzhavan Plus** is ₹499 for 12 months, renewals extend rather than reset.

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

**Buyer** — Home feed with filters · crop detail · farmer profile · select quantity · review request · request details (live) · confirm purchase · book a truck · nearby trucks · review booking · track truck (live) · delivery receipt · My Orders · Profile
Tabs: **Home · Book Track · My Orders · Profile**

**Farmer** — dashboard · my listings · new/edit listing · request inbox · set price and accept/decline · profile & sales
Tabs: **Home · My Crops · Requests · Profile**

**Driver** — job board with online toggle · my trips · trip detail with the status stepper · profile & truck settings
Tabs: **Jobs · My Trips · Profile**

**Shared** — sign in · choose role · create account · verification · help & support · my issues · raise an issue · ticket thread

---

## API

All routes are under `/api`. Everything except `/health`, `/app/config`, `/auth/login`, `/auth/register` and `/webhooks/*` needs a `Bearer` token.

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` |
| Profile | `GET/PATCH /me` · `PUT/DELETE /me/follows/:cropId` · `PUT/DELETE /me/saved/:cropId` |
| Browse | `GET /crops` (`status` `q` `farmId` `following` `district` `radiusKm` `verifiedOnly` `category` `minPrice` `maxPrice` `sort`) · `GET /crops/:id` · `GET /crops/districts` |
| Verification | `GET/POST /verification` · `GET /verification/documents/:id` · `GET /verification/queue` · `POST /verification/queue/:userId` |
| Farmer | `GET /farmer/summary` · `PATCH /farmer/farm` · `GET/POST /farmer/crops` · `PATCH/DELETE /farmer/crops/:id` · `GET /farmer/requests` · `POST /farmer/requests/:id/accept｜decline` · `GET /farmer/orders` · `GET /farmer/demand` |
| Driver | `GET /driver/summary` · `PATCH /driver/availability｜truck` · `GET /driver/jobs｜trips` · `POST /driver/trips/:id/advance｜cancel` |
| Buyer | `GET/POST /requests` · `POST /requests/:id/confirm｜decline｜cancel` · `GET /orders` · `GET/PATCH /orders/:id` · `GET /trucks?loadKg=` · `GET /bookings/quote/fare` · `POST /bookings` · `POST /bookings/:id/pay｜cancel` |
| Support | `GET/POST /tickets` · `GET /tickets/:code` · `POST /tickets/:code/reply` · `GET /tickets/desk/queue｜stats` · `POST /tickets/desk/:code/assign｜status` |
| Announcements | `GET /announcements` · `GET /announcements/unread-count` · `POST /announcements/:id/read` · `POST /announcements/read-all` |
| Payments | `GET /payments` · `GET /payments/config` · `POST /payments/start｜confirm` · `POST /webhooks/razorpay` |
| Admin | `GET /admin/me｜permissions｜overview｜audit` · `GET /admin/users` · `POST /admin/users/:id/status` · `GET /admin/track?plate=` · staff, settings, releases, gateways, announcements |
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
- **API:** Node 22, Express 5, Prisma 6, Zod, JWT, bcrypt — see [`server/`](server)
- **Console:** React 18, Vite 6, TanStack Query, plain CSS — see [`admin/`](admin)
- **Database:** PostgreSQL

Images stay bundled in the app; the API returns image *keys* that resolve to local assets via `src/lib/images.ts`.

---

## Testing

The API is covered by four end-to-end suites — **199 assertions** — run against a live server and database:

| Suite | Covers |
| --- | --- |
| Marketplace (44) | The full loop, role enforcement, stock reservation, truck capacity, driver trip steps |
| Security (47) | Peppered hashing, encryption at rest, KYC, document access, blocking, live revocation |
| Admin (63) | Permissions, non-delegable rights, tickets, escalation, remote config, update gating, audit |
| Discovery & platform (45) | District distance, filters, demand board, driver verification, announcements, payments, vehicle tracking |

Typecheck everything:

```bash
npx tsc --noEmit               # mobile app
cd server && npm run typecheck
cd admin && npm run typecheck
npx expo-doctor                # dependency + config health
```

---

## Maintenance

```bash
cd server
npm run db:reset     # clear trips/orders/requests, release reservations, re-seed
npm run db:studio    # browse the database
```

Back up before any destructive migration:

```bash
pg_dump "$DATABASE_URL" -f backup.sql
```

If the database is shared with other applications, keep `connection_limit` in `DATABASE_URL` — Prisma otherwise opens roughly `CPU cores × 2 + 1` connections per process, which crowds out other tenants on a server with the default `max_connections` of 100.

---

## Not done yet

- **Two-app split** — Buyer and Partner as separate builds. `APP_KIND` already reads from `app.json`, so the split is a build-config change rather than a rewrite.
- **App screens** for Uzhavan Plus, driver verification, the announcements bell and Razorpay checkout — the APIs exist and are tested.
- **Console screens** for announcements, payment gateways and vehicle tracking — same.
- **Interest-based suggestions.**
- **Deployment.** Nothing here is hosted yet.
