import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../store.js";

const router = Router();

// GET /api/history — list all of the user's conversations (for the History viewer).
router.get("/", requireAuth, async (req, res) => {
  const chats = await db.listChats(req.user.id);
  res.json({ chats });
});

// GET /api/history/:agentId — load saved conversation for one agent.
router.get("/:agentId", requireAuth, async (req, res) => {
  const messages = await db.getChat(req.user.id, req.params.agentId);
  res.json({ messages });
});

// PUT /api/history/:agentId — save the conversation. Body: { messages }
router.put("/:agentId", requireAuth, async (req, res) => {
  const { messages } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages must be an array" });
  await db.saveChat(req.user.id, req.params.agentId, messages);
  res.json({ ok: true });
});

// DELETE /api/history/:agentId — clear the conversation.
router.delete("/:agentId", requireAuth, async (req, res) => {
  await db.clearChat(req.user.id, req.params.agentId);
  res.json({ ok: true });
});

export default router;
