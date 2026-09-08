# Uzhavan

React Native (Expo) buyer app for a farm-to-buyer marketplace in Tamil Nadu. Buyers discover crops before harvest, request a quantity, confirm the price the farmer sets, then book a local truck from farm to warehouse. No middlemen.

**Repo:** [github.com/mrrokesh/Uzhavan](https://github.com/mrrokesh/Uzhavan)

---

## Run

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on iOS or Android. Press `i` for the iOS simulator or `a` for Android.

Requires Node 22+ and the [Expo Go](https://expo.dev/go) app (or Xcode / Android Studio).

---

## Product rules

1. Price is never final until the farmer says so. Pre-acceptance figures are labelled **Estimated**, with “Final price confirmed by farmer.”
2. No payment is collected before the farmer accepts.
3. Transport is optional and happens after the crop order is confirmed. Buyers can always choose **Use a private truck**.
4. Status is always visible: green = done / ready, amber = waiting, grey = not started.
5. Trucks that cannot carry the load stay in the list, disabled, with a reason.

---

## Demo flows

### 1. Discover → request → confirm → truck → delivered

Home → **Bhagwa pomegranates** (Arul Farms, Natham, Dindigul) → 2,000 kg → send request `UZH-REQ-1809` → farmer accepts at **₹95/kg** (`₹1,90,000`) → confirm quantity → book truck → pay **₹3,450** UPI → track Selvam (`TN 30 AB 4821`) → delivered.

On **Request details**, tap **Farmer responded — view update**.

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

Native tabs: **Home · Book Track · My Orders · Profile**

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

Indian rupee formatting (`₹1,90,000`), weights in kg.

---

## Stack

Expo 54, React Native 0.81, React Navigation 7 (native stack + bottom tabs), TypeScript.
