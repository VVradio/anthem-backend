import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";
import { sendEmail } from "../email.js";

const router = Router();
const emailOk = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || "");

// GET /api/fans — list this artist's fans + their public signup code.
router.get("/", requireAuth, async (req, res) => {
  const fans = await db.listFans(req.user.id);
  let code = await db.getFanCode(req.user.id);
  if (!code) { code = crypto.randomBytes(5).toString("hex"); await db.setFanCode(req.user.id, code); }
  res.json({ fans, fanCode: code });
});

// POST /api/fans — add a fan manually.
router.post("/", requireAuth, async (req, res) => {
  const { name, email } = req.body || {};
  if (!emailOk(email)) return res.status(400).json({ error: "Valid email required" });
  const r = await db.addFan(req.user.id, { name, email, source: "manual" });
  if (r.duplicate) return res.status(409).json({ error: "That fan is already on your list." });
  res.json(r);
});

// DELETE /api/fans/:id
router.delete("/:id", requireAuth, async (req, res) => {
  await db.deleteFan(req.user.id, Number(req.params.id));
  res.json({ ok: true });
});

// POST /api/fans/blast { subject, message } — email all fans.
router.post("/blast", requireAuth, async (req, res) => {
  const { subject, message } = req.body || {};
  if (!subject || !message) return res.status(400).json({ error: "Subject and message required" });
  const fans = await db.listFans(req.user.id);
  if (!fans.length) return res.status(400).json({ error: "No fans to email yet." });
  const safe = String(message).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  let sent = 0;
  for (const f of fans) {
    const html = `<div style="font-family:system-ui,sans-serif;max-width:540px;margin:0 auto;color:#1f1a16;line-height:1.6">
      ${safe}
      <p style="color:#6b6258;font-size:12px;margin-top:24px">You're receiving this because you joined the mailing list. To stop receiving emails, reply with "unsubscribe".</p>
    </div>`;
    const r = await sendEmail(f.email, subject, html);
    if (r?.ok) sent++;
  }
  res.json({ ok: true, sent, total: fans.length });
});

// PUBLIC: GET /api/fans/page/:code — who is this signup page for (artist name lookup).
router.get("/page/:code", async (req, res) => {
  const u = await db.findUserByFanCode(req.params.code);
  if (!u) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

// PUBLIC: POST /api/fans/join/:code — a fan signs up via the artist's public link.
router.post("/join/:code", async (req, res) => {
  const u = await db.findUserByFanCode(req.params.code);
  if (!u) return res.status(404).json({ error: "Not found" });
  const { name, email } = req.body || {};
  if (!emailOk(email)) return res.status(400).json({ error: "Please enter a valid email." });
  await db.addFan(u.id, { name, email, source: "signup" });
  res.json({ ok: true });
});

export default router;
