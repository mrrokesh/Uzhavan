# Messages, notifications and the assistant

## Messages (chat)

Buyers and farmers can message each other inside the app.

**Buyer:** open a crop and tap **Message farmer**. A chat opens with that farm. You can also reach it from **Profile → Messages**.

**Farmer:** a buyer starts the conversation. Open **Profile → Messages** to see it and reply.

How it works:

- There is **one chat per buyer and farm**, not one per order. Messaging the same farm again opens the same chat.
- A dot on a conversation means there is something you have not read.
- The list updates by itself every few seconds.
- Only the two people in a chat can read it.
- Messages are **text only** for now. Voice messages are planned.
- Drivers do not have chat. They use support instead.

## The bell: notifications and announcements

The bell on each home screen shows one number. It adds together:

- **Notifications:** things that happened to you.
- **Announcements:** messages the Uzhavan team sent to a whole group.

Tap the bell to see your own activity first, with a link to announcements.

You are notified when:

| What happened | Who is told |
| --- | --- |
| A farmer accepts your request | The buyer |
| A farmer declines your request | The buyer |
| A buyer confirms an order | The farmer |
| A driver accepts the job | The buyer |
| The crop is delivered | The buyer |

### Pop-up alerts when the app is closed

The bell always works. Pop-up alerts on the phone (push) need two extra things:

1. A real installed build of the app, not Expo Go.
2. Firebase set up for Android. See [Deployment hand-off](deployment-handoff.md).

Until then, you will see everything on the bell the next time you open the app. Nothing is lost.

## Ask a question (the assistant)

Open **Profile → Ask a question**. It answers from the live data in the app, never from guesses. It understands three kinds of question:

- **Crops:** "What crops are available?"
- **Delivery:** "Who is available for delivery?"
- **Payments:** "What is my payment status?" It shows only your own orders.

The screen offers these as one-tap suggestions. If you ask something else, it says it cannot answer instead of making something up. It is not a person and it does not remember earlier questions. Buyers, farmers and drivers can all use it.
