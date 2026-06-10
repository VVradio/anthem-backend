import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "../store.js";
import { requireAuth } from "../middleware/auth.js";
import { isOwner } from "../access.js";
import { sendEmail, welcomeEmail, resetPasswordEmail } from "../email.js";

const router = Router();

// Short-lived password-reset tokens (in memory). token -> { userId, expires }
const resetTokens = new Map();

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
    // Welcome email (skips silently if email isn't configured).
    const w = welcomeEmail(email);
    sendEmail(email, w.subject, w.html).catch(() => {});
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
  // Owners always appear on the top plan so the UI unlocks everything.
  const plan = isOwner(u) ? "label" : u.plan;
  return { id: u.id, email: u.email, plan, referralCode: u.referralCode, createdAt: u.createdAt, owner: isOwner(u) };
}

// GET /api/auth/me — returns the current user with their up-to-date plan.
// Used by the app to reflect plan upgrades after a Stripe payment.
router.get("/me", requireAuth, async (req, res) => {
  const user = await db.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ user: publicUser(user) });
});

// POST /api/auth/forgot  { email } — emails a reset link if the account exists.
router.post("/forgot", async (req, res) => {
  const { email } = req.body || {};
  // Always respond OK (don't reveal whether an email is registered).
  try {
    const user = email ? await db.findByEmail(email) : null;
    if (user) {
      const token = crypto.randomBytes(24).toString("hex");
      resetTokens.set(token, { userId: user.id, expires: Date.now() + 60 * 60 * 1000 }); // 1h
      const base = process.env.CLIENT_ORIGIN || "https://www.varietyvibesradio.shop";
      const url = `${base}/?reset=${token}`;
      const e = resetPasswordEmail(user.email, url);
      sendEmail(user.email, e.subject, e.html).catch(() => {});
    }
  } catch { /* ignore */ }
  res.json({ ok: true });
});

// POST /api/auth/reset  { token, password } — sets a new password.
router.post("/reset", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: "Missing token or password" });
  const entry = resetTokens.get(token);
  if (!entry || entry.expires < Date.now()) {
    return res.status(400).json({ error: "This reset link is invalid or expired." });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await db.setPassword(entry.userId, passwordHash);
    resetTokens.delete(token);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "Could not reset password" });
  }
});

export default router;
