import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../store.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, plan: user.plan },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

router.post("/signup", async (req, res) => {
  const { email, password, referralCode } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.createUser({ email, passwordHash, referralCode });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = await db.findByEmail(email);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  res.json({ token: signToken(user), user: publicUser(user) });
});

function publicUser(u) {
  return { id: u.id, email: u.email, plan: u.plan, referralCode: u.referralCode };
}

// GET /api/auth/me — returns the current user with their up-to-date plan.
// Used by the app to reflect plan upgrades after a Stripe payment.
router.get("/me", requireAuth, async (req, res) => {
  const user = await db.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ user: publicUser(user) });
});

export default router;
