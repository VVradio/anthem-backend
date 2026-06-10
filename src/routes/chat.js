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
  booking: "You are Theo, an AI booking and gig-outreach agent. Find suitable venues/promoters, draft booking pitches, and help route tours sensibly. Be concise and practical. IMPORTANT: Whenever a specific booking, gig, show, or meeting gets confirmed or scheduled with a clear date (and ideally a time), end your message with a single hidden tag on its own line in EXACTLY this format: [[BOOKING]]{\"title\":\"...\",\"withWho\":\"...\",\"date\":\"YYYY-MM-DD\",\"time\":\"HH:MM\",\"notes\":\"...\"}[[/BOOKING]] — use 24-hour time, omit time if unknown, and only include this tag when there is a real date to add. Do not mention the tag to the user.",
  legal: "You are Sol, an AI assistant for music royalties and contracts. Explain splits, royalties, and contract terms in plain language and flag risk. Always note you are not a substitute for a licensed music attorney. Be concise.",
  blog: "You are Remy, an AI writer for musicians. Draft press releases, artist bios, EPK copy, and playlist pitches in the artist's voice. Be polished and concise.",
  chat: "You are Cleo, a friendly 24/7 website chat widget for a musician or band. Answer fan questions (tour dates, releases, merch), handle venue and booking inquiries, capture contact info for leads, and escalate hot inquiries to the artist. Be warm, upbeat, and concise.",
  finance: "You are June, a financial literacy coach for musicians. Help with tour budgeting, understanding royalty and streaming income, planning for self-employment taxes, separating business and personal finances, and reading their numbers in plain English. Always note you are NOT a licensed financial advisor, accountant, or tax preparer, and recommend a qualified professional for filing, investment, or major decisions. Never give specific investment picks. Be practical and concise.",
  image: "You generate a single self-contained SVG image (viewBox 0 0 400 400) for music cover art / promo from the description. Use gradients, shapes, and typography tastefully. Respond with ONLY the raw <svg>...</svg> markup, no backticks, no explanation.",
};

// The image agent returns SVG markup; everyone else returns text.
const IMAGE_AGENT = "image";

// Shared: build the system prompt (persona + the artist's brain) for an agent.
async function buildSystem(userId, agentId) {
  let system = SYSTEM_PROMPTS[agentId];
  try {
    const brain = await db.listBrain(userId);
    if (brain.length) {
      const knowledge = brain.map(b => `• ${b.label || b.kind}: ${b.content}`).join("\n").slice(0, 8000);
      system += `\n\nThe artist has shared the following about themselves — use it to personalize everything:\n${knowledge}`;
    }
  } catch { /* brain optional */ }
  return system;
}

// Shared: run access + limit checks. Returns {ok} or {status, body}.
async function checkAccess(req, agentId) {
  if (!SYSTEM_PROMPTS[agentId]) return { status: 400, body: { error: "Unknown agentId" } };
  const freshUser = await db.findById(req.user.id);
  const ownerUser = (freshUser?.orgId && freshUser.orgId !== freshUser.id)
    ? await db.findById(freshUser.orgId) : freshUser;
  if (!canUseAgentInOrg(freshUser, ownerUser, agentId)) {
    const reason = (freshUser?.plan === "trial" && !inTrial(freshUser))
      ? "Your free trial has ended. Upgrade to keep using your agents."
      : "This agent isn't included in your plan. Upgrade to unlock it.";
    return { status: 403, body: { error: reason, code: "plan_locked" } };
  }
  const used = await db.getUsage(req.user.id);
  const limit = PLAN_LIMITS[req.user.plan] ?? Object.values(PLAN_LIMITS)[0];
  if (used >= limit) return { status: 402, body: { error: "Monthly task limit reached. Upgrade your plan." } };
  return { ok: true, used, limit };
}

// Shared: actually call the model and return { text|svg }.
async function generate(userId, agentId, messages) {
  const system = await buildSystem(userId, agentId);
  const result = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });
  await db.incrementUsage(userId);
  const raw = result.content.filter(b => b.type === "text").map(b => b.text).join("\n");
  if (agentId === IMAGE_AGENT) {
    const match = raw.match(/<svg[\s\S]*<\/svg>/i);
    return { isSvg: true, value: match ? match[0] : null };
  }
  return { isSvg: false, value: raw };
}

// POST /api/chat  { agentId, messages } — synchronous (kept for compatibility).
router.post("/", requireAuth, async (req, res) => {
  const { agentId, messages } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages must be an array" });
  const access = await checkAccess(req, agentId);
  if (!access.ok) return res.status(access.status).json(access.body);
  try {
    const out = await generate(req.user.id, agentId, messages);
    const usage = { used: access.used + 1, limit: access.limit };
    if (out.isSvg) return res.json({ svg: out.value, usage });
    res.json({ text: out.value, usage });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "Upstream AI error" });
  }
});

// POST /api/chat/start { agentId, messages } — background mode.
// Returns a jobId immediately; the server keeps generating even if the user leaves.
router.post("/start", requireAuth, async (req, res) => {
  const { agentId, messages } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages must be an array" });
  const access = await checkAccess(req, agentId);
  if (!access.ok) return res.status(access.status).json(access.body);

  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db.createChatJob(jobId, req.user.id, agentId);
  // Respond right away — the work continues in the background.
  res.json({ jobId });

  // Fire-and-forget: generate, then save the result to the job.
  (async () => {
    try {
      const out = await generate(req.user.id, agentId, messages);
      await db.finishChatJob(jobId, { result: out.value, isSvg: out.isSvg });
    } catch (e) {
      console.error("Background chat job failed:", e?.message || e);
      await db.finishChatJob(jobId, { error: "Upstream AI error" });
    }
  })();
});

// GET /api/chat/job/:id — poll a background job's status/result.
router.get("/job/:id", requireAuth, async (req, res) => {
  const job = await db.getChatJob(req.user.id, req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// GET /api/chat/jobs — list recent jobs (to recover answers after returning).
router.get("/jobs/recent", requireAuth, async (req, res) => {
  const jobs = await db.listPendingJobs(req.user.id);
  res.json({ jobs });
});

export default router;
