import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";

const router = Router();

// GET /api/bookings — list the user's bookings.
router.get("/", requireAuth, async (req, res) => {
  const items = await db.listBookings(req.user.id);
  res.json({ bookings: items });
});

// POST /api/bookings — add a booking.
router.post("/", requireAuth, async (req, res) => {
  const { title, withWho, startsAt, endsAt, notes, meetLink } = req.body || {};
  if (!title || !startsAt) return res.status(400).json({ error: "Title and start time are required." });
  const row = await db.addBooking(req.user.id, { title, withWho, startsAt, endsAt, notes, meetLink });
  res.json(row);
});

// DELETE /api/bookings/:id
router.delete("/:id", requireAuth, async (req, res) => {
  await db.deleteBooking(req.user.id, Number(req.params.id));
  res.json({ ok: true });
});

export default router;
