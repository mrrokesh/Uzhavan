# Troubleshooting

## In the apps

**The app keeps loading on my phone.**
- Check the phone is still connected by USB and run the `adb reverse` lines from [Developer setup](developer-setup.md). They stop working when the cable is unplugged.
- Check the screen is unlocked. A locked phone can leave the app stuck.
- The first load after starting the dev server takes about 20 to 30 seconds while it builds.

**I never get a pop-up notification.**
That is expected in Expo Go. Push needs a real installed build and Firebase set up. See [Deployment hand-off](deployment-handoff.md). The bell inside the app still shows everything.

**The bell is empty.**
Notifications only appear for the five events listed in [Messages, notifications and the assistant](messages-notifications-assistant.md). Nothing is created for other actions.

**"Wrong app" appears after signing in.**
Farmers and drivers use **Uzhavan**. Buyers use **Uzhavan Buy**. Staff and admins use the web console.

**I cannot edit my request.**
You can only edit while the farmer has not answered. After the farmer sets a price, decline it and request again.

**"Message farmer" does nothing.**
Check your connection and try again. If it keeps failing, raise an issue under **Help & support**.

**I forgot my password.**
Tap **Forgot password**. A six-digit code arrives by email or SMS and expires in 15 minutes. Five wrong guesses cancel the code, so ask for a new one.

**My account is blocked.**
The sign-in message shows the reason. Contact support from the details shown.

## In the console

**Sign-in fails with a CORS error.**
The API's `CORS_ORIGIN` does not exactly match the console address. Check for a trailing slash, then redeploy the API.

**I cannot edit the platform fee.**
Only admin accounts can edit it. Staff accounts see it read-only. Check which account you are signed in as.

**The "Suspended" filter shows nothing.**
Nobody is suspended. Use **Suspend** on an account to create one, then filter again.

**My console changes are not live.**
Check the latest commit on GitHub for the Vercel status. "Deployment was blocked" means the repository is private. See [Deployment hand-off](deployment-handoff.md).

## For developers

**`429` errors, or tests that pass alone but fail together.**
You have used up the in-memory login and reset limits. Restart the API and run `npm run db:reset`.

**An error about "out of shared memory".**
The shared database host is busy. Run the command again.

**`prisma generate` fails with a locked file on Windows.**
Stop the dev server first, then run it again.

**The app on the phone shows old behaviour after a code change.**
Close the app completely and reopen it. If a screen is stuck in a loop, force-stop Expo Go.

**Port 5173 is already in use.**
Another console dev server is running. Vite will pick the next port, so check the address it prints.

Still stuck? Raise it with the team and include what you did, what you expected, and any error text.
