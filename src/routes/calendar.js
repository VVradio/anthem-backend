// routes/calendar.js
//
// Social content calendar — a simple weekly planner, same pattern as bookings.js.
//
// Requires new db methods in store.js (see STEP2b_store_additions.js for the
// exact functions to add): listSocialPosts, addSocialPost, deleteSocialPost.

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";

const router = Router();

const VALID_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VALID_PLATFORMS = ["Instagram", "Facebook", "TikTok", "X", "LinkedIn", "YouTube"];

// GET /api/calendar — list this user's planned posts.
router.get("/", requireAuth, async (req, res) => {
  const posts = await db.listSocialPosts(req.user.id);
  res.json({ posts });
});

// POST /api/calendar — add a planned post. Body: { day, platform, postType, note }
router.post("/", requireAuth, async (req, res) => {
  const { day, platform, postType, note } = req.body || {};
  if (!VALID_DAYS.includes(day)) return res.status(400).json({ error: "Invalid day" });
  if (!VALID_PLATFORMS.includes(platform)) return res.status(400).json({ error: "Invalid platform" });
  if (!note?.trim()) return res.status(400).json({ error: "Note is required" });
  const row = await db.addSocialPost(req.user.id, {
    day,
    platform,
    postType: postType || "Post",
    note: note.trim().slice(0, 500),
  });
  res.json(row);
});

// DELETE /api/calendar/:id
router.delete("/:id", requireAuth, async (req, res) => {
  await db.deleteSocialPost(req.user.id, Number(req.params.id));
  res.json({ ok: true });
});

export default router;
