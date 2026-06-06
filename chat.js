import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../middleware/auth.js";
import { db, PLAN_LIMITS } from "../store.js";
import { canUseAgent, canUseAgentInOrg, inTrial } from "../access.js";

const router = Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Each agent's persona lives on the SERVER, so it can't be tampered with.
const SYSTEM_PROMPTS = {
  anr: "You are Nora, an AI A&R and music career strategist. Advise artists on release strategy, audience growth, positioning, and honest creative direction. Be specific and practical. Be concise.",
  social: "You are Mia, an AI social media and fan-engagement manager for musicians. Plan release content, write captions in the artist's voice, and grow fan loyalty. Be punchy and concise.",
  booking: "You are Theo, an AI booking and gig-outreach agent. Find suitable venues/promoters, draft booking pitches, and help route tours sensibly. Be concise and practical.",
  legal: "You are Sol, an AI assistant for music royalties and contracts. Explain splits, royalties, and contract terms in plain language and flag risk. Always note you are not a substitute for a licensed music attorney. Be concise.",
  blog: "You are Remy, an AI writer for musicians. Draft press releases, artist bios, EPK copy, and playlist pitches in the artist's voice. Be polished and concise.",
  chat: "You are Cleo, a friendly 24/7 website chat widget for a musician or band. Answer fan questions (tour dates, releases, merch), handle venue and booking inquiries, capture contact info for leads, and escalate hot inquiries to the artist. Be warm, upbeat, and concise.",
  finance: "You are June, a financial literacy coach for musicians. Help with tour budgeting, understanding royalty and streaming income, planning for self-employment taxes, separating business and personal finances, and reading their numbers in plain English. Always note you are NOT a licensed financial advisor, accountant, or tax preparer, and recommend a qualified professional for filing, investment, or major decisions. Never give specific investment picks. Be practical and concise.",
  image: "You generate a single self-contained SVG image (viewBox 0 0 400 400) for music cover art / promo from the description. Use gradients, shapes, and typography tastefully. Respond with ONLY the raw <svg>...</svg> markup, no backticks, no explanation.",
};

// The image agent returns SVG markup; everyone else returns text.
const IMAGE_AGENT = "image";

// POST /api/chat  { agentId, messages:[{role,content}] }
router.post("/", requireAuth, async (req, res) => {
  const { agentId, messages } = req.body || {};
  const baseSystem = SYSTEM_PROMPTS[agentId];
  if (!baseSystem) return res.status(400).json({ error: "Unknown agentId" });
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages must be an array" });

  // Enforce plan/trial access for this agent (server-side gate, org-aware).
  const freshUser = await db.findById(req.user.id);
  const ownerUser = (freshUser?.orgId && freshUser.orgId !== freshUser.id)
    ? await db.findById(freshUser.orgId) : freshUser;
  if (!canUseAgentInOrg(freshUser, ownerUser, agentId)) {
    const reason = (freshUser?.plan === "trial" && !inTrial(freshUser))
      ? "Your free trial has ended. Upgrade to keep using your agents."
      : "This agent isn't included in your plan. Upgrade to unlock it.";
    return res.status(403).json({ error: reason, code: "plan_locked" });
  }

  // Enforce the monthly task limit for the user's plan.
  const used = await db.getUsage(req.user.id);
  const limit = PLAN_LIMITS[req.user.plan] ?? Object.values(PLAN_LIMITS)[0];
  if (used >= limit) {
    return res.status(402).json({ error: "Monthly task limit reached. Upgrade your plan." });
  }

  // Pull the artist's "brain" (notes + site content) and add it to the persona,
  // so every agent knows what the artist has taught Anthem about them.
  let system = baseSystem;
  try {
    const brain = await db.listBrain(req.user.id);
    if (brain.length) {
      const knowledge = brain.map(b => `• ${b.label || b.kind}: ${b.content}`).join("\n").slice(0, 8000);
      system += `\n\nThe artist has shared the following about themselves — use it to personalize everything:\n${knowledge}`;
    }
  } catch { /* brain optional */ }

  try {
    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });
    await db.incrementUsage(req.user.id);
    const raw = result.content.filter(b => b.type === "text").map(b => b.text).join("\n");

    if (agentId === IMAGE_AGENT) {
      const match = raw.match(/<svg[\s\S]*<\/svg>/i);
      return res.json({ svg: match ? match[0] : null, usage: { used: used + 1, limit } });
    }
    res.json({ text: raw, usage: { used: used + 1, limit } });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Upstream AI error" });
  }
});

export default router;
