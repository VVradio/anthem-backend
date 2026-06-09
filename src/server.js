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
import epkRouter from "./routes/epk.js";
import royaltiesRouter from "./routes/royalties.js";
import fansRouter from "./routes/fans.js";
import syncRouter from "./routes/sync.js";

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
app.use("/api/epk", epkRouter);
app.use("/api/royalties", royaltiesRouter);
app.use("/api/fans", fansRouter);
app.use("/api/sync", syncRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Anthem backend running on :${PORT}`);
  console.log("Email configured:", process.env.RESEND_API_KEY ? "YES (key detected)" : "NO (RESEND_API_KEY missing)");
});

// --- Daily job: email trial users whose trial ends within ~24h ---
import { db } from "./store.js";
import { sendEmail, trialEndingEmail, weeklyDigestEmail } from "./email.js";
const TIPS = [
  "Post consistently — even one strong post a week beats sporadic bursts. Ask Mia for ideas.",
  "Pitch your next release to Spotify editorial at least 7 days early via Spotify for Artists.",
  "Update your Artist Profile so every agent personalizes its work to you.",
  "Reach out to one new venue or playlist this week. Theo can draft the message.",
  "Set aside ~25-30% of streaming income for taxes — June can help you plan.",
  "Refresh your press kit and bio before reaching out to blogs. Remy can help.",
  "Engage with fans who comment — replies build the loyal core that streams and shows you.",
];
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

// --- Weekly digest: upcoming bookings + a tip, to opted-in users ---
let lastDigestDay = null;
async function runWeeklyDigest() {
  try {
    if (!db.getDigestRecipients) return;
    const now = new Date();
    // Send on Mondays, once per day-key.
    const dayKey = now.toISOString().slice(0, 10);
    if (now.getUTCDay() !== 1 || lastDigestDay === dayKey) return;
    lastDigestDay = dayKey;
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    const recipients = await db.getDigestRecipients();
    for (const u of recipients) {
      let bookings = [];
      try {
        const all = await db.listBookings(u.id);
        const t = Date.now();
        bookings = (all || []).filter(b => new Date(b.startsAt).getTime() >= t).slice(0, 5);
      } catch {}
      const e = weeklyDigestEmail(u.email, { bookings, tip });
      await sendEmail(u.email, e.subject, e.html);
    }
    if (recipients.length) console.log(`Weekly digest sent to ${recipients.length}`);
  } catch (e) { console.error("Weekly digest job error:", e); }
}
// Check a few times a day; it only actually sends Mondays.
setTimeout(runWeeklyDigest, 60000);
setInterval(runWeeklyDigest, 6 * 60 * 60 * 1000);
