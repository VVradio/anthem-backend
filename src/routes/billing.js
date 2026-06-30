import { Router } from "express";
import Stripe from "stripe";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";
import { sendEmail, paymentEmail, notifyOwner } from "../email.js";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

// Monthly price in cents per plan — used to compute referral commission.
const PLAN_CENTS = { indie: 2900, artist: 7900, label: 24900 };

const PRICE_IDS = {
  // Monthly subscription price IDs
  indie: process.env.STRIPE_PRICE_INDIE,
  artist: process.env.STRIPE_PRICE_ARTIST,
  label: process.env.STRIPE_PRICE_LABEL,
  // Annual subscription price IDs (create these in Stripe as yearly prices)
  indie_annual: process.env.STRIPE_PRICE_INDIE_ANNUAL,
  artist_annual: process.env.STRIPE_PRICE_ARTIST_ANNUAL,
  label_annual: process.env.STRIPE_PRICE_LABEL_ANNUAL,
};

// ---- STRIPE: create a Checkout session for a subscription ----
// POST /api/billing/checkout  { plan: "indie"|"artist"|"label", cycle: "monthly"|"annual" }
router.post("/checkout", requireAuth, async (req, res) => {
  const { plan, cycle = "monthly" } = req.body || {};
  const key = cycle === "annual" ? `${plan}_annual` : plan;
  const price = PRICE_IDS[key];
  if (!price) return res.status(400).json({ error: "Unknown plan or cycle not configured" });
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: "Payments not configured yet. Add STRIPE_SECRET_KEY." });
  }
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: req.user.email,
      // Apply a promo automatically if you've set the coupon env vars in Stripe:
      //  - annual → 50% off first year coupon; monthly → $7 first month coupon.
      ...(cycle === "annual" && process.env.STRIPE_COUPON_LAUNCH
        ? { discounts: [{ coupon: process.env.STRIPE_COUPON_LAUNCH }] }
        : cycle === "monthly" && process.env.STRIPE_COUPON_TRIAL
        ? { discounts: [{ coupon: process.env.STRIPE_COUPON_TRIAL }] }
        : { allow_promotion_codes: true }),
      success_url: `${process.env.CLIENT_ORIGIN}/?paid=1`,
      cancel_url: `${process.env.CLIENT_ORIGIN}/?canceled=1`,
      metadata: { userId: String(req.user.id), plan, cycle },
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Stripe error" });
  }
});

// POST /api/billing/seats  { quantity } — buy team seats at $10/seat/month.
router.post("/seats", requireAuth, async (req, res) => {
  const quantity = Math.max(1, Math.min(50, Number(req.body?.quantity) || 1));
  const price = process.env.STRIPE_PRICE_SEAT;
  if (!price) return res.status(503).json({ error: "Seat billing isn't set up yet. Add STRIPE_PRICE_SEAT." });
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: "Payments not configured yet." });
  }
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity }],
      customer_email: req.user.email,
      allow_promotion_codes: true,
      success_url: `${process.env.CLIENT_ORIGIN}/?seats=1`,
      cancel_url: `${process.env.CLIENT_ORIGIN}/?canceled=1`,
      metadata: { userId: String(req.user.id), kind: "seats", quantity: String(quantity) },
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Stripe error" });
  }
});

// POST /api/billing/cancel — simple in-app downgrade (immediately drops to no plan).
// Also cancels the Stripe subscription if we can find it by customer email.
router.post("/cancel", requireAuth, async (req, res) => {
  try {
    // Downgrade in our system right away.
    await db.setPlan(req.user.id, "canceled");
    // Best-effort: cancel any active Stripe subscription for this email.
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const customers = await stripe.customers.list({ email: req.user.email, limit: 1 });
        const cust = customers.data[0];
        if (cust) {
          const subs = await stripe.subscriptions.list({ customer: cust.id, status: "active", limit: 10 });
          for (const sub of subs.data) {
            await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
          }
        }
      } catch (e) { console.error("Stripe cancel error:", e.message); }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Could not cancel" });
  }
});

// POST /api/billing/portal — opens the Stripe Billing Portal so the customer
// can manage/cancel their subscription and update payment details themselves.
router.post("/portal", requireAuth, async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Billing not configured." });
  try {
    const customers = await stripe.customers.list({ email: req.user.email, limit: 1 });
    const cust = customers.data[0];
    if (!cust) return res.status(404).json({ error: "No billing account found for your email yet." });
    const session = await stripe.billingPortal.sessions.create({
      customer: cust.id,
      return_url: `${process.env.CLIENT_ORIGIN}/`,
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Stripe error" });
  }
});

// ---- STRIPE WEBHOOK: confirms payment, upgrades the user's plan ----
// Registered with express.raw() in server.js (must verify the raw body).
export async function stripeWebhook(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const userId = Number(s.metadata?.userId);
    const buyerEmail = s.customer_email || s.customer_details?.email;
    if (s.metadata?.kind === "seats") {
      // Team seats purchased — record how many this org paid for.
      const qty = Number(s.metadata?.quantity) || 1;
      if (userId && db.setSeats) await db.setSeats(userId, qty);
      if (buyerEmail) {
        const e = paymentEmail(buyerEmail, `${qty} team seat${qty > 1 ? "s" : ""}`, `$${qty * 10}/mo`);
        sendEmail(buyerEmail, e.subject, e.html).catch(() => {});
      }
      notifyOwner("upgrade", { email: buyerEmail, plan: `${qty} team seat${qty > 1 ? "s" : ""}`, amount: `$${qty * 10}/mo` });
    } else {
      const plan = s.metadata?.plan;
      if (userId && plan) await db.setPlan(userId, plan);
      // Credit the referrer's 30% commission, if this user was referred.
      const user = userId ? await db.findById(userId) : null;
      if (user?.referredBy && plan) {
        await db.recordReferralConversion(user.email, plan, PLAN_CENTS[plan] || 0);
      }
      // Send a payment confirmation / receipt email.
      if (buyerEmail && plan) {
        const planName = { indie: "Indie", artist: "Artist", label: "Label" }[plan] || plan;
        const amt = PLAN_CENTS[plan] ? `$${(PLAN_CENTS[plan] / 100).toFixed(0)}/mo` : "";
        const e = paymentEmail(buyerEmail, planName, amt);
        sendEmail(buyerEmail, e.subject, e.html).catch(() => {});
        notifyOwner("upgrade", { email: buyerEmail, plan: planName, amount: amt });
      }
    }
  }
  if (event.type === "customer.subscription.deleted") {
    // Subscription ended — downgrade the matching user.
    try {
      const sub = event.data.object;
      const cust = await stripe.customers.retrieve(sub.customer);
      const email = cust?.email;
      if (email) {
        const u = await db.findByEmail(email);
        if (u) await db.setPlan(u.id, "canceled");
      }
    } catch (e) { console.error("sub.deleted handling:", e.message); }
  }
  res.json({ received: true });
}

// ---- STRIPE CONNECT: pay referrers their commission ----
// To pay people, the referrer first onboards a Connect account (gives Stripe
// their bank/payout details). Then you send payouts (transfers) to that account.

// POST /api/billing/connect/onboard — returns a Stripe onboarding link.
router.post("/connect/onboard", requireAuth, async (req, res) => {
  try {
    const me = await db.findById(req.user.id);
    let acctId = me?.stripeConnectId;
    if (!acctId) {
      const account = await stripe.accounts.create({ type: "express", email: req.user.email });
      acctId = account.id;
      await db.setConnectAccount(req.user.id, acctId);
    }
    const link = await stripe.accountLinks.create({
      account: acctId,
      refresh_url: `${process.env.CLIENT_ORIGIN}/dashboard?connect=retry`,
      return_url: `${process.env.CLIENT_ORIGIN}/dashboard?connect=done`,
      type: "account_onboarding",
    });
    res.json({ url: link.url });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Stripe Connect error" });
  }
});

// POST /api/billing/payout — sends the referrer their owed commission.
// In production, run this on a schedule (e.g. monthly) rather than on demand.
router.post("/payout", requireAuth, async (req, res) => {
  const user = await db.findById(req.user.id);
  if (!user?.stripeConnectId) {
    return res.status(400).json({ error: "Connect a payout account first." });
  }
  const owedCents = await db.commissionOwed(user.referralCode);
  if (owedCents <= 0) return res.json({ paid: 0, message: "Nothing to pay out yet." });
  try {
    const transfer = await stripe.transfers.create({
      amount: owedCents,
      currency: "usd",
      destination: user.stripeConnectId,
      description: `Anthem referral commission for ${user.referralCode}`,
    });
    res.json({ paid: owedCents / 100, transferId: transfer.id });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Payout failed" });
  }
});

// ---- PAYPAL (optional secondary processor) ----
// PayPal supports recurring billing via its Subscriptions API. To enable it you
// would: (1) create a product + billing plan in the PayPal dashboard, (2) create
// a subscription here and return the approval URL, (3) verify status via a PayPal
// webhook (mirroring the Stripe webhook above) and call db.setPlan().
// Note: Cash App does NOT offer recurring SaaS subscription billing, so it is not
// wired up here — use Stripe and/or PayPal for plans.
router.post("/paypal/checkout", requireAuth, async (_req, res) => {
  res.status(501).json({ error: "PayPal not configured yet. See comments in billing.js." });
});

export default router;
