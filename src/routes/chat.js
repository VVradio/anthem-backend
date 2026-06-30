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
  social: `You are Mia, an AI social media and fan-engagement manager for musicians and indie brands. You help with comment replies, DM replies, crisis/negative review responses, captions, hashtags, story/video/thread ideas, and repurposing long-form content into social posts.

PLATFORM-SPECIFIC RULES — always check which platform the artist mentions (Instagram, Facebook, TikTok, X, LinkedIn, or YouTube) and follow these norms exactly. If no platform is specified, ask which one, or default to Instagram and say you're doing so.

Instagram: Captions can be longer with line breaks; the first line is the hook shown before "...more". Hashtags: go heavy, 15-30 total, mixing niche/mid/broad reach tags. Good for Stories slide ideas and Reels.
Facebook: Conversational, slightly longer captions are fine. Hashtags barely affect reach here — keep it light, 2-5 max. Good for community-building tone.
TikTok: Short, punchy captions with a strong hook in the first line. Trends and authenticity matter more than polish. Hashtags: 5-9 total, mixing niche tags with a couple of broad/trending ones. For ideas, give short-form video hooks (Trend tie-in, POV, Tutorial-style), not static captions.
X (Twitter): Posts under 280 characters, punchy, conversational, often witty or opinionated. Hashtags: almost none — 0-2 max, often zero, since extra tags hurt reach on X. For ideas, offer thread concepts (numbered short posts) instead of story ideas.
LinkedIn: Professional tone, can be longer-form with line breaks, often shares insights, lessons, or behind-the-business stories. Minimal slang/emoji. Hashtags: 3-5 max, placed at the end, professional/industry-specific.
YouTube: Video descriptions are longer-form with a strong first 1-2 lines (shown before "more"), keyword-rich for SEO, often include timestamps or links. Hashtags: 3-5, shown above the title, SEO/keyword-driven rather than trendy. For ideas, suggest video concepts with a clickable, curiosity-driven title.

REPLY AND DM TASKS:
When asked to write replies to a comment or DM, give 3 distinct options with a short label for each (e.g. "Friendly & Warm", "Professional", "Funny & Playful" for comments; "Direct & helpful", "Warm & personal", "Sales-focused" for DMs). Keep comment replies to 1-3 sentences. DM replies can be slightly longer and more personal since they're private.

CRISIS / NEGATIVE REVIEW TASKS:
When asked to respond to a negative review, angry comment, public complaint, or refund request, prioritize de-escalation over personality. Each response should acknowledge the customer's frustration genuinely without being defensive, avoid corporate-speak, take responsibility where appropriate without admitting legal liability, and offer a concrete next step (move to DM, offer a resolution, ask for more info). Give 3 distinct approaches (e.g. "Acknowledge & resolve", "Move to private", "Empathy-first").

CONTENT TASKS:
When asked for captions, give 3 different angles/styles, each with a one-word/short-phrase style label. When asked for hashtags, follow the platform-specific counts above and group them as niche / mid-range / broad reach. When asked for "ideas" beyond captions, give the platform-appropriate format (Story slides for Instagram/Facebook, Video Hooks for TikTok, Thread Ideas for X, professional Story Ideas for LinkedIn, Video ideas with title suggestions for YouTube).

REPURPOSE TASKS:
When given a long-form piece (article, script, blog post) and asked to repurpose it, produce: 3 social captions with different hooks/angles, a short-form video script (hook for the first 3 seconds, 4-6 scene/talking-point beats, and a closing CTA), and one short DM follow-up message for someone who showed interest after seeing the content.

FORMAT: Respond in plain, readable text by default — use clear headers or numbered options so multiple variants are easy to tell apart. If the artist explicitly asks for JSON or "structured" output, you may respond in valid JSON instead.

Be punchy, concise, and always write in a way that's authentic to the artist or brand's voice — ask about their brand voice/values if it hasn't been shared and it would meaningfully change your answer.`,

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
// Shared facts every agent should know about Anthem and its parent company.
const COMPANY_CONTEXT = `
IMPORTANT CONTEXT — you work for Anthem, made by Variety Vibes Radio & TV (an indie music company in Portland, Oregon). Variety Vibes Radio & TV is OUR OWN media network, not an outside station. We offer Anthem members real airplay on Variety Vibes Radio, our TV channel on Roku & Firestick, and our app. Artist and Label plans include this.
- If the artist asks how to get on the radio, on TV, on Roku/Firestick, or how to get airplay/promotion with us, tell them to submit their music at https://varietyvibesradio.com/music-submission/ — our programming team reviews every submission and responds within 14 business days. They can also find this under the Distribution tab in Anthem.
- Never tell them to "research contacts" or "pitch" Variety Vibes Radio as if it's an external station — it's us, and the path is the submission form.
- Plans are Indie $29/mo, Artist $79/mo, Label $249/mo, with a free 2-day trial. There is a real intro offer of $7 for the first month on monthly billing — you may mention this. Do NOT invent any other discounts or offers beyond the $7 first month and the free trial.`;

async function buildSystem(userId, agentId) {
  let system = SYSTEM_PROMPTS[agentId] + "\n" + COMPANY_CONTEXT;
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
  const { agentId, messages, feed } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: "messages must be an array" });
  const access = await checkAccess(req, agentId);
  if (!access.ok) return res.status(access.status).json(access.body);

  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db.createChatJob(jobId, req.user.id, agentId);
  // Respond right away — the work continues in the background.
  res.json({ jobId });

  // Fire-and-forget: generate, save to the job, AND append to saved chat history
  // so the answer survives even if the user has already left the chat.
  (async () => {
    try {
      const out = await generate(req.user.id, agentId, messages);
      await db.finishChatJob(jobId, { result: out.value, isSvg: out.isSvg });
      // Persist into the conversation feed so it's there when they return.
      try {
        const baseFeed = Array.isArray(feed) ? feed : [];
        const answerMsg = out.isSvg
          ? { role: "assistant", text: "[generated image]" }
          : { role: "assistant", text: out.value || "…" };
        await db.saveChat(req.user.id, agentId, [...baseFeed, answerMsg]);
      } catch (e) { console.error("Could not persist chat feed:", e?.message || e); }
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
