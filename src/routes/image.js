import { Router } from "express";
import OpenAI from "openai";
import { requireAuth } from "../middleware/auth.js";
import { db, IMAGE_LIMITS } from "../store.js";

const router = Router();

// Lazily create the client so a missing key doesn't crash the server at boot.
let _openai = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// GET /api/image/quota — how many images the user has left this month.
router.get("/quota", requireAuth, async (req, res) => {
  const used = await db.getImageUsage(req.user.id);
  const limit = IMAGE_LIMITS[req.user.plan] ?? IMAGE_LIMITS.indie;
  res.json({ used, limit, remaining: Math.max(0, limit - used) });
});

// POST /api/image — generate a real image. Body: { prompt, size?, quality? }
router.post("/", requireAuth, async (req, res) => {
  const { prompt, size = "1024x1024", quality = "medium" } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "A prompt is required" });

  // Enforce the monthly image cap for the user's plan.
  const used = await db.getImageUsage(req.user.id);
  const limit = IMAGE_LIMITS[req.user.plan] ?? IMAGE_LIMITS.indie;
  if (used >= limit) {
    return res.status(402).json({ error: `Monthly image limit reached (${limit}). Upgrade your plan for more.` });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "Image generation not configured. Add OPENAI_API_KEY." });
  }

  try {
    const openai = getOpenAI();
    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size,
      quality,
      n: 1,
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error: "No image was generated." });
    await db.incrementImageUsage(req.user.id);
    const newUsed = used + 1;
    // Return as a data URL the frontend can show directly.
    res.json({
      image: `data:image/png;base64,${b64}`,
      usage: { used: newUsed, limit, remaining: Math.max(0, limit - newUsed) },
    });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Image generation failed." });
  }
});

export default router;
