import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "./env.js";
import { prisma } from "./db.js";
import { errorHandler, notFound } from "./http.js";
import { startTicketSweeper } from "./tickets/assignment.js";
import { startPayoutSweeper } from "./payouts.js";
import { payoutsRouter, adminPayoutsRouter } from "./routes/payouts.js";
import { authRouter } from "./routes/auth.js";
import { meRouter } from "./routes/me.js";
import { verificationRouter } from "./routes/verification.js";
import { moderationRouter } from "./routes/moderation.js";
import { adminRouter } from "./routes/admin.js";
import { ticketsRouter } from "./routes/tickets.js";
import { appRouter } from "./routes/app.js";
import { announcementsRouter, adminAnnouncementsRouter } from "./routes/announcements.js";
import { paymentsRouter, webhookRouter, gatewayRouter, registerGatewayRoutes } from "./routes/payments.js";
import { requireAdmin } from "./session.js";
import { encrypt } from "./crypto.js";
import { modeForKey } from "./payments/razorpay.js";
import { cropsRouter } from "./routes/crops.js";
import { farmerRouter } from "./routes/farmer.js";
import { driverRouter } from "./routes/driver.js";
import { trucksRouter } from "./routes/trucks.js";
import { requestsRouter } from "./routes/requests.js";
import { ordersRouter } from "./routes/orders.js";
import { bookingsRouter } from "./routes/bookings.js";

const app = express();

app.use(
  cors({
    origin: env.corsOrigin === "*" ? true : env.corsOrigin.split(",").map((s) => s.trim()),
  }),
);
// Razorpay signs the exact bytes it sends, so the webhook has to see them
// before any JSON parser rewrites the body.
app.use("/api/webhooks", webhookRouter);

// KYC documents arrive base64-encoded in the JSON body, which inflates them by
// ~4/3. Allow headroom over MAX_UPLOAD_MB so a file at the limit still fits.
app.use(express.json({ limit: `${Math.ceil((env.maxUploadBytes / 1024 / 1024) * 4 * 1.4)}mb` }));
app.use(morgan("dev"));

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
  } catch {
    res.status(503).json({ ok: false, db: "down" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/me", meRouter);
app.use("/api/verification", verificationRouter);
app.use("/api/app", appRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/announcements", announcementsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/payouts", payoutsRouter);
app.use("/api/admin", adminPayoutsRouter);
app.use("/api/admin/announcements", adminAnnouncementsRouter);
app.use("/api/admin", gatewayRouter);
app.use("/api/admin", moderationRouter);
app.use("/api/admin", adminRouter);
app.use("/api/crops", cropsRouter);
app.use("/api/farmer", farmerRouter);
app.use("/api/driver", driverRouter);
app.use("/api/trucks", trucksRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/bookings", bookingsRouter);

app.use(notFound);
app.use(errorHandler);

registerGatewayRoutes(gatewayRouter, { requireAdmin, encrypt, modeForKey });

const server = app.listen(env.port, () => {
  console.log(`Uzhavan API listening on http://localhost:${env.port}`);
});

// Force-assigns tickets left unattended past TICKET_ESCALATION_HOURS.
const sweeper = startTicketSweeper();
// Farmers waiting on money must not depend on an admin opening the console.
const payoutSweeper = startPayoutSweeper();

async function shutdown() {
  clearInterval(sweeper);
  clearInterval(payoutSweeper);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
