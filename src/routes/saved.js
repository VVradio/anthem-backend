import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";

const router = Router();

// GET /api/saved — list the user's saved items.
router.get("/", requireAuth, async (req, res) => {
  const items = await db.listSaved(req.user.id);
  res.json({ items });
});

// POST /api/saved — save an item. Body: { tool, text }
router.post("/", requireAuth, async (req, res) => {
  const { tool, text } = req.body || {};
  if (!text) return res.status(400).json({ error: "Nothing to save" });
  const item = await db.addSaved(req.user.id, tool || "Note", text);
  res.json({ item });
});

// DELETE /api/saved/:id — remove a saved item.
router.delete("/:id", requireAuth, async (req, res) => {
  const ok = await db.deleteSaved(req.user.id, Number(req.params.id));
  res.json({ deleted: ok });
});

export default router;
