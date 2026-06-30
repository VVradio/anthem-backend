import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";

const router = Router();
const SEAT_PRICE = 10; // dollars per seat / month

// GET /api/team — list members + pending invites for the caller's org.
router.get("/", requireAuth, async (req, res) => {
  const me = await db.findById(req.user.id);
  const orgId = me?.orgId || me?.id;
  const [members, invites] = await Promise.all([db.getOrgMembers(orgId), db.getInvites(orgId)]);
  res.json({
    orgId,
    isOwner: orgId === me.id,
    members,
    invites: invites.filter(i => i.status === "pending"),
    seatPrice: SEAT_PRICE,
  });
});

// POST /api/team/invite { email } — owner invites a teammate.
router.post("/invite", requireAuth, async (req, res) => {
  const me = await db.findById(req.user.id);
  const orgId = me?.orgId || me?.id;
  if (orgId !== me.id) return res.status(403).json({ error: "Only the team owner can invite members." });
  const email = (req.body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return res.status(400).json({ error: "Enter a valid email." });
  const invite = await db.addInvite(orgId, email);
  // NOTE: emailing the invite would happen here (needs an email service).
  res.json({ ok: true, invite, note: "They'll join your team automatically when they sign up with this email." });
});

// DELETE /api/team/invite/:id — cancel a pending invite.
router.delete("/invite/:id", requireAuth, async (req, res) => {
  const me = await db.findById(req.user.id);
  const orgId = me?.orgId || me?.id;
  if (orgId !== me.id) return res.status(403).json({ error: "Only the team owner can manage invites." });
  await db.removeInvite(orgId, Number(req.params.id));
  res.json({ ok: true });
});

// DELETE /api/team/member/:id — remove a member from the team.
router.delete("/member/:id", requireAuth, async (req, res) => {
  const me = await db.findById(req.user.id);
  const orgId = me?.orgId || me?.id;
  if (orgId !== me.id) return res.status(403).json({ error: "Only the team owner can remove members." });
  const ok = await db.removeMember(orgId, Number(req.params.id));
  res.json({ ok });
});

export default router;
