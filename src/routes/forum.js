import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";
import { isOwner } from "../access.js";

const router = Router();

// Best-effort display name for a user (profile name → email prefix → "Artist").
async function displayName(userId) {
  try {
    const brain = await db.listBrain(userId);
    const prof = brain.find(b => b.kind === "__profile__" || b.label === "__profile__");
    if (prof) { try { const p = JSON.parse(prof.content); if (p.name) return p.name; } catch {} }
  } catch {}
  try { const u = await db.findById(userId); if (u?.email) return u.email.split("@")[0]; } catch {}
  return "Artist";
}

// GET /api/forum — list threads.
router.get("/", requireAuth, async (req, res) => {
  const threads = await db.listThreads();
  res.json({ threads });
});

// GET /api/forum/:id — one thread with its replies.
router.get("/:id", requireAuth, async (req, res) => {
  const thread = await db.getThread(Number(req.params.id));
  if (!thread) return res.status(404).json({ error: "Not found" });
  res.json({ thread });
});

// POST /api/forum — create a thread. { title, body }
router.post("/", requireAuth, async (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: "Title required" });
  const name = await displayName(req.user.id);
  const t = await db.addThread(req.user.id, name, title.trim().slice(0, 200), (body || "").slice(0, 5000));
  res.json(t);
});

// POST /api/forum/:id/reply — add a reply. { body }
router.post("/:id/reply", requireAuth, async (req, res) => {
  const { body } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: "Reply can't be empty" });
  const thread = await db.getThread(Number(req.params.id));
  if (!thread) return res.status(404).json({ error: "Thread not found" });
  const name = await displayName(req.user.id);
  const r = await db.addReply(Number(req.params.id), req.user.id, name, body.trim().slice(0, 5000));
  res.json(r);
});

// DELETE /api/forum/:id — delete own thread (or any, if owner).
router.delete("/:id", requireAuth, async (req, res) => {
  const u = await db.findById(req.user.id);
  await db.deleteThread(req.user.id, Number(req.params.id), isOwner(u));
  res.json({ ok: true });
});

export default router;
