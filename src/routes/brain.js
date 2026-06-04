import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";

const router = Router();

// GET /api/brain — list the artist's brain items.
router.get("/", requireAuth, async (req, res) => {
  const items = await db.listBrain(req.user.id);
  res.json({ items });
});

// POST /api/brain — add a note or a website link.
// Body: { kind: "note"|"link", label, content }  (for links, content = URL)
router.post("/", requireAuth, async (req, res) => {
  const { kind = "note", label, content } = req.body || {};
  if (!content) return res.status(400).json({ error: "Content is required" });

  let stored = content;
  let finalLabel = label;

  if (kind === "link") {
    // Fetch the page and extract readable text so agents can "read" the site.
    try {
      const url = content.startsWith("http") ? content : `https://${content}`;
      const r = await fetch(url, { headers: { "User-Agent": "AnthemBot/1.0" }, signal: AbortSignal.timeout(8000) });
      const html = await r.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000); // cap so we don't bloat agent context
      stored = `From ${url}:\n${text}`;
      if (!finalLabel) finalLabel = url;
    } catch {
      stored = `Link (couldn't fetch content): ${content}`;
      if (!finalLabel) finalLabel = content;
    }
  }

  const item = await db.addBrain(req.user.id, kind, finalLabel || "Note", stored);
  res.json({ item });
});

// DELETE /api/brain/:id
router.delete("/:id", requireAuth, async (req, res) => {
  const ok = await db.deleteBrain(req.user.id, Number(req.params.id));
  res.json({ deleted: ok });
});

export default router;
