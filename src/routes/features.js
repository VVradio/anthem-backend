import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";

const router = Router();

// POST /api/features  { text } — submit a feature request.
router.post("/", requireAuth, async (req, res) => {
  const text = (req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "Tell us what you'd like!" });
  if (db.addFeatureRequest) await db.addFeatureRequest(req.user.id, req.user.email, text);
  res.json({ ok: true });
});

export default router;
