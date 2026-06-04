import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const AYRSHARE_KEY = process.env.AYRSHARE_API_KEY;

// POST /api/social/post — publish a post on the artist's connected accounts.
// Body: { text, platforms?: ["instagram"], imageUrl? }
router.post("/post", requireAuth, async (req, res) => {
  const { text, platforms = ["instagram"], imageUrl } = req.body || {};
  if (!text && !imageUrl) return res.status(400).json({ error: "Nothing to post" });
  if (!AYRSHARE_KEY) {
    return res.status(503).json({ error: "Social posting isn't set up yet. Add AYRSHARE_API_KEY." });
  }
  try {
    const body = { post: text || "", platforms };
    // Instagram requires an image (or video). Attach if provided.
    if (imageUrl) body.mediaUrls = [imageUrl];
    const r = await fetch("https://api.ayrshare.com/api/post", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AYRSHARE_KEY}` },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok || data.status === "error") {
      return res.status(502).json({ error: data.message || "Post failed", detail: data });
    }
    res.json({ ok: true, result: data });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Could not reach the posting service." });
  }
});

// GET /api/social/link — returns a URL where the artist connects their socials.
// (Ayrshare's hosted linking page. In a single-account setup this links YOUR
//  Ayrshare profile; for many artists you'd use Ayrshare user profiles.)
router.get("/link", requireAuth, async (req, res) => {
  if (!AYRSHARE_KEY) return res.status(503).json({ error: "Not configured" });
  try {
    const r = await fetch("https://api.ayrshare.com/api/profiles/generateJWT", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AYRSHARE_KEY}` },
      body: JSON.stringify({}),
    });
    const data = await r.json();
    res.json({ url: data.url || "https://app.ayrshare.com" });
  } catch {
    res.json({ url: "https://app.ayrshare.com" });
  }
});

export default router;
