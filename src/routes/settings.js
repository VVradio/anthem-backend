import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";

const router = Router();

// GET /api/settings — timezone + business hours.
router.get("/", requireAuth, async (req, res) => {
  const s = await db.getSettings(req.user.id);
  res.json(s);
});

// POST /api/settings — update timezone and/or business hours.
router.post("/", requireAuth, async (req, res) => {
  const { timezone, businessHours } = req.body || {};
  await db.setSettings(req.user.id, { timezone, businessHours });
  res.json({ ok: true });
});

export default router;
