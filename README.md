# Uzhavan

Direct farm-to-buyer marketplace for Tamil Nadu. Buyers discover crops before harvest, request a quantity, confirm the price the farmer sets, then book a local truck from farm to warehouse. No middlemen.

This repo is the **buyer-side** app — high-fidelity iOS screens (390 × 844) wired into two end-to-end flows.

**Repo:** [github.com/mrrokesh/Uzhavan](https://github.com/mrrokesh/Uzhavan)

---

## Product rules

1. Price is never final until the farmer says so. Every pre-acceptance figure is labelled **Estimated**, with “Final price confirmed by farmer.”
2. No payment is collected before the farmer accepts.
3. Transport is a separate, optional step after the crop order is confirmed. Buyers can always choose **Use a private truck**.
4. Status is always visible: green = done / ready, amber = waiting, grey = not started.
5. Trucks that cannot carry the load stay in the list, disabled, with a reason.

---

## Demo flows

### 1. Discover → request → confirm → truck → delivered

Home → **Bhagwa pomegranates** (Arul Farms, Natham, Dindigul) → 2,000 kg → send request `UZH-REQ-1809` → farmer accepts at **₹95/kg** (`₹1,90,000`) → confirm quantity → book truck → pay **₹3,450** UPI → track Selvam (`TN 30 AB 4821`) → delivered.

On **Request details**, tap **Farmer responded — view update** to continue the acceptance path.

### 2. Book Track (tab)

Ready-for-pickup **turmeric**, 3,200 kg, Muthu Farms (Attur) → Salem Agro Warehouse.

- Tata Ace 1.5T is shown but disabled (**Too small** for 3,200 kg)
- Mini Truck 3.5T is recommended at ₹3,450
- LCV 5T is available at ₹4,250

---

## Screens

| Group | Screens |
| --- | --- |
| Discovery | Home feed, crop detail |
| Request | Select quantity, review request, request sent, request details |
| Acceptance | Request update, confirm purchase, quantity confirmed, book a truck |
| Truck booking | Book Track home, choose an order, pickup & delivery, nearby trucks, truck details |
| Trip | Review booking, finding truck, truck confirmed, live track, delivery completed |
| Account | My Orders, Profile (Karthik Traders, Salem) |

Bottom tabs: **Home · Book Track · My Orders · Profile**

Seed farms: Arul Farms (Dindigul), Muthu Farms (Attur, Salem), Kannan Orchard (Ooty).

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

Cards 16px radius, full-width buttons 52px / 12px radius. Indian rupee formatting (`₹1,90,000`), weights in kg.

---

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

```bash
npm run build    # production build
npm run preview  # serve the build
```

Requires Node 22+.

---

## Deploy (GitHub Pages)

Push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

The repo owner needs Pages turned on once:

1. [Settings → Pages](https://github.com/mrrokesh/Uzhavan/settings/pages)
2. **Source:** GitHub Actions
3. For a public URL on a free plan, set the repo to **public** (private Pages needs GitHub Pro)

Live path after that: `https://mrrokesh.github.io/Uzhavan/`

---

## Stack

React 19, TypeScript, Vite 7, Tailwind CSS 4, React Router 7.
