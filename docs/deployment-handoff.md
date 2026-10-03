# Deployment hand-off

This page is for whoever deploys Uzhavan. Nothing here needs the code changed. For the long Render walkthrough, see [DEPLOY.md](../DEPLOY.md).

## What runs where

| Part | Host | How it deploys |
| --- | --- | --- |
| API (`backend/`) | Render, Singapore | Automatically on every push to `main` |
| Console (`frontend/`) | Vercel | Automatically on every push to `main` |
| Database | The existing Ubuntu server | Not deployed. Render connects to it over the internet |
| Mobile apps | Expo EAS builds | Built by hand, see below |

Live addresses at the time of writing:

- API: `https://uzhavan-33kj.onrender.com`
- Console: `https://uzhavan-beta.vercel.app`

## Settings that must match

| Where | Setting | Value |
| --- | --- | --- |
| Vercel project | `VITE_API_URL` | The API address, with **no** trailing slash |
| Render API | `CORS_ORIGIN` | The console address, with **no** trailing slash |

A trailing slash in `CORS_ORIGIN` breaks sign-in on the console with a CORS error. `VITE_API_URL` is read when the console is built, so after changing it, redeploy on Vercel.

Render also needs `DATABASE_URL`, `PASSWORD_PEPPER` and `ENCRYPTION_KEY`. Back up the pepper and the encryption key somewhere other than the server. If the encryption key is lost, every stored identity document becomes unreadable for good.

## The repository must stay public

On Vercel's free plan, deployments from a **private** repository are blocked when the person who pushed is not on the Vercel team. The block is silent. Pushes just stop deploying.

To check, open the latest commit on GitHub and look at the Vercel status. "Deployment was blocked" means the repo is private again. Making it public fixes it. The cost is that the source code is visible to everyone. Upgrading Vercel's plan is the other way out.

## Database changes

Your local and deployed API may share one database. New tables for chat and notifications are already in it. If a separate production database is ever created, run this against it before starting the API:

```bash
cd backend
npx prisma db push
```

## Push notifications (Android)

Pop-up alerts need Firebase. The bell inside the app works without it.

The code and both `google-services.json` files are already in the repo. The Firebase project is `com-uzhavan-app`, with two Android apps:

| App | Package |
| --- | --- |
| Uzhavan (farmer and driver) | `com.uzhavan.app` |
| Uzhavan Buy | `com.uzhavan.buy` |

What is left:

1. **Create the key.** In the Firebase console open `com-uzhavan-app`, then Project settings, then Service accounts, then **Generate new private key**. Keep the file private. Never commit it or paste it into chat.
2. **Upload it to Expo**, once per app:
   ```bash
   cd Uzhavanbuy      # then repeat in Uzhavan
   npx eas-cli credentials
   ```
   Choose Android, the build profile, then Google Service Account, then the FCM V1 push key option, and select the file.
3. **Build and install real apps.** Push does not work inside Expo Go.
   ```bash
   cd Uzhavanbuy && npx eas-cli build --profile uzhavan-buy-preview --platform android
   cd Uzhavan && npx eas-cli build --profile uzhavan-preview --platform android
   ```
   Download the APKs and install them on a phone.
4. **Protect the API key.** The Firebase files contain a normal client API key. In Google Cloud, open APIs and Services, then Credentials, and restrict the key to the two package names.
5. **Test it.** Publish an announcement from the console and check the phone gets an alert.

iPhones need a separate Apple Developer account and push key. That is not set up.

## Not set up yet

- **Razorpay.** No payment gateway account is configured, so a live payment has never been completed. Add one in the console under **Payments**.
- **Real email and SMS.** The server prints codes to its log unless email or SMS is configured. In production it refuses to start with both set to `log`.
- **Uzhavan Plus** has no purchase screen in the app yet.
- **Voice messages and an LLM for the assistant** wait for a server to host them.

## After every deploy

1. Open `<API address>/api/health`. It should say `{"ok":true,"db":"up"}`.
2. Open the console and sign in.
3. Check the latest commit's Vercel status on GitHub says deployed, not blocked.
