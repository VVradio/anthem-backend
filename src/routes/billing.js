import { Router } from "express";
import Stripe from "stripe";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";

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
    const plan = s.metadata?.plan;
    if (userId && plan) await db.setPlan(userId, plan);
    // Credit the referrer's 30% commission, if this user was referred.
    const user = userId ? await db.findById(userId) : null;
    if (user?.referredBy && plan) {
      await db.recordReferralConversion(user.email, plan, PLAN_CENTS[plan] || 0);
    }
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
