import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
// Shared workspace: items live under the org id (own id for solo users).
import { db } from "../store.js";

const router = Router();

// Resolve the caller's workspace id (their org, or themselves if solo).
async function orgIdOf(req) {
  const u = await db.findById(req.user.id);
  return u?.orgId || u?.id || req.user.id;
}

// GET /api/saved — list the user's saved items.
router.get("/", requireAuth, async (req, res) => {
  const items = await db.listSaved(await orgIdOf(req));
  res.json({ items });
});

// POST /api/saved — save an item. Body: { tool, text }
router.post("/", requireAuth, async (req, res) => {
  const { tool, text } = req.body || {};
  if (!text) return res.status(400).json({ error: "Nothing to save" });
  const item = await db.addSaved(await orgIdOf(req), tool || "Note", text);
  res.json({ item });
});

// DELETE /api/saved/:id — remove a saved item.
router.delete("/:id", requireAuth, async (req, res) => {
  const ok = await db.deleteSaved(await orgIdOf(req), Number(req.params.id));
  res.json({ deleted: ok });
});

export default router;
