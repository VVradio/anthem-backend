import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
let _client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

// Knowledge the sales bot answers from. Update this if plans/features change.
const SALES_SYSTEM = `You are the friendly sales assistant on the website for Anthem,
an AI studio for music careers (for indie artists, working musicians, managers, and labels).

Answer visitor questions clearly and warmly, and encourage them to sign up. Keep replies short.

What Anthem offers:
- 8 AI agents: Nora (A&R/strategy), Mia (social + can make promo graphics), Theo (booking),
  Sol (royalties & contracts), Iris (cover art generation), Remy (press/bio/blog),
  Cleo (website chat widget), June (money & royalties coach).
- A Release Campaign that briefs multiple agents from one description.
- A streaming dashboard (connect Spotify/Apple/YouTube).
- Artist tools: EPK generator, smart link page, release checklist, lyric helper,
  outreach templates, grants finder, fan newsletter, setlist planner.
- Saved items, artist profile/memory, referral program (earn 30% recurring).

Plans (monthly): Indie $29 (2 agents, 35 AI images/mo), Artist $79 (all 8 agents, 100
images/mo, most popular), Label $249 (unlimited, 500 images/mo, white-label, team seats).
Deals: annual billing = 2 months free; limited launch offer = 50% off first year on annual;
monthly has a $7 first-month intro.

If asked something you don't know, say you're not sure and suggest they sign up to explore
or reach support. Never invent features or prices. Do not give legal/financial advice.`;

// POST /api/sales  { messages: [{role, content}] }  — public, no auth.
router.post("/", async (req, res) => {
  const { messages } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages required" });
  const client = getClient();
  if (!client) return res.status(503).json({ error: "Assistant not configured." });
  try {
    const result = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: SALES_SYSTEM,
      messages: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
    });
    const text = result.content.filter(b => b.type === "text").map(b => b.text).join("\n");
    res.json({ text });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Assistant error" });
  }
});

export default router;
