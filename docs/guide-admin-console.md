# Admin console guide

The console is a website for admin and support staff. Buyers, farmers and drivers cannot sign in to it. Staff and admin accounts have no mobile app.

## Sign in

Go to the console address and sign in with a staff or admin account.

## Admin or staff?

- **Admin** can do everything.
- **Staff** can only do what an admin has granted them.

Four things are admin-only and can never be given to staff: creating or removing staff, granting permissions, publishing app updates, and reading the audit log.

## The sections

| Section | Use it to |
| --- | --- |
| **Overview** | See pending verifications, unassigned tickets, blocked accounts and total order value |
| **Verification** | Review identity documents. The number is shown next to the document. Rejections need a reason, which the person sees |
| **Support** | Handle tickets: assign, reply, add internal notes, change status |
| **Accounts** | Search and filter accounts, then suspend, block or restore |
| **Announcements** | Send a notice to farmers, buyers, drivers or everyone |
| **Settings** | Change fees, payout rules and support contact details |
| **Track a vehicle** | Look up a truck by plate: driver, papers, and what is on board |
| **Farmer payouts** | See every payment, release it, or hold it with a reason |
| **App updates** | Ask users to update, or force an update |
| **Payments** | Manage the payment gateway accounts |
| **Staff** | Create staff and choose what they can do |
| **Audit log** | See every sensitive action and who did it |

## Accounts

Use the search box for name, email, phone or business. Two dropdowns narrow the list:

- **Role:** buyers, farmers or drivers.
- **Status:** one dropdown with two groups. *Account status* is active, suspended or blocked. *Verification* is unverified, pending, verified or rejected.

**Suspend** and **Block** both need a reason, which the person sees when they try to sign in. A blocked person is signed out immediately. A blocked driver goes offline, and a blocked farmer's listings are hidden. **Restore** brings them back.

## Change the platform fee

Only admins can do this.

1. Open **Settings**.
2. Find **Platform fee (%)** under Commercial.
3. Enter a number from 5 to 30 and tap **Save**.

The fee is added on top of the farmer's price and paid by the buyer. Farmers and drivers never pay it. The new rate applies to new orders. Existing orders keep the rate they were made with. The same page controls the advance on loading, the hold after delivery, and when farmers get paid.

## Announcements

Write a title and message, choose who it is for, then publish. You can save a draft, pin it to the top, or set an expiry. Publishing also sends a phone notification once push is set up (see [Deployment hand-off](deployment-handoff.md)). Editing a published notice does not send it again.

## Support tickets

New tickets are assigned automatically to the least busy agent. Payment and delivery issues start at high priority. Anything unanswered for 24 hours is escalated automatically. Internal notes are never shown to the customer.

## Keep in mind

- You must be signed in as an admin to see the editable fee. Staff see it read-only.
- Every sensitive action is recorded in the audit log.
