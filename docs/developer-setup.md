# Developer setup

## What is in the repo

| Folder | What it is |
| --- | --- |
| `backend/` | The Node, Express and Prisma API, with PostgreSQL |
| `frontend/` | The web console for staff (Vite and React) |
| `Uzhavan/` | The farmer and driver app (Expo, React Native) |
| `Uzhavanbuy/` | The buyer app (Expo, React Native) |
| `docs/` | These guides |

You need Node 22 or newer.

## Run everything

Start the API first. The others talk to it.

```bash
cd backend
npm install
cp .env.example .env     # then fill it in, see the comments inside
npm run db:push          # create the tables
npm run db:seed          # demo data
npm run dev              # http://localhost:4000
```

Check it: `http://localhost:4000/api/health` should say `{"ok":true,"db":"up"}`.

```bash
cd frontend && npm install && npm run dev      # console, http://localhost:5173
cd Uzhavan && npm install && npm start         # farmer/driver app, port 8082
cd Uzhavanbuy && npm install && npm start      # buyer app, port 8083
```

Scan the QR code with Expo Go, or press `a` for an Android emulator.

## Demo accounts

Every demo account uses the password `uzhavan123`.

| Role | Email |
| --- | --- |
| Buyer | `karthik@uzhavan.app` |
| Farmers | `arul@`, `muthu@`, `kannan@uzhavan.app` |
| Drivers | `selvam@`, `ramesh@`, `vikram@uzhavan.app` |
| Admin | `admin@uzhavan.app` (console only) |
| Staff | `staff@uzhavan.app` (console only) |

## Testing on a real phone over USB

```bash
adb reverse tcp:4000 tcp:4000
adb reverse tcp:8082 tcp:8082
adb reverse tcp:8083 tcp:8083
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8083"
```

Use 8082 instead of 8083 for the farmer/driver app. If you unplug the cable, run the `adb reverse` lines again.

## Run the tests

The tests run against a live server and a real database.

```bash
cd backend
npm run dev            # one terminal
npm run db:reset       # clean state
npm test               # another terminal
```

Things that trip people up:

- **Reset first.** Several suites change things that cannot be undone, so a second run without `db:reset` fails on its own leftovers.
- **Do not run the suites many times in a row.** The server remembers password-reset and login attempts in memory for about 15 minutes. After many runs you get `429` errors and unrelated failures. Restart the API to clear it.
- **The shared database is sometimes busy.** An error mentioning "out of shared memory" is a known problem with the database host. Run the step again.
- Type checks: `npm run typecheck` in each of `backend`, `frontend`, `Uzhavan` and `Uzhavanbuy`.

## Things to know before changing code

**The two mobile apps are copies.** `Uzhavan/` and `Uzhavanbuy/` share the same source files and differ only in `app.config.js`, `eas.json`, `package.json` and the Firebase file. If you change a screen in one, make the same change in the other.

**Changing the database schema.** Do these in order:

```bash
cd backend
npx prisma format
# stop the dev server first, because Windows locks the Prisma engine file
npx prisma db push --skip-generate
npx prisma generate
npm run dev
```

**Check which database you are connected to.** Your local `DATABASE_URL` may point at the same shared database that the deployed API uses. A schema push or `db:reset` then affects the live data. Look before you run either.

**Adding a notification.** Call `notify(userId, kind, { title, body, data })` from `backend/src/notifications.ts`. It saves the in-app row first and sends a push after. Add the new kind to the `NotificationKind` enum in `schema.prisma` and the screen's icon list.

**Changing a password by hand.** Use `npm run set-password -- email 'new password'` in `backend`. A plain SQL update will not work, because passwords are peppered before hashing.

## Where things live

| To change... | Look in |
| --- | --- |
| An API route | `backend/src/routes/` |
| Database models | `backend/prisma/schema.prisma` |
| Platform fee logic | `backend/src/fees.ts` |
| Push sending | `backend/src/push.ts` and `backend/src/notifications.ts` |
| The assistant's answers | `backend/src/assistant.ts` |
| A mobile screen | `Uzhavanbuy/src/screens/` (then copy to `Uzhavan/`) |
| Server calls from the apps | `src/api/hooks.ts` in each app |
| A console page | `frontend/src/pages/` |

For the API list, data model and security design, see the main [README](../README.md).
