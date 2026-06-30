import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";
import { isOwner } from "../access.js";

const router = Router();

// Gate: only owners (your email in OWNER_EMAILS) may use these.
async function requireOwner(req, res, next) {
  const me = await db.findById(req.user.id);
  if (!me || !isOwner(me)) return res.status(403).json({ error: "Owners only" });
  next();
}

// GET /api/admin/users — list everyone + totals.
router.get("/users", requireAuth, requireOwner, async (_req, res) => {
  const users = await db.listAllUsers();
  const totals = users.reduce((acc, u) => {
    acc.total++;
    acc.byPlan[u.plan] = (acc.byPlan[u.plan] || 0) + 1;
    return acc;
  }, { total: 0, byPlan: {} });
  res.json({ users, totals });
});

// POST /api/admin/user/:id/plan { plan } — change someone's plan (e.g. comp to "label", or "trial").
router.post("/user/:id/plan", requireAuth, requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  const { plan } = req.body || {};
  const allowed = ["trial", "indie", "artist", "label", "canceled"];
  if (!allowed.includes(plan)) return res.status(400).json({ error: "Unknown plan" });
  await db.setPlan(id, plan);
  res.json({ ok: true });
});

// DELETE /api/admin/user/:id — permanently delete a user/signup.
router.delete("/user/:id", requireAuth, requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: "You can't delete your own account here." });
  const target = await db.findById(id);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (isOwner(target)) return res.status(400).json({ error: "Can't delete an owner account." });
  await db.deleteUser(id);
  res.json({ ok: true });
});

export default router;
