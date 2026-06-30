import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";

const router = Router();

// GET /api/sync — list the user's sync tracks.
router.get("/", requireAuth, async (req, res) => {
  const tracks = await db.listSyncTracks(req.user.id);
  res.json({ tracks });
});

// POST /api/sync — add a track.
router.post("/", requireAuth, async (req, res) => {
  const { title, data } = req.body || {};
  if (!title) return res.status(400).json({ error: "Title required" });
  const row = await db.addSyncTrack(req.user.id, title, data || {});
  res.json(row);
});

// PATCH /api/sync/:id — update metadata/checklist.
router.patch("/:id", requireAuth, async (req, res) => {
  const row = await db.updateSyncTrack(req.user.id, Number(req.params.id), req.body || {});
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

// DELETE /api/sync/:id
router.delete("/:id", requireAuth, async (req, res) => {
  await db.deleteSyncTrack(req.user.id, Number(req.params.id));
  res.json({ ok: true });
});

export default router;
