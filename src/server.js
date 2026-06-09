import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import chatRouter from "./routes/chat.js";
import authRouter from "./routes/auth.js";
import billingRouter, { stripeWebhook } from "./routes/billing.js";
import referralRouter from "./routes/referral.js";
import streamsRouter from "./routes/streams.js";
import savedRouter from "./routes/saved.js";
import imageRouter from "./routes/image.js";
import salesRouter from "./routes/sales.js";
import brainRouter from "./routes/brain.js";
import extractRouter from "./routes/extract.js";
import historyRouter from "./routes/history.js";
import socialRouter from "./routes/social.js";
import hostRouter from "./routes/host.js";
import teamRouter from "./routes/team.js";
import featuresRouter from "./routes/features.js";
import adminRouter from "./routes/admin.js";
import bookingsRouter from "./routes/bookings.js";
import settingsRouter from "./routes/settings.js";

dotenv.config();

const app = express();

// Stripe webhook needs the RAW body, so it is registered BEFORE express.json().
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), stripeWebhook);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "anthem-backend" }));

app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);
app.use("/api/billing", billingRouter);
app.use("/api/referral", referralRouter);
app.use("/api/streams", streamsRouter);
app.use("/api/saved", savedRouter);
app.use("/api/image", imageRouter);
app.use("/api/sales", salesRouter);
app.use("/api/brain", brainRouter);
app.use("/api/extract", extractRouter);
app.use("/api/history", historyRouter);
app.use("/api/social", socialRouter);
app.use("/api/host", hostRouter);
app.use("/api/team", teamRouter);
app.use("/api/features", featuresRouter);
app.use("/api/admin", adminRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/settings", settingsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Anthem backend running on :${PORT}`);
  console.log("Email configured:", process.env.RESEND_API_KEY ? "YES (key detected)" : "NO (RESEND_API_KEY missing)");
});

// --- Daily job: email trial users whose trial ends within ~24h ---
import { db } from "./store.js";
import { sendEmail, trialEndingEmail } from "./email.js";
const sentReminders = new Set(); // avoid double-sending in one process run
async function runTrialReminders() {
  try {
    if (!db.getTrialsEndingSoon) return;
    const soon = await db.getTrialsEndingSoon();
    for (const u of soon) {
      if (sentReminders.has(u.id)) continue;
      const e = trialEndingEmail(u.email);
      const r = await sendEmail(u.email, e.subject, e.html);
      if (r?.ok) sentReminders.add(u.id);
    }
    if (soon.length) console.log(`Trial reminders processed: ${soon.length}`);
  } catch (e) { console.error("Trial reminder job error:", e); }
}
// Run shortly after boot, then every 12 hours.
setTimeout(runTrialReminders, 30000);
setInterval(runTrialReminders, 12 * 60 * 60 * 1000);
