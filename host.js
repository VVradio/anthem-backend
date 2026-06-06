import { Router } from "express";
import express from "express";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(express.json({ limit: "12mb" }));

const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
const sb = useSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;
const BUCKET = "anthem-images";

// POST /api/host/image  { dataUrl }  -> { url }
// Uploads a data-URL image to Supabase Storage and returns a public URL,
// which social platforms (Instagram/Facebook/etc.) require for image posts.
router.post("/image", requireAuth, async (req, res) => {
  const { dataUrl } = req.body || {};
  if (!dataUrl) return res.status(400).json({ error: "No image provided" });
  if (!sb) return res.status(503).json({ error: "Image hosting needs Supabase configured." });
  try {
    const [meta, b64] = dataUrl.split(",");
    const mime = (meta.match(/data:(.*?);/) || [])[1] || "image/png";
    const ext = mime.split("/")[1] || "png";
    const bytes = Buffer.from(b64, "base64");
    const path = `${req.user.id}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: true });
    if (error) return res.status(502).json({ error: error.message });
    const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
    res.json({ url: data.publicUrl });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Could not host image." });
  }
});

export default router;
