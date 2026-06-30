import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";

const router = Router();

// GET /api/royalties — list the user's releases with splits + revenue.
router.get("/", requireAuth, async (req, res) => {
  const releases = await db.listReleases(req.user.id);
  res.json({ releases });
});

// POST /api/royalties — add a release.
router.post("/", requireAuth, async (req, res) => {
  const { title, splits, revenueCents } = req.body || {};
  if (!title) return res.status(400).json({ error: "Title required" });
  const row = await db.addRelease(req.user.id, { title, splits: splits || [], revenueCents: revenueCents || 0 });
  res.json(row);
});

// PATCH /api/royalties/:id — update splits/revenue/title.
router.patch("/:id", requireAuth, async (req, res) => {
  const row = await db.updateRelease(req.user.id, Number(req.params.id), req.body || {});
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

// DELETE /api/royalties/:id
router.delete("/:id", requireAuth, async (req, res) => {
  await db.deleteRelease(req.user.id, Number(req.params.id));
  res.json({ ok: true });
});

// POST /api/royalties/:id/share — create/return a public split-sheet code.
router.post("/:id/share", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const list = await db.listReleases(req.user.id);
  const rel = list.find(r => r.id === id);
  if (!rel) return res.status(404).json({ error: "Not found" });
  const code = rel.shareCode || crypto.randomBytes(6).toString("hex");
  await db.updateRelease(req.user.id, id, { shareCode: code });
  res.json({ shareCode: code });
});

// GET /api/royalties/sheet/:code — PUBLIC split sheet (no auth).
router.get("/sheet/:code", async (req, res) => {
  const rel = await db.getReleaseByCode(req.params.code);
  if (!rel) return res.status(404).json({ error: "Not found" });
  res.json({ title: rel.title, splits: rel.splits, revenueCents: rel.revenueCents });
});

export default router;
