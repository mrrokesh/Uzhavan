# Uzhavan

Buyer-side farm-to-buyer marketplace for Tamil Nadu. Discover crops before harvest, request a quantity, confirm the farmer’s price, then book a local truck.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The UI is framed at 390 × 844.

## Flows

1. **Home → request → confirm → truck → delivered** — Bhagwa pomegranates from Arul Farms (`UZH-REQ-1809` / `UZH-ORD-1809`).
2. **Book Track** — Turmeric pickup from Muthu Farms, Attur to Salem Agro Warehouse.

Price stays estimated until the farmer confirms. No payment is collected on the request.
