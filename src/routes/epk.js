import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";

const router = Router();

// POST /api/epk/publish  { data } — save/refresh the artist's public EPK, return share code.
router.post("/publish", requireAuth, async (req, res) => {
  const data = req.body?.data;
  if (!data || typeof data !== "object") return res.status(400).json({ error: "Missing EPK data" });
  try {
    const existing = await db.getEpkByUser(req.user.id);
    const code = existing?.shareCode || crypto.randomBytes(6).toString("hex");
    await db.saveEpk(req.user.id, code, data);
    res.json({ shareCode: code });
  } catch (e) {
    console.error("EPK publish error:", e);
    res.status(500).json({ error: "Could not publish EPK" });
  }
});

// GET /api/epk/me — get this user's current share code (if any).
router.get("/me", requireAuth, async (req, res) => {
  const e = await db.getEpkByUser(req.user.id);
  res.json({ shareCode: e?.shareCode || null });
});

// GET /api/epk/:code — PUBLIC: fetch an EPK by its share code (no auth).
router.get("/:code", async (req, res) => {
  const data = await db.getEpkByCode(req.params.code);
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json({ data });
});

export default router;
