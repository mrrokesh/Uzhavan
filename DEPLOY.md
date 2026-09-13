# Deploying to Render

The API and the admin console go to Render. **The database does not** — it stays
on the existing Ubuntu box, which is the decision everything below has to work
around.

---

## Read this before you start

**Render will be far from your database.** Singapore is Render's nearest region
to Tamil Nadu, and the round trip to your VPS will be roughly 50–80 ms. Prisma
issues several queries per request, so a screen needing five of them spends
about a third of a second doing nothing but waiting — every time, for every
user. On the same machine as Postgres that figure is about 0.1 ms.

Nothing in this guide fixes that. It is the price of splitting the two, and the
only real cures are moving the API onto the VPS or moving Postgres to a managed
Indian region. Worth knowing now rather than wondering later why everything
feels slow.

**Port 5432 has to stay open to the internet.** Render's outbound addresses are
not fixed on the plans below, so you cannot firewall Postgres to a known list.
Given the `postgres` superuser password currently unlocks all 43 databases on
that box and grants shell access through `COPY ... FROM PROGRAM`, rotate it and
give Uzhavan its own limited role *before* anything is publicly reachable.

**The free plan sleeps.** A free web service spins down after 15 minutes idle,
and the next request waits 50 seconds or so for a cold start. That is fine for
a demo and not fine for a farmer standing in a field. `starter` is what the
blueprint asks for.

---

## 1. Prepare the database

On the VPS, as a user who can administer Postgres:

```sql
CREATE ROLE uzhavan LOGIN PASSWORD 'a-long-random-string';
GRANT CONNECT ON DATABASE uzhalavan TO uzhavan;
\c uzhalavan
GRANT USAGE, CREATE ON SCHEMA public TO uzhavan;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO uzhavan;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO uzhavan;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO uzhavan;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO uzhavan;
```

That role can do anything it needs inside `uzhalavan` and nothing at all in the
other 42 databases. A leaked credential then costs you one app.

Postgres must also accept remote connections with TLS. In `postgresql.conf`:

```
listen_addresses = '*'
ssl = on
```

and in `pg_hba.conf`, requiring encrypted connections for this role:

```
hostssl  uzhalavan  uzhavan  0.0.0.0/0  scram-sha-256
```

While you are in `postgresql.conf`, raise the lock table — the current 64 is
too small for 43 databases and has already taken the API down once:

```
max_locks_per_transaction = 256
```

Then `sudo systemctl restart postgresql`. That restart interrupts every
database on the box, so pick a quiet moment.

---

## 2. Create the services

Render dashboard → **New** → **Blueprint** → choose this repository. It reads
[`render.yaml`](render.yaml) and creates two services: `uzhavan-api` and
`uzhavan-admin`.

Render will prompt for every variable marked `sync: false`.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `postgresql://uzhavan:PASSWORD@YOUR_DB_HOST:5432/uzhalavan?schema=public&sslmode=require&connection_limit=5&pool_timeout=20&connect_timeout=10` |
| `PASSWORD_PEPPER` | 64 hex characters |
| `ENCRYPTION_KEY` | 64 hex characters |
| `CORS_ORIGIN` | the admin console's URL, e.g. `https://uzhavan-admin.onrender.com` |
| `SMTP_URL` | your mail provider's SMTP URL |
| `VITE_API_URL` | the API's URL, e.g. `https://uzhavan-api.onrender.com` |

The host is deliberately not written down here. It's in `backend/.env`, and a
repository is a poor place to record where an internet-facing database lives.

Generate the two secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Use the values already in `backend/.env` if this database has real data in
it.** A different `PASSWORD_PEPPER` invalidates every existing password; a
different `ENCRYPTION_KEY` makes every stored KYC document permanently
unreadable. Back both up somewhere that is not this server.

`CORS_ORIGIN` and `VITE_API_URL` are circular — each service needs the other's
URL. Deploy once, copy the two URLs Render assigns, set the variables, redeploy.

---

## 3. First deploy

The API's build runs `prisma generate` but deliberately not `prisma db push`:
schema changes should be a decision, not a side effect of a deploy. Your
database already has the schema. When you next change it, run the push yourself
against the production URL, having taken a dump first:

```bash
pg_dump "$DATABASE_URL" -f before-push.sql
DATABASE_URL="..." npx prisma db push
```

Check the API came up:

```bash
curl https://uzhavan-api.onrender.com/api/health
```

`{"ok":true,"db":"up"}` means the whole chain works — Render reached your VPS,
TLS negotiated, the role has access.

If it says `db:"down"`, the usual causes are `pg_hba.conf` not allowing the
address, `listen_addresses` still on localhost, or a firewall on 5432.

---

## 4. Point the apps at it

In the repo root, create `.env`:

```
EXPO_PUBLIC_API_URL=https://uzhavan-api.onrender.com
```

Then build both apps:

```bash
npx eas build -p android --profile uzhavan-preview
npx eas build -p android --profile uzhavan-buy-preview
```

Without that variable the apps derive the API host from the Expo dev server,
which means an installed APK only works while your laptop is running.

---

## What this does not cover

- **Uploads live in the database.** KYC documents are encrypted rows, not files
  on disk, so there is nothing to mount and nothing to lose on redeploy. It
  also means the database grows by roughly 5 MB per verified user.
- **No backups are configured.** Render backs up nothing here, because Render
  does not hold your data. Set up `pg_dump` on a cron on the VPS.
- **Logs are ephemeral.** Render keeps a rolling window. Anything you want to
  keep needs shipping elsewhere.
- **One instance.** The rate limiter holds its counters in memory, so a second
  instance would each have their own. The per-account lockout is in the
  database and unaffected. Revisit if you ever scale out.
