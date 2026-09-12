# Uzhavan

A three-sided farm-to-buyer marketplace for Tamil Nadu. Farmers list a harvest, wholesale buyers request a quantity and confirm the price the farmer sets, and local truck drivers move the crop from farm to warehouse. No middlemen.

One React Native (Expo) app serves all three sides — the role is chosen at sign-up and decides which experience loads.

**Repo:** [github.com/mrrokesh/Uzhavan](https://github.com/mrrokesh/Uzhavan)

---

## The three roles

| Role | What they do |
| --- | --- |
| 🛒 **Buyer** | Browse listings, request a quantity, confirm the farmer's final price, book a truck, track delivery |
| 🌱 **Farmer** | Own a farm, list and edit crops, price and accept/decline incoming requests, watch sales |
| 🚚 **Driver** | Own a truck, go online, accept jobs, drive the trip status forward, capture proof of delivery |

Each side only controls what it owns. A buyer cannot accept their own request or move a truck; a farmer cannot touch another farm's listings; a driver cannot take another driver's trip. All of it is enforced server-side, not just hidden in the UI.

---

## Run

### 1. Backend (`server/`)

```bash
cd server
npm install
cp .env.example .env      # set DATABASE_URL to your Postgres instance
npm run db:push           # create the tables (Prisma)
npm run db:seed           # 3 farmers + 3 drivers + 1 buyer, with listings and trucks
npm run dev               # http://localhost:4000
```

`GET /api/health` should return `{"ok":true,"db":"up"}`.

### 2. Admin console (`admin/`)

```bash
cd admin
npm install
npm run dev               # http://localhost:5173
```

Sign in with a staff or admin account. Vite proxies `/api` to the server, so there's no CORS to configure. Build for production with `npm run build`.

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

Don't pass `--localhost` to `expo start` — it binds Metro to IPv6 only, and `adb reverse` connects over IPv4, so the device gets connection-refused.
</details>

### Demo accounts

Every seeded account uses the password **`uzhavan123`**.

| Role | Email |
| --- | --- |
| Buyer | `karthik@uzhavan.app` |
| Farmers | `arul@uzhavan.app` · `muthu@uzhavan.app` · `kannan@uzhavan.app` |
| Drivers | `selvam@uzhavan.app` · `ramesh@uzhavan.app` · `vikram@uzhavan.app` |
| Admin | `admin@uzhavan.app` — console only |
| Staff | `staff@uzhavan.app` — console only |

Set `ADMIN_PASSWORD` in `server/.env` before going live and the seed uses that for the admin instead.

To see the whole marketplace work, sign in as each in turn — or on two devices at once.

---

## Product rules

1. **Price is never final until the farmer says so.** Pre-acceptance figures are labelled *Estimated*, with "Final price confirmed by farmer."
2. **No payment is collected before the farmer accepts.**
3. **Status only ever comes from whoever owns it.** A request changes when the real farmer responds; a trip advances when the real driver taps the button. Nothing is faked or on a timer.
4. **Listings can't oversell.** Confirming an order reserves that quantity, and the listing shows what's still available.
5. **Transport is optional** and chosen after the order is confirmed — buyers can always use a private truck.
6. **Trucks that can't carry the load stay in the list**, disabled, with the reason shown.
7. **Delivery needs proof.** A driver cannot close a trip without recording who received the crop.

---

## The full loop

```
FARMER   lists a crop
   ↓
BUYER    picks a quantity → sends a request         (nothing reserved yet)
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

Buyer-side screens poll, so a farmer accepting or a driver moving shows up on the buyer's phone without a refresh.

---

## Screens

**Buyer** — Home feed · crop detail · farmer profile · select quantity · review request · request sent · request details (live) · confirm purchase · quantity confirmed · book a truck · choose an order · pickup & delivery · nearby trucks · truck details · review booking · track truck (live) · delivery completed · My Orders · Profile
Tabs: **Home · Book Track · My Orders · Profile**

**Farmer** — dashboard · my listings · new/edit listing · request inbox · request detail (set price, accept/decline) · profile & sales
Tabs: **Home · My Crops · Requests · Profile**

**Driver** — job board with online toggle · my trips · trip detail with the status stepper · profile & truck settings
Tabs: **Jobs · My Trips · Profile**

**Shared** — Sign in · choose role · create account

Seed farms: Arul Farms (Dindigul), Muthu Farms (Attur, Salem), Kannan Orchard (Ooty).

---

## API

All routes are under `/api`. Everything except `/health`, `/auth/login` and `/auth/register` needs a `Bearer` token.

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` |
| Profile | `GET/PATCH /me` · `PUT/DELETE /me/follows/:cropId` · `PUT/DELETE /me/saved/:cropId` |
| Browse | `GET /crops` (`?status=` `?q=` `?farmId=` `?following=`) · `GET /crops/:id` |
| Farmer | `GET /farmer/summary` · `PATCH /farmer/farm` · `GET/POST /farmer/crops` · `PATCH/DELETE /farmer/crops/:id` · `GET /farmer/requests` · `POST /farmer/requests/:id/accept` · `POST /farmer/requests/:id/decline` · `GET /farmer/orders` |
| Driver | `GET /driver/summary` · `PATCH /driver/availability` · `PATCH /driver/truck` · `GET /driver/jobs` · `GET /driver/trips` · `POST /driver/trips/:id/advance` · `POST /driver/trips/:id/cancel` |
| Buyer | `GET/POST /requests` · `GET /requests/:id` · `POST /requests/:id/confirm｜decline｜cancel` · `GET /orders` · `GET/PATCH /orders/:id` · `GET /trucks?loadKg=` · `GET /bookings/quote/fare?truckId=` · `POST /bookings` · `GET /bookings/:id` · `POST /bookings/:id/pay｜cancel` |

---

## Data model

`User` (with a `role`) is the single auth identity. A farmer owns one `Farm` which owns many `Crop`s; a driver owns one `Truck`.

```
User ─┬─ Farm ── Crop ──┬── CropRequest ── Order ── TruckBooking ── BookingEvent
      │                 ├── Follow                      │
      ├─ Driver ── Truck ┘                              │
      └─────────── (as buyer) ── Order ─────────────────┘
```

`Crop.reservedKg` rises as orders are confirmed, so availability is always `expectedKg − reservedKg`.

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

- **Frontend:** Expo 57, React Native 0.86, React Navigation 7 (native stack + bottom tabs), TanStack Query, TypeScript
- **Backend:** Node.js, Express 5, Prisma 6, Zod, JWT + bcrypt — see [`server/`](server)
- **Database:** PostgreSQL

Images stay bundled in the app; the API returns image *keys* that resolve to local assets via `src/lib/images.ts`. Client data access lives in `src/api/hooks.ts`, server routes in `server/src/routes/`, and role checks in `server/src/session.ts`.

---

## Maintenance

```bash
cd server
npm run db:reset     # clear trips/orders/requests, release reservations, re-seed
npm run db:studio    # browse the database
npm run typecheck    # server
```

```bash
npx tsc --noEmit     # app (repo root)
npx expo-doctor      # dependency + config health
```

Back up before any destructive migration:

```bash
pg_dump "$DATABASE_URL" -f backup.sql
```
