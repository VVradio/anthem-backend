import React, { useState, useRef, useEffect } from "react";
import {
  Disc3, Users2, Megaphone, MapPin, Scale, ImageIcon, PenLine,
  LayoutDashboard, Gift, Check, ArrowRight, Send, Sparkles, Music2,
  TrendingUp, Calendar, DollarSign, Activity, Cpu, Copy, Headphones, Mic2,
  MessageCircle, Wallet, UserCircle, Rocket, Loader2, BarChart3, Music, Link2,
  FileText, Link as LinkIcon, ListChecks, PenTool, Inbox, Award, Mail as MailIcon,
  ListMusic, Wrench, ArrowLeft, Clock, CalendarPlus, Download, X, Brain, Lock,
  SlidersHorizontal, Trash2, CalendarDays, Video
} from "lucide-react";

// Agent portrait images (bundled). Drop these files into src/assets/agents/.
// If a file is missing, the UI falls back to the agent's icon.
import imgNora from "./assets/agents/nora.webp";
import imgMia from "./assets/agents/mia.webp";
import imgTheo from "./assets/agents/theo.webp";
import imgSol from "./assets/agents/sol.webp";
import imgIris from "./assets/agents/iris.webp";
import imgRemy from "./assets/agents/remy.webp";
import imgCleo from "./assets/agents/cleo.webp";
import imgJune from "./assets/agents/june.webp";
import anthemLogo from "./assets/anthem-logo.webp";
const AGENT_IMG = {
  anr: imgNora, social: imgMia, booking: imgTheo, legal: imgSol,
  image: imgIris, blog: imgRemy, chat: imgCleo, finance: imgJune,
};

/* ============================ THEME — clean & indie, warm ============================ */
const C = {
  paper: "#faf6f0", cream: "#fffdf9", card: "#ffffff",
  ink: "#1f1a16", soft: "#6b6258", line: "#ece3d6",
  rust: "#c2542d", clay: "#d98b4a", sage: "#7b8b6f",
  plum: "#7a5c74", teal: "#3f7d78", gold: "#b8893f",
};
const FONT_DISPLAY = `"Fraunces", Georgia, serif`;
const FONT_BODY = `"Inter", system-ui, sans-serif`;

/* ============================ BACKEND WIRING ============================
 * Set API_BASE to your deployed backend (e.g. "https://api.anthem.fm").
 * When it's set, the app logs in and routes every agent call through your
 * server (where the AI key lives). When it's left empty — like in this
 * preview — the app falls back to a direct demo call so you can still try it.
 * ----------------------------------------------------------------------- */
const API_BASE = import.meta.env.VITE_API_BASE || ""; // set VITE_API_BASE in your host to go live

const api = {
  live: () => !!API_BASE,
  async signup(email, password, referralCode) {
    const r = await fetch(`${API_BASE}/api/auth/signup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, referralCode }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Signup failed");
    return r.json();
  },
  async login(email, password) {
    const r = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Login failed");
    return r.json();
  },
  async me(token) {
    const r = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not fetch account");
    return r.json(); // { user }
  },
  async chat(token, agentId, messages) {
    const r = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ agentId, messages }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Chat failed");
    return r.json(); // { text } or { svg }
  },
  async chatStart(token, agentId, messages) {
    const r = await fetch(`${API_BASE}/api/chat/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ agentId, messages }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Chat failed");
    return r.json(); // { jobId }
  },
  async chatJob(token, jobId) {
    const r = await fetch(`${API_BASE}/api/chat/job/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Job not found");
    return r.json(); // { status, result, isSvg, error }
  },
  // Start a background job and poll until it finishes. The answer is generated
  // server-side, so it completes even if the user navigates away mid-request.
  async chatBackground(token, agentId, messages, { onJobId } = {}) {
    const { jobId } = await this.chatStart(token, agentId, messages);
    if (onJobId) onJobId(jobId);
    // Poll up to ~3 min.
    for (let i = 0; i < 180; i++) {
      await new Promise(r => setTimeout(r, 1000));
      let job;
      try { job = await this.chatJob(token, jobId); } catch { continue; }
      if (job.status === "done") return job.isSvg ? { svg: job.result } : { text: job.result };
      if (job.status === "error") throw new Error(job.error || "Chat failed");
    }
    throw new Error("Timed out");
  },
  async streams(token) {
    const r = await fetch(`${API_BASE}/api/streams`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error((await r.json()).error || "Streams failed");
    return r.json();
  },
  async listSaved(token) {
    const r = await fetch(`${API_BASE}/api/saved`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not load saved items");
    return r.json();
  },
  async addSaved(token, tool, text) {
    const r = await fetch(`${API_BASE}/api/saved`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tool, text }),
    });
    if (!r.ok) throw new Error("Could not save");
    return r.json();
  },
  async deleteSaved(token, id) {
    const r = await fetch(`${API_BASE}/api/saved/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error("Could not delete");
    return r.json();
  },
  async generateImage(token, prompt, size = "1024x1024") {
    const r = await fetch(`${API_BASE}/api/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt, size }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Image generation failed");
    return r.json(); // { image, usage }
  },
  async checkout(token, plan, cycle) {
    const r = await fetch(`${API_BASE}/api/billing/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan, cycle }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Checkout failed");
    return r.json(); // { url }
  },
  async sales(messages) {
    const r = await fetch(`${API_BASE}/api/sales`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Assistant unavailable");
    return r.json(); // { text }
  },
  async listBrain(token) {
    const r = await fetch(`${API_BASE}/api/brain`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not load brain");
    return r.json();
  },
  async addBrain(token, kind, label, content) {
    const r = await fetch(`${API_BASE}/api/brain`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kind, label, content }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Could not add");
    return r.json();
  },
  async deleteBrain(token, id) {
    const r = await fetch(`${API_BASE}/api/brain/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error("Could not delete");
    return r.json();
  },
  async extract(token, name, type, dataBase64) {
    const r = await fetch(`${API_BASE}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, type, dataBase64 }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Couldn't read file");
    return r.json(); // { text }
  },
  async getHistory(token, agentId) {
    const r = await fetch(`${API_BASE}/api/history/${agentId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not load history");
    return r.json(); // { messages }
  },
  async listHistory(token) {
    const r = await fetch(`${API_BASE}/api/history`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not load history");
    return r.json(); // { chats }
  },
  async saveHistory(token, agentId, messages) {
    const r = await fetch(`${API_BASE}/api/history/${agentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages }),
    });
    if (!r.ok) throw new Error("Could not save history");
    return r.json();
  },
  async clearHistory(token, agentId) {
    const r = await fetch(`${API_BASE}/api/history/${agentId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) throw new Error("Could not clear history");
    return r.json();
  },
  async socialPost(token, text, platforms, imageUrl) {
    const r = await fetch(`${API_BASE}/api/social/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text, platforms, imageUrl }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Post failed");
    return r.json();
  },
  async hostImage(token, dataUrl) {
    const r = await fetch(`${API_BASE}/api/host/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ dataUrl }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Could not host image");
    return r.json(); // { url }
  },
  async getTeam(token) {
    const r = await fetch(`${API_BASE}/api/team`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not load team");
    return r.json();
  },
  async inviteTeam(token, email) {
    const r = await fetch(`${API_BASE}/api/team/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Could not invite");
    return r.json();
  },
  async cancelInvite(token, id) {
    const r = await fetch(`${API_BASE}/api/team/invite/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not cancel invite");
    return r.json();
  },
  async removeMember(token, id) {
    const r = await fetch(`${API_BASE}/api/team/member/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not remove member");
    return r.json();
  },
  async buySeats(token, quantity) {
    const r = await fetch(`${API_BASE}/api/billing/seats`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ quantity }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Could not start seat checkout");
    return r.json(); // { url }
  },
  async requestFeature(token, text) {
    const r = await fetch(`${API_BASE}/api/features`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Could not submit");
    return r.json();
  },
  async getReferrals(token) {
    const r = await fetch(`${API_BASE}/api/referral`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not load referrals");
    return r.json();
  },
  async forgotPassword(email) {
    const r = await fetch(`${API_BASE}/api/auth/forgot`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return r.json();
  },
  async resetPassword(token, password) {
    const r = await fetch(`${API_BASE}/api/auth/reset`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Could not reset");
    return r.json();
  },
  async adminUsers(token) {
    const r = await fetch(`${API_BASE}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error((await r.json()).error || "Could not load");
    return r.json();
  },
  async adminSetPlan(token, id, plan) {
    const r = await fetch(`${API_BASE}/api/admin/user/${id}/plan`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plan }),
    });
    if (!r.ok) throw new Error((await r.json()).error || "Could not update");
    return r.json();
  },
  async adminDeleteUser(token, id) {
    const r = await fetch(`${API_BASE}/api/admin/user/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error((await r.json()).error || "Could not delete");
    return r.json();
  },
  async cancelPlan(token) {
    const r = await fetch(`${API_BASE}/api/billing/cancel`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error((await r.json()).error || "Could not cancel");
    return r.json();
  },
  async billingPortal(token) {
    const r = await fetch(`${API_BASE}/api/billing/portal`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error((await r.json()).error || "Could not open billing");
    return r.json();
  },
  async listBookings(token) {
    const r = await fetch(`${API_BASE}/api/bookings`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not load bookings");
    return r.json();
  },
  async addBooking(token, b) {
    const r = await fetch(`${API_BASE}/api/bookings`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(b) });
    if (!r.ok) throw new Error((await r.json()).error || "Could not add booking");
    return r.json();
  },
  async deleteBooking(token, id) {
    const r = await fetch(`${API_BASE}/api/bookings/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not delete");
    return r.json();
  },
  async getSettings(token) {
    const r = await fetch(`${API_BASE}/api/settings`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not load settings");
    return r.json();
  },
  async saveSettings(token, s) {
    const r = await fetch(`${API_BASE}/api/settings`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(s) });
    if (!r.ok) throw new Error("Could not save settings");
    return r.json();
  },
  async publishEpk(token, data) {
    const r = await fetch(`${API_BASE}/api/epk/publish`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data }) });
    if (!r.ok) throw new Error((await r.json()).error || "Could not publish");
    return r.json(); // { shareCode }
  },
  async getEpk(code) {
    const r = await fetch(`${API_BASE}/api/epk/${code}`);
    if (!r.ok) throw new Error("Not found");
    return r.json(); // { data }
  },
  async listReleases(token) {
    const r = await fetch(`${API_BASE}/api/royalties`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not load");
    return r.json();
  },
  async addRelease(token, rel) {
    const r = await fetch(`${API_BASE}/api/royalties`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(rel) });
    if (!r.ok) throw new Error("Could not add");
    return r.json();
  },
  async updateRelease(token, id, patch) {
    const r = await fetch(`${API_BASE}/api/royalties/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch) });
    if (!r.ok) throw new Error("Could not update");
    return r.json();
  },
  async deleteRelease(token, id) {
    const r = await fetch(`${API_BASE}/api/royalties/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not delete");
    return r.json();
  },
  async shareRelease(token, id) {
    const r = await fetch(`${API_BASE}/api/royalties/${id}/share`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not share");
    return r.json();
  },
  async getSplitSheet(code) {
    const r = await fetch(`${API_BASE}/api/royalties/sheet/${code}`);
    if (!r.ok) throw new Error("Not found");
    return r.json();
  },
  async listFans(token) {
    const r = await fetch(`${API_BASE}/api/fans`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not load");
    return r.json();
  },
  async addFan(token, name, email) {
    const r = await fetch(`${API_BASE}/api/fans`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, email }) });
    if (!r.ok) throw new Error((await r.json()).error || "Could not add");
    return r.json();
  },
  async deleteFan(token, id) {
    const r = await fetch(`${API_BASE}/api/fans/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not delete");
    return r.json();
  },
  async blastFans(token, subject, message) {
    const r = await fetch(`${API_BASE}/api/fans/blast`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subject, message }) });
    if (!r.ok) throw new Error((await r.json()).error || "Could not send");
    return r.json();
  },
  async joinFanList(code, name, email) {
    const r = await fetch(`${API_BASE}/api/fans/join/${code}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }) });
    if (!r.ok) throw new Error((await r.json()).error || "Could not join");
    return r.json();
  },
  async fanPage(code) {
    const r = await fetch(`${API_BASE}/api/fans/page/${code}`);
    if (!r.ok) throw new Error("Not found");
    return r.json();
  },
  async listSync(token) {
    const r = await fetch(`${API_BASE}/api/sync`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not load");
    return r.json();
  },
  async addSync(token, title, data) {
    const r = await fetch(`${API_BASE}/api/sync`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, data }) });
    if (!r.ok) throw new Error("Could not add");
    return r.json();
  },
  async updateSync(token, id, patch) {
    const r = await fetch(`${API_BASE}/api/sync/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch) });
    if (!r.ok) throw new Error("Could not update");
    return r.json();
  },
  async deleteSync(token, id) {
    const r = await fetch(`${API_BASE}/api/sync/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error("Could not delete");
    return r.json();
  },
};

// Fallback used only when no backend is configured (keeps the preview working).
async function directCall(system, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1500, system,
      messages: messages.map(m => ({ role: m.role, content: m.content })) }),
  });
  const data = await res.json();
  return data.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "";
}

const MODELS = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", vendor: "Anthropic" },
  { id: "gpt-class", label: "GPT-class", vendor: "OpenAI" },
  { id: "gemini-class", label: "Gemini-class", vendor: "Google" },
  { id: "llama-class", label: "Llama-class", vendor: "Meta / open" },
];

const AGENTS = [
  { id: "anr", name: "Nora", role: "A&R · Career Strategist", icon: Disc3, color: C.rust, model: "claude-sonnet-4-20250514",
    blurb: "Maps your release strategy, spots growth opportunities, and gives honest feedback on your direction.",
    sample: "Your last two singles leaned bedroom-pop but your streams spike on the upbeat tracks. I'd lead the next release with the high-energy single and stagger two slower B-sides. Want a 6-week rollout plan?" },
  { id: "social", name: "Mia", role: "Social & Fan Engagement", icon: Megaphone, color: C.plum, model: "gpt-class",
    blurb: "Plans content around your releases, writes captions in your voice, and keeps your fanbase warm between drops.",
    sample: "Release week plan ready: teaser Tuesday, snippet reel Thursday, drop-day countdown, and a fan Q&A Saturday. Want me to draft the caption for the snippet reel?" },
  { id: "booking", name: "Theo", role: "Booking & Gig Outreach", icon: MapPin, color: C.teal, model: "claude-sonnet-4-20250514",
    blurb: "Finds venues and promoters, drafts booking pitches, and helps route a tour that actually makes sense.",
    sample: "Found 8 venues that fit your draw (200–400 cap) along the I-95 corridor. Drafted a booking pitch with your stats and EPK link. Want me to tailor it per venue?" },
  { id: "legal", name: "Sol", role: "Royalties & Contracts", icon: Scale, color: C.gold, model: "claude-sonnet-4-20250514",
    blurb: "Explains splits, reviews contracts in plain language, and flags terms that could cost you down the line.",
    sample: "Reviewed the distribution deal. The 30% commission is high and the term auto-renews for 3 years. Recommend negotiating to 15% and a 1-year term. Not legal advice — run it by a music attorney too." },
  { id: "image", name: "Iris", role: "Cover Art & Promo", icon: ImageIcon, color: C.clay, model: "gemini-class",
    blurb: "Generates single covers, promo graphics, and social visuals from a description, in your aesthetic.",
    sample: "Describe the mood and I'll make a cover — e.g. \"moody analog single cover, warm grain, lone figure under a streetlight, muted oranges.\"" },
  { id: "blog", name: "Remy", role: "Press · Bio · Blog", icon: PenLine, color: C.sage, model: "claude-sonnet-4-20250514",
    blurb: "Writes press releases, artist bios, and EPK copy that sound like you — ready to send to blogs and playlists.",
    sample: "Give me the release details and a few facts about you, and I'll draft a press release, a short bio, and a playlist pitch. What are we announcing?" },
  { id: "chat", name: "Cleo", role: "Website Chat Widget", icon: MessageCircle, color: C.teal, model: "claude-sonnet-4-20250514",
    blurb: "A 24/7 chatbot for your site — answers fan FAQs, handles venue/booking inquiries, and captures leads while you sleep.",
    sample: "Hey! I'm the chat widget that lives on your site. Fans ask me about tour dates, merch, and releases; venues ask about booking. I capture their info and hand the hot ones to you. (Voice-call version coming as you scale.)" },
  { id: "finance", name: "June", role: "Money & Royalties Coach", icon: Wallet, color: C.gold, model: "claude-sonnet-4-20250514",
    blurb: "Helps you budget tours, make sense of royalty income, plan for taxes, and understand your numbers — in plain English.",
    sample: "Let's make your money make sense. I can budget a tour, break down where your streaming income comes from, or explain what to set aside for taxes. Heads up: I'm a financial literacy coach, not a licensed advisor — take big decisions to a real accountant. What are we looking at?" },
];

// Round agent portrait with graceful fallback to the lucide icon.
function AgentAvatar({ agent, size = 40, radius }) {
  const [failed, setFailed] = useState(false);
  const src = AGENT_IMG[agent.id];
  const r = radius != null ? radius : Math.round(size / 4);
  if (src && !failed) {
    return (
      <img src={src} alt={agent.name} onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: r, objectFit: "cover",
          border: `1px solid ${agent.color}55`, display: "block" }} />
    );
  }
  const Icon = agent.icon;
  return (
    <div style={{ width: size, height: size, borderRadius: r, background: `${agent.color}1a`,
      border: `1px solid ${agent.color}40`, display: "grid", placeItems: "center" }}>
      <Icon size={Math.round(size * 0.5)} color={agent.color} />
    </div>
  );
}
const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "twitter", label: "X (Twitter)" },
  { id: "tiktok", label: "TikTok" },
  { id: "threads", label: "Threads" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "youtube", label: "YouTube" },
];

// Which agents each plan unlocks. Indie = first 2; Artist/Label = all.
const PLAN_AGENTS = {
  indie: ["anr", "social"],
  artist: ["anr", "social", "booking", "legal", "image", "blog", "chat", "finance"],
  label: ["anr", "social", "booking", "legal", "image", "blog", "chat", "finance"],
};
const TRIAL_DAYS = 2;
// Is a new (trial) user still inside their free window?
function inTrial(user) {
  if (!user?.createdAt) return false;
  const t = new Date(user.createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < TRIAL_DAYS * 24 * 60 * 60 * 1000;
}
// Days left in trial (0 if none / expired).
function trialDaysLeft(user) {
  if (!user?.createdAt) return 0;
  const t = new Date(user.createdAt).getTime();
  const left = TRIAL_DAYS * 24 * 60 * 60 * 1000 - (Date.now() - t);
  return left > 0 ? Math.ceil(left / (24 * 60 * 60 * 1000)) : 0;
}
function planAllows(plan, agentId, user) {
  if (plan === "trial") return inTrial(user); // trial = everything for 2 days, then nothing
  return (PLAN_AGENTS[plan] || PLAN_AGENTS.indie).includes(agentId);
}

const PLANS = [
  { name: "Indie", id: "indie", price: 29, tag: "Solo & emerging artists", accent: C.teal,
    features: ["2 active agents", "35 AI images / mo", "Website chat widget", "Email support"] },
  { name: "Artist", id: "artist", price: 79, tag: "Working musicians", accent: C.rust, popular: true,
    features: ["All 8 agents", "100 AI images / mo", "Booking & press outreach", "Royalty & contract review", "Referral rewards 2x"] },
  { name: "Label", id: "label", price: 249, tag: "Managers, labels & studios", accent: C.plum,
    features: ["Unlimited artists & agents", "500 AI images / mo", "White-label dashboard", "Team seats", "Dedicated success manager"] },
];

// ---- Promotions ----
// Flip LAUNCH_PROMO to false to turn off the 50%-off-first-year launch banner.
const LAUNCH_PROMO = true;
const LAUNCH_PROMO_PCT = 0.5; // 50% off first year
// Annual billing gives 2 months free (pay for 10, get 12).
const ANNUAL_MONTHS_CHARGED = 10;
// $7 first month intro offer (applies to monthly billing). Flip to false to disable.
const TRIAL_OFFER = true;
const TRIAL_PRICE = 7;

/* ============================ ROOT ============================ */
export default function App() {
  const [view, setView] = useState("landing");
  const [auth, setAuth] = useState(null); // { token, user }
  const [pendingPlan, setPendingPlan] = useState(null); // { plan, cycle } chosen before login
  const [resetToken, setResetToken] = useState(null);
  const [epkCode, setEpkCode] = useState(null);
  const [splitCode, setSplitCode] = useState(null);
  const [joinCode, setJoinCode] = useState(null);

  // Restore a remembered session on load (if the user chose "Remember me").
  useEffect(() => {
    try {
      const saved = localStorage.getItem("anthem_auth");
      if (saved) {
        const a = JSON.parse(saved);
        if (a?.token) {
          setAuth(a);
          setView("dashboard");
        }
      }
    } catch { /* ignore */ }
    // Capture a referral code if they arrived via someone's link (?ref=CODE).
    try {
      const m = /[?&]ref=([^&]+)/.exec(window.location.search);
      if (m && m[1]) localStorage.setItem("anthem_ref", decodeURIComponent(m[1]));
    } catch {}
    // If they followed a password reset link (?reset=TOKEN), show the reset screen.
    try {
      const rm = /[?&]reset=([^&]+)/.exec(window.location.search);
      if (rm && rm[1]) { setResetToken(decodeURIComponent(rm[1])); setView("reset"); }
    } catch {}
    // If they opened a public EPK link (?epk=CODE), show the public press kit.
    try {
      const em = /[?&]epk=([^&]+)/.exec(window.location.search);
      if (em && em[1]) { setEpkCode(decodeURIComponent(em[1])); setView("epk"); }
    } catch {}
    // If they opened a shared split sheet (?split=CODE), show it.
    try {
      const sm = /[?&]split=([^&]+)/.exec(window.location.search);
      if (sm && sm[1]) { setSplitCode(decodeURIComponent(sm[1])); setView("split"); }
    } catch {}
    // If they opened an artist's fan-signup link (?join=CODE), show the join page.
    try {
      const jm = /[?&]join=([^&]+)/.exec(window.location.search);
      if (jm && jm[1]) { setJoinCode(decodeURIComponent(jm[1])); setView("join"); }
    } catch {}
  }, []);

  function launch() {
    // If a backend is configured, require login first; otherwise go straight in (demo).
    if (api.live() && !auth) setView("login");
    else setView("dashboard");
  }

  function logout() {
    setAuth(null);
    try { localStorage.removeItem("anthem_auth"); } catch {}
    setView("landing");
  }

  // Begin Stripe checkout. If not logged in (and backend live), log in first then resume.
  async function startCheckout(plan, cycle) {
    if (!api.live()) { launch(); return; } // demo mode: no real payments
    if (!auth) { setPendingPlan({ plan, cycle }); setView("login"); return; }
    try {
      const { url } = await api.checkout(auth.token, plan, cycle);
      window.location.href = url;
    } catch (e) {
      alert(e.message || "Couldn't start checkout.");
    }
  }

  async function afterLogin(a, remember) {
    setAuth(a);
    // Persist the session if the user ticked "Remember me".
    try {
      if (remember) localStorage.setItem("anthem_auth", JSON.stringify(a));
      else localStorage.removeItem("anthem_auth");
    } catch {}
    if (pendingPlan) {
      const { plan, cycle } = pendingPlan;
      setPendingPlan(null);
      try {
        const { url } = await api.checkout(a.token, plan, cycle);
        window.location.href = url;
        return;
      } catch { /* fall through to dashboard */ }
    }
    setView("dashboard");
  }

  return (
    <div style={{ background: C.paper, color: C.ink, fontFamily: FONT_BODY, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::selection { background:${C.clay}; color:#fff; }
        body { margin:0; }
        @keyframes rise { from { opacity:0; transform: translateY(16px);} to {opacity:1; transform:none;} }
        @keyframes blink { 50% { opacity:.25; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        .rise { animation: rise .7s cubic-bezier(.2,.8,.2,1) both; }
        .lift { transition: transform .22s, box-shadow .22s, border-color .22s; }
        .lift:hover { transform: translateY(-3px); box-shadow: 0 18px 40px -24px rgba(31,26,22,.35); border-color:${C.clay}; }
        .scroll::-webkit-scrollbar{width:8px;} .scroll::-webkit-scrollbar-thumb{background:${C.line};border-radius:8px;}
      `}</style>
      {view === "landing" && <Landing onLaunch={launch} onCheckout={startCheckout} />}
      {view === "login" && <Login onAuthed={afterLogin} onBack={() => setView("landing")} />}
      {view === "reset" && <ResetPassword token={resetToken} onDone={() => { setResetToken(null); setView("login"); }} />}
      {view === "epk" && <PublicEPK code={epkCode} />}
      {view === "split" && <PublicSplitSheet code={splitCode} />}
      {view === "join" && <FanJoinPage code={joinCode} />}
      {view === "dashboard" && <Dashboard auth={auth} onExit={() => setView("landing")} onLogout={logout} />}
    </div>
  );
}

/* ============================ SALES BOT ============================ */
const SALES_SYSTEM_DEMO = `You are the friendly sales assistant on Anthem's website, an AI studio for music careers. Answer questions about plans and features warmly and briefly, and encourage signup. Plans: Indie $29/mo (2 agents, 35 AI images), Artist $79/mo (all 8 agents, 100 images, most popular), Label $249/mo (unlimited, 500 images, white-label). Annual = 2 months free; launch offer 50% off first year; $7 first month on monthly. 8 agents handle A&R, social, booking, contracts, cover art, press, chat, and finance. Never invent prices or features.`;

function SalesBot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ role: "assistant", text: "Hey! 👋 I'm here to help. Ask me anything about Anthem — plans, features, or how the AI agents work." }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy, open]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user", text: q }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const payload = next.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));
      const text = api.live()
        ? (await api.sales(payload)).text
        : await directCall(SALES_SYSTEM_DEMO, payload);
      setMsgs(m => [...m, { role: "assistant", text: text || "…" }]);
    } catch {
      setMsgs(m => [...m, { role: "assistant", text: "Sorry, I'm having trouble right now — try again, or just sign up to explore!" }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      {/* Floating bubble */}
      <button onClick={() => setOpen(o => !o)} aria-label="Chat with us"
        style={{ position: "fixed", bottom: 22, right: 22, zIndex: 60, width: 58, height: 58,
          borderRadius: "50%", border: "none", cursor: "pointer", background: C.rust, color: "#fff",
          boxShadow: "0 10px 30px -8px rgba(31,26,22,.5)", display: "grid", placeItems: "center" }}>
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{ position: "fixed", bottom: 92, right: 22, zIndex: 60, width: "min(360px, calc(100vw - 44px))",
          height: 480, background: C.card, border: `1px solid ${C.line}`, borderRadius: 18,
          boxShadow: "0 24px 60px -20px rgba(31,26,22,.45)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ background: C.rust, color: "#fff", padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
            <MessageCircle size={18} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Ask Anthem</div>
              <div style={{ fontSize: 11, opacity: .85 }}>Usually replies instantly</div>
            </div>
          </div>
          <div className="scroll" style={{ flex: 1, overflow: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%",
                background: m.role === "user" ? C.rust : C.cream, color: m.role === "user" ? "#fff" : C.ink,
                padding: "10px 13px", borderRadius: 13, fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap",
                border: m.role === "user" ? "none" : `1px solid ${C.line}` }}>
                {m.text}
              </div>
            ))}
            {busy && <div style={{ color: C.soft, fontSize: 12 }}>typing…</div>}
            <div ref={endRef} />
          </div>
          <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${C.line}` }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()} placeholder="Type your question…"
              style={{ ...inp, padding: "10px 13px", fontSize: 13.5 }} />
            <button onClick={send} disabled={busy} style={{ ...btn(C.rust), padding: "10px 14px", opacity: busy ? .5 : 1 }}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================ LANDING ============================ */
function Landing({ onLaunch, onCheckout }) {
  const [annual, setAnnual] = useState(true); // default to annual to show the deal
  return (
    <div>
      <nav style={{ position: "sticky", top: 0, zIndex: 40, backdropFilter: "blur(10px)",
        background: "rgba(250,246,240,.8)", borderBottom: `1px solid ${C.line}` }}>
        <div style={wrap}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0" }}>
            <Logo size={64} />
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              {["Agents", "Pricing", "Referrals"].map(l => (
                <a key={l} href={`#${l.toLowerCase()}`} className="navlink"
                   style={{ color: C.soft, textDecoration: "none", fontSize: 14, display: "none" }}>{l}</a>
              ))}
              <button onClick={onLaunch} style={btn(C.rust)}>Open studio <ArrowRight size={16} /></button>
            </div>
          </div>
        </div>
        <style>{`@media(min-width:760px){.navlink{display:inline!important;}}`}</style>
      </nav>

      {/* Hero */}
      <header style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background:
          `radial-gradient(700px 380px at 85% -5%, rgba(217,139,74,.16), transparent),
           radial-gradient(600px 420px at -5% 25%, rgba(122,92,116,.12), transparent)` }} />
        <div style={{ ...wrap, position: "relative" }}>
          <div style={{ padding: "84px 0 64px", maxWidth: 820 }}>
            <div className="rise" style={{ marginBottom: 24 }}><Logo size={150} /></div>
            <span className="rise" style={pill}><Music2 size={14} color={C.rust} /> A creative team for working musicians</span>
            <h1 className="rise" style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(40px,7vw,74px)",
              lineHeight: 1.04, margin: "20px 0 0", fontWeight: 600, letterSpacing: -1 }}>
              Your whole <span style={{ color: C.rust, fontStyle: "italic" }}>music team</span>,
              run by <span style={{ color: C.teal, fontStyle: "italic" }}>AI</span>.
            </h1>
            <p className="rise" style={{ color: C.soft, fontSize: 19, lineHeight: 1.65, marginTop: 20, maxWidth: 600 }}>
              Anthem gives artists, managers, and labels an AI A&R strategist, social manager,
              booking agent, contract reviewer, cover artist, and press writer — all in one studio.
            </p>
            <div className="rise" style={{ display: "flex", gap: 12, marginTop: 30, flexWrap: "wrap" }}>
              <button onClick={onLaunch} style={btn(C.rust, true)}>Open the studio <ArrowRight size={18} /></button>
              <a href="#pricing" style={btn("transparent")}>See pricing</a>
            </div>
            <div className="rise" style={{ display: "flex", gap: 26, marginTop: 36, color: C.soft, fontSize: 13, flexWrap: "wrap" }}>
              <Stat n="24/7" l="always on" /><Stat n="8" l="specialist agents" />
              <Stat n="4+" l="AI models" /><Stat n="30%" l="referral commission" />
            </div>
          </div>
        </div>
      </header>

      {/* Agents */}
      <section id="agents" style={{ ...wrap, padding: "36px 0 28px" }}>
        <SectionHead kicker="The roster" title="Meet your studio" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 16 }}>
          {AGENTS.map((a, i) => (
            <div key={a.id} className="lift" style={{ ...card, animationDelay: `${i * 60}ms` }}>
              <AgentAvatar agent={a} size={46} radius={12} />
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, marginTop: 14, fontWeight: 600 }}>{a.name}</div>
              <div style={{ color: a.color, fontSize: 12, fontWeight: 600, letterSpacing: .4, textTransform: "uppercase" }}>{a.role}</div>
              <p style={{ color: C.soft, fontSize: 14, lineHeight: 1.55, marginTop: 10 }}>{a.blurb}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ ...wrap, padding: "56px 0 28px" }}>
        <SectionHead kicker="Plans" title="Pricing that fits your stage" />

        {/* Launch promo banner */}
        {LAUNCH_PROMO && (
          <div style={{ ...card, marginBottom: 20, padding: "16px 22px", borderColor: C.rust,
            background: `linear-gradient(120deg, ${C.cream}, #fdf0e4)`, display: "flex",
            alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Sparkles size={20} color={C.rust} />
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 700 }}>Launch offer — 50% off your first year</div>
              <div style={{ color: C.soft, fontSize: 13 }}>Limited time for new artists. Lock in half price when you choose annual billing.</div>
            </div>
          </div>
        )}

        {/* Monthly / Annual toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", background: C.cream, border: `1px solid ${C.line}`,
            borderRadius: 30, padding: 4 }}>
            {[["Monthly", false], ["Annual", true]].map(([label, val]) => (
              <button key={label} onClick={() => setAnnual(val)}
                style={{ border: "none", cursor: "pointer", fontFamily: FONT_BODY, fontSize: 14,
                  fontWeight: 600, padding: "9px 20px", borderRadius: 26,
                  background: annual === val ? C.rust : "transparent",
                  color: annual === val ? "#fff" : C.soft }}>
                {label}{label === "Annual" && <span style={{ fontSize: 11, marginLeft: 6,
                  color: annual === val ? "#fff" : C.teal }}>2 months free</span>}
                {label === "Monthly" && TRIAL_OFFER && <span style={{ fontSize: 11, marginLeft: 6,
                  color: annual === val ? "#fff" : C.teal }}>$7 first month</span>}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          {PLANS.map(p => {
            // Annual = pay for 10 months (2 free). Promo = 50% off that first-year total.
            const annualFull = p.price * 12;
            const annualBase = p.price * ANNUAL_MONTHS_CHARGED;        // 2 months free
            const firstYear = LAUNCH_PROMO ? Math.round(annualBase * (1 - LAUNCH_PROMO_PCT)) : annualBase;
            const perMonthShown = annual ? (firstYear / 12) : p.price;
            return (
            <div key={p.name} className="lift" style={{ ...card, position: "relative",
              borderColor: p.popular ? p.accent : C.line,
              boxShadow: p.popular ? `0 28px 60px -38px ${p.accent}` : "none" }}>
              {p.popular && <span style={{ position: "absolute", top: -12, right: 18, background: p.accent,
                color: "#fff", fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 20 }}>MOST POPULAR</span>}
              <div style={{ color: p.accent, fontSize: 12, fontWeight: 700, letterSpacing: .6, textTransform: "uppercase" }}>{p.name}</div>
              <div style={{ color: C.soft, fontSize: 13 }}>{p.tag}</div>

              <div style={{ margin: "16px 0" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: 46, fontWeight: 600 }}>
                    ${annual ? perMonthShown.toFixed(0) : p.price}
                  </span>
                  <span style={{ color: C.soft }}>/mo</span>
                </div>
                {annual ? (
                  <div style={{ fontSize: 13, color: C.soft, marginTop: 4 }}>
                    {LAUNCH_PROMO && (
                      <span style={{ color: C.rust, fontWeight: 600 }}>
                        ${firstYear}/yr first year{" "}
                        <span style={{ color: C.soft, textDecoration: "line-through", fontWeight: 400 }}>${annualFull}</span>
                      </span>
                    )}
                    {!LAUNCH_PROMO && <span>${annualBase}/yr · 2 months free</span>}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: C.soft, marginTop: 4 }}>
                    {TRIAL_OFFER ? (
                      <span style={{ color: C.teal, fontWeight: 600 }}>
                        First month ${TRIAL_PRICE}, then ${p.price}/mo
                      </span>
                    ) : "billed monthly"}
                  </div>
                )}
              </div>

              {p.features.map(f => (
                <div key={f} style={{ display: "flex", gap: 9, alignItems: "center", color: C.ink, fontSize: 14, padding: "6px 0" }}>
                  <Check size={16} color={p.accent} /> {f}
                </div>
              ))}
              <button onClick={() => onCheckout(p.id, annual ? "annual" : "monthly")} style={{ ...btn(p.popular ? p.accent : "transparent"), width: "100%", marginTop: 16, justifyContent: "center" }}>
                {annual && LAUNCH_PROMO ? "Claim launch deal" : (!annual && TRIAL_OFFER ? `Start for $${TRIAL_PRICE}` : "Get started")}
              </button>
            </div>
            );
          })}
        </div>
      </section>

      {/* Referral */}
      <section id="referrals" style={{ ...wrap, padding: "56px 0 76px" }}>
        <div style={{ ...card, padding: 38, background: `linear-gradient(120deg, ${C.cream}, #fdf0e4)`, borderColor: C.clay }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40, alignItems: "center" }}>
            <div>
              <span style={pill}><Gift size={14} color={C.rust} /> Referral program</span>
              <div style={{ margin: "14px 0 6px" }}><Logo size={44} /></div>
              <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, margin: "8px 0 10px", fontWeight: 600 }}>
                Put other artists on, earn <span style={{ color: C.rust }}>30%</span> recurring.
              </h3>
              <p style={{ color: C.soft, lineHeight: 1.65, fontSize: 15 }}>
                Share your link with other artists and bands. They get 20% off their first 3 months,
                and you earn 30% recurring for as long as they keep creating with Anthem.
              </p>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {[["Share", "Send your artist link"], ["They join", "20% off first 3 months"],
                ["You earn", "30% recurring, paid monthly"]].map(([t, d], i) => (
                <div key={t} style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: `${C.rust}18`,
                    color: C.rust, display: "grid", placeItems: "center", fontFamily: FONT_DISPLAY, fontWeight: 700 }}>{i + 1}</div>
                  <div><div style={{ fontWeight: 600 }}>{t}</div><div style={{ color: C.soft, fontSize: 13 }}>{d}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${C.line}`, padding: "32px 0 40px", textAlign: "center", color: C.soft, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><Logo /></div>
        <div style={{ display: "flex", gap: 18, justifyContent: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <a href="https://varietyvibesradio.com/terms-of-service/" target="_blank" rel="noopener" style={{ color: C.soft, textDecoration: "none" }}>Terms of Use</a>
          <a href="https://varietyvibesradio.com/privacy-policy" target="_blank" rel="noopener" style={{ color: C.soft, textDecoration: "none" }}>Privacy Policy</a>
        </div>
        <div>© 2026 Variety Vibes Radio &amp; TV. All Rights Reserved.</div>
      </footer>

      <SalesBot />
    </div>
  );
}

/* ============================ LOGIN ============================ */
function Login({ onAuthed, onBack }) {
  const hasRef = (() => { try { return !!localStorage.getItem("anthem_ref"); } catch { return false; } })();
  const [mode, setMode] = useState(hasRef ? "signup" : "login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ref, setRef] = useState(() => {
    try { return localStorage.getItem("anthem_ref") || ""; } catch { return ""; }
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true); // stay logged in by default
  const [sentReset, setSentReset] = useState(false);

  async function submit() {
    setErr(""); setBusy(true);
    try {
      const res = mode === "signup"
        ? await api.signup(email, password, ref || undefined)
        : await api.login(email, password);
      try { localStorage.removeItem("anthem_ref"); } catch {}
      onAuthed(res, remember);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="rise" style={{ ...card, width: "100%", maxWidth: 400, padding: 30 }}>
        <Logo />
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600, margin: "18px 0 4px" }}>
          {mode === "signup" ? "Create your studio" : "Welcome back"}
        </h2>
        <p style={{ color: C.soft, fontSize: 14, marginTop: 0 }}>
          {mode === "signup" ? "Start with the Indie plan free." : "Log in to your studio."}
        </p>
        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
            style={inp} type="email" />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password"
            style={inp} type="password" onKeyDown={e => e.key === "Enter" && submit()} />
          {mode === "signup" && (
            <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Referral code (optional)" style={inp} />
          )}
          {err && <div style={{ color: C.rust, fontSize: 13 }}>{err}</div>}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.soft, cursor: "pointer" }}>
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: C.rust, cursor: "pointer" }} />
            Remember me on this device
          </label>
          {mode !== "signup" && (
            <button onClick={async () => {
                if (!email) { setErr("Enter your email above first, then tap this."); return; }
                setErr(""); try { await api.forgotPassword(email); } catch {}
                setSentReset(true);
              }}
              style={{ background: "none", border: "none", color: C.soft, cursor: "pointer",
                fontFamily: FONT_BODY, fontSize: 13, textAlign: "left", padding: 0 }}>
              Forgot password?
            </button>
          )}
          {sentReset && (
            <div style={{ color: C.sage, fontSize: 13 }}>
              If that email has an account, we sent a reset link. Check your inbox (and spam).
            </div>
          )}
          <button onClick={submit} disabled={busy}
            style={{ ...btn(C.rust), justifyContent: "center", opacity: busy ? .6 : 1 }}>
            {busy ? "…" : mode === "signup" ? "Create studio" : "Log in"}
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 13 }}>
          <button onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            style={{ background: "none", border: "none", color: C.teal, cursor: "pointer", fontFamily: FONT_BODY }}>
            {mode === "signup" ? "Have an account? Log in" : "New here? Sign up"}
          </button>
          <button onClick={onBack}
            style={{ background: "none", border: "none", color: C.soft, cursor: "pointer", fontFamily: FONT_BODY }}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================ RESET PASSWORD ============================ */
function ResetPassword({ token, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setErr("");
    if (password.length < 4) { setErr("Password must be at least 4 characters."); return; }
    if (password !== confirm) { setErr("Passwords don't match."); return; }
    setBusy(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(onDone, 1800);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="rise" style={{ ...card, width: "100%", maxWidth: 400, padding: 30 }}>
        <Logo />
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600, margin: "18px 0 4px" }}>
          {done ? "Password updated" : "Set a new password"}
        </h2>
        {done ? (
          <p style={{ color: C.sage, fontSize: 14 }}>You're all set — taking you to log in…</p>
        ) : (
          <>
            <p style={{ color: C.soft, fontSize: 14, marginTop: 0 }}>Choose a new password for your account.</p>
            <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="New password"
                style={inp} type="password" />
              <input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm new password"
                style={inp} type="password" onKeyDown={e => e.key === "Enter" && submit()} />
              {err && <div style={{ color: C.rust, fontSize: 13 }}>{err}</div>}
              <button onClick={submit} disabled={busy}
                style={{ ...btn(C.rust), justifyContent: "center", opacity: busy ? .6 : 1 }}>
                {busy ? "…" : "Update password"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================ PUBLIC EPK (press kit) ============================ */
function PublicEPK({ code }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    api.getEpk(code).then(r => setData(r.data)).catch(() => setErr(true));
  }, [code]);

  if (err) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, textAlign: "center" }}>
      <div><div style={{ fontFamily: FONT_DISPLAY, fontSize: 24 }}>Press kit not found</div>
        <p style={{ color: C.soft }}>This link may be incorrect or no longer available.</p></div>
    </div>
  );
  if (!data) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><Loader2 className="spin" /></div>;

  const Section = ({ title, children }) => children ? (
    <div style={{ margin: "18px 0" }}>
      <h3 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: C.rust, margin: "0 0 6px",
        borderBottom: `1px solid ${C.line}`, paddingBottom: 4 }}>{title}</h3>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 15 }}>{children}</div>
    </div>
  ) : null;

  return (
    <div style={{ minHeight: "100vh", background: C.cream, padding: "40px 20px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", background: C.card, borderRadius: 16,
        border: `1px solid ${C.line}`, padding: 36, boxShadow: "0 20px 50px -20px rgba(31,26,22,.25)" }}>
        <div style={{ display: "flex", gap: 22, alignItems: "center", borderBottom: `3px solid ${C.rust}`, paddingBottom: 20 }}>
          {data.photo && <div style={{ width: 110, height: 110, borderRadius: 12, flexShrink: 0,
            background: `center/cover url(${data.photo})`, border: `1px solid ${C.line}` }} />}
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 600 }}>{data.name || "Artist"}</div>
            {data.genre && <div style={{ color: C.rust, fontWeight: 600, marginTop: 2 }}>{data.genre}</div>}
            <div style={{ color: C.soft, fontSize: 13, marginTop: 4 }}>{[data.location, data.stage].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <Section title="About">{data.recent}</Section>
        <Section title="Highlights">{data.achievements}</Section>
        <Section title="Audience">{data.audience}</Section>
        <Section title="Links">{data.links}</Section>
        {data.contact && (
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${C.line}`, fontSize: 15 }}>
            <strong>Booking & contact:</strong> {data.contact}
          </div>
        )}
        <div style={{ marginTop: 28, textAlign: "center", color: C.soft, fontSize: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <img src={anthemLogo} alt="Anthem" style={{ height: 30, width: "auto", opacity: .85 }} />
          <span>Press kit powered by Anthem</span>
        </div>
      </div>
    </div>
  );
}

/* ============================ PUBLIC SPLIT SHEET ============================ */
function PublicSplitSheet({ code }) {
  const [rel, setRel] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api.getSplitSheet(code).then(setRel).catch(() => setErr(true)); }, [code]);

  if (err) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, textAlign: "center" }}>
      <div><div style={{ fontFamily: FONT_DISPLAY, fontSize: 24 }}>Split sheet not found</div>
        <p style={{ color: C.soft }}>This link may be incorrect or no longer available.</p></div>
    </div>
  );
  if (!rel) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><Loader2 className="spin" /></div>;

  const rev = (rel.revenueCents || 0) / 100;
  return (
    <div style={{ minHeight: "100vh", background: C.cream, padding: "40px 20px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", background: C.card, borderRadius: 16,
        border: `1px solid ${C.line}`, padding: 36, boxShadow: "0 20px 50px -20px rgba(31,26,22,.25)" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, borderBottom: `3px solid ${C.rust}`, paddingBottom: 12 }}>
          {rel.title} — Split Sheet
        </div>
        {rel.revenueCents > 0 && <div style={{ marginTop: 12, fontSize: 15 }}>Revenue logged: <strong>${rev.toFixed(2)}</strong></div>}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, fontSize: 15 }}>
          <thead><tr style={{ color: C.rust, textAlign: "left", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
            <th style={{ padding: 10 }}>Name</th><th style={{ padding: 10 }}>Role</th>
            <th style={{ padding: 10, textAlign: "right" }}>Split</th><th style={{ padding: 10, textAlign: "right" }}>Amount</th>
          </tr></thead>
          <tbody>{(rel.splits || []).map((s, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
              <td style={{ padding: 10 }}>{s.name}</td><td style={{ padding: 10 }}>{s.role}</td>
              <td style={{ padding: 10, textAlign: "right" }}>{s.pct}%</td>
              <td style={{ padding: 10, textAlign: "right", color: C.sage, fontWeight: 600 }}>${(rev * ((Number(s.pct) || 0) / 100)).toFixed(2)}</td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{ marginTop: 28, textAlign: "center", color: C.soft, fontSize: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <img src={anthemLogo} alt="Anthem" style={{ height: 28, width: "auto", opacity: .85 }} />
          <span>A record of agreed splits, generated with Anthem. Not a legal contract.</span>
        </div>
      </div>
    </div>
  );
}

/* ============================ PUBLIC FAN SIGNUP ============================ */
function FanJoinPage({ code }) {
  const [valid, setValid] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { api.fanPage(code).then(() => setValid(true)).catch(() => setValid(false)); }, [code]);

  async function join() {
    setErr("");
    if (!email.trim()) { setErr("Please enter your email."); return; }
    setBusy(true);
    try { await api.joinFanList(code, name.trim(), email.trim()); setDone(true); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  if (valid === false) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, textAlign: "center" }}>
      <div><div style={{ fontFamily: FONT_DISPLAY, fontSize: 24 }}>List not found</div>
        <p style={{ color: C.soft }}>This signup link may be incorrect or no longer active.</p></div>
    </div>
  );
  if (valid === null) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}><Loader2 className="spin" /></div>;

  return (
    <div style={{ minHeight: "100vh", background: C.cream, display: "grid", placeItems: "center", padding: 20 }}>
      <div className="rise" style={{ ...card, width: "100%", maxWidth: 420, padding: 34, textAlign: "center" }}>
        <Logo />
        {done ? (
          <>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600, margin: "18px 0 6px" }}>You're on the list! 🎉</div>
            <p style={{ color: C.soft }}>Thanks for joining — you'll be the first to hear about new music and shows.</p>
          </>
        ) : (
          <>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600, margin: "18px 0 6px" }}>Join the mailing list</div>
            <p style={{ color: C.soft, marginTop: 0 }}>Get new releases, show announcements, and updates straight to your inbox.</p>
            <div style={{ display: "grid", gap: 10, marginTop: 18, textAlign: "left" }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name (optional)" style={inp} />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email" style={inp} type="email" onKeyDown={e => e.key === "Enter" && join()} />
              {err && <div style={{ color: C.rust, fontSize: 13 }}>{err}</div>}
              <button onClick={join} disabled={busy} style={{ ...btn(C.rust), justifyContent: "center", opacity: busy ? .6 : 1 }}>
                {busy ? "…" : "Join the list"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================ DASHBOARD ============================ */
function Dashboard({ auth, onExit, onLogout }) {
  const [tab, setTab] = useState("overview");
  // Artist profile lives here so every agent can read it (the "memory").
  const [profile, setProfile] = useState(null);
  const [saved, setSaved] = useState([]); // saved tool outputs (lyrics, grants, etc.)
  const [plan, setPlan] = useState(auth?.user?.plan || "indie");
  const [justPaid, setJustPaid] = useState(false);

  // Fetch the current plan fresh (reflects Stripe upgrades). If we just returned
  // from a successful checkout (?paid=1), poll briefly so the webhook has time to land.
  useEffect(() => {
    if (!api.live() || !auth?.token) return;
    const paid = typeof window !== "undefined" && /[?&]paid=1/.test(window.location.search);
    if (paid) { setJustPaid(true); window.history.replaceState({}, "", "/"); }
    let tries = 0;
    const fetchPlan = () => {
      api.me(auth.token).then(({ user }) => {
        if (user?.plan) setPlan(user.plan);
      }).catch(() => {});
    };
    fetchPlan();
    // If returning from payment, re-check a few times while the webhook processes.
    let timer;
    if (paid) {
      timer = setInterval(() => { tries++; fetchPlan(); if (tries >= 5) clearInterval(timer); }, 2500);
    }
    return () => timer && clearInterval(timer);
  }, [auth]);

  const nav = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "streams", label: "Streams", icon: BarChart3, color: C.teal },
    { id: "campaign", label: "Release Campaign", icon: Rocket, color: C.rust },
    { id: "tools", label: "Artist Tools", icon: Wrench, color: C.plum },
    ...AGENTS.map(a => ({ id: a.id, label: a.name, icon: a.icon, color: a.color })),
    { id: "profile", label: "Artist Profile", icon: UserCircle },
    { id: "brain", label: "Brain", icon: Brain, color: C.plum },
    { id: "saved", label: "Saved", icon: Inbox, color: C.clay },
    { id: "history", label: "History", icon: Clock, color: C.teal },
    { id: "team", label: "Team", icon: Users2, color: C.plum },
    { id: "calendar", label: "Calendar", icon: Clock, color: C.teal },
    { id: "distribution", label: "Distribution", icon: Rocket, color: C.rust },
    { id: "royalties", label: "Royalties & Splits", icon: DollarSign, color: C.sage },
    { id: "sync", label: "Sync Licensing", icon: Music, color: C.plum },
    { id: "fans", label: "Fans", icon: Inbox, color: C.gold },
    { id: "referral", label: "Referrals", icon: Gift },
    { id: "billing", label: "Billing & plan", icon: Wallet, color: C.teal },
    { id: "settings", label: "Settings", icon: SlidersHorizontal, color: C.soft },
    { id: "features", label: "Request Features", icon: Sparkles, color: C.gold },
    ...(auth?.user?.owner ? [{ id: "admin", label: "Admin", icon: Users2, color: C.rust }] : []),
  ];
  const planLabel = { trial: "Free Trial", indie: "Indie", artist: "Artist", label: "Label" }[plan] || "Indie";
  const daysLeft = plan === "trial" ? trialDaysLeft(auth?.user) : null;
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside className="scroll" style={{ width: 234, borderRight: `1px solid ${C.line}`, background: C.cream,
        padding: "20px 14px 40px", position: "sticky", top: 0, height: "100vh", maxHeight: "100vh", flexShrink: 0,
        overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: "0 6px 18px" }}><Logo /></div>
        {nav.map(n => {
          const active = tab === n.id;
          const agentForNav = AGENTS.find(a => a.id === n.id);
          return (
            <button key={n.id} onClick={() => setTab(n.id)} style={{
              display: "flex", gap: 11, alignItems: "center", width: "100%", textAlign: "left",
              padding: "11px 12px", marginBottom: 4, borderRadius: 10, cursor: "pointer",
              border: "none", fontSize: 14, fontFamily: FONT_BODY,
              background: active ? C.paper : "transparent",
              color: active ? C.ink : C.soft,
              borderLeft: `3px solid ${active ? (n.color || C.rust) : "transparent"}`, fontWeight: active ? 600 : 400 }}>
              {agentForNav
                ? <AgentAvatar agent={agentForNav} size={22} radius={6} />
                : <n.icon size={18} color={active ? (n.color || C.rust) : C.soft} />}
              <span style={{ flex: 1 }}>{n.label}</span>
              {AGENTS.some(a => a.id === n.id) && !planAllows(plan, n.id, auth?.user) &&
                <Lock size={13} color={C.soft} />}
            </button>
          );
        })}
        {/* Current plan badge */}
        <div style={{ marginTop: 16, padding: "12px 14px", background: C.paper, border: `1px solid ${C.line}`,
          borderRadius: 12 }}>
          <div style={{ fontSize: 11, color: C.soft, textTransform: "uppercase", letterSpacing: .5 }}>Your plan</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{planLabel}</span>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: (plan === "trial" && daysLeft === 0) ? C.rust : C.sage }} />
          </div>
          {plan === "trial" && (
            <div style={{ fontSize: 12, color: daysLeft > 0 ? C.soft : C.rust, marginTop: 4 }}>
              {daysLeft > 0 ? `${daysLeft} day${daysLeft > 1 ? "s" : ""} left — then pick a plan` : "Trial ended — choose a plan"}
            </div>
          )}
          <button onClick={() => onExit()} style={{ ...btn("transparent"), width: "100%", justifyContent: "center",
            marginTop: 8, fontSize: 12, padding: "7px 10px" }}>
            {plan === "label" ? "Manage" : "Upgrade"}
          </button>
        </div>
        <button onClick={onExit} style={{ ...btn("transparent"), width: "100%", justifyContent: "center", marginTop: 12, fontSize: 13 }}>
          ← Back to site
        </button>
        <button onClick={onLogout} style={{ ...btn("transparent"), width: "100%", justifyContent: "center",
          marginTop: 8, fontSize: 13, color: C.rust }}>
          Log out
        </button>
      </aside>

      <main className="scroll" style={{ flex: 1, padding: "26px 32px", overflow: "auto" }}>
        {justPaid && (
          <div style={{ ...card, marginBottom: 18, borderColor: C.sage, background: "#f0f6ee",
            display: "flex", alignItems: "center", gap: 12 }}>
            <Check size={20} color={C.sage} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>Payment received — welcome to {planLabel}! 🎉</div>
              <div style={{ color: C.soft, fontSize: 13 }}>Your plan is being activated. If it doesn't show within a minute, refresh.</div>
            </div>
            <button onClick={() => setJustPaid(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.soft }}>
              <X size={18} />
            </button>
          </div>
        )}
        {tab === "overview" && <Overview onJump={setTab} profile={profile} />}
        {tab === "streams" && <StreamsPanel profile={profile} auth={auth} />}
        {tab === "campaign" && <CampaignPanel auth={auth} profile={profile} onSetup={() => setTab("profile")} />}
        {tab === "tools" && <ToolsPanel auth={auth} profile={profile} saved={saved} setSaved={setSaved} streams={{ months: STREAM_MONTHS, streams: STREAM_VALUES, topTracks: TOP_TRACKS, platforms: PLATFORMS }} />}
        {tab === "profile" && <ProfilePanel profile={profile} onSave={setProfile} auth={auth} />}
        {tab === "saved" && <SavedPanel auth={auth} saved={saved} setSaved={setSaved} />}
        {tab === "brain" && <BrainPanel auth={auth} />}
        {tab === "history" && <HistoryPanel auth={auth} onOpenAgent={setTab} />}
        {tab === "team" && <TeamPanel auth={auth} onUpgrade={() => onExit()} />}
        {tab === "features" && <FeaturesPanel auth={auth} />}
        {tab === "admin" && auth?.user?.owner && <AdminPanel auth={auth} />}
        {tab === "referral" && <ReferralPanel auth={auth} />}
        {tab === "billing" && <BillingPanel auth={auth} plan={plan} planLabel={planLabel} onUpgrade={() => onExit()} />}
        {tab === "calendar" && <CalendarPanel auth={auth} />}
        {tab === "distribution" && <DistributionPanel profile={profile} />}
        {tab === "royalties" && <RoyaltiesPanel auth={auth} />}
        {tab === "sync" && <SyncPanel auth={auth} />}
        {tab === "fans" && <FansPanel auth={auth} />}
        {tab === "settings" && <SettingsPanel auth={auth} />}
        {AGENTS.map(a => tab === a.id && (
          planAllows(plan, a.id, auth?.user)
            ? <AgentPanel key={a.id} agent={a} auth={auth} profile={profile} setSaved={setSaved} />
            : <LockedAgent key={a.id} agent={a} plan={plan} user={auth?.user} onUpgrade={() => onExit()} />
        ))}
      </main>
    </div>
  );
}

/* ---- Streaming analytics dashboard ---- */
// NOTE: sample data. Real Spotify/Apple numbers require connecting those accounts
// via their official APIs on the backend (OAuth) — the connect buttons are the hooks.
const STREAM_MONTHS = ["Dec", "Jan", "Feb", "Mar", "Apr", "May"];
const STREAM_VALUES = [18200, 21400, 19800, 28600, 34100, 42800];
const TOP_TRACKS = [
  { title: "Wildfire", streams: 184200, pct: 100 },
  { title: "Slow Burn", streams: 121800, pct: 66 },
  { title: "Coastline", streams: 98400, pct: 53 },
  { title: "Paper Hearts", streams: 64100, pct: 35 },
  { title: "Lantern", streams: 41900, pct: 23 },
];
const CONNECT_PLATFORMS = [
  { name: "Spotify", color: "#1DB954" },
  { name: "Apple Music", color: "#fa2d48" },
  { name: "YouTube Music", color: "#ff0000" },
  { name: "Other", color: C.soft },
];
const PLATFORMS = [
  { name: "Spotify", pct: 58, color: "#1DB954", connected: true },
  { name: "Apple Music", pct: 24, color: "#fa2d48", connected: false },
  { name: "YouTube Music", pct: 11, color: "#ff0000", connected: false },
  { name: "Other", pct: 7, color: C.soft, connected: false },
];

function MiniLineChart({ values, labels, color }) {
  const w = 520, h = 160, pad = 28;
  const max = Math.max(...values) * 1.1, min = Math.min(...values) * 0.85;
  const x = i => pad + (i * (w - pad * 2)) / (values.length - 1);
  const y = v => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${pad},${h - pad} ${pts} ${x(values.length - 1)},${h - pad}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto" }}>
      <defs>
        <linearGradient id="streamfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#streamfill)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={color} />)}
      {labels.map((l, i) => (
        <text key={l} x={x(i)} y={h - 8} fontSize="11" fill={C.soft} textAnchor="middle" fontFamily="Inter">{l}</text>
      ))}
    </svg>
  );
}

function StreamsPanel({ profile, auth }) {
  const [connected, setConnected] = useState({ Spotify: true, "Apple Music": false, "YouTube Music": false, Other: false });
  const [data, setData] = useState({ months: STREAM_MONTHS, streams: STREAM_VALUES, topTracks: TOP_TRACKS, platforms: PLATFORMS, sample: true });
  const [editing, setEditing] = useState(false);
  const [manual, setManual] = useState(null); // { months, streams, listeners, topTracks }
  const [draft, setDraft] = useState(null);

  // Load any saved manual stats (stored as a special Brain item).
  useEffect(() => {
    if (api.live() && auth?.token) {
      api.listBrain(auth.token).then(d => {
        const row = (d.items || []).find(i => i.label === "__stats__");
        if (row) {
          try { const m = JSON.parse(row.content); setManual(m); } catch {}
        }
      }).catch(() => {});
    } else {
      try { const s = JSON.parse(localStorage.getItem("anthem_stats") || "null"); if (s) setManual(s); } catch {}
    }
  }, [auth]);

  // When manual stats exist, use them instead of the sample data.
  useEffect(() => {
    if (manual) {
      setData({
        months: manual.months, streams: manual.streams,
        topTracks: (manual.topTracks || []).map(t => ({ ...t, pct: 100 })),
        platforms: PLATFORMS, sample: false, listeners: manual.listeners,
      });
    }
  }, [manual]);

  function startEdit() {
    setDraft(manual || {
      months: STREAM_MONTHS,
      streams: [0, 0, 0, 0, 0, 0],
      listeners: "",
      topTracks: [{ title: "", streams: 0 }, { title: "", streams: 0 }, { title: "", streams: 0 }],
    });
    setEditing(true);
  }

  async function saveManual() {
    const clean = {
      months: draft.months,
      streams: draft.streams.map(n => Number(n) || 0),
      listeners: draft.listeners,
      topTracks: draft.topTracks.filter(t => t.title.trim()).map(t => ({ title: t.title, streams: Number(t.streams) || 0 })),
    };
    setManual(clean); setEditing(false);
    if (api.live() && auth?.token) {
      // Replace any existing __stats__ brain row.
      try {
        const d = await api.listBrain(auth.token);
        const old = (d.items || []).find(i => i.label === "__stats__");
        if (old) await api.deleteBrain(auth.token, old.id);
        await api.addBrain(auth.token, "note", "__stats__", JSON.stringify(clean));
      } catch {}
    } else {
      try { localStorage.setItem("anthem_stats", JSON.stringify(clean)); } catch {}
    }
  }

  // In live mode, pull real (or backend-sample) stats from the API — only if no manual stats.
  useEffect(() => {
    if (manual) return;
    if (api.live() && auth?.token) {
      api.streams(auth.token).then(d => {
        setData({
          months: d.months || STREAM_MONTHS,
          streams: d.streams || STREAM_VALUES,
          topTracks: (d.topTracks || TOP_TRACKS).map(t => ({ ...t, pct: 100 })),
          platforms: (d.platforms || PLATFORMS).map(p => ({ ...p, color: (PLATFORMS.find(x => x.name === p.name) || {}).color || C.soft })),
          sample: d.sample,
        });
      }).catch(() => {});
    }
  }, [auth, manual]);

  const SV = data.streams;
  const total = SV.reduce((a, b) => a + b, 0);
  const lastMo = SV[SV.length - 1];
  const prevMo = SV[SV.length - 2];
  const growth = (((lastMo - prevMo) / prevMo) * 100).toFixed(0);
  const maxTrack = Math.max(...data.topTracks.map(t => t.streams));
  const kpis = [
    { l: "Streams (6 mo)", v: total.toLocaleString(), c: C.teal },
    { l: "This month", v: lastMo.toLocaleString(), c: C.rust },
    { l: "Mo/mo growth", v: `+${growth}%`, c: C.sage },
    { l: "Monthly listeners", v: data.listeners ? Number(String(data.listeners).replace(/[^0-9.]/g,"")).toLocaleString() : (manual ? "—" : "42.8k"), c: C.plum },
  ];
  return (
    <div className="rise">
      <PageTitle title={profile?.name ? `${profile.name} — streams` : "Streams"}
        sub="Your streaming performance across platforms." />

      <div style={{ ...card, marginBottom: 18, display: "flex", gap: 10, alignItems: "center",
        background: data.sample ? "#fdf0e4" : "#f0f6ee", borderColor: data.sample ? C.clay : C.sage, fontSize: 13 }}>
        <BarChart3 size={18} color={data.sample ? C.rust : C.sage} />
        <span style={{ flex: 1 }}>
          {data.sample
            ? <>Showing <strong>sample data</strong>. Enter your real numbers below — Nora and June will use them automatically.</>
            : <>Showing <strong>your numbers</strong>. Nora and June use these to personalize advice.</>}
        </span>
        <button onClick={startEdit} style={{ ...btn(C.teal), fontSize: 13, padding: "8px 14px" }}>
          {manual ? "Edit my stats" : "Enter my stats"}
        </button>
      </div>

      {/* Auto-connect coming soon note */}
      <div style={{ ...card, marginBottom: 18, padding: "12px 16px", display: "flex", gap: 10,
        alignItems: "center", fontSize: 13, color: C.soft }}>
        <Clock size={16} color={C.plum} />
        <span style={{ flex: 1 }}>Auto-connect to Spotify & Apple Music is coming soon. For now, pop your numbers in manually from your Spotify for Artists dashboard.</span>
      </div>

      {/* Manual entry form */}
      {editing && draft && (
        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Enter your streaming numbers</div>
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Monthly streams (last 6 months)</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8 }}>
                {draft.months.map((m, i) => (
                  <div key={m}>
                    <div style={{ fontSize: 11, color: C.soft, marginBottom: 3 }}>{m}</div>
                    <input type="number" value={draft.streams[i] || ""} placeholder="0"
                      onChange={e => { const s = [...draft.streams]; s[i] = e.target.value; setDraft({ ...draft, streams: s }); }}
                      style={{ ...inp, padding: "8px 10px", fontSize: 13 }} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Monthly listeners</label>
              <input value={draft.listeners} placeholder="e.g. 12,500"
                onChange={e => setDraft({ ...draft, listeners: e.target.value })}
                style={{ ...inp, maxWidth: 200 }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Top tracks</label>
              {draft.topTracks.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input value={t.title} placeholder={`Track ${i + 1} name`}
                    onChange={e => { const tt = [...draft.topTracks]; tt[i] = { ...tt[i], title: e.target.value }; setDraft({ ...draft, topTracks: tt }); }}
                    style={{ ...inp, flex: 2, padding: "8px 10px", fontSize: 13 }} />
                  <input type="number" value={t.streams || ""} placeholder="streams"
                    onChange={e => { const tt = [...draft.topTracks]; tt[i] = { ...tt[i], streams: e.target.value }; setDraft({ ...draft, topTracks: tt }); }}
                    style={{ ...inp, flex: 1, padding: "8px 10px", fontSize: 13 }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={saveManual} style={{ ...btn(C.rust) }}>Save my stats</button>
              <button onClick={() => setEditing(false)} style={{ ...btn("transparent") }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14, marginBottom: 18 }}>
        {kpis.map(k => (
          <div key={k.l} style={card}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 600, color: k.c }}>{k.v}</div>
            <div style={{ color: C.soft, fontSize: 13 }}>{k.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 18 }}>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Streams over time</div>
          <MiniLineChart values={SV} labels={data.months} color={C.teal} />
        </div>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 14 }}>By platform</div>
          {data.platforms.map(p => (
            <div key={p.name} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 9, background: p.color }} /> {p.name}
                </span>
                <span style={{ color: C.soft }}>{p.pct}%</span>
              </div>
              <div style={{ height: 7, background: C.line, borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: `${p.pct}%`, height: "100%", background: p.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 14 }}>Top tracks</div>
        {data.topTracks.map((t, i) => (
          <div key={t.title} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0",
            borderTop: i ? `1px solid ${C.line}` : "none" }}>
            <span style={{ color: C.soft, fontFamily: FONT_DISPLAY, width: 18 }}>{i + 1}</span>
            <Music size={15} color={C.teal} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{t.title}</span>
            <div style={{ width: 120, height: 6, background: C.line, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: `${Math.round((t.streams / maxTrack) * 100)}%`, height: "100%", background: C.teal }} />
            </div>
            <span style={{ color: C.soft, fontSize: 13, width: 70, textAlign: "right" }}>{t.streams.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Artist profile = the memory every agent uses ---- */
function profileToContext(p) {
  if (!p) return "";
  const parts = [];
  if (p.name) parts.push(`Artist/act name: ${p.name}`);
  if (p.genre) parts.push(`Genre/style: ${p.genre}`);
  if (p.stage) parts.push(`Career stage: ${p.stage}`);
  if (p.voice) parts.push(`Brand voice/personality: ${p.voice}`);
  if (p.goals) parts.push(`Current goals: ${p.goals}`);
  if (p.audience) parts.push(`Audience: ${p.audience}`);
  if (p.recent) parts.push(`Recent releases/context: ${p.recent}`);
  if (p.location) parts.push(`Based in: ${p.location}`);
  if (p.achievements) parts.push(`Notable achievements: ${p.achievements}`);
  if (!parts.length) return "";
  return `\n\nHere is the artist's profile — use it to personalize everything:\n${parts.join("\n")}`;
}

function ProfilePanel({ profile, onSave, auth }) {
  const [f, setF] = useState(profile || { name: "", genre: "", stage: "", voice: "", goals: "", audience: "", recent: "", photo: "", location: "", contact: "", achievements: "", links: "" });
  const [saved, setSaved] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const fileRef = useRef(null);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setSaved(false); };

  async function publishLink() {
    if (!f.name) { alert("Add your artist name first."); return; }
    setPublishing(true);
    try {
      const { shareCode } = await api.publishEpk(auth.token, f);
      setShareUrl(`${window.location.origin}/?epk=${shareCode}`);
    } catch (e) { alert(e.message || "Couldn't create link."); }
    finally { setPublishing(false); }
  }

  function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { alert("Please choose an image under 4MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { setF(prev => ({ ...prev, photo: reader.result })); setSaved(false); };
    reader.readAsDataURL(file);
  }

  const fields = [
    ["name", "Artist / act name", "e.g. The Hold Tights"],
    ["genre", "Genre & style", "e.g. indie rock with shoegaze textures"],
    ["stage", "Career stage", "e.g. ~5k monthly listeners, first headline tour soon"],
    ["voice", "Brand voice / personality", "e.g. warm, a little wry, never corporate"],
    ["goals", "Current goals", "e.g. grow to 25k listeners, land a sync placement"],
    ["audience", "Who's your audience?", "e.g. 18–30, college towns, vinyl buyers"],
    ["recent", "Recent releases / context", "e.g. dropped an EP in March, prepping a single"],
    ["location", "Based in", "e.g. Austin, TX"],
    ["achievements", "Notable achievements", "e.g. 500k streams, featured on Spotify Fresh Finds, opened for ___"],
    ["links", "Links (streaming, socials, website)", "Spotify: ...\nInstagram: ...\nWebsite: ..."],
    ["contact", "Booking / contact email", "e.g. booking@yourname.com"],
  ];
  return (
    <div className="rise">
      <PageTitle title="Artist profile" sub="Fill this once. Every agent uses it to personalize their work — this is your studio's memory." />
      <div style={{ ...card, maxWidth: 680 }}>
        {/* Headshot / artist photo */}
        <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 18 }}>
          <div onClick={() => fileRef.current?.click()}
            style={{ width: 92, height: 92, borderRadius: "50%", cursor: "pointer", flexShrink: 0,
              background: f.photo ? `center/cover url(${f.photo})` : `linear-gradient(135deg, ${C.rust}, ${C.plum})`,
              display: "grid", placeItems: "center", border: `2px solid ${C.line}`, overflow: "hidden" }}>
            {!f.photo && <UserCircle size={40} color="#fff" />}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Artist photo / headshot</div>
            <div style={{ color: C.soft, fontSize: 13, margin: "2px 0 8px" }}>Used on your EPK and smart link. Square images look best.</div>
            <button onClick={() => fileRef.current?.click()} style={{ ...btn("transparent"), fontSize: 13, padding: "8px 14px" }}>
              {f.photo ? "Change photo" : "Upload photo"}
            </button>
            {f.photo && (
              <button onClick={() => { setF(prev => ({ ...prev, photo: "" })); setSaved(false); }}
                style={{ ...btn("transparent"), fontSize: 13, padding: "8px 14px", marginLeft: 8, color: C.soft }}>
                Remove
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} />
          </div>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          {fields.map(([k, label, ph]) => (
            <div key={k}>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.ink, display: "block", marginBottom: 5 }}>{label}</label>
              {k === "voice" || k === "recent" || k === "goals" || k === "links" || k === "achievements"
                ? <textarea value={f[k]} onChange={set(k)} placeholder={ph} rows={2} style={{ ...inp, resize: "vertical" }} />
                : <input value={f[k]} onChange={set(k)} placeholder={ph} style={inp} />}
            </div>
          ))}
          <button onClick={() => { onSave(f); setSaved(true); }}
            style={{ ...btn(C.rust), justifyContent: "center" }}>
            {saved ? <><Check size={16} /> Saved — agents will use this</> : "Save profile"}
          </button>
        </div>
      </div>

      {/* EPK — shareable press kit built from this profile */}
      <div style={{ ...card, maxWidth: 680, marginTop: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Press kit (EPK)</div>
        <p style={{ color: C.soft, fontSize: 14, marginTop: 0, lineHeight: 1.5 }}>
          Turn your profile into a one-page press kit you can send to venues, blogs, and curators.
          Fill in your details above first, then download it as a PDF.
        </p>
        <div style={{ background: `${C.gold}14`, border: `1px solid ${C.gold}44`, borderRadius: 10,
          padding: "10px 13px", fontSize: 13, color: C.ink, marginBottom: 14 }}>
          <strong>To edit or update your EPK:</strong> change your details in the Artist Profile fields above,
          hit <strong>Save profile</strong>, then click <strong>Update share link</strong> below so your shared kit shows the latest.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => downloadEPK(f)} style={btn(C.plum)}>
            <Download size={16} /> Download EPK (PDF)
          </button>
          {api.live() && auth?.token && (
            <button onClick={publishLink} disabled={publishing} style={{ ...btn(C.teal), opacity: publishing ? .6 : 1 }}>
              <LinkIcon size={16} /> {publishing ? "Creating…" : shareUrl ? "Update share link" : "Get shareable link"}
            </button>
          )}
        </div>
        {shareUrl && (
          <div style={{ marginTop: 12, padding: "10px 12px", border: `1px solid ${C.teal}55`, background: `${C.teal}10`,
            borderRadius: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <a href={shareUrl} target="_blank" rel="noopener" style={{ flex: 1, minWidth: 180, color: C.ink, fontSize: 13, wordBreak: "break-all" }}>{shareUrl}</a>
            <button onClick={() => { navigator.clipboard?.writeText(shareUrl); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 1500); }}
              style={{ ...btn(copiedLink ? C.sage : "transparent"), fontSize: 13, padding: "6px 12px" }}>
              {copiedLink ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
        )}
        <p style={{ color: C.soft, fontSize: 12, marginTop: 10 }}>
          Tip: ask <strong>Remy</strong> to write you a sharp artist bio, then paste it into "Recent releases / context" for a stronger kit.
        </p>
      </div>
    </div>
  );
}

// Build a clean EPK one-pager and open the print dialog (save as PDF).
function downloadEPK(f) {
  const esc = s => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const nl = s => esc(s).replace(/\n/g, "<br>");
  const linksHtml = f.links ? `<div class="sec"><h3>Links</h3><p>${nl(f.links)}</p></div>` : "";
  const achHtml = f.achievements ? `<div class="sec"><h3>Highlights</h3><p>${nl(f.achievements)}</p></div>` : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(f.name || "EPK")} — Press Kit</title>
  <style>
    *{box-sizing:border-box} body{font-family:Georgia,'Times New Roman',serif;color:#1f1a16;margin:0;padding:48px;max-width:760px;margin:0 auto;line-height:1.5}
    .head{display:flex;gap:24px;align-items:center;border-bottom:3px solid #c2542d;padding-bottom:20px;margin-bottom:22px}
    .photo{width:120px;height:120px;border-radius:8px;object-fit:cover;flex-shrink:0;background:#eee}
    h1{font-size:34px;margin:0;color:#1f1a16} .role{color:#c2542d;font-weight:bold;font-size:15px;margin-top:4px}
    .meta{color:#6b6258;font-size:13px;margin-top:6px}
    .sec{margin:16px 0} h3{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#c2542d;margin:0 0 4px;border-bottom:1px solid #eee;padding-bottom:3px}
    p{margin:4px 0} .contact{margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:14px}
    @media print{body{padding:24px}}
  </style></head><body>
    <div class="head">
      ${f.photo ? `<img class="photo" src="${f.photo}">` : ""}
      <div>
        <h1>${esc(f.name || "Artist Name")}</h1>
        ${f.genre ? `<div class="role">${esc(f.genre)}</div>` : ""}
        <div class="meta">${[f.location, f.stage].filter(Boolean).map(esc).join(" · ")}</div>
      </div>
    </div>
    ${f.recent ? `<div class="sec"><h3>About</h3><p>${nl(f.recent)}</p></div>` : ""}
    ${achHtml}
    ${f.audience ? `<div class="sec"><h3>Audience</h3><p>${nl(f.audience)}</p></div>` : ""}
    ${linksHtml}
    ${f.contact ? `<div class="contact"><strong>Booking & contact:</strong> ${esc(f.contact)}</div>` : ""}
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { alert("Please allow pop-ups to download your EPK."); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}

/* ---- Release Campaign = one brief, fanned out to multiple agents ---- */
const CAMPAIGN_STEPS = [
  { id: "anr", label: "Nora", sub: "Rollout strategy", icon: Disc3, color: C.rust,
    prompt: (brief) => `Create a focused release rollout strategy for this: ${brief}. Give a clear week-by-week plan.` },
  { id: "social", label: "Mia", sub: "Social plan + captions", icon: Megaphone, color: C.plum,
    prompt: (brief) => `Plan the social rollout for this release and write 3 ready-to-post captions: ${brief}` },
  { id: "blog", label: "Remy", sub: "Press release", icon: PenLine, color: C.sage,
    prompt: (brief) => `Write a short press release and a one-paragraph playlist pitch for this release: ${brief}` },
  { id: "image", label: "Iris", sub: "Cover concept", icon: ImageIcon, color: C.clay,
    prompt: (brief) => `Design a single cover that fits this release: ${brief}` },
];

function CampaignPanel({ auth, profile, onSetup }) {
  const [brief, setBrief] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState({}); // id -> {status, text, svg}

  async function run() {
    const b = brief.trim();
    if (!b || running) return;
    setRunning(true);
    setResults(Object.fromEntries(CAMPAIGN_STEPS.map(s => [s.id, { status: "pending" }])));
    const ctx = profileToContext(profile);
    // Fan the one brief out to each agent in sequence.
    for (const step of CAMPAIGN_STEPS) {
      setResults(r => ({ ...r, [step.id]: { status: "running" } }));
      try {
        const system = (AGENT_SYSTEMS[step.id] || "") + ctx;
        const baseMsg = [{ role: "user", content: step.prompt(b) }];
        const messages = ctx
          ? [{ role: "user", content: `(Context about me:${ctx})` },
             { role: "assistant", content: "Understood." }, ...baseMsg]
          : baseMsg;
        if (api.live()) {
          const data = await api.chat(auth.token, step.id, messages);
          setResults(r => ({ ...r, [step.id]: { status: "done", text: data.text, svg: data.svg } }));
        } else {
          const raw = await directCall(system, baseMsg);
          if (step.id === "image") {
            const svg = (raw.match(/<svg[\s\S]*<\/svg>/i) || [])[0];
            setResults(r => ({ ...r, [step.id]: { status: "done", svg, text: svg ? "" : raw } }));
          } else {
            setResults(r => ({ ...r, [step.id]: { status: "done", text: raw } }));
          }
        }
      } catch (e) {
        setResults(r => ({ ...r, [step.id]: { status: "error", text: e.message } }));
      }
    }
    setRunning(false);
  }

  return (
    <div className="rise">
      <PageTitle title="Release Campaign" sub="Describe your release once. Your team builds the whole rollout together." />
      {!profile && (
        <div style={{ ...card, marginBottom: 16, display: "flex", gap: 12, alignItems: "center", borderColor: C.clay, background: "#fdf0e4" }}>
          <UserCircle size={20} color={C.rust} />
          <div style={{ flex: 1, fontSize: 14 }}>Set up your artist profile first so the campaign sounds like you.</div>
          <button onClick={onSetup} style={btn(C.rust)}>Set up profile</button>
        </div>
      )}
      <div style={{ ...card, marginBottom: 18 }}>
        <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={3}
          placeholder='Describe the release — e.g. "New single \"Wildfire,\" upbeat indie-rock, out June 20, themes of starting over. Lead single off the fall EP."'
          style={{ ...inp, resize: "vertical" }} />
        <button onClick={run} disabled={running} style={{ ...btn(C.rust), marginTop: 12, opacity: running ? .6 : 1 }}>
          {running ? <><Loader2 size={16} className="spin" /> Building campaign…</> : <><Rocket size={16} /> Launch campaign</>}
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        {CAMPAIGN_STEPS.map(s => {
          const r = results[s.id];
          return (
            <div key={s.id} style={{ ...card, borderColor: r?.status === "done" ? `${s.color}66` : C.line }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${s.color}18`,
                  border: `1px solid ${s.color}40`, display: "grid", placeItems: "center" }}>
                  <s.icon size={17} color={s.color} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.label}</div>
                  <div style={{ color: C.soft, fontSize: 11, textTransform: "uppercase", letterSpacing: .4 }}>{s.sub}</div>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 12, color: C.soft }}>
                  {r?.status === "running" && <Loader2 size={14} className="spin" />}
                  {r?.status === "pending" && "queued"}
                  {r?.status === "done" && <Check size={15} color={s.color} />}
                  {r?.status === "error" && "error"}
                </span>
              </div>
              {r?.svg && (
                <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C.line}`, width: "100%", aspectRatio: "1", background: "#fff", marginBottom: 8 }}
                  dangerouslySetInnerHTML={{ __html: r.svg.replace(/<svg/, '<svg width="100%" height="100%"') }} />
              )}
              {r?.text && <div style={{ fontSize: 13, lineHeight: 1.55, color: C.ink, whiteSpace: "pre-wrap" }}>{r.text}</div>}
              {r?.status === "done" && r?.text && (
                <div style={{ marginTop: 10 }}>
                  <CopyButton text={r.text} color={s.color} />
                  {s.id === "social" && <ScheduleReminder defaultTitle="Post this to social" />}
                </div>
              )}
              {!r && <div style={{ fontSize: 13, color: C.soft }}>Will draft when you launch.</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function Overview({ onJump, profile }) {
  const kpis = [
    { l: "Monthly listeners", v: "42.8k", d: "+14% mo", icon: Headphones, c: C.rust },
    { l: "Shows booked", v: "9", d: "+3 this mo", icon: Calendar, c: C.teal },
    { l: "Royalties tracked", v: "$6.2k", d: "+8% mo", icon: DollarSign, c: C.gold },
    { l: "Active agents", v: "8 / 8", d: "all online", icon: Activity, c: C.plum },
  ];
  return (
    <div className="rise">
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 22 }}>
        {profile?.photo && (
          <div style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
            background: `center/cover url(${profile.photo})`, border: `2px solid ${C.line}` }} />
        )}
        <div>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 30, margin: 0, fontWeight: 600 }}>
            {profile?.name ? `Welcome back, ${profile.name}` : "Studio overview"}
          </h2>
          <p style={{ color: C.soft, margin: "4px 0 0" }}>Everything your team worked on this week.</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
        {kpis.map(k => (
          <div key={k.l} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <k.icon size={20} color={k.c} />
              <span style={{ color: k.c, fontSize: 12, fontWeight: 600 }}>{k.d}</span>
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, marginTop: 10, fontWeight: 600 }}>{k.v}</div>
            <div style={{ color: C.soft, fontSize: 13 }}>{k.l}</div>
          </div>
        ))}
      </div>

      <h3 style={{ fontFamily: FONT_DISPLAY, marginTop: 30, marginBottom: 14, fontWeight: 600 }}>Your studio</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
        {AGENTS.map(a => (
          <button key={a.id} onClick={() => onJump(a.id)} className="lift"
            style={{ ...card, cursor: "pointer", textAlign: "left" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <AgentAvatar agent={a} size={40} radius={10} />
              <div>
                <div style={{ fontWeight: 700 }}>{a.name}</div>
                <div style={{ color: a.color, fontSize: 11, textTransform: "uppercase", letterSpacing: .4 }}>{a.role}</div>
              </div>
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.sage }}>
                <span style={{ width: 7, height: 7, borderRadius: 9, background: C.sage, animation: "blink 1.6s infinite" }} /> live
              </span>
            </div>
            <p style={{ color: C.soft, fontSize: 13, lineHeight: 1.5, marginTop: 12 }}>{a.sample}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================ ARTIST TOOLS ============================ */
const TOOLS = [
  { id: "epk", name: "EPK Generator", icon: FileText, color: C.rust,
    desc: "A polished one-page electronic press kit from your profile + streams.",
    cta: "Generate my EPK", input: false,
    prompt: (p, s, x) => `Write a professional one-page EPK (electronic press kit) for this artist. Include: a compelling 100-word bio, key stats, notable tracks, and a short pitch to bookers/press. Format with clear sections.${p}${s}` },
  { id: "smartlink", name: "Smart Link Page", icon: LinkIcon, color: C.teal,
    desc: "A 'listen everywhere' landing page for a release — replaces Linktree/Linkfire.",
    cta: "Build smart link", input: true, placeholder: "Release name + the platforms/links (Spotify, Apple, etc.)",
    builder: true },
  { id: "checklist", name: "Release Checklist", icon: ListChecks, color: C.sage,
    desc: "An auto-timed countdown of everything to do before a release date.",
    cta: "Build my checklist", input: true, placeholder: "Release name + release date (e.g. 'Wildfire, June 20')",
    prompt: (p, s, x) => `Create a release checklist and countdown timeline working backwards from the release date for: ${x}. Group tasks by timeframe (6 weeks out, 4 weeks, 2 weeks, 1 week, release day, after). Be specific and music-industry-savvy.${p}` },
  { id: "lyrics", name: "Lyric & Songwriting", icon: PenTool, color: C.plum,
    desc: "Rhymes, synonyms, hook ideas, and a cure for writer's block.",
    cta: "Open the writing room", input: true, placeholder: "What are you working on? (a line, a theme, a stuck spot…)",
    prompt: (p, s, x) => `You are a songwriting collaborator. Help with this: ${x}. Offer rhyme options, alternate lines, hook ideas, or imagery as fits. Keep the artist's voice.${p}` },
  { id: "templates", name: "Outreach Templates", icon: Inbox, color: C.clay,
    desc: "Ready-to-edit messages for curators, blogs, venues, and collabs.",
    cta: "Get templates", input: true, placeholder: "Who are you reaching out to? (playlist curator, blog, venue, producer…)",
    prompt: (p, s, x) => `Write 3 short, editable outreach message templates for a musician contacting: ${x}. Make them warm, specific, and non-spammy, with clear placeholders in [brackets].${p}` },
  { id: "grants", name: "Grants & Opportunities", icon: Award, color: C.gold,
    desc: "Find music grants, sync briefs, and submission deadlines to chase.",
    cta: "Find opportunities", input: true, placeholder: "Your country/region + genre (helps target real opportunities)",
    prompt: (p, s, x) => `Suggest types of music grants, funding programs, sync/licensing briefs, and competitions a musician in this situation should pursue: ${x}. Explain what each is, who qualifies, and how to find current openings. Note that the artist should verify current deadlines.${p}` },
  { id: "newsletter", name: "Fan Newsletter", icon: MailIcon, color: C.rust,
    desc: "Drafts release announcements and tour newsletters for your fans.",
    cta: "Write a newsletter", input: true, placeholder: "What's the news? (new single, tour dates, behind-the-scenes…)",
    prompt: (p, s, x) => `Write a warm, engaging fan newsletter/email about: ${x}. Include a subject line, a personal-feeling opening, the news, and a clear call to action. Match the artist's voice.${p}` },
  { id: "setlist", name: "Setlist & Show Day", icon: ListMusic, color: C.teal,
    desc: "Builds set lists by energy/tempo and a day-of-show checklist.",
    cta: "Plan a show", input: true, placeholder: "Set length + your songs (or vibe) + venue type",
    prompt: (p, s, x) => `Build a suggested setlist ordered by energy/tempo flow, plus a day-of-show checklist (load-in, soundcheck, merch, etc.) for: ${x}.${p}${s}` },
];

function ToolsPanel({ auth, profile, streams, saved, setSaved }) {
  const [open, setOpen] = useState(null); // tool id

  if (open) {
    const tool = TOOLS.find(t => t.id === open);
    return <ToolView tool={tool} auth={auth} profile={profile} streams={streams} saved={saved} setSaved={setSaved} onBack={() => setOpen(null)} />;
  }
  return (
    <div className="rise">
      <PageTitle title="Artist tools" sub="A growing toolkit to build and grow your career — all powered by your profile and stats." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 14 }}>
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setOpen(t.id)} className="lift"
            style={{ ...card, cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: `${t.color}18`,
              border: `1px solid ${t.color}40`, display: "grid", placeItems: "center" }}>
              <t.icon size={20} color={t.color} />
            </div>
            <div style={{ fontWeight: 700, marginTop: 12 }}>{t.name}</div>
            <p style={{ color: C.soft, fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// Builds a smart-link "listen everywhere" page preview from typed links.
function SmartLinkBuilder({ profile, input }) {
  // Parse "Platform: url" lines or bare urls.
  const lines = input.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  const links = lines.map(l => {
    const m = l.match(/(spotify|apple|youtube|tidal|soundcloud|bandcamp|amazon|deezer)/i);
    return { label: m ? m[1][0].toUpperCase() + m[1].slice(1) : "Listen", raw: l };
  });
  const title = lines[0] && !/https?:/.test(lines[0]) ? lines[0] : (profile?.name || "New Release");
  return (
    <div style={{ maxWidth: 360, margin: "0 auto", background: "#15110e", color: "#fff",
      borderRadius: 20, padding: 28, textAlign: "center", border: `1px solid ${C.line}` }}>
      <div style={{ width: 150, height: 150, borderRadius: 12, margin: "0 auto 16px", overflow: "hidden",
        background: profile?.photo ? `center/cover url(${profile.photo})` : `linear-gradient(135deg, ${C.rust}, ${C.plum})`,
        display: "grid", placeItems: "center" }}>
        {!profile?.photo && <Music size={48} color="#fff" />}
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600 }}>{title}</div>
      <div style={{ color: "#bbb", fontSize: 13, marginBottom: 18 }}>{profile?.name || "Your artist name"}</div>
      <div style={{ display: "grid", gap: 10 }}>
        {(links.length ? links : [{ label: "Spotify" }, { label: "Apple Music" }, { label: "YouTube" }]).map((l, i) => (
          <div key={i} style={{ background: "#241d18", borderRadius: 10, padding: "13px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14 }}>
            <span>{l.label}</span><span style={{ color: C.clay }}>Play ▸</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolView({ tool, auth, profile, streams, saved, setSaved, onBack }) {
  const [input, setInput] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [built, setBuilt] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  function saveOutput() {
    if (!out) return;
    const item = { id: Date.now(), tool: tool.name, text: out, when: new Date().toLocaleString() };
    setSaved?.(list => [item, ...(list || [])]);
    setJustSaved(true); setTimeout(() => setJustSaved(false), 1500);
    // Persist to the backend so it survives logout (live mode only).
    if (api.live() && auth?.token) {
      api.addSaved(auth.token, tool.name, out).catch(() => {});
    }
  }

  const pctx = profileToContext(profile);
  const sctx = streams ? `\n\nStreaming context: top tracks ${streams.topTracks.slice(0, 3).map(t => t.title).join(", ")}; recent monthly streams trending ${streams.streams[streams.streams.length - 1] > streams.streams[0] ? "up" : "down"}.` : "";

  async function run() {
    if (busy) return;
    if (tool.input && !input.trim()) return;
    if (tool.builder) { setBuilt(true); return; }
    setBusy(true); setOut("");
    try {
      const system = "You are an expert music-industry assistant helping an artist. Be practical, specific, and concise.";
      const userPrompt = tool.prompt(pctx, sctx, input.trim());
      if (api.live()) {
        const data = await api.chat(auth.token, "blog", [{ role: "user", content: system + "\n\n" + userPrompt }]);
        setOut(data.text || "…");
      } else {
        setOut(await directCall(system, [{ role: "user", content: userPrompt }]) || "…");
      }
    } catch (e) { setOut(`⚠️ ${e.message || "Something went wrong."}`); }
    finally { setBusy(false); }
  }

  return (
    <div className="rise">
      <button onClick={onBack} style={{ ...btn("transparent"), marginBottom: 14, fontSize: 13 }}>
        <ArrowLeft size={15} /> All tools
      </button>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: `${tool.color}18`,
          border: `1px solid ${tool.color}40`, display: "grid", placeItems: "center" }}>
          <tool.icon size={22} color={tool.color} />
        </div>
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 23, fontWeight: 600 }}>{tool.name}</div>
          <div style={{ color: C.soft, fontSize: 13 }}>{tool.desc}</div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        {tool.input && (
          <textarea value={input} onChange={e => { setInput(e.target.value); setBuilt(false); }} rows={3}
            placeholder={tool.placeholder} style={{ ...inp, resize: "vertical", marginBottom: 12 }} />
        )}
        <button onClick={run} disabled={busy} style={{ ...btn(tool.color), opacity: busy ? .6 : 1 }}>
          {busy ? <><Loader2 size={16} className="spin" /> Working…</> : <><tool.icon size={16} /> {tool.cta}</>}
        </button>
      </div>

      {tool.builder && built && (
        <div style={{ ...card }}>
          <div style={{ color: C.soft, fontSize: 13, marginBottom: 14 }}>Smart link preview — this is the page fans would see:</div>
          <SmartLinkBuilder profile={profile} input={input} />
        </div>
      )}
      {out && (
        <div style={{ ...card }}>
          {/* EPK shows the artist photo at the top of the press kit */}
          {tool.id === "epk" && profile?.photo && (
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16,
              borderBottom: `1px solid ${C.line}`, paddingBottom: 16 }}>
              <div style={{ width: 84, height: 84, borderRadius: 12, flexShrink: 0,
                background: `center/cover url(${profile.photo})`, border: `1px solid ${C.line}` }} />
              <div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 600 }}>{profile?.name || "Press Kit"}</div>
                {profile?.genre && <div style={{ color: C.soft, fontSize: 13 }}>{profile.genre}</div>}
              </div>
            </div>
          )}
          {tool.id === "epk" && !profile?.photo && (
            <div style={{ fontSize: 13, color: C.soft, marginBottom: 12 }}>
              Tip: add a photo in your Artist Profile and it'll appear at the top of your EPK.
            </div>
          )}
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14 }}>{out}</div>
          <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <CopyButton text={out} color={tool.color} />
            <button onClick={saveOutput} style={{ ...btn(justSaved ? C.sage : "transparent"), fontSize: 13, padding: "8px 14px" }}>
              {justSaved ? <><Check size={15} /> Saved!</> : <><Inbox size={15} /> Save</>}
            </button>
            <button onClick={() => downloadText(`${tool.id}-${(profile?.name || "anthem").replace(/\s+/g, "-")}.txt`, out)}
              style={{ ...btn("transparent"), fontSize: 13, padding: "8px 14px" }}>
              <Download size={15} /> Download
            </button>
            {(tool.id === "newsletter" || tool.id === "checklist") && (
              <ScheduleReminder defaultTitle={tool.id === "checklist" ? "Release task" : "Send newsletter"} />
            )}
          </div>
          {saved?.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: C.soft }}>
              {saved.length} saved item{saved.length > 1 ? "s" : ""} this session
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Brain: notes + links that teach the agents about the artist ---- */
function BrainPanel({ auth }) {
  const [items, setItems] = useState([]);
  const [kind, setKind] = useState("note");
  const [label, setLabel] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const live = api.live() && auth?.token;

  useEffect(() => {
    if (live) {
      setLoading(true);
      api.listBrain(auth.token).then(d => setItems(d.items || [])).catch(() => {}).finally(() => setLoading(false));
    }
  }, [auth]);

  async function add() {
    if (!content.trim() || busy) return;
    setBusy(true);
    const optimistic = { id: Date.now(), kind, label: label || (kind === "link" ? content : "Note"), content, when: new Date().toISOString() };
    try {
      if (live) {
        const { item } = await api.addBrain(auth.token, kind, label, content);
        setItems(list => [item, ...list]);
      } else {
        setItems(list => [optimistic, ...list]);
      }
      setLabel(""); setContent("");
    } catch (e) { alert(e.message || "Couldn't add that."); }
    finally { setBusy(false); }
  }

  function remove(id) {
    setItems(list => list.filter(i => i.id !== id));
    if (live) api.deleteBrain(auth.token, id).catch(() => {});
  }

  return (
    <div className="rise">
      <PageTitle title="Brain" sub="Teach your agents about you. Everything here feeds every agent so their work sounds like you." />

      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[["note", "Add a note"], ["link", "Add a website link"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setKind(k)}
              style={{ ...btn(kind === k ? C.plum : "transparent"), fontSize: 13, padding: "8px 14px" }}>{lbl}</button>
          ))}
        </div>
        <input value={label} onChange={e => setLabel(e.target.value)}
          placeholder={kind === "link" ? "Label (optional, e.g. My website)" : "Label (e.g. My sound, Bio, Influences)"}
          style={{ ...inp, marginBottom: 8 }} />
        {kind === "link" ? (
          <input value={content} onChange={e => setContent(e.target.value)}
            placeholder="https://your-site.com — I'll read it so the agents know what's there"
            style={inp} onKeyDown={e => e.key === "Enter" && add()} />
        ) : (
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
            placeholder="Anything you want the agents to know — your story, brand voice, press quotes, song meanings, influences…"
            style={{ ...inp, resize: "vertical" }} />
        )}
        <button onClick={add} disabled={busy} style={{ ...btn(C.plum), marginTop: 12, opacity: busy ? .6 : 1 }}>
          {busy ? <><Loader2 size={16} className="spin" /> Adding…</> : <><Brain size={16} /> Add to brain</>}
        </button>
      </div>

      {loading && <div style={{ color: C.soft, fontSize: 13, marginBottom: 12 }}>Loading your brain…</div>}
      {items.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: 40 }}>
          <Brain size={32} color={C.soft} style={{ margin: "0 auto 12px" }} />
          <div style={{ fontWeight: 600 }}>Your brain is empty</div>
          <p style={{ color: C.soft, fontSize: 14, marginTop: 6 }}>Add notes and links above. The more you add, the better your agents know you.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map(it => (
            <div key={it.id} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: .4,
                  color: it.kind === "link" ? C.teal : C.plum }}>{it.kind}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{it.label}</span>
                <button onClick={() => remove(it.id)}
                  style={{ ...btn("transparent"), marginLeft: "auto", fontSize: 13, padding: "6px 10px", color: C.rust }}>
                  Remove
                </button>
              </div>
              <div style={{ fontSize: 13, color: C.soft, lineHeight: 1.5, maxHeight: 110, overflow: "auto", whiteSpace: "pre-wrap" }}>
                {it.content.length > 400 ? it.content.slice(0, 400) + "…" : it.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Conversation history viewer (browse + search) ---- */
function HistoryPanel({ auth, onOpenAgent }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null); // agentId expanded

  useEffect(() => {
    if (api.live() && auth?.token) {
      setLoading(true);
      api.listHistory(auth.token).then(d => setChats(d.chats || [])).catch(() => {}).finally(() => setLoading(false));
    }
  }, [auth]);

  const agentName = id => (AGENTS.find(a => a.id === id)?.name || id);
  const agentColor = id => (AGENTS.find(a => a.id === id)?.color || C.rust);

  // Filter by search text across all messages.
  const filtered = !q.trim() ? chats : chats.filter(c =>
    c.messages.some(m => (m.text || "").toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="rise">
      <PageTitle title="History" sub="Browse and search every conversation with your agents." />

      {!api.live() ? (
        <div style={{ ...card, color: C.soft }}>Conversation history is available on the live site once you're logged in.</div>
      ) : (
        <>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search your conversations…"
            style={{ ...inp, marginBottom: 16 }} />
          {loading && <div style={{ color: C.soft, fontSize: 13 }}>Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ ...card, textAlign: "center", padding: 40 }}>
              <Clock size={32} color={C.soft} style={{ margin: "0 auto 12px" }} />
              <div style={{ fontWeight: 600 }}>{q ? "No matches" : "No conversations yet"}</div>
              <p style={{ color: C.soft, fontSize: 14, marginTop: 6 }}>
                {q ? "Try a different search." : "Chat with any agent and it'll show up here automatically."}
              </p>
            </div>
          )}
          <div style={{ display: "grid", gap: 12 }}>
            {filtered.map(c => (
              <div key={c.agentId} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: agentColor(c.agentId) }}>{agentName(c.agentId)}</span>
                  <span style={{ color: C.soft, fontSize: 12 }}>{c.count} messages</span>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button onClick={() => setOpen(open === c.agentId ? null : c.agentId)}
                      style={{ ...btn("transparent"), fontSize: 13, padding: "7px 12px" }}>
                      {open === c.agentId ? "Hide" : "Preview"}
                    </button>
                    <button onClick={() => onOpenAgent(c.agentId)}
                      style={{ ...btn(agentColor(c.agentId)), fontSize: 13, padding: "7px 12px" }}>
                      Open chat
                    </button>
                  </div>
                </div>
                {open === c.agentId && (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${C.line}`, paddingTop: 12,
                    display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflow: "auto" }}>
                    {c.messages.map((m, i) => (
                      <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%",
                        background: m.role === "user" ? agentColor(c.agentId) : C.cream,
                        color: m.role === "user" ? "#fff" : C.ink, padding: "8px 12px", borderRadius: 11,
                        fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap",
                        border: m.role === "user" ? "none" : `1px solid ${C.line}` }}>
                        {m.img ? <img src={m.img} alt="" style={{ width: 180, borderRadius: 8, display: "block" }} /> : m.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Saved items library ---- */
function SavedPanel({ auth, saved, setSaved }) {
  const [loading, setLoading] = useState(false);

  // In live mode, load saved items from the backend so they persist across logins.
  useEffect(() => {
    if (api.live() && auth?.token) {
      setLoading(true);
      api.listSaved(auth.token)
        .then(d => setSaved((d.items || []).map(i => ({
          id: i.id, tool: i.tool, text: i.text,
          when: new Date(i.when).toLocaleString(),
        }))))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [auth]);

  function remove(id) {
    setSaved(list => (list || []).filter(s => s.id !== id));
    if (api.live() && auth?.token) api.deleteSaved(auth.token, id).catch(() => {});
  }

  return (
    <div className="rise">
      <PageTitle title="Saved" sub="Everything you've saved from your tools and agents, in one place." />
      {loading && <div style={{ color: C.soft, fontSize: 13, marginBottom: 12 }}>Loading your saved items…</div>}
      {(!saved || saved.length === 0) ? (
        <div style={{ ...card, textAlign: "center", padding: 40 }}>
          <Inbox size={32} color={C.soft} style={{ margin: "0 auto 12px" }} />
          <div style={{ fontWeight: 600 }}>Nothing saved yet</div>
          <p style={{ color: C.soft, fontSize: 14, marginTop: 6 }}>
            Use the Save button on any tool or agent reply, and it'll show up here.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {saved.map(item => {
            const isImage = typeof item.text === "string" && item.text.startsWith("data:image");
            return (
            <div key={item.id} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{item.tool}</span>
                <span style={{ color: C.soft, fontSize: 12 }}>{item.when}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  {isImage ? (
                    <button onClick={() => saveImage(item.text, `${(item.tool || "anthem").replace(/\s+/g, "-")}.png`)}
                      style={{ ...btn("transparent"), fontSize: 13, padding: "8px 12px" }}>
                      <Download size={15} /> Download
                    </button>
                  ) : (
                    <>
                      <CopyButton text={item.text} />
                      <button onClick={() => downloadText(`${(item.tool || "anthem").replace(/\s+/g, "-")}.txt`, item.text)}
                        style={{ ...btn("transparent"), fontSize: 13, padding: "8px 12px" }}>
                        <Download size={15} /> Download
                      </button>
                    </>
                  )}
                  <button onClick={() => remove(item.id)}
                    style={{ ...btn("transparent"), fontSize: 13, padding: "8px 12px", color: C.rust }}>
                    Delete
                  </button>
                </div>
              </div>
              {isImage ? (
                <img src={item.text} alt={item.tool} style={{ width: 300, maxWidth: "100%",
                  borderRadius: 12, border: `1px solid ${C.line}`, display: "block" }} />
              ) : (
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.55, color: C.ink,
                  maxHeight: 160, overflow: "auto" }}>{item.text}</div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Each agent gets a second "work" tab (like Marblism's Chat / Posts / Docs).
// label = tab name, kind = what it shows.
const WORK_TABS = {
  social:  { label: "Posts",     kind: "saved-images" },
  image:   { label: "Gallery",   kind: "saved-images" },
  blog:    { label: "Drafts",    kind: "saved-text" },
  legal:   { label: "Documents", kind: "saved-text" },
  anr:     { label: "Plans",     kind: "saved-text" },
  booking: { label: "Outreach",  kind: "saved-text" },
  finance: { label: "Notes",     kind: "saved-text" },
  chat:    { label: "Snippets",  kind: "saved-text" },
};

const AGENT_SYSTEMS = {
  anr: "You are Nora, an AI A&R and music career strategist. Advise artists on release strategy, audience growth, positioning, and honest creative direction. Be specific and practical. Be concise.",
  social: "You are Mia, an AI social media and fan-engagement manager for musicians. Plan release content, write captions in the artist's voice, and grow fan loyalty. Be punchy and concise.",
  booking: "You are Theo, an AI booking and gig-outreach agent. Find suitable venues/promoters, draft booking pitches, and help route tours sensibly. Be concise and practical. IMPORTANT: Whenever a specific booking, gig, show, or meeting gets confirmed or scheduled with a clear date (and ideally a time), end your message with a single hidden tag on its own line in EXACTLY this format: [[BOOKING]]{\"title\":\"...\",\"withWho\":\"...\",\"date\":\"YYYY-MM-DD\",\"time\":\"HH:MM\",\"notes\":\"...\"}[[/BOOKING]] — use 24-hour time, omit time if unknown, and only include this tag when there is a real date to add. Do not mention the tag to the user.",
  legal: "You are Sol, an AI assistant for music royalties and contracts. Explain splits, royalties, and contract terms in plain language and flag risk. Always note you are not a substitute for a licensed music attorney. Be concise.",
  blog: "You are Remy, an AI writer for musicians. Draft press releases, artist bios, EPK copy, and playlist pitches in the artist's voice. Be polished and concise.",
  chat: "You are Cleo, a friendly 24/7 website chat widget for a musician or band. Answer fan questions (tour dates, releases, merch), handle venue and booking inquiries, capture contact info for leads, and escalate hot inquiries to the artist. Be warm, upbeat, and concise.",
  finance: "You are June, a financial literacy coach for musicians. Help with tour budgeting, understanding royalty and streaming income, planning for self-employment taxes, separating business and personal finances, and reading their numbers in plain English. Always note you are NOT a licensed financial advisor, accountant, or tax preparer, and recommend a qualified professional for filing, investment, or major decisions. Never give specific investment picks. Be practical and concise.",
  image: "You are Iris, an AI cover-art and promo image maker for musicians. You generate a single self-contained SVG image (viewBox 0 0 400 400) based on the description. Use gradients, shapes, and typography tastefully. Respond with ONLY the raw <svg>...</svg> markup, no backticks, no explanation.",
};

// Shown instead of an agent's chat when the user's plan doesn't include it.
function LockedAgent({ agent, plan, user, onUpgrade }) {
  const trialExpired = plan === "trial"; // reaches here only if trial ended
  // Cheapest paid plan that unlocks this agent.
  const needed = ["indie", "artist", "label"].find(p => (PLAN_AGENTS[p] || []).includes(agent.id)) || "artist";
  const planName = { indie: "Indie", artist: "Artist", label: "Label" }[needed];
  const planPrice = { indie: 29, artist: 79, label: 249 }[needed];
  return (
    <div className="rise" style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
      <div style={{ ...card, maxWidth: 420, textAlign: "center", padding: 40 }}>
        <div style={{ width: 64, height: 64, margin: "0 auto 16px", position: "relative", display: "inline-block" }}>
          <AgentAvatar agent={agent} size={64} radius={16} />
          <div style={{ position: "absolute", bottom: -6, right: -6, width: 26, height: 26, borderRadius: "50%",
            background: C.ink, display: "grid", placeItems: "center" }}>
            <Lock size={13} color="#fff" />
          </div>
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 600 }}>
          {trialExpired ? "Your free trial has ended" : `${agent.name} is locked`}
        </div>
        <div style={{ color: agent.color, fontSize: 12, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: .4, marginTop: 4 }}>{agent.role}</div>
        <p style={{ color: C.soft, fontSize: 14, lineHeight: 1.55, marginTop: 12 }}>
          {trialExpired
            ? `Your 2-day free trial is over. Choose a plan to keep working with ${agent.name} and the rest of your team.`
            : agent.blurb}
        </p>
        <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, margin: "16px 0" }}>
          <div style={{ fontSize: 14 }}>
            {trialExpired ? "Plans start at" : <>Unlock {agent.name} with the <strong>{planName}</strong> plan</>}
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, marginTop: 4 }}>
            ${trialExpired ? 29 : planPrice}<span style={{ fontSize: 14, color: C.soft, fontWeight: 400 }}>/mo</span>
          </div>
        </div>
        <button onClick={onUpgrade} style={{ ...btn(agent.color), width: "100%", justifyContent: "center" }}>
          <Rocket size={16} /> {trialExpired ? "Choose a plan" : `Upgrade to ${planName}`}
        </button>
      </div>
    </div>
  );
}

// The per-agent "work" tab — shows what this agent has produced and saved
// (Marblism-style Posts/Documents/Gallery). Pulls from the saved-items store.
function AgentWorkTab({ agent, auth, setSaved }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const cfg = WORK_TABS[agent.id] || { label: "Saved", kind: "saved-text" };
  const wantImages = cfg.kind === "saved-images";

  useEffect(() => {
    if (api.live() && auth?.token) {
      setLoading(true);
      api.listSaved(auth.token)
        .then(d => setItems((d.items || []).map(i => ({
          id: i.id, tool: i.tool, text: i.text, when: new Date(i.when).toLocaleString(),
        }))))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [auth]);

  // Show items this agent made (matched by the tool/name we save under).
  const mine = items.filter(it => {
    const isImg = typeof it.text === "string" && it.text.startsWith("data:image");
    const fromAgent = (it.tool || "").toLowerCase().includes(agent.name.toLowerCase());
    return wantImages ? isImg : (!isImg && fromAgent);
  });

  function remove(id) {
    setItems(list => list.filter(s => s.id !== id));
    setSaved?.(list => (list || []).filter(s => s.id !== id));
    if (api.live() && auth?.token) api.deleteSaved(auth.token, id).catch(() => {});
  }

  if (loading) return <div style={{ color: C.soft, fontSize: 13 }}>Loading…</div>;
  if (!mine.length) {
    return (
      <div style={{ ...card, textAlign: "center", padding: 40 }}>
        <Inbox size={30} color={C.soft} style={{ margin: "0 auto 10px" }} />
        <div style={{ fontWeight: 600 }}>No {cfg.label.toLowerCase()} yet</div>
        <p style={{ color: C.soft, fontSize: 14, marginTop: 6 }}>
          When you save {agent.name}'s {wantImages ? "images" : "work"} from the Chat tab, it shows up here.
        </p>
      </div>
    );
  }

  if (wantImages) {
    return (
      <div className="scroll" style={{ flex: 1, overflow: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          {mine.map(it => (
            <div key={it.id} style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", background: C.card }}>
              <img src={it.text} alt="" style={{ width: "100%", display: "block", aspectRatio: "1", objectFit: "cover" }} />
              <div style={{ display: "flex", gap: 6, padding: 8 }}>
                <button onClick={() => saveImage(it.text, "anthem-image.png")}
                  style={{ ...btn("transparent"), fontSize: 12, padding: "6px 10px", flex: 1, justifyContent: "center" }}>
                  <Download size={13} /> Save
                </button>
                <button onClick={() => remove(it.id)}
                  style={{ ...btn("transparent"), fontSize: 12, padding: "6px 10px", color: C.rust }}>
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="scroll" style={{ flex: 1, overflow: "auto", display: "grid", gap: 12 }}>
      {mine.map(it => (
        <div key={it.id} style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{it.tool}</span>
            <span style={{ color: C.soft, fontSize: 12 }}>{it.when}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <CopyButton text={it.text} />
              <button onClick={() => remove(it.id)}
                style={{ ...btn("transparent"), fontSize: 13, padding: "8px 12px", color: C.rust }}>Delete</button>
            </div>
          </div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.55, color: C.ink, maxHeight: 200, overflow: "auto" }}>{it.text}</div>
        </div>
      ))}
    </div>
  );
}

// Chip shown under a Theo message when he's confirmed a booking — one tap to save it.
function AddToCalendarChip({ booking, auth }) {
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const niceDate = (() => {
    try {
      const dt = new Date(`${booking.date}T${booking.time || "12:00"}`);
      return dt.toLocaleString([], { weekday: "short", month: "short", day: "numeric",
        ...(booking.time ? { hour: "numeric", minute: "2-digit" } : {}) });
    } catch { return booking.date; }
  })();
  async function add() {
    if (busy || added) return;
    setBusy(true);
    try {
      const startsAt = new Date(`${booking.date}T${booking.time || "12:00"}`).toISOString();
      const payload = { title: booking.title || "Booking", withWho: booking.withWho || "",
        startsAt, notes: booking.notes || "" };
      if (api.live() && auth?.token) await api.addBooking(auth.token, payload);
      setAdded(true);
    } catch (e) { alert(e.message || "Couldn't add to calendar."); }
    finally { setBusy(false); }
  }
  return (
    <div style={{ marginTop: 8, padding: "10px 12px", border: `1px solid ${C.teal}55`,
      background: `${C.teal}12`, borderRadius: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <CalendarPlus size={16} color={C.teal} />
      <div style={{ flex: 1, minWidth: 160, fontSize: 13 }}>
        <div style={{ fontWeight: 700 }}>{booking.title || "Booking"}</div>
        <div style={{ color: C.soft }}>{niceDate}{booking.withWho ? ` · ${booking.withWho}` : ""}</div>
      </div>
      <button onClick={add} disabled={busy || added}
        style={{ ...btn(added ? C.sage : C.teal), fontSize: 13, padding: "8px 14px", opacity: busy ? .6 : 1 }}>
        {added ? <><Check size={15} /> Added to calendar</> : busy ? "Adding…" : <><CalendarPlus size={15} /> Add to calendar</>}
      </button>
    </div>
  );
}

function AgentPanel({ agent, auth, profile, setSaved }) {
  const [msgs, setMsgs] = useState([{ role: "assistant", text: agent.sample }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState(agent.model);
  const [attached, setAttached] = useState(null); // { name, text }
  const [loaded, setLoaded] = useState(false); // history loaded yet?
  const [savedTick, setSavedTick] = useState(false); // shows "Saved" briefly
  const [view, setView] = useState("chat"); // chat | work
  const fileRef = useRef(null);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy, view]);

  // Load saved conversation when opening this agent (live mode only).
  useEffect(() => {
    let cancelled = false;
    if (api.live() && auth?.token) {
      api.getHistory(auth.token, agent.id)
        .then(({ messages }) => {
          if (!cancelled && Array.isArray(messages) && messages.length) setMsgs(messages);
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoaded(true); });
    } else {
      setLoaded(true);
    }
    return () => { cancelled = true; };
  }, [agent.id, auth]);

  // Background mode: if a job was running when the user left this agent, resume it.
  useEffect(() => {
    let cancelled = false;
    if (!api.live() || !auth?.token) return;
    let jid = null;
    try { jid = localStorage.getItem(`anthem_job_${agent.id}`); } catch {}
    if (!jid) return;
    setBusy(true);
    (async () => {
      for (let i = 0; i < 180 && !cancelled; i++) {
        await new Promise(r => setTimeout(r, 1000));
        let job;
        try { job = await api.chatJob(auth.token, jid); } catch { continue; }
        if (job.status === "done") {
          if (!cancelled) setMsgs(m => [...m, { role: "assistant", text: job.isSvg ? "" : (job.result || "…"), svg: job.isSvg ? job.result : undefined }]);
          break;
        }
        if (job.status === "error") break;
      }
      try { localStorage.removeItem(`anthem_job_${agent.id}`); } catch {}
      if (!cancelled) setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [agent.id, auth]);

  // Auto-save the conversation whenever it changes (after the initial load).
  useEffect(() => {
    if (!loaded || !api.live() || !auth?.token) return;
    // Don't bother saving a brand-new empty chat (just the greeting).
    if (msgs.length <= 1) return;
    const t = setTimeout(() => {
      api.saveHistory(auth.token, agent.id, msgs)
        .then(() => { setSavedTick(true); setTimeout(() => setSavedTick(false), 1500); })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [msgs, loaded]);

  function clearChat() {
    setMsgs([{ role: "assistant", text: agent.sample }]);
    if (api.live() && auth?.token) api.clearHistory(auth.token, agent.id).catch(() => {});
  }

  // Agents that benefit from document uploads.
  const ALLOW_UPLOAD = ["legal", "blog", "anr"]; // Sol, Remy, Nora
  const canUpload = ALLOW_UPLOAD.includes(agent.id);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Please choose a file under 10MB."); return; }
    setBusy(true);
    try {
      const isText = file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name);
      if (isText) {
        const text = await file.text();
        setAttached({ name: file.name, text: text.slice(0, 20000) });
      } else if (api.live()) {
        // PDF / Word need backend extraction.
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        const { text } = await api.extract(auth.token, file.name, file.type, b64);
        setAttached({ name: file.name, text });
      } else {
        alert("PDF/Word reading works on the live site. In preview, upload a .txt or paste the text.");
      }
    } catch (err) {
      alert(err.message || "Couldn't read that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Persona + the artist profile (memory) so the agent personalizes its replies.
  const systemFor = (AGENT_SYSTEMS[agent.id] || "") + profileToContext(profile);

  async function send() {
    const q = input.trim();
    if ((!q && !attached) || busy) return;
    // Build the visible message and the text actually sent to the agent.
    const displayText = attached ? `${q || "Take a look at this file:"}  📎 ${attached.name}` : q;
    const sentText = attached
      ? `${q || "Please review this document."}\n\n--- Attached file: ${attached.name} ---\n${attached.text}`
      : q;
    const next = [...msgs, { role: "user", text: displayText }];
    setMsgs(next); setInput(""); setBusy(true);
    // Payload uses the full file text; the on-screen history shows the short version.
    const payload = next.map((m, idx) =>
      idx === next.length - 1
        ? { role: "user", content: sentText }
        : { role: m.role === "user" ? "user" : "assistant", content: m.text });
    setAttached(null);
    try {
      // The image agent (Iris) uses the real image API when live.
      if (agent.id === "image") {
        if (api.live()) {
          const data = await api.generateImage(auth.token, q);
          setMsgs(m => [...m, { role: "assistant",
            text: `Here's "${q}"${data.usage ? ` · ${data.usage.remaining} images left this month` : ""}:`,
            img: data.image }]);
        } else {
          // Preview fallback: SVG sketch (real raster needs the backend + OpenAI key).
          const raw = await directCall(systemFor, payload);
          const svg = (raw.match(/<svg[\s\S]*<\/svg>/i) || [])[0];
          setMsgs(m => [...m, svg
            ? { role: "assistant", text: `Preview sketch for "${q}" (deploy with an image key for real art):`, svg }
            : { role: "assistant", text: "Couldn't render that one — try rephrasing." }]);
        }
        return;
      }
      if (api.live()) {
        // Route through your backend (AI key stays server-side). Prepend profile
        // context so the server-side persona personalizes to this artist.
        const ctx = profileToContext(profile);
        const sent = ctx ? [{ role: "user", content: `(Context about me — keep in mind:${ctx})` },
                            { role: "assistant", content: "Got it — I'll keep your profile in mind." },
                            ...payload] : payload;
        const data = await api.chatBackground(auth.token, agent.id, sent, {
          onJobId: (jid) => { try { localStorage.setItem(`anthem_job_${agent.id}`, jid); } catch {} },
        });
        try { localStorage.removeItem(`anthem_job_${agent.id}`); } catch {}
        setMsgs(m => [...m, { role: "assistant", text: data.text || "…" }]);
      } else {
        // Preview fallback: direct demo call.
        const raw = await directCall(systemFor, payload);
        setMsgs(m => [...m, { role: "assistant", text: raw || "…" }]);
      }
    } catch (e) {
      setMsgs(m => [...m, { role: "assistant", text: `⚠️ ${e.message || "Connection issue — try again."}` }]);
    } finally { setBusy(false); }
  }

  // Lets Mia (social) turn the current message into a promo graphic.
  async function makeGraphic() {
    const q = input.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user", text: `Make a graphic: ${q}` }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      if (api.live()) {
        const data = await api.generateImage(auth.token, q);
        setMsgs(m => [...m, { role: "assistant",
          text: `Here's a graphic for "${q}"${data.usage ? ` · ${data.usage.remaining} images left this month` : ""}:`,
          img: data.image }]);
      } else {
        setMsgs(m => [...m, { role: "assistant", text: "Graphic generation works on the live site (needs the image key). In preview, I can write the caption instead!" }]);
      }
    } catch (e) {
      setMsgs(m => [...m, { role: "assistant", text: `⚠️ ${e.message || "Couldn't make that graphic."}` }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="rise" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <AgentAvatar agent={agent} size={44} radius={11} />
        <div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 23, fontWeight: 600 }}>{agent.name}</div>
          <div style={{ color: agent.color, fontSize: 12, textTransform: "uppercase", letterSpacing: .4 }}>{agent.role}</div>
        </div>
        <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8,
          background: C.card, border: `1px solid ${C.line}`, padding: "8px 12px", borderRadius: 10 }}>
          <Cpu size={15} color={agent.color} />
          <span style={{ color: C.soft, fontSize: 12 }}>Model</span>
          <select value={model} onChange={e => setModel(e.target.value)}
            style={{ background: "transparent", color: C.ink, border: "none", outline: "none",
              fontFamily: FONT_BODY, fontSize: 13, cursor: "pointer" }}>
            {MODELS.map(m => <option key={m.id} value={m.id}>{m.label} · {m.vendor}</option>)}
          </select>
        </label>
        {api.live() && (savedTick
          ? <span style={{ display: "flex", alignItems: "center", gap: 5, color: C.sage, fontSize: 12, fontWeight: 600 }}>
              <Check size={14} /> Saved
            </span>
          : <span style={{ display: "flex", alignItems: "center", gap: 5, color: C.soft, fontSize: 12 }}>
              <Clock size={13} /> Auto-saved
            </span>)}
        <button onClick={clearChat} title="Clear this conversation"
          style={{ ...btn("transparent"), fontSize: 13, padding: "8px 12px" }}>
          <X size={15} /> Clear
        </button>
      </div>

      {/* Chat / work tabs (Marblism-style) */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.line}`, marginBottom: 14 }}>
        {[{ id: "chat", label: "Chat", icon: MessageCircle },
          { id: "work", label: WORK_TABS[agent.id]?.label || "Saved", icon: Inbox }].map(t => (
          <button key={t.id} onClick={() => setView(t.id)}
            style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none",
              cursor: "pointer", fontFamily: FONT_BODY, fontSize: 14, padding: "10px 16px",
              color: view === t.id ? C.ink : C.soft, fontWeight: view === t.id ? 600 : 400,
              borderBottom: `2px solid ${view === t.id ? agent.color : "transparent"}`, marginBottom: -1 }}>
            <t.icon size={16} color={view === t.id ? agent.color : C.soft} /> {t.label}
          </button>
        ))}
      </div>

      {view === "work" && (
        <AgentWorkTab agent={agent} auth={auth} setSaved={setSaved} />
      )}

      {view === "chat" && <>

      <div className="scroll" style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 6 }}>
        {msgs.map((m, i) => {
          // Detect a booking suggestion Theo embedded (and hide the raw tag).
          let booking = null, displayText = m.text;
          if (m.role !== "user" && typeof m.text === "string" && m.text.includes("[[BOOKING]]")) {
            const match = m.text.match(/\[\[BOOKING\]\]([\s\S]*?)\[\[\/BOOKING\]\]/);
            if (match) {
              try { booking = JSON.parse(match[1].trim()); } catch {}
              displayText = m.text.replace(/\[\[BOOKING\]\][\s\S]*?\[\[\/BOOKING\]\]/, "").trim();
            }
          }
          return (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "78%" }}>
            <div style={{
              background: m.role === "user" ? agent.color : C.card,
              color: m.role === "user" ? "#fff" : C.ink,
              padding: "12px 15px", borderRadius: 14,
              borderTopRightRadius: m.role === "user" ? 4 : 14,
              borderTopLeftRadius: m.role === "user" ? 14 : 4,
              fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap",
              border: m.role === "user" ? "none" : `1px solid ${C.line}` }}>
              {displayText}
            </div>
            {booking && booking.date && <AddToCalendarChip booking={booking} auth={auth} />}
            {m.svg && (
              <div style={{ marginTop: 8, borderRadius: 14, overflow: "hidden", border: `1px solid ${C.line}`,
                width: 280, height: 280, background: "#fff" }}
                dangerouslySetInnerHTML={{ __html: m.svg.replace(/<svg/, '<svg width="280" height="280"') }} />
            )}
            {m.img && (
              <div style={{ marginTop: 8 }}>
                <img src={m.img} alt="Generated artwork" style={{ width: 320, maxWidth: "100%",
                  borderRadius: 14, border: `1px solid ${C.line}`, display: "block" }} />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={() => saveImage(m.img, "anthem-artwork.png")}
                    style={{ ...btn("transparent"), fontSize: 13, padding: "8px 14px" }}>
                    <Download size={15} /> Download
                  </button>
                  <button onClick={() => {
                      const item = { id: Date.now(), tool: `${agent.name} image`, text: m.img, when: new Date().toLocaleString() };
                      setSaved?.(list => [item, ...(list || [])]);
                      if (api.live() && auth?.token) api.addSaved(auth.token, `${agent.name} image`, m.img).catch(() => {});
                    }}
                    style={{ ...btn("transparent"), fontSize: 13, padding: "8px 14px" }}>
                    <Inbox size={15} /> Save
                  </button>
                  {agent.id === "social" && <PostMenu token={auth?.token} image={m.img} />}
                </div>
              </div>
            )}
            {/* Copy + save + schedule actions on assistant text replies */}
            {m.role !== "user" && m.text && i !== 0 && (
              <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <CopyButton text={displayText} color={agent.color} />
                <button onClick={() => {
                    const item = { id: Date.now(), tool: agent.name, text: displayText, when: new Date().toLocaleString() };
                    setSaved?.(list => [item, ...(list || [])]);
                    if (api.live() && auth?.token) api.addSaved(auth.token, agent.name, displayText).catch(() => {});
                  }}
                  style={{ ...btn("transparent"), fontSize: 13, padding: "8px 12px" }}>
                  <Inbox size={15} /> Save
                </button>
                {(agent.id === "social" || agent.id === "blog") && (
                  <ScheduleReminder defaultTitle={agent.id === "social" ? "Post this to social" : "Publish this"} />
                )}
                {agent.id === "social" && <PostMenu token={auth?.token} text={m.text} />}
              </div>
            )}
          </div>
          );
        })}
        {busy && <div style={{ color: C.soft, fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
          <Mic2 size={15} color={agent.color} /> {agent.name} is {agent.id === "image" ? "creating" : "thinking"}…</div>}
        <div ref={endRef} />
      </div>

      {/* Attached file chip */}
      {attached && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10,
          background: C.cream, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 12px", fontSize: 13 }}>
          <FileText size={15} color={agent.color} />
          <span style={{ flex: 1 }}>{attached.name}</span>
          <button onClick={() => setAttached(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.soft }}>
            <X size={15} />
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        {canUpload && (
          <>
            <input ref={fileRef} type="file" accept=".txt,.md,.pdf,.docx,text/plain,application/pdf"
              onChange={onFile} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={busy}
              title="Upload a document (txt, pdf, docx)"
              style={{ ...btn("transparent"), opacity: busy ? .5 : 1 }}>
              <Download size={17} style={{ transform: "rotate(180deg)" }} />
            </button>
          </>
        )}
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder={agent.id === "image" ? "Describe cover art or a promo graphic…" : `Message ${agent.name}…`}
          style={{ flex: 1, background: C.card, border: `1px solid ${C.line}`, color: C.ink,
            padding: "13px 16px", borderRadius: 12, fontSize: 14, outline: "none", fontFamily: FONT_BODY }} />
        {agent.id === "social" && (
          <button onClick={makeGraphic} disabled={busy} title="Generate a promo graphic"
            style={{ ...btn("transparent"), opacity: busy ? .5 : 1 }}>
            <ImageIcon size={17} />
          </button>
        )}
        <button onClick={send} disabled={busy} style={{ ...btn(agent.color), opacity: busy ? .5 : 1 }}>
          <Send size={17} />
        </button>
      </div>
      </>}
    </div>
  );
}

/* ---- Sync licensing: get tracks sync-ready + pitch pack ---- */
const SYNC_CHECKLIST = [
  ["mastered", "Broadcast-ready master", "A clean, mastered mix at streaming/broadcast loudness."],
  ["instrumental", "Instrumental version", "Supervisors need this to place under dialogue."],
  ["stems", "Stems available", "Separate tracks (drums, vocals, etc.) for editing."],
  ["cleanEdit", "Clean / radio edit", "No explicit language, for ads & broadcast."],
  ["cleared", "Rights cleared", "All splits agreed & documented (see Royalties & Splits)."],
];
const SYNC_META = [
  ["isrc", "ISRC code", "From your distributor (e.g. US-XXX-YY-NNNNN)"],
  ["iswc", "ISWC code", "From your PRO registration"],
  ["pro", "PRO affiliation", "ASCAP, BMI, SESAC, or your local PRO"],
  ["publisher", "Publisher", "Your publishing entity or your name if self-published"],
  ["writers", "Writer(s) — legal names", "Everyone who wrote it, full legal names"],
  ["instruments", "Instrumentation", "e.g. acoustic guitar, strings, light percussion"],
  ["moods", "Moods / sync tags", "e.g. uplifting, cinematic, hopeful, building"],
  ["bpm", "BPM", "Tempo in beats per minute"],
];
const SYNC_PLATFORMS = [
  ["Songtradr", "https://www.songtradr.com"],
  ["Musicbed", "https://www.musicbed.com"],
  ["Artlist", "https://artlist.io"],
  ["DISCO", "https://disco.ac"],
  ["Music Vine", "https://musicvine.com"],
];

function pitchPackHTML(t) {
  const d = t.data || {};
  const esc = s => (s || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const meta = SYNC_META.filter(([k]) => d[k]).map(([k, label]) => `<tr><td style="color:#6b6258;padding:4px 12px 4px 0">${label}</td><td>${esc(d[k])}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(t.title)} — Sync Sheet</title>
  <style>body{font-family:Georgia,serif;color:#1f1a16;max-width:680px;margin:0 auto;padding:48px;line-height:1.5}
  h1{border-bottom:3px solid #c2542d;padding-bottom:12px;margin-bottom:6px} table{border-collapse:collapse;margin-top:10px}
  td{padding:4px 0;vertical-align:top;font-size:15px} .tag{display:inline-block;background:#eee;border-radius:20px;padding:3px 12px;margin:3px 4px 0 0;font-size:13px}
  @media print{body{padding:24px}}</style></head><body>
  <h1>${esc(t.title)}</h1>
  <div style="color:#c2542d;font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:13px">Sync Licensing One-Sheet</div>
  <table>${meta}</table>
  ${d.moods ? `<div style="margin-top:16px"><strong>Tags:</strong> ${d.moods.split(",").map(m => `<span class="tag">${esc(m.trim())}</span>`).join("")}</div>` : ""}
  <p style="margin-top:24px;color:#999;font-size:12px">Prepared with Anthem. Rights represented as cleared by the submitting artist.</p>
  </body></html>`;
}
function printPitchPack(t) {
  const w = window.open("", "_blank");
  if (!w) { alert("Please allow pop-ups to export the pitch pack."); return; }
  w.document.write(pitchPackHTML(t)); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}

function SyncPanel({ auth }) {
  const [tracks, setTracks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  async function load() {
    if (api.live() && auth?.token) {
      try { const d = await api.listSync(auth.token); setTracks(d.tracks || []); } catch {}
    }
  }
  useEffect(() => { load(); }, [auth]);

  async function add() {
    if (!title.trim()) return;
    try { await api.addSync(auth.token, title.trim(), {}); setTitle(""); setAdding(false); load(); }
    catch (e) { alert(e.message); }
  }

  return (
    <div className="rise">
      <PageTitle title="Sync Licensing" sub="Get your tracks placement-ready for film, TV, ads & games." />

      <div style={{ ...card, marginBottom: 18, padding: "14px 16px", fontSize: 13, color: C.soft, lineHeight: 1.6 }}>
        <strong style={{ color: C.ink }}>How sync works:</strong> music supervisors get thousands of submissions and only consider tracks that are fully prepared — mastered, with an instrumental, clean metadata, and cleared rights. Anthem gets each track sync-ready and builds a one-sheet you can submit. Ask <strong>Sol</strong> for guidance on rights and contracts.
      </div>

      {!adding ? (
        <button onClick={() => setAdding(true)} style={{ ...btn(C.rust), marginBottom: 18 }}>
          <Music size={16} /> Add a track
        </button>
      ) : (
        <div style={{ ...card, marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Track title" style={{ ...inp, flex: 1, minWidth: 200 }} onKeyDown={e => e.key === "Enter" && add()} />
          <button onClick={add} style={btn(C.rust)}>Add</button>
          <button onClick={() => setAdding(false)} style={btn("transparent")}>Cancel</button>
        </div>
      )}

      {tracks.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: C.soft, padding: 30 }}>
          <Music size={28} color={C.soft} style={{ margin: "0 auto 10px" }} />
          No tracks yet. Add one to start getting it sync-ready.
        </div>
      ) : tracks.map(t => <SyncTrackCard key={t.id} track={t} auth={auth} onChange={load} />)}

      <div style={{ ...card, marginTop: 22, background: `${C.plum}0d`, borderColor: `${C.plum}40` }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Where to submit</div>
        <p style={{ color: C.soft, fontSize: 13, marginTop: 0 }}>Once a track is sync-ready, submit it to established platforms (Anthem isn't affiliated):</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SYNC_PLATFORMS.map(([n, u]) => (
            <a key={n} href={u} target="_blank" rel="noopener" style={{ ...btn("transparent"), fontSize: 13, padding: "8px 14px", textDecoration: "none" }}>{n} →</a>
          ))}
        </div>
      </div>
    </div>
  );
}

function SyncTrackCard({ track, auth, onChange }) {
  const [data, setData] = useState(track.data || {});
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);

  const done = SYNC_CHECKLIST.filter(([k]) => data[k]).length;
  const score = Math.round((done / SYNC_CHECKLIST.length) * 100);
  const ready = score === 100;

  function toggle(k) { setData(d => ({ ...d, [k]: !d[k] })); setDirty(true); }
  function setMeta(k, v) { setData(d => ({ ...d, [k]: v })); setDirty(true); }
  async function save() {
    try { await api.updateSync(auth.token, track.id, { data }); setDirty(false); onChange?.(); }
    catch (e) { alert(e.message); }
  }
  async function del() {
    if (!confirm(`Delete "${track.title}"?`)) return;
    try { await api.deleteSync(auth.token, track.id); onChange?.(); } catch (e) { alert(e.message); }
  }

  return (
    <div style={{ ...card, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600, color: C.ink }}>
            {track.title}
          </button>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
            background: ready ? `${C.sage}22` : `${C.gold}22`, color: ready ? C.sage : C.gold }}>
            {ready ? "Sync-ready ✓" : `${score}% ready`}
          </span>
        </div>
        <button onClick={del} style={{ background: "none", border: "none", color: C.soft, cursor: "pointer", display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}>
          <Trash2 size={14} /> Delete
        </button>
      </div>

      {/* progress bar */}
      <div style={{ height: 6, background: C.line, borderRadius: 6, marginTop: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${score}%`, background: ready ? C.sage : C.gold, transition: "width .3s" }} />
      </div>

      {open && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Readiness checklist</div>
          <div style={{ display: "grid", gap: 8 }}>
            {SYNC_CHECKLIST.map(([k, label, desc]) => (
              <label key={k} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                <input type="checkbox" checked={!!data[k]} onChange={() => toggle(k)} style={{ width: 16, height: 16, marginTop: 3, accentColor: C.rust }} />
                <div><div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div><div style={{ color: C.soft, fontSize: 12 }}>{desc}</div></div>
              </label>
            ))}
          </div>

          <div style={{ fontWeight: 700, fontSize: 14, margin: "18px 0 8px" }}>Metadata (what supervisors require)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {SYNC_META.map(([k, label, ph]) => (
              <div key={k}>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 3 }}>{label}</label>
                <input value={data[k] || ""} onChange={e => setMeta(k, e.target.value)} placeholder={ph} style={{ ...inp, padding: "7px 10px", fontSize: 13 }} />
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button onClick={save} disabled={!dirty} style={{ ...btn(dirty ? C.rust : "transparent"), opacity: dirty ? 1 : .5 }}>
              {dirty ? "Save" : "Saved"}
            </button>
            <button onClick={() => printPitchPack({ ...track, data })} style={btn(C.plum)}>
              <Download size={15} /> Export pitch one-sheet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Fan mailing list / CRM ---- */
function FansPanel({ auth }) {
  const [fans, setFans] = useState([]);
  const [fanCode, setFanCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    if (api.live() && auth?.token) {
      try { const d = await api.listFans(auth.token); setFans(d.fans || []); setFanCode(d.fanCode || ""); } catch {}
    }
  }
  useEffect(() => { load(); }, [auth]);

  const signupUrl = fanCode ? `${window.location.origin}/?join=${fanCode}` : "";

  async function add() {
    if (!email.trim()) return;
    try { await api.addFan(auth.token, name.trim(), email.trim()); setName(""); setEmail(""); load(); }
    catch (e) { alert(e.message); }
  }
  async function remove(id) {
    try { await api.deleteFan(auth.token, id); load(); } catch (e) { alert(e.message); }
  }
  function exportCSV() {
    const rows = [["Name", "Email", "Source", "Joined"], ...fans.map(f => [f.name || "", f.email, f.source, new Date(f.when).toLocaleDateString()])];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "fans.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function sendBlast() {
    if (!subject.trim() || !message.trim()) { alert("Add a subject and message."); return; }
    if (!confirm(`Send this to all ${fans.length} fans?`)) return;
    setSending(true);
    try {
      const r = await api.blastFans(auth.token, subject.trim(), message.trim());
      alert(`Sent to ${r.sent} of ${r.total} fans.`);
      setComposing(false); setSubject(""); setMessage("");
    } catch (e) { alert(e.message); } finally { setSending(false); }
  }

  const filtered = fans.filter(f => !q || (f.email + (f.name || "")).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="rise">
      <PageTitle title="Fans" sub="Build your mailing list and reach your fans directly." />

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
        <div style={card}><div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, color: C.gold }}>{fans.length}</div><div style={{ color: C.soft, fontSize: 13 }}>Total fans</div></div>
        <div style={card}><div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, color: C.teal }}>{fans.filter(f => f.source === "signup").length}</div><div style={{ color: C.soft, fontSize: 13 }}>From signup page</div></div>
      </div>

      {/* Public signup link */}
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Your "join my list" link</div>
        <p style={{ color: C.soft, fontSize: 13, marginTop: 0 }}>Share this anywhere — bio, posts, shows. Fans who sign up land right here.</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <a href={signupUrl} target="_blank" rel="noopener" style={{ flex: 1, minWidth: 180, color: C.ink, fontSize: 13, wordBreak: "break-all" }}>{signupUrl}</a>
          <button onClick={() => { navigator.clipboard?.writeText(signupUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            style={{ ...btn(copied ? C.sage : C.teal), fontSize: 13, padding: "8px 14px" }}>
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}
          </button>
        </div>
      </div>

      {/* Add + actions */}
      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Add a fan</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (optional)" style={{ ...inp, flex: 1, minWidth: 120 }} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" style={{ ...inp, flex: 1, minWidth: 160 }} onKeyDown={e => e.key === "Enter" && add()} />
          <button onClick={add} style={btn(C.rust)}>Add</button>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={() => setComposing(c => !c)} style={btn(C.plum)}><MailIcon size={15} /> Email all fans</button>
          <button onClick={exportCSV} style={btn("transparent")}><Download size={15} /> Export CSV</button>
        </div>
      </div>

      {/* Blast composer */}
      {composing && (
        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Email all {fans.length} fans</div>
          <div style={{ display: "grid", gap: 10 }}>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject — e.g. My new single is out!" style={inp} />
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6} placeholder="Write your message to fans…" style={{ ...inp, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={sendBlast} disabled={sending} style={{ ...btn(C.rust), opacity: sending ? .6 : 1 }}>
                {sending ? "Sending…" : `Send to ${fans.length} fans`}
              </button>
              <button onClick={() => setComposing(false)} style={btn("transparent")}>Cancel</button>
            </div>
            <p style={{ color: C.soft, fontSize: 12, margin: 0 }}>Sent from your verified domain. An unsubscribe note is added automatically.</p>
          </div>
        </div>
      )}

      {/* Fan list */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>Your fans</div>
          {fans.length > 0 && <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" style={{ ...inp, width: 180, padding: "7px 10px" }} />}
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", color: C.soft, padding: 24 }}>
            {fans.length === 0 ? "No fans yet. Share your signup link or add one above." : "No matches."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ color: C.soft, textAlign: "left" }}>
                {["Name", "Email", "Source", ""].map(h => <th key={h} style={{ padding: "8px 10px", fontWeight: 600 }}>{h}</th>)}
              </tr></thead>
              <tbody>{filtered.map(f => (
                <tr key={f.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={{ padding: "10px" }}>{f.name || "—"}</td>
                  <td style={{ padding: "10px", wordBreak: "break-all" }}>{f.email}</td>
                  <td style={{ padding: "10px" }}><span style={{ fontSize: 11, color: f.source === "signup" ? C.teal : C.soft }}>{f.source}</span></td>
                  <td style={{ padding: "10px", textAlign: "right" }}>
                    <button onClick={() => remove(f.id)} style={{ background: "none", border: "none", color: C.soft, cursor: "pointer" }}><X size={15} /></button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Royalties & splits tracker ---- */
function splitSheetHTML(rel) {
  const esc = s => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rev = (rel.revenueCents || 0) / 100;
  const rows = (rel.splits || []).map(s => {
    const cut = rev * ((Number(s.pct) || 0) / 100);
    return `<tr><td>${esc(s.name)}</td><td>${esc(s.role || "")}</td><td style="text-align:right">${s.pct}%</td><td style="text-align:right">$${cut.toFixed(2)}</td></tr>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(rel.title)} — Split Sheet</title>
  <style>body{font-family:Georgia,serif;color:#1f1a16;max-width:680px;margin:0 auto;padding:48px;line-height:1.5}
  h1{border-bottom:3px solid #c2542d;padding-bottom:12px} table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{padding:10px;border-bottom:1px solid #eee;text-align:left} th{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#c2542d}
  .total{margin-top:18px;font-weight:bold} .sig{margin-top:40px;display:flex;gap:30px;flex-wrap:wrap}
  .sig div{flex:1;min-width:200px;border-top:1px solid #1f1a16;padding-top:6px;font-size:13px;color:#6b6258}
  @media print{body{padding:24px}}</style></head><body>
  <h1>${esc(rel.title)} — Split Sheet</h1>
  ${rel.revenueCents ? `<div>Revenue logged: <strong>$${rev.toFixed(2)}</strong></div>` : ""}
  <table><thead><tr><th>Name</th><th>Role</th><th style="text-align:right">Split</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="sig">${(rel.splits || []).map(s => `<div>${esc(s.name)} — signature & date</div>`).join("")}</div>
  <p style="margin-top:30px;color:#999;font-size:12px">Generated with Anthem. This is a record of agreed splits, not a legal contract.</p>
  </body></html>`;
}
function printSplitSheet(rel) {
  const w = window.open("", "_blank");
  if (!w) { alert("Please allow pop-ups to print the split sheet."); return; }
  w.document.write(splitSheetHTML(rel)); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}

function RoyaltiesPanel({ auth }) {
  const [releases, setReleases] = useState([]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  async function load() {
    if (api.live() && auth?.token) {
      try { const d = await api.listReleases(auth.token); setReleases(d.releases || []); } catch {}
    }
  }
  useEffect(() => { load(); }, [auth]);

  async function addRelease() {
    if (!title.trim()) return;
    try {
      await api.addRelease(auth.token, { title: title.trim(), splits: [{ name: "", role: "Artist", pct: 100 }], revenueCents: 0 });
      setTitle(""); setAdding(false); load();
    } catch (e) { alert(e.message); }
  }

  return (
    <div className="rise">
      <PageTitle title="Royalties & Splits" sub="Track who owns what on each release, and who's owed what." />

      <div style={{ ...card, marginBottom: 18, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", fontSize: 13, color: C.soft }}>
        <DollarSign size={16} color={C.sage} />
        <span style={{ flex: 1 }}>Log each release's collaborator splits and any revenue you receive — Anthem calculates everyone's cut. Ask <strong>June</strong> for guidance on royalties and taxes.</span>
      </div>

      {!adding ? (
        <button onClick={() => setAdding(true)} style={{ ...btn(C.rust), marginBottom: 18 }}>
          <PenLine size={16} /> Add a release
        </button>
      ) : (
        <div style={{ ...card, marginBottom: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Release / song title" style={{ ...inp, flex: 1, minWidth: 200 }} onKeyDown={e => e.key === "Enter" && addRelease()} />
          <button onClick={addRelease} style={btn(C.rust)}>Add</button>
          <button onClick={() => setAdding(false)} style={btn("transparent")}>Cancel</button>
        </div>
      )}

      {releases.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: C.soft, padding: 30 }}>
          <DollarSign size={28} color={C.soft} style={{ margin: "0 auto 10px" }} />
          No releases yet. Add one to start tracking splits.
        </div>
      ) : releases.map(rel => <ReleaseCard key={rel.id} rel={rel} auth={auth} onChange={load} />)}
    </div>
  );
}

function ReleaseCard({ rel, auth, onChange }) {
  const [splits, setSplits] = useState(rel.splits?.length ? rel.splits : [{ name: "", role: "Artist", pct: 100 }]);
  const [revenue, setRevenue] = useState(((rel.revenueCents || 0) / 100) || "");
  const [dirty, setDirty] = useState(false);
  const [shareUrl, setShareUrl] = useState(rel.shareCode ? `${window.location.origin}/?split=${rel.shareCode}` : "");

  const total = splits.reduce((s, x) => s + (Number(x.pct) || 0), 0);
  const rev = Number(revenue) || 0;
  const valid = total === 100;

  function setSplit(i, k, v) { setSplits(s => s.map((x, j) => j === i ? { ...x, [k]: v } : x)); setDirty(true); }
  function addRow() { setSplits(s => [...s, { name: "", role: "", pct: 0 }]); setDirty(true); }
  function removeRow(i) { setSplits(s => s.filter((_, j) => j !== i)); setDirty(true); }

  async function save() {
    try {
      await api.updateRelease(auth.token, rel.id, {
        splits: splits.map(s => ({ name: s.name, role: s.role, pct: Number(s.pct) || 0 })),
        revenueCents: Math.round(rev * 100),
      });
      setDirty(false); onChange?.();
    } catch (e) { alert(e.message); }
  }
  async function del() {
    if (!confirm(`Delete "${rel.title}"?`)) return;
    try { await api.deleteRelease(auth.token, rel.id); onChange?.(); } catch (e) { alert(e.message); }
  }
  async function share() {
    try {
      const { shareCode } = await api.shareRelease(auth.token, rel.id);
      const url = `${window.location.origin}/?split=${shareCode}`;
      setShareUrl(url); navigator.clipboard?.writeText(url);
      alert("Split sheet link copied to clipboard!");
    } catch (e) { alert(e.message); }
  }

  return (
    <div style={{ ...card, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600 }}>{rel.title}</div>
        <button onClick={del} style={{ background: "none", border: "none", color: C.soft, cursor: "pointer", display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}>
          <Trash2 size={14} /> Delete
        </button>
      </div>

      {/* Revenue */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "12px 0", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: C.soft }}>Revenue received $</span>
        <input type="number" value={revenue} onChange={e => { setRevenue(e.target.value); setDirty(true); }}
          placeholder="0.00" style={{ ...inp, width: 120, padding: "6px 10px" }} />
      </div>

      {/* Splits table */}
      <div style={{ display: "grid", gap: 8 }}>
        {splits.map((s, i) => {
          const cut = rev * ((Number(s.pct) || 0) / 100);
          return (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input value={s.name} onChange={e => setSplit(i, "name", e.target.value)} placeholder="Name" style={{ ...inp, flex: 2, minWidth: 120, padding: "7px 10px" }} />
              <input value={s.role} onChange={e => setSplit(i, "role", e.target.value)} placeholder="Role" style={{ ...inp, flex: 1, minWidth: 90, padding: "7px 10px" }} />
              <input type="number" value={s.pct} onChange={e => setSplit(i, "pct", e.target.value)} placeholder="%" style={{ ...inp, width: 70, padding: "7px 10px" }} />
              <span style={{ width: 80, textAlign: "right", fontSize: 13, color: C.sage, fontWeight: 600 }}>${cut.toFixed(2)}</span>
              <button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: C.soft, cursor: "pointer" }}><X size={15} /></button>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
        <button onClick={addRow} style={{ ...btn("transparent"), fontSize: 13, padding: "6px 12px" }}>+ Add collaborator</button>
        <div style={{ fontSize: 13, fontWeight: 700, color: valid ? C.sage : C.rust }}>
          Total: {total}% {valid ? "✓" : "(must equal 100%)"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button onClick={save} disabled={!dirty} style={{ ...btn(dirty ? C.rust : "transparent"), opacity: dirty ? 1 : .5 }}>
          {dirty ? "Save" : "Saved"}
        </button>
        <button onClick={() => printSplitSheet({ ...rel, splits, revenueCents: Math.round(rev * 100) })} style={btn("transparent")}>
          <Download size={15} /> Print split sheet
        </button>
        <button onClick={share} style={btn(C.teal)}>
          <LinkIcon size={15} /> Share with collaborators
        </button>
      </div>
      {shareUrl && <div style={{ marginTop: 8, fontSize: 12, color: C.soft, wordBreak: "break-all" }}>Shareable: {shareUrl}</div>}
    </div>
  );
}

/* ---- Distribution guidance (get music on streaming platforms) ---- */
const DISTRIBUTORS = [
  { name: "DistroKid", best: "Unlimited releases, fast", price: "~$23/yr flat", note: "Keep 100% royalties. Great for frequent releasers.", url: "https://distrokid.com" },
  { name: "TuneCore", best: "Detailed reporting", price: "Per-release or yearly", note: "Strong analytics and publishing admin add-ons.", url: "https://www.tunecore.com" },
  { name: "CD Baby", best: "One-time fee per release", price: "~$10–30 once", note: "Pay once, distribute forever for that release.", url: "https://cdbaby.com" },
  { name: "Amuse", best: "Free tier", price: "Free / Pro", note: "A solid free option to get started with no cost.", url: "https://www.amuse.io" },
  { name: "Symphonic", best: "Growing artists/labels", price: "Revenue share", note: "More hands-on, good for catalog and labels.", url: "https://symphonic.com" },
];
const RELEASE_STEPS = [
  ["Finish & master your track", "Make sure your audio is mixed and mastered to streaming loudness. Have the final WAV ready."],
  ["Prepare cover art", "3000×3000px square, no logos/URLs/blurriness. Iris can generate this for you."],
  ["Pick a distributor", "Choose one below based on budget and how often you release."],
  ["Set a release date", "Pick a date 3–4 weeks out so you can pitch to playlists and build hype."],
  ["Pitch to Spotify editorial", "In Spotify for Artists, submit your unreleased track at least 7 days early."],
  ["Line up your rollout", "Use the Release Campaign tool — Nora, Mia, Remy and Iris plan the whole launch."],
  ["Release & promote", "On drop day, share everywhere. Mia can prep your posts and captions."],
];

function DistributionPanel({ profile }) {
  return (
    <div className="rise">
      <PageTitle title="Distribution" sub="Get your music onto Spotify, Apple Music, and everywhere else." />

      <div style={{ ...card, marginBottom: 22 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>How it works</div>
        <p style={{ color: C.soft, fontSize: 14, lineHeight: 1.6, marginTop: 0 }}>
          Streaming platforms don't let you upload music directly — you go through a <strong>distributor</strong> that
          delivers your track to Spotify, Apple Music, TikTok, YouTube Music and 150+ stores, and collects your royalties.
          Pick one distributor, upload your song and cover art, set a release date, and they handle the rest.
        </p>
      </div>

      <SectionHead kicker="Step by step" title="Your release checklist" />
      <div style={{ display: "grid", gap: 10, marginBottom: 26 }}>
        {RELEASE_STEPS.map(([t, d], i) => (
          <div key={t} style={{ ...card, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${C.rust}18`, color: C.rust,
              display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{i + 1}</div>
            <div>
              <div style={{ fontWeight: 700 }}>{t}</div>
              <p style={{ color: C.soft, fontSize: 14, lineHeight: 1.5, margin: "4px 0 0" }}>{d}</p>
            </div>
          </div>
        ))}
      </div>

      <SectionHead kicker="Compare" title="Popular distributors" />
      <p style={{ color: C.soft, fontSize: 13, marginTop: -6, marginBottom: 14 }}>
        A few well-known options — compare and pick what fits your budget and release pace. (These are independent services; Anthem isn't affiliated.)
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
        {DISTRIBUTORS.map(d => (
          <div key={d.name} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 600 }}>{d.name}</div>
              <span style={{ fontSize: 12, color: C.teal, fontWeight: 600 }}>{d.price}</span>
            </div>
            <div style={{ color: C.rust, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginTop: 4 }}>{d.best}</div>
            <p style={{ color: C.soft, fontSize: 14, lineHeight: 1.5, marginTop: 8 }}>{d.note}</p>
            <a href={d.url} target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", gap: 6,
              color: C.ink, fontSize: 13, fontWeight: 600, textDecoration: "none", marginTop: 6 }}>
              Visit {d.name} <ArrowRight size={14} />
            </a>
          </div>
        ))}
      </div>

      <div style={{ ...card, marginTop: 22, background: `${C.plum}0d`, borderColor: `${C.plum}40` }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Need a hand?</div>
        <p style={{ color: C.soft, fontSize: 14, margin: 0, lineHeight: 1.5 }}>
          Ask <strong>Nora</strong> about release strategy and timing, or use the <strong>Release Campaign</strong> tool to plan your whole rollout in one go.
        </p>
      </div>
    </div>
  );
}

/* ---- Booking calendar (in-app, free) ---- */
const COMMON_TZ = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Africa/Lagos",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney", "UTC",
];
const DAYS = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];

function pad(n) { return String(n).padStart(2, "0"); }
function toICSDate(iso) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}
function downloadICS(b) {
  const start = toICSDate(b.startsAt);
  const end = toICSDate(b.endsAt || new Date(new Date(b.startsAt).getTime() + 60 * 60 * 1000).toISOString());
  const desc = [b.notes, b.meetLink ? `Meet: ${b.meetLink}` : ""].filter(Boolean).join("\\n");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Anthem//EN", "BEGIN:VEVENT",
    `UID:anthem-${b.id}@varietyvibesradio`, `DTSTAMP:${toICSDate(new Date().toISOString())}`,
    `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${b.title}${b.withWho ? " — " + b.withWho : ""}`,
    desc ? `DESCRIPTION:${desc}` : "", b.meetLink ? `LOCATION:${b.meetLink}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${b.title.replace(/[^a-z0-9]/gi, "-")}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CalendarPanel({ auth }) {
  const [bookings, setBookings] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", withWho: "", date: "", time: "", notes: "", meetLink: "" });
  const [tz, setTz] = useState("");

  async function load() {
    if (api.live() && auth?.token) {
      try { const d = await api.listBookings(auth.token); setBookings(d.bookings || []); } catch {}
      try { const s = await api.getSettings(auth.token); setTz(s.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone); } catch {}
    }
  }
  useEffect(() => { load(); }, [auth]);

  async function save() {
    if (!form.title || !form.date || !form.time) { alert("Add a title, date, and time."); return; }
    const startsAt = new Date(`${form.date}T${form.time}`).toISOString();
    try {
      await api.addBooking(auth.token, {
        title: form.title, withWho: form.withWho, startsAt, notes: form.notes, meetLink: form.meetLink });
      setForm({ title: "", withWho: "", date: "", time: "", notes: "", meetLink: "" });
      setAdding(false); load();
    } catch (e) { alert(e.message); }
  }
  async function remove(id) {
    try { await api.deleteBooking(auth.token, id); load(); } catch (e) { alert(e.message); }
  }

  const fmt = iso => {
    try {
      return new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZone: tz || undefined });
    } catch { return iso; }
  };
  const now = Date.now();
  const upcoming = bookings.filter(b => new Date(b.startsAt).getTime() >= now - 36e5);
  const past = bookings.filter(b => new Date(b.startsAt).getTime() < now - 36e5);

  const Row = b => (
    <div key={b.id} style={{ ...card, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{b.title}</div>
          {b.withWho && <div style={{ color: C.soft, fontSize: 13 }}>with {b.withWho}</div>}
          <div style={{ color: C.teal, fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={13} /> {fmt(b.startsAt)}
          </div>
          {b.notes && <div style={{ color: C.soft, fontSize: 13, marginTop: 6 }}>{b.notes}</div>}
          {b.meetLink && (
            <a href={b.meetLink} target="_blank" rel="noopener" style={{ display: "inline-flex", alignItems: "center", gap: 5,
              color: C.plum, fontSize: 13, marginTop: 6, textDecoration: "none" }}>
              <Video size={13} /> Join Meet
            </a>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={() => downloadICS(b)} title="Add to calendar"
            style={{ ...btn("transparent"), padding: "6px 10px", fontSize: 12 }}>
            <Download size={13} /> Add to calendar
          </button>
          <button onClick={() => remove(b.id)} title="Delete"
            style={{ background: "none", border: "none", color: C.soft, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
            <Trash2 size={13} /> Remove
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="rise">
      <PageTitle title="Calendar" sub="Your bookings, sessions, and meetings — all in one place." />

      <div style={{ ...card, marginBottom: 18, padding: "12px 16px", display: "flex", gap: 10,
        alignItems: "center", fontSize: 13, color: C.soft }}>
        <Clock size={16} color={C.plum} />
        <span style={{ flex: 1 }}>Connecting Google Calendar for 2-way sync &amp; auto Meet links is coming soon. For now, add bookings here and tap "Add to calendar" to drop them into any calendar app.</span>
      </div>

      {!adding ? (
        <button onClick={() => setAdding(true)} style={{ ...btn(C.rust), marginBottom: 18 }}>
          <CalendarPlus size={16} /> Add a booking
        </button>
      ) : (
        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>New booking</div>
          <div style={{ display: "grid", gap: 10 }}>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Title (e.g. Studio session)" style={inp} />
            <input value={form.withWho} onChange={e => setForm({ ...form, withWho: e.target.value })} placeholder="With (optional)" style={inp} />
            <div style={{ display: "flex", gap: 10 }}>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={{ ...inp, flex: 1 }} />
              <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={{ ...inp, flex: 1 }} />
            </div>
            <input value={form.meetLink} onChange={e => setForm({ ...form, meetLink: e.target.value })} placeholder="Google Meet / Zoom link (optional)" style={inp} />
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" rows={2} style={{ ...inp, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={save} style={btn(C.rust)}>Save booking</button>
              <button onClick={() => setAdding(false)} style={btn("transparent")}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <SectionHead kicker="Upcoming" title={`${upcoming.length} booking${upcoming.length === 1 ? "" : "s"}`} />
      {upcoming.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: C.soft, padding: 30 }}>
          <CalendarDays size={28} color={C.soft} style={{ margin: "0 auto 10px" }} />
          No upcoming bookings yet. Add one above.
        </div>
      ) : upcoming.map(Row)}

      {past.length > 0 && (
        <>
          <div style={{ height: 18 }} />
          <SectionHead kicker="Past" title="Earlier bookings" />
          <div style={{ opacity: .6 }}>{past.map(Row)}</div>
        </>
      )}
    </div>
  );
}

/* ---- Settings: timezone + business hours ---- */
function SettingsPanel({ auth }) {
  const [tz, setTz] = useState("");
  const [hours, setHours] = useState({});
  const [digest, setDigest] = useState(true);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      if (api.live() && auth?.token) {
        try {
          const s = await api.getSettings(auth.token);
          setTz(s.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
          setHours(s.businessHours || { mon: ["10:00", "18:00"], tue: ["10:00", "18:00"], wed: ["10:00", "18:00"], thu: ["10:00", "18:00"], fri: ["10:00", "18:00"] });
          setDigest(s.weeklyDigest !== false);
        } catch {}
      } else {
        setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
      }
      setLoaded(true);
    })();
  }, [auth]);

  function toggleDay(day) {
    setHours(h => {
      const next = { ...h };
      if (next[day]) delete next[day];
      else next[day] = ["10:00", "18:00"];
      return next;
    });
  }
  function setTime(day, idx, val) {
    setHours(h => ({ ...h, [day]: h[day].map((t, i) => i === idx ? val : t) }));
  }

  async function save() {
    try {
      if (api.live() && auth?.token) await api.saveSettings(auth.token, { timezone: tz, businessHours: hours, weeklyDigest: digest });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert(e.message); }
  }

  if (!loaded) return <div className="rise"><PageTitle title="Settings" sub="Your preferences." /></div>;

  return (
    <div className="rise">
      <PageTitle title="Settings" sub="Your timezone and availability." />

      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Timezone</div>
        <p style={{ color: C.soft, fontSize: 13, marginTop: 0 }}>All times across Anthem show in your timezone.</p>
        <select value={tz} onChange={e => setTz(e.target.value)} style={{ ...inp, maxWidth: 320 }}>
          {[tz, ...COMMON_TZ.filter(t => t !== tz)].map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Business hours</div>
        <p style={{ color: C.soft, fontSize: 13, marginTop: 0 }}>Set the days and hours you're open for bookings.</p>
        <div style={{ display: "grid", gap: 8 }}>
          {DAYS.map(([key, label]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, width: 90, cursor: "pointer" }}>
                <input type="checkbox" checked={!!hours[key]} onChange={() => toggleDay(key)}
                  style={{ width: 16, height: 16, accentColor: C.rust }} />
                <span style={{ fontSize: 14 }}>{label}</span>
              </label>
              {hours[key] ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="time" value={hours[key][0]} onChange={e => setTime(key, 0, e.target.value)} style={{ ...inp, padding: "6px 8px", width: "auto" }} />
                  <span style={{ color: C.soft }}>to</span>
                  <input type="time" value={hours[key][1]} onChange={e => setTime(key, 1, e.target.value)} style={{ ...inp, padding: "6px 8px", width: "auto" }} />
                </div>
              ) : <span style={{ color: C.soft, fontSize: 13 }}>Closed</span>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Weekly email digest</div>
        <p style={{ color: C.soft, fontSize: 13, marginTop: 0 }}>Get a Monday email with your upcoming bookings and a tip to keep momentum.</p>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={digest} onChange={e => setDigest(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: C.rust }} />
          <span style={{ fontSize: 14 }}>Email me the weekly digest</span>
        </label>
      </div>

      <button onClick={save} style={btn(saved ? C.sage : C.rust)}>
        {saved ? <><Check size={16} /> Saved</> : "Save settings"}
      </button>
    </div>
  );
}

/* ---- Billing & plan: manage subscription, cancel ---- */
function BillingPanel({ auth, plan, planLabel, onUpgrade }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const isOwner = auth?.user?.owner;

  async function openPortal() {
    setBusy(true);
    try { const { url } = await api.billingPortal(auth.token); window.location.href = url; }
    catch (e) { alert(e.message || "Couldn't open billing."); setBusy(false); }
  }
  async function doCancel() {
    setBusy(true);
    try { await api.cancelPlan(auth.token); setCanceled(true); setConfirming(false); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="rise">
      <PageTitle title="Billing & plan" sub="Manage your subscription." />

      <div style={{ ...card, marginBottom: 18 }}>
        <div style={{ color: C.soft, fontSize: 13 }}>Current plan</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 600, color: C.rust, margin: "2px 0 4px" }}>
          {isOwner ? "Owner — full access" : (canceled ? "Canceled" : planLabel)}
        </div>
        {isOwner && <div style={{ color: C.soft, fontSize: 13 }}>You have permanent full access.</div>}
        {canceled && <div style={{ color: C.soft, fontSize: 13 }}>Your plan has been canceled. You'll keep access until the end of your billing period.</div>}
      </div>

      {!isOwner && (
        <>
          <div style={{ ...card, marginBottom: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Manage payment & subscription</div>
            <p style={{ color: C.soft, fontSize: 13, marginTop: 0 }}>
              Update your card, view invoices, or cancel through our secure billing portal.
            </p>
            <button onClick={openPortal} disabled={busy} style={{ ...btn(C.teal), opacity: busy ? .6 : 1 }}>
              <Wallet size={16} /> Open billing portal
            </button>
          </div>

          <div style={{ ...card, marginBottom: 18 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Upgrade or change plan</div>
            <p style={{ color: C.soft, fontSize: 13, marginTop: 0 }}>Want more agents or seats? See plans.</p>
            <button onClick={onUpgrade} style={btn(C.rust)}>View plans</button>
          </div>

          {!canceled && (
            <div style={{ ...card, borderColor: C.line }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Cancel plan</div>
              {!confirming ? (
                <>
                  <p style={{ color: C.soft, fontSize: 13, marginTop: 0 }}>
                    You'll keep access until the end of your current billing period.
                  </p>
                  <button onClick={() => setConfirming(true)} style={{ ...btn("transparent"), color: C.rust, borderColor: C.rust }}>
                    Cancel my plan
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 14, marginTop: 0 }}>Are you sure you want to cancel?</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={doCancel} disabled={busy} style={{ ...btn(C.rust), opacity: busy ? .6 : 1 }}>
                      {busy ? "…" : "Yes, cancel"}
                    </button>
                    <button onClick={() => setConfirming(false)} style={btn("transparent")}>Keep my plan</button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---- Admin (owner only): see all signups, comp/change plans ---- */
function AdminPanel({ auth }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  async function load() {
    try { setData(await api.adminUsers(auth.token)); }
    catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function setPlan(id, plan) {
    try { await api.adminSetPlan(auth.token, id, plan); load(); }
    catch (e) { alert(e.message); }
  }

  async function deleteUser(id, email) {
    if (!confirm(`Permanently delete ${email}? This removes their account and all their data. This cannot be undone.`)) return;
    try { await api.adminDeleteUser(auth.token, id); load(); }
    catch (e) { alert(e.message); }
  }

  const fmtDate = d => { try { return new Date(d).toLocaleDateString(); } catch { return "—"; } };
  const planColor = { trial: C.gold, indie: C.teal, artist: C.rust, label: C.plum, canceled: C.soft };

  return (
    <div className="rise">
      <PageTitle title="Admin" sub="Everyone who's signed up — owner only." />
      {err && <div style={{ ...card, color: C.rust, marginBottom: 16 }}>{err}</div>}

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14, marginBottom: 22 }}>
            <div style={card}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, color: C.ink }}>{data.totals.total}</div>
              <div style={{ color: C.soft, fontSize: 13 }}>Total signups</div>
            </div>
            {Object.entries(data.totals.byPlan).map(([plan, n]) => (
              <div key={plan} style={card}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, color: planColor[plan] || C.ink }}>{n}</div>
                <div style={{ color: C.soft, fontSize: 13, textTransform: "capitalize" }}>{plan}</div>
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>All users</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead><tr style={{ color: C.soft, textAlign: "left" }}>
                  {["Email", "Plan", "Joined", "Actions"].map(h => <th key={h} style={{ padding: "8px 10px", fontWeight: 600 }}>{h}</th>)}
                </tr></thead>
                <tbody>{data.users.map(u => (
                  <tr key={u.id} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ padding: "10px", wordBreak: "break-all" }}>{u.email}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: planColor[u.plan] || C.ink,
                        background: `${planColor[u.plan] || C.ink}18`, padding: "2px 9px", borderRadius: 20, textTransform: "capitalize" }}>
                        {u.plan}
                      </span>
                    </td>
                    <td style={{ padding: "10px", color: C.soft }}>{fmtDate(u.createdAt)}</td>
                    <td style={{ padding: "10px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select value="" onChange={e => { if (e.target.value) setPlan(u.id, e.target.value); }}
                          style={{ ...inp, padding: "6px 8px", fontSize: 12, width: "auto" }}>
                          <option value="">Change…</option>
                          <option value="label">Comp free (Label)</option>
                          <option value="artist">Set Artist</option>
                          <option value="indie">Set Indie</option>
                          <option value="trial">Reset to Trial</option>
                          <option value="canceled">Cancel</option>
                        </select>
                        <button onClick={() => deleteUser(u.id, u.email)} title="Delete user"
                          style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 8px",
                            cursor: "pointer", color: C.rust, display: "inline-flex", alignItems: "center" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Coming soon + request a feature ---- */
const COMING_SOON = [
  { title: "One-click social posting", desc: "Connect your Instagram, TikTok & more so agents post for you automatically.", icon: Send, color: C.plum, tag: "In progress" },
  { title: "Connect streaming stats", desc: "Link Spotify & Apple Music to see real numbers (not samples) across your dashboard.", icon: BarChart3, color: C.teal, tag: "Planned" },
  { title: "Video editing", desc: "Turn your tracks into ready-to-post video clips and visualizers — right inside Anthem.", icon: Music2, color: C.rust, tag: "Planned" },
  { title: "Beat making", desc: "Generate and customize beats and instrumentals to spark your next track.", icon: Music, color: C.plum, tag: "Planned" },
  { title: "Scheduled posts", desc: "Queue content and have it go out at the best times automatically.", icon: Clock, color: C.rust, tag: "Planned" },
  { title: "Connect Google Calendar", desc: "2-way calendar sync with auto-created Google Meet links for every booking.", icon: CalendarDays, color: C.teal, tag: "Planned" },
  { title: "Call agent", desc: "An AI voice agent that answers calls, books gigs, and handles fan & venue inquiries by phone.", icon: MessageCircle, color: C.teal, tag: "Planned" },
  { title: "Voice chat with agents", desc: "Talk to your team out loud instead of typing.", icon: Mic2, color: C.gold, tag: "Exploring" },
  { title: "Mobile app", desc: "Anthem in your pocket — iOS & Android.", icon: Music2, color: C.clay, tag: "Exploring" },
  { title: "Merch store", desc: "Sell shirts, vinyl, and digital goods to your fans right from Anthem.", icon: Inbox, color: C.rust, tag: "Exploring" },
  { title: "Tour routing map", desc: "Plan smart tour routes and find venues along the way.", icon: MapPin, color: C.teal, tag: "Exploring" },
  { title: "AI mastering", desc: "Master your tracks to streaming-ready loudness in one click.", icon: Sparkles, color: C.gold, tag: "Exploring" },
  { title: "White-label platform", desc: "Run Anthem under your own brand — your logo, your colors, your domain. Built for labels & agencies.", icon: Sparkles, color: C.plum, tag: "Exploring" },
];

function FeaturesPanel({ auth }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      if (api.live() && auth?.token) await api.requestFeature(auth.token, t);
      setDone(true); setText("");
      setTimeout(() => setDone(false), 2500);
    } catch (e) { alert(e.message || "Couldn't submit."); }
    finally { setBusy(false); }
  }

  const tagColor = { "In progress": C.plum, "Planned": C.teal, "Exploring": C.soft };

  return (
    <div className="rise">
      <PageTitle title="Request Features" sub="See what's coming, and tell us what you want next." />

      {/* Request box */}
      <div style={{ ...card, marginBottom: 22 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Got an idea?</div>
        <p style={{ color: C.soft, fontSize: 13, marginTop: 0 }}>
          Tell us what would make Anthem more useful for you. We read every request.
        </p>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
          placeholder="I'd love it if Anthem could…" style={{ ...inp, resize: "vertical" }} />
        <button onClick={submit} disabled={busy}
          style={{ ...btn(done ? C.sage : C.gold), marginTop: 12, opacity: busy ? .6 : 1 }}>
          {done ? <><Check size={16} /> Thanks — we got it!</> : busy ? "Sending…" : <><Sparkles size={16} /> Send request</>}
        </button>
      </div>

      {/* Coming soon */}
      <SectionHead kicker="Roadmap" title="Coming soon" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
        {COMING_SOON.map(f => (
          <div key={f.title} style={{ ...card, position: "relative" }}>
            <span style={{ position: "absolute", top: 14, right: 14, fontSize: 11, fontWeight: 700,
              color: tagColor[f.tag] || C.soft, background: `${tagColor[f.tag] || C.soft}18`,
              padding: "3px 10px", borderRadius: 20 }}>{f.tag}</span>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: `${f.color}18`,
              border: `1px solid ${f.color}40`, display: "grid", placeItems: "center" }}>
              <f.icon size={20} color={f.color} />
            </div>
            <div style={{ fontWeight: 700, marginTop: 12 }}>{f.title}</div>
            <p style={{ color: C.soft, fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Team: invite members ($10/seat), shared workspace ---- */
function TeamPanel({ auth, onUpgrade }) {
  const [data, setData] = useState(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function load() {
    if (api.live() && auth?.token) {
      api.getTeam(auth.token).then(setData).catch(() => {});
    }
  }
  useEffect(load, [auth]);

  async function invite() {
    const e = email.trim();
    if (!e || busy) return;
    setBusy(true); setMsg("");
    try {
      const r = await api.inviteTeam(auth.token, e);
      setEmail(""); setMsg(r.note || "Invite sent!");
      load();
    } catch (err) { setMsg(err.message || "Couldn't invite."); }
    finally { setBusy(false); }
  }

  async function cancel(id) { await api.cancelInvite(auth.token, id).catch(() => {}); load(); }
  async function remove(id) { await api.removeMember(auth.token, id).catch(() => {}); load(); }

  if (!api.live()) {
    return (
      <div className="rise">
        <PageTitle title="Team" sub="Invite teammates to share your Anthem workspace." />
        <div style={{ ...card, color: C.soft }}>Team features are available on the live site once you're logged in.</div>
      </div>
    );
  }

  const seatPrice = data?.seatPrice || 10;
  const memberCount = data?.members?.length || 1;
  const extraSeats = Math.max(0, memberCount - 1 + (data?.invites?.length || 0));

  return (
    <div className="rise">
      <PageTitle title="Team" sub={`Invite teammates to share your workspace — $${seatPrice}/seat per month.`} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 18 }}>
        <div style={card}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, color: C.plum }}>{memberCount}</div>
          <div style={{ color: C.soft, fontSize: 13 }}>Team members</div>
        </div>
        <div style={card}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, color: C.teal }}>{data?.invites?.length || 0}</div>
          <div style={{ color: C.soft, fontSize: 13 }}>Pending invites</div>
        </div>
        <div style={card}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, fontWeight: 600, color: C.rust }}>${extraSeats * seatPrice}</div>
          <div style={{ color: C.soft, fontSize: 13 }}>Seats / month ({extraSeats} × ${seatPrice})</div>
        </div>
      </div>

      {data?.isOwner ? (
        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Invite a teammate</div>
          <p style={{ color: C.soft, fontSize: 13, marginTop: 0 }}>
            They'll join your shared workspace (same agents, Brain, and saved work) when they sign up with this email. Each extra seat is ${seatPrice}/month.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="teammate@email.com"
              onKeyDown={e => e.key === "Enter" && invite()} style={{ ...inp, flex: 1, minWidth: 220 }} />
            <button onClick={invite} disabled={busy} style={{ ...btn(C.plum), opacity: busy ? .6 : 1 }}>
              <UserCircle size={16} /> {busy ? "Inviting…" : "Invite"}
            </button>
          </div>
          {msg && <div style={{ color: C.soft, fontSize: 13, marginTop: 8 }}>{msg}</div>}
          <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 14, paddingTop: 14,
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Pay for seats</div>
              <div style={{ color: C.soft, fontSize: 13 }}>Each teammate seat is ${seatPrice}/month.</div>
            </div>
            <button onClick={async () => {
                try {
                  const qty = Math.max(1, (data?.members?.length || 1) - 1 + (data?.invites?.length || 0)) || 1;
                  const { url } = await api.buySeats(auth.token, qty);
                  window.location.href = url;
                } catch (e) { alert(e.message || "Couldn't start checkout."); }
              }}
              style={btn(C.teal)}>
              <Wallet size={16} /> Buy seats
            </button>
          </div>
        </div>
      ) : (
        <div style={{ ...card, marginBottom: 18, color: C.soft, fontSize: 14 }}>
          You're a member of this team's shared workspace. Only the team owner can invite or remove members.
        </div>
      )}

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Members</div>
        <div style={{ display: "grid", gap: 10 }}>
          {(data?.members || []).map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12,
              padding: "10px 0", borderTop: `1px solid ${C.line}` }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${C.plum}22`,
                display: "grid", placeItems: "center", color: C.plum, fontWeight: 700 }}>
                {m.email[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{m.email}</div>
                <div style={{ color: C.soft, fontSize: 12 }}>{m.isOwner ? "Owner" : "Member"}</div>
              </div>
              {data?.isOwner && !m.isOwner && (
                <button onClick={() => remove(m.id)}
                  style={{ ...btn("transparent"), fontSize: 13, padding: "7px 12px", color: C.rust }}>Remove</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {(data?.invites?.length > 0) && (
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Pending invites</div>
          <div style={{ display: "grid", gap: 10 }}>
            {data.invites.map(i => (
              <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 12,
                padding: "10px 0", borderTop: `1px solid ${C.line}` }}>
                <Clock size={18} color={C.soft} />
                <div style={{ flex: 1, fontSize: 14 }}>{i.email}</div>
                <span style={{ color: C.gold, fontSize: 12, fontWeight: 600 }}>Pending</span>
                {data?.isOwner && (
                  <button onClick={() => cancel(i.id)}
                    style={{ ...btn("transparent"), fontSize: 13, padding: "7px 12px" }}>Cancel</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReferralPanel({ auth }) {
  const [copied, setCopied] = useState(false);
  const [info, setInfo] = useState(null); // real data from backend
  // Real, unique link built from the logged-in artist's referral code.
  const code = info?.code || auth?.user?.referralCode || "";
  const base = (typeof window !== "undefined" && window.location.origin) || "https://www.varietyvibesradio.shop";
  const link = code ? `${base}/?ref=${code}` : `${base}`;

  useEffect(() => {
    if (api.live() && auth?.token) {
      api.getReferrals(auth.token).then(setInfo).catch(() => {});
    }
  }, [auth]);

  // Real referrals (fall back to empty if none yet).
  const referrals = info?.referrals || [];
  const activeCount = info?.activeCount ?? referrals.filter(r => r.status === "active").length;
  const pendingCount = referrals.filter(r => r.status === "trial" || r.status === "pending").length;
  const totalEarned = info ? `$${(info.owedUsd ?? 0).toFixed(2)}` : "$0.00";
  const rows = referrals.map(r => [
    r.referredEmail || r.referred_email || "—",
    (r.plan || "—").charAt(0).toUpperCase() + (r.plan || "").slice(1),
    r.status === "active" ? "Active" : (r.status === "trial" ? "Trial" : (r.status || "—")),
    r.status === "active" && r.commissionCents ? `$${(r.commissionCents / 100).toFixed(2)}/mo` : "—",
  ]);
  return (
    <div className="rise">
      <PageTitle title="Referrals" sub="Put other artists on — earn 30% recurring." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 22 }}>
        {[["Total earned", totalEarned, C.rust], ["Active referrals", String(activeCount), C.teal],
          ["Pending", String(pendingCount), C.gold], ["Total referred", String(referrals.length), C.plum]]
          .map(([l, v, c]) => (
            <div key={l} style={card}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 28, color: c, fontWeight: 600 }}>{v}</div>
              <div style={{ color: C.soft, fontSize: 13 }}>{l}</div>
            </div>
          ))}
      </div>
      <div style={{ ...card, marginBottom: 22 }}>
        <div style={{ color: C.soft, fontSize: 13, marginBottom: 8 }}>Your artist referral link</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <code style={{ flex: 1, minWidth: 240, background: C.paper, border: `1px solid ${C.line}`,
            padding: "12px 14px", borderRadius: 10, color: C.rust, fontSize: 13 }}>{link}</code>
          <button onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            style={btn(C.rust)}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}</button>
        </div>

        {/* Shareable card — the image + text fans see when you share */}
        <div style={{ color: C.soft, fontSize: 13, marginBottom: 8 }}>Share this with other artists</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ width: 200, borderRadius: 14, overflow: "hidden", border: `1px solid ${C.line}`, flexShrink: 0 }}>
            <div style={{ height: 120, background: `linear-gradient(135deg, ${C.rust}, ${C.plum})`,
              display: "grid", placeItems: "center", position: "relative" }}>
              <Disc3 size={44} color="#fff" />
              <span style={{ position: "absolute", bottom: 8, right: 10, background: "rgba(0,0,0,.35)",
                color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>30% OFF</span>
            </div>
            <div style={{ padding: "12px 14px" }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 16 }}>Join me on Anthem</div>
              <div style={{ color: C.soft, fontSize: 12, marginTop: 2 }}>Your AI music team — get 20% off your first 3 months.</div>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 220, display: "grid", gap: 10 }}>
            <p style={{ color: C.soft, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
              Share the card and your link anywhere. When an artist joins, they get 20% off and you earn 30% recurring.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={async () => {
                  const shareData = { title: "Anthem", text: "Join me on Anthem — your AI music team. 20% off your first 3 months:", url: link };
                  if (navigator.share) { try { await navigator.share(shareData); } catch {} }
                  else { navigator.clipboard?.writeText(`${shareData.text} ${link}`); alert("Share text copied!"); }
                }}
                style={btn(C.rust)}>
                <Send size={15} /> Share
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent("Join me on Anthem — your AI music team. 20% off your first 3 months: " + link)}`}
                target="_blank" rel="noreferrer" style={{ ...btn("transparent"), fontSize: 13 }}>WhatsApp</a>
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Join me on Anthem — 20% off your first 3 months:")}&url=${encodeURIComponent(link)}`}
                target="_blank" rel="noreferrer" style={{ ...btn("transparent"), fontSize: 13 }}>X / Twitter</a>
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`}
                target="_blank" rel="noreferrer" style={{ ...btn("transparent"), fontSize: 13 }}>Facebook</a>
            </div>
          </div>
        </div>
      </div>
      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Your referrals</div>
        {rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, color: C.soft }}>
            <Gift size={28} color={C.soft} style={{ margin: "0 auto 10px" }} />
            <div style={{ fontWeight: 600, color: C.ink }}>No referrals yet</div>
            <p style={{ fontSize: 14, marginTop: 6 }}>Share your link above. When artists join with it, they'll show up here.</p>
          </div>
        ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead><tr style={{ color: C.soft, textAlign: "left" }}>
              {["Artist / Label", "Plan", "Status", "Your commission"].map(h => <th key={h} style={{ padding: "8px 10px", fontWeight: 600 }}>{h}</th>)}
            </tr></thead>
            <tbody>{rows.map((r, ri) => (
              <tr key={ri} style={{ borderTop: `1px solid ${C.line}` }}>
                {r.map((c, i) => <td key={i} style={{ padding: "12px 10px", color: i === 2 && c === "Active" ? C.sage : C.ink }}>{c}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}

/* ============================ COPY + SCHEDULE HELPERS ============================ */
// Downloads any text as a .txt file.
function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Saves an image (data URL) in a way that works on desktop AND mobile.
// Desktop: triggers a normal download. Mobile (esp. iOS): the download attribute
// is ignored, so we open the image full-screen and prompt a long-press to save.
function saveImage(dataUrl, filename = "anthem-image.png") {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    // Convert the data URL to a Blob URL and open it; user long-presses to save.
    try {
      const [meta, b64] = dataUrl.split(",");
      const mime = (meta.match(/data:(.*?);/) || [])[1] || "image/png";
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: mime }));
      window.open(url, "_blank");
      // Give the new tab a moment before revoking.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      window.open(dataUrl, "_blank");
    }
  } else {
    const a = document.createElement("a");
    a.href = dataUrl; a.download = filename; a.click();
  }
}

// A "Post" button that opens a small platform picker, then posts via the backend.
// Platform open targets. X supports prefilled text; others open the composer/app
// and the caption is on the clipboard ready to paste (their APIs don't allow prefill).
const PLATFORM_OPEN = {
  twitter:   (t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t || "")}`,
  facebook:  () => `https://www.facebook.com/`,
  instagram: () => `https://www.instagram.com/`,
  tiktok:    () => `https://www.tiktok.com/upload`,
  threads:   () => `https://www.threads.net/`,
  linkedin:  () => `https://www.linkedin.com/feed/`,
  youtube:   () => `https://www.youtube.com/upload`,
};

function PostMenu({ token, text, image }) {
  const [open, setOpen] = useState(false);

  function go(pf) {
    setOpen(false);
    // Put the caption on the clipboard so the user can paste it.
    if (text) { try { navigator.clipboard?.writeText(text); } catch {} }
    const url = (PLATFORM_OPEN[pf.id] || (() => "#"))(text);
    // X can prefill; others just open — tell the user the caption is copied.
    if (pf.id !== "twitter" && text) {
      alert(`Caption copied! Opening ${pf.label} — just paste it into your post.`);
    }
    window.open(url, "_blank", "noopener");
  }

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ ...btn("transparent"), fontSize: 13, padding: "8px 12px" }}>
        <Send size={15} /> Post
      </button>
      {open && (
        <div style={{ position: "absolute", bottom: "110%", left: 0, zIndex: 20, background: C.card,
          border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 12px 30px -12px rgba(31,26,22,.4)",
          padding: 6, minWidth: 170 }}>
          <div style={{ fontSize: 11, color: C.soft, padding: "4px 12px 6px" }}>Copy caption & open:</div>
          {SOCIAL_PLATFORMS.map(pf => (
            <button key={pf.id} onClick={() => go(pf)}
              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none",
                padding: "8px 12px", borderRadius: 7, cursor: "pointer", fontSize: 13, color: C.ink, fontFamily: FONT_BODY }}>
              {pf.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// One-click copy button for any AI-generated text.
function CopyButton({ text, color = C.rust, label = "Copy" }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => {
        navigator.clipboard?.writeText(text);
        setDone(true); setTimeout(() => setDone(false), 1500);
      }}
      style={{ ...btn(done ? C.sage : "transparent"), fontSize: 13, padding: "8px 14px" }}>
      {done ? <Check size={15} /> : <Copy size={15} />} {done ? "Copied!" : label}
    </button>
  );
}

// Builds a downloadable .ics calendar reminder so a post/task lands on the
// artist's own calendar (Google/Apple/Outlook all read .ics). No integration needed.
function downloadReminder(title, dateStr, notes) {
  const dt = dateStr ? new Date(dateStr) : new Date(Date.now() + 24 * 3600 * 1000);
  const stamp = d => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const end = new Date(dt.getTime() + 30 * 60 * 1000);
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Anthem//EN", "BEGIN:VEVENT",
    `UID:${Date.now()}@anthem.fm`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(dt)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${(title || "Anthem reminder").replace(/\n/g, " ")}`,
    `DESCRIPTION:${(notes || "").replace(/\n/g, " ")}`,
    "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url; a.download = `${(title || "anthem-reminder").slice(0, 30).replace(/\s+/g, "-")}.ics`;
  a.click(); URL.revokeObjectURL(url);
}

// A small inline scheduler: pick a date/time, get a calendar reminder file.
function ScheduleReminder({ defaultTitle }) {
  const [when, setWhen] = useState("");
  const [title, setTitle] = useState(defaultTitle || "Post this to social");
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
      <Clock size={15} color={C.soft} />
      <input value={title} onChange={e => setTitle(e.target.value)}
        style={{ ...inp, width: "auto", flex: "1 1 160px", padding: "8px 12px", fontSize: 13 }} />
      <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)}
        style={{ ...inp, width: "auto", padding: "8px 12px", fontSize: 13 }} />
      <button onClick={() => downloadReminder(title, when, "Created in Anthem")}
        style={{ ...btn(C.teal), fontSize: 13, padding: "8px 14px" }}>
        <CalendarPlus size={15} /> Add reminder
      </button>
    </div>
  );
}

/* ============================ BITS ============================ */
const wrap = { maxWidth: 1120, margin: "0 auto", padding: "0 22px" };
const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 22 };
const pill = { display: "inline-flex", gap: 8, alignItems: "center", background: C.cream,
  border: `1px solid ${C.line}`, padding: "7px 14px", borderRadius: 30, fontSize: 13, color: C.soft };
const inp = { background: C.card, border: `1px solid ${C.line}`, color: C.ink,
  padding: "12px 14px", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: FONT_BODY, width: "100%" };

function btn(bg, big) {
  const solid = bg !== "transparent";
  return { display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer",
    background: solid ? bg : "transparent", color: solid ? "#fff" : C.ink,
    border: solid ? "none" : `1px solid ${C.line}`, fontWeight: 600, fontFamily: FONT_BODY,
    padding: big ? "15px 24px" : "11px 18px", borderRadius: 12, fontSize: big ? 16 : 14, textDecoration: "none" };
}
function Logo({ size = 52 }) {
  return (
    <img src={anthemLogo} alt="Anthem" style={{ height: size, width: "auto", display: "block", objectFit: "contain" }} />
  );
}
function Stat({ n, l }) {
  return <div><span style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: C.ink, fontWeight: 600 }}>{n}</span> <span>{l}</span></div>;
}
function SectionHead({ kicker, title }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: C.rust, fontSize: 12, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>{kicker}</div>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: "clamp(28px,4vw,40px)", margin: "6px 0 0", fontWeight: 600 }}>{title}</h2>
    </div>
  );
}
function PageTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 30, margin: 0, fontWeight: 600 }}>{title}</h2>
      <p style={{ color: C.soft, margin: "4px 0 0" }}>{sub}</p>
    </div>
  );
}
