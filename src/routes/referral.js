import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";

const router = Router();

// GET /api/referral — returns the logged-in user's referral link + their referrals.
router.get("/", requireAuth, (req, res) => {
  const user = db.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const list = db.listReferralsFor(user.referralCode);
  const COMMISSION = 0.30; // 30% recurring
  res.json({
    code: user.referralCode,
    link: `${process.env.CLIENT_ORIGIN}/?ref=${user.referralCode}`,
    commissionRate: COMMISSION,
    referrals: list,
    activeCount: list.filter(r => r.status === "active").length,
    owedUsd: (db.commissionOwed(user.referralCode) / 100),
    hasPayoutAccount: !!user.stripeConnectId,
  });
});

export default router;
