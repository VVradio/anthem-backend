// ----------------------------------------------------------------------------
// DATA STORE
//
// Uses Supabase (Postgres) when SUPABASE_URL + SUPABASE_SERVICE_KEY are set;
// otherwise falls back to an in-memory store so the app still runs with zero
// setup (data resets on restart in that mode).
//
// All methods are ASYNC. Routes await them.
// ----------------------------------------------------------------------------
import { createClient } from "@supabase/supabase-js";

export const COMMISSION_RATE = 0.30; // 30% recurring
export const PLAN_LIMITS = { indie: 500, artist: 10000, label: 100000 };
// Monthly AI image generation caps per plan (covers art + promos cost real money).
export const IMAGE_LIMITS = { indie: 35, artist: 100, label: 500 };

const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
const sb = useSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

function genCode() { return "AF-" + Math.random().toString(36).slice(2, 8).toUpperCase(); }

// ---------------------------------------------------------------------------
// SUPABASE IMPLEMENTATION
// ---------------------------------------------------------------------------
const supabaseDb = {
  async createUser({ email, passwordHash, referralCode }) {
    const { data: existing } = await sb.from("users").select("id").eq("email", email).maybeSingle();
    if (existing) throw new Error("Email already registered");
    const row = {
      email, password_hash: passwordHash, plan: "trial",
      referral_code: genCode(), referred_by: referralCode || null,
    };
    const { data, error } = await sb.from("users").insert(row).select().single();
    if (error) throw new Error(error.message);
    // If invited to a team, attach to that org and mark the invite joined.
    const { data: inv } = await sb.from("team_invites").select("*")
      .eq("email", email.toLowerCase()).eq("status", "pending").maybeSingle();
    if (inv) {
      await sb.from("users").update({ org_id: inv.org_id }).eq("id", data.id);
      await sb.from("team_invites").update({ status: "joined" }).eq("id", inv.id);
      data.org_id = inv.org_id;
    } else {
      await sb.from("users").update({ org_id: data.id }).eq("id", data.id);
      data.org_id = data.id;
    }
    if (referralCode) {
      await sb.from("referrals").insert({ code: referralCode, referred_email: email, plan: "indie", status: "trial" });
    }
    return mapUser(data);
  },
  async findByEmail(email) {
    const { data } = await sb.from("users").select("*").eq("email", email).maybeSingle();
    return data ? mapUser(data) : null;
  },
  async findById(id) {
    const { data } = await sb.from("users").select("*").eq("id", id).maybeSingle();
    return data ? mapUser(data) : null;
  },
  async findByReferralCode(code) {
    const { data } = await sb.from("users").select("*").eq("referral_code", code).maybeSingle();
    return data ? mapUser(data) : null;
  },
  async setPlan(userId, plan) {
    await sb.from("users").update({ plan }).eq("id", userId);
  },
  async deleteUser(userId) {
    // Child rows (fans, releases, bookings, etc.) cascade via FK on delete.
    await sb.from("users").delete().eq("id", userId);
    return true;
  },
  async setPassword(userId, passwordHash) {
    await sb.from("users").update({ password_hash: passwordHash }).eq("id", userId);
  },
  async listAllUsers() {
    const { data } = await sb.from("users")
      .select("id, email, plan, created_at, seats, referred_by")
      .order("created_at", { ascending: false });
    return (data || []).map(u => ({
      id: u.id, email: u.email, plan: u.plan, createdAt: u.created_at,
      seats: u.seats || 0, referredBy: u.referred_by || null,
    }));
  },
  async setSeats(userId, seats) {
    await sb.from("users").update({ seats }).eq("id", userId);
  },
  async getSeats(userId) {
    const { data } = await sb.from("users").select("seats").eq("id", userId).maybeSingle();
    return data?.seats || 0;
  },
  // Trial users whose 2-day trial ends within the next 24h (for reminder emails).
  async getTrialsEndingSoon() {
    const now = Date.now();
    const startMin = new Date(now - 2 * 864e5).toISOString();      // created ~2 days ago
    const startMax = new Date(now - 1 * 864e5).toISOString();      // created ~1 day ago
    const { data } = await sb.from("users").select("id, email, created_at, plan")
      .eq("plan", "trial").gte("created_at", startMin).lte("created_at", startMax);
    return (data || []).map(u => ({ id: u.id, email: u.email, createdAt: u.created_at }));
  },
  async setConnectAccount(userId, acctId) {
    await sb.from("users").update({ stripe_connect_id: acctId }).eq("id", userId);
  },

  async getUsage(userId) {
    const { data } = await sb.from("usage").select("count").eq("user_id", userId).maybeSingle();
    return data?.count || 0;
  },
  async incrementUsage(userId, by = 1) {
    const current = await this.getUsage(userId);
    const next = current + by;
    await sb.from("usage").upsert({ user_id: userId, count: next }, { onConflict: "user_id" });
    return next;
  },
  async getImageUsage(userId) {
    const { data } = await sb.from("usage").select("image_count").eq("user_id", userId).maybeSingle();
    return data?.image_count || 0;
  },
  async incrementImageUsage(userId, by = 1) {
    const current = await this.getImageUsage(userId);
    const next = current + by;
    await sb.from("usage").upsert({ user_id: userId, image_count: next }, { onConflict: "user_id" });
    return next;
  },

  async listReferralsFor(code) {
    const { data } = await sb.from("referrals").select("*").eq("code", code);
    return (data || []).map(mapReferral);
  },
  async recordReferralConversion(referredEmail, plan, monthlyCents) {
    const commissionCents = Math.round(monthlyCents * COMMISSION_RATE);
    const { data } = await sb.from("referrals")
      .update({ status: "active", plan, commission_cents: commissionCents })
      .eq("referred_email", referredEmail).select().maybeSingle();
    return data ? mapReferral(data) : null;
  },
  async commissionOwed(code) {
    const { data } = await sb.from("referrals").select("commission_cents").eq("code", code).eq("status", "active");
    return (data || []).reduce((sum, r) => sum + (r.commission_cents || 0), 0);
  },

  async listSaved(userId) {
    const { data } = await sb.from("saved_items").select("*").eq("user_id", userId).order("id", { ascending: false });
    return (data || []).map(mapSaved);
  },
  async addSaved(userId, tool, text) {
    const { data, error } = await sb.from("saved_items")
      .insert({ user_id: userId, tool, text }).select().single();
    if (error) throw new Error(error.message);
    return mapSaved(data);
  },
  async deleteSaved(userId, id) {
    const { error } = await sb.from("saved_items").delete().eq("user_id", userId).eq("id", id);
    return !error;
  },
  async listBrain(userId) {
    const { data } = await sb.from("brain_items").select("*").eq("user_id", userId).order("id", { ascending: false });
    return (data || []).map(mapBrain);
  },
  async addBrain(userId, kind, label, content) {
    const { data, error } = await sb.from("brain_items")
      .insert({ user_id: userId, kind, label, content }).select().single();
    if (error) throw new Error(error.message);
    return mapBrain(data);
  },
  async deleteBrain(userId, id) {
    const { error } = await sb.from("brain_items").delete().eq("user_id", userId).eq("id", id);
    return !error;
  },
  async listBookings(userId) {
    const { data } = await sb.from("bookings").select("*").eq("user_id", userId).order("starts_at", { ascending: true });
    return (data || []).map(mapBooking);
  },
  async addBooking(userId, b) {
    const { data, error } = await sb.from("bookings").insert({
      user_id: userId, title: b.title, with_who: b.withWho || null, starts_at: b.startsAt,
      ends_at: b.endsAt || null, notes: b.notes || null, meet_link: b.meetLink || null,
    }).select().single();
    if (error) throw new Error(error.message);
    return mapBooking(data);
  },
  async deleteBooking(userId, id) {
    const { error } = await sb.from("bookings").delete().eq("user_id", userId).eq("id", id);
    return !error;
  },
  async getSettings(userId) {
    const { data } = await sb.from("users").select("timezone, business_hours, weekly_digest").eq("id", userId).maybeSingle();
    return { timezone: data?.timezone || null, businessHours: data?.business_hours || null,
      weeklyDigest: data?.weekly_digest !== false };
  },
  async setSettings(userId, { timezone, businessHours, weeklyDigest }) {
    const patch = {};
    if (timezone !== undefined) patch.timezone = timezone;
    if (businessHours !== undefined) patch.business_hours = businessHours;
    if (weeklyDigest !== undefined) patch.weekly_digest = weeklyDigest;
    await sb.from("users").update(patch).eq("id", userId);
    return true;
  },
  async getDigestRecipients() {
    const { data } = await sb.from("users").select("id, email").neq("weekly_digest", false);
    return (data || []).map(u => ({ id: u.id, email: u.email }));
  },
  async saveEpk(userId, shareCode, data) {
    await sb.from("epks").upsert({ user_id: userId, share_code: shareCode, data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    return { shareCode };
  },
  async getEpkByUser(userId) {
    const { data } = await sb.from("epks").select("share_code, data").eq("user_id", userId).maybeSingle();
    return data ? { shareCode: data.share_code, data: data.data } : null;
  },
  async getEpkByCode(code) {
    const { data } = await sb.from("epks").select("data").eq("share_code", code).maybeSingle();
    return data ? data.data : null;
  },
  async listReleases(userId) {
    const { data } = await sb.from("releases").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    return (data || []).map(mapRelease);
  },
  async addRelease(userId, r) {
    const { data, error } = await sb.from("releases").insert({
      user_id: userId, title: r.title, splits: r.splits || [], revenue_cents: r.revenueCents || 0 }).select().single();
    if (error) throw new Error(error.message);
    return mapRelease(data);
  },
  async updateRelease(userId, id, patch) {
    const p = {};
    if (patch.title !== undefined) p.title = patch.title;
    if (patch.splits !== undefined) p.splits = patch.splits;
    if (patch.revenueCents !== undefined) p.revenue_cents = patch.revenueCents;
    if (patch.shareCode !== undefined) p.share_code = patch.shareCode;
    const { data } = await sb.from("releases").update(p).eq("user_id", userId).eq("id", id).select().single();
    return data ? mapRelease(data) : null;
  },
  async deleteRelease(userId, id) {
    await sb.from("releases").delete().eq("user_id", userId).eq("id", id);
    return true;
  },
  async getReleaseByCode(code) {
    const { data } = await sb.from("releases").select("*").eq("share_code", code).maybeSingle();
    return data ? mapRelease(data) : null;
  },
  async listFans(userId) {
    const { data } = await sb.from("fans").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    return (data || []).map(f => ({ id: f.id, name: f.name, email: f.email, source: f.source, when: f.created_at }));
  },
  async addFan(userId, { name, email, source }) {
    // Avoid duplicate emails per artist.
    const { data: existing } = await sb.from("fans").select("id").eq("user_id", userId).eq("email", email).maybeSingle();
    if (existing) return { duplicate: true };
    const { data } = await sb.from("fans").insert({ user_id: userId, name: name || null, email, source: source || "manual" }).select().single();
    return { id: data.id, name: data.name, email: data.email };
  },
  async deleteFan(userId, id) {
    await sb.from("fans").delete().eq("user_id", userId).eq("id", id);
    return true;
  },
  async getFanCode(userId) {
    const { data } = await sb.from("users").select("fan_code").eq("id", userId).maybeSingle();
    return data?.fan_code || null;
  },
  async setFanCode(userId, code) {
    await sb.from("users").update({ fan_code: code }).eq("id", userId);
    return true;
  },
  async findUserByFanCode(code) {
    const { data } = await sb.from("users").select("id, email").eq("fan_code", code).maybeSingle();
    return data ? { id: data.id, email: data.email } : null;
  },
  async listSyncTracks(userId) {
    const { data } = await sb.from("sync_tracks").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    return (data || []).map(t => ({ id: t.id, title: t.title, data: t.data || {} }));
  },
  async addSyncTrack(userId, title, data) {
    const { data: row } = await sb.from("sync_tracks").insert({ user_id: userId, title, data: data || {} }).select().single();
    return { id: row.id, title: row.title, data: row.data || {} };
  },
  async updateSyncTrack(userId, id, patch) {
    const p = {};
    if (patch.title !== undefined) p.title = patch.title;
    if (patch.data !== undefined) p.data = patch.data;
    const { data } = await sb.from("sync_tracks").update(p).eq("user_id", userId).eq("id", id).select().single();
    return data ? { id: data.id, title: data.title, data: data.data || {} } : null;
  },
  async deleteSyncTrack(userId, id) {
    await sb.from("sync_tracks").delete().eq("user_id", userId).eq("id", id);
    return true;
  },
  async createChatJob(id, userId, agentId) {
    await sb.from("chat_jobs").insert({ id, user_id: userId, agent_id: agentId, status: "pending" });
    return { id, status: "pending" };
  },
  async finishChatJob(id, { result, isSvg, error }) {
    await sb.from("chat_jobs").update({
      status: error ? "error" : "done", result: result || null, is_svg: !!isSvg,
      error: error || null, updated_at: new Date().toISOString(),
    }).eq("id", id);
    return true;
  },
  async getChatJob(userId, id) {
    const { data } = await sb.from("chat_jobs").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    return data ? { id: data.id, agentId: data.agent_id, status: data.status, result: data.result, isSvg: data.is_svg, error: data.error } : null;
  },
  async listPendingJobs(userId) {
    const { data } = await sb.from("chat_jobs").select("*").eq("user_id", userId)
      .in("status", ["pending", "done"]).order("created_at", { ascending: false }).limit(10);
    return (data || []).map(d => ({ id: d.id, agentId: d.agent_id, status: d.status, result: d.result, isSvg: d.is_svg, error: d.error }));
  },
  async listThreads() {
    const { data } = await sb.from("forum_threads").select("*").order("updated_at", { ascending: false }).limit(100);
    return (data || []).map(mapThread);
  },
  async getThread(id) {
    const { data } = await sb.from("forum_threads").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const { data: replies } = await sb.from("forum_replies").select("*").eq("thread_id", id).order("created_at", { ascending: true });
    return { ...mapThread(data), replies: (replies || []).map(mapReply) };
  },
  async addThread(userId, authorName, title, body) {
    const { data } = await sb.from("forum_threads").insert({ user_id: userId, author_name: authorName, title, body }).select().single();
    return mapThread(data);
  },
  async addReply(threadId, userId, authorName, body) {
    const { data } = await sb.from("forum_replies").insert({ thread_id: threadId, user_id: userId, author_name: authorName, body }).select().single();
    const { data: t } = await sb.from("forum_threads").select("reply_count").eq("id", threadId).maybeSingle();
    await sb.from("forum_threads").update({ reply_count: (t?.reply_count || 0) + 1, updated_at: new Date().toISOString() }).eq("id", threadId);
    return mapReply(data);
  },
  async deleteThread(userId, id, isOwner) {
    const q = sb.from("forum_threads").delete().eq("id", id);
    if (!isOwner) q.eq("user_id", userId);
    await q;
    return true;
  },
  async getChat(userId, agentId) {
    const { data } = await sb.from("chats").select("messages")
      .eq("user_id", userId).eq("agent_id", agentId).maybeSingle();
    return data?.messages || [];
  },
  async saveChat(userId, agentId, messages) {
    const trimmed = (messages || []).slice(-100);
    await sb.from("chats").upsert(
      { user_id: userId, agent_id: agentId, messages: trimmed, updated_at: new Date().toISOString() },
      { onConflict: "user_id,agent_id" }
    );
    return true;
  },
  async clearChat(userId, agentId) {
    await sb.from("chats").delete().eq("user_id", userId).eq("agent_id", agentId);
    return true;
  },
  async listChats(userId) {
    const { data } = await sb.from("chats").select("agent_id, messages, updated_at")
      .eq("user_id", userId).order("updated_at", { ascending: false });
    return (data || []).map(r => ({ agentId: r.agent_id, count: (r.messages || []).length, messages: r.messages || [], updatedAt: r.updated_at }));
  },
  // --- Team / org ---
  async getOrgMembers(orgId) {
    const { data } = await sb.from("users").select("id, email, created_at, org_id").eq("org_id", orgId).order("created_at");
    return (data || []).map(u => ({ id: u.id, email: u.email, joined: u.created_at, isOwner: u.id === orgId }));
  },
  async getInvites(orgId) {
    const { data } = await sb.from("team_invites").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
    return (data || []).map(i => ({ id: i.id, email: i.email, status: i.status, when: i.created_at }));
  },
  async addInvite(orgId, email) {
    const { data } = await sb.from("team_invites").insert({ org_id: orgId, email: email.toLowerCase() }).select().single();
    return data ? { id: data.id, email: data.email, status: data.status } : null;
  },
  async removeInvite(orgId, id) {
    await sb.from("team_invites").delete().eq("org_id", orgId).eq("id", id);
    return true;
  },
  async findInviteByEmail(email) {
    const { data } = await sb.from("team_invites").select("*").eq("email", email.toLowerCase()).eq("status", "pending").maybeSingle();
    return data ? { id: data.id, orgId: data.org_id, email: data.email } : null;
  },
  async joinOrg(userId, orgId, inviteId) {
    await sb.from("users").update({ org_id: orgId }).eq("id", userId);
    if (inviteId) await sb.from("team_invites").update({ status: "joined" }).eq("id", inviteId);
    return true;
  },
  async setOrgMemberPlanByOrg(orgId) { /* members inherit access via org; no-op placeholder */ return true; },
  async removeMember(orgId, memberId) {
    // Send them back to their own solo org (can't remove the owner).
    if (memberId === orgId) return false;
    await sb.from("users").update({ org_id: memberId }).eq("id", memberId).eq("org_id", orgId);
    return true;
  },
  async addFeatureRequest(userId, email, text) {
    await sb.from("feature_requests").insert({ user_id: userId, email, text });
    return true;
  },
};

// Map snake_case DB rows to the camelCase the app expects.
function mapUser(r) {
  return {
    id: r.id, email: r.email, passwordHash: r.password_hash, plan: r.plan,
    referralCode: r.referral_code, referredBy: r.referred_by,
    stripeConnectId: r.stripe_connect_id, createdAt: r.created_at,
    orgId: r.org_id || r.id,
  };
}
function mapReferral(r) {
  return { code: r.code, referredEmail: r.referred_email, plan: r.plan,
    status: r.status, commissionCents: r.commission_cents };
}
function mapSaved(r) {
  return { id: r.id, userId: r.user_id, tool: r.tool, text: r.text, when: r.created_at };
}
function mapBrain(r) {
  return { id: r.id, userId: r.user_id, kind: r.kind, label: r.label, content: r.content, when: r.created_at };
}
function mapBooking(r) {
  return { id: r.id, userId: r.user_id, title: r.title, withWho: r.with_who,
    startsAt: r.starts_at, endsAt: r.ends_at, notes: r.notes, meetLink: r.meet_link };
}
function mapRelease(r) {
  return { id: r.id, userId: r.user_id, title: r.title, splits: r.splits || [],
    revenueCents: r.revenue_cents || 0, shareCode: r.share_code || null };
}
function mapThread(t) {
  return { id: t.id, userId: t.user_id, author: t.author_name || "Artist", title: t.title,
    body: t.body || "", replyCount: t.reply_count || 0, createdAt: t.created_at, updatedAt: t.updated_at };
}
function mapReply(r) {
  return { id: r.id, userId: r.user_id, author: r.author_name || "Artist", body: r.body, createdAt: r.created_at };
}

// ---------------------------------------------------------------------------
// IN-MEMORY FALLBACK (async wrappers so the interface matches)
// ---------------------------------------------------------------------------
const users = new Map();
const usageByUser = new Map();
const imageUsageByUser = new Map();
const referrals = [];
const savedItems = [];
const brainItems = [];
const chatsByUserAgent = new Map(); // key: `${userId}:${agentId}` -> [messages]
const teamInvites = []; // { id, orgId, email, status, createdAt }
const featureRequests = []; // { id, userId, email, text, createdAt }
const bookings = []; // { id, userId, title, withWho, startsAt, endsAt, notes, meetLink }
const settingsByUser = new Map(); // userId -> { timezone, businessHours }
const epks = new Map(); // userId -> { shareCode, data }
const epkByCode = new Map(); // shareCode -> userId
const releases = []; // { id, userId, title, splits, revenueCents, shareCode }
const fans = []; // { id, userId, name, email, source, when }
const syncTracks = []; // { id, userId, title, data }
const chatJobs = new Map(); // id -> { id, userId, agentId, status, result, isSvg, error, createdAt }
const threads = []; // { id, userId, author, title, body, replyCount, createdAt, updatedAt }
const forumReplies = []; // { id, threadId, userId, author, body, createdAt }
let nextId = 1;

const memoryDb = {
  async createUser({ email, passwordHash, referralCode }) {
    if (users.has(email)) throw new Error("Email already registered");
    const id = nextId++;
    // If they were invited to a team, join that org; otherwise they're their own org.
    const inv = teamInvites.find(i => i.email === email.toLowerCase() && i.status === "pending");
    const user = { id, email, passwordHash, plan: "trial",
      referralCode: genCode(), referredBy: referralCode || null, createdAt: new Date().toISOString(),
      orgId: inv ? inv.orgId : id };
    if (inv) inv.status = "joined";
    users.set(email, user);
    if (referralCode) referrals.push({ code: referralCode, referredEmail: email, plan: "indie", status: "trial" });
    return user;
  },
  async findByEmail(email) { return users.get(email) || null; },
  async findById(id) { return [...users.values()].find(u => u.id === id) || null; },
  async findByReferralCode(code) { return [...users.values()].find(u => u.referralCode === code) || null; },
  async setPlan(userId, plan) { const u = await this.findById(userId); if (u) u.plan = plan; },
  async deleteUser(userId) {
    const u = await this.findById(userId);
    if (u) users.delete(u.email);
    // clean child data
    for (const arr of [fans, releases, syncTracks, bookings]) {
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i].userId === userId) arr.splice(i, 1);
    }
    return true;
  },
  async setPassword(userId, passwordHash) { const u = await this.findById(userId); if (u) u.passwordHash = passwordHash; },
  async listAllUsers() {
    return [...users.values()].map(u => ({
      id: u.id, email: u.email, plan: u.plan, createdAt: u.createdAt,
      seats: u.seats || 0, referredBy: u.referredBy || null,
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  async setSeats(userId, seats) { const u = await this.findById(userId); if (u) u.seats = seats; },
  async getSeats(userId) { const u = await this.findById(userId); return u?.seats || 0; },
  async getTrialsEndingSoon() {
    const now = Date.now();
    return [...users.values()].filter(u => {
      if (u.plan !== "trial" || !u.createdAt) return false;
      const age = now - new Date(u.createdAt).getTime();
      return age >= 1 * 864e5 && age <= 2 * 864e5; // between 1 and 2 days old
    }).map(u => ({ id: u.id, email: u.email, createdAt: u.createdAt }));
  },
  async setConnectAccount(userId, acctId) { const u = await this.findById(userId); if (u) u.stripeConnectId = acctId; },
  async getUsage(userId) { return usageByUser.get(userId) || 0; },
  async incrementUsage(userId, by = 1) { const n = (usageByUser.get(userId) || 0) + by; usageByUser.set(userId, n); return n; },
  async getImageUsage(userId) { return imageUsageByUser.get(userId) || 0; },
  async incrementImageUsage(userId, by = 1) { const n = (imageUsageByUser.get(userId) || 0) + by; imageUsageByUser.set(userId, n); return n; },
  async listReferralsFor(code) { return referrals.filter(r => r.code === code); },
  async recordReferralConversion(referredEmail, plan, monthlyCents) {
    const r = referrals.find(x => x.referredEmail === referredEmail);
    if (!r) return null;
    r.status = "active"; r.plan = plan; r.commissionCents = Math.round(monthlyCents * COMMISSION_RATE);
    return r;
  },
  async commissionOwed(code) {
    return referrals.filter(r => r.code === code && r.status === "active")
      .reduce((sum, r) => sum + (r.commissionCents || 0), 0);
  },
  async listSaved(userId) { return savedItems.filter(s => s.userId === userId).sort((a, b) => b.id - a.id); },
  async addSaved(userId, tool, text) {
    const item = { id: Date.now() + Math.floor(Math.random() * 1000), userId, tool, text, when: new Date().toISOString() };
    savedItems.push(item); return item;
  },
  async deleteSaved(userId, id) {
    const i = savedItems.findIndex(s => s.userId === userId && s.id === id);
    if (i >= 0) savedItems.splice(i, 1);
    return i >= 0;
  },
  async listBrain(userId) { return brainItems.filter(b => b.userId === userId).sort((a, b) => b.id - a.id); },
  async addBrain(userId, kind, label, content) {
    const item = { id: Date.now() + Math.floor(Math.random() * 1000), userId, kind, label, content, when: new Date().toISOString() };
    brainItems.push(item); return item;
  },
  async deleteBrain(userId, id) {
    const i = brainItems.findIndex(b => b.userId === userId && b.id === id);
    if (i >= 0) brainItems.splice(i, 1);
    return i >= 0;
  },
  async getChat(userId, agentId) {
    return chatsByUserAgent.get(`${userId}:${agentId}`) || [];
  },
  async saveChat(userId, agentId, messages) {
    // Keep the most recent 100 messages to bound storage.
    chatsByUserAgent.set(`${userId}:${agentId}`, (messages || []).slice(-100));
    return true;
  },
  async clearChat(userId, agentId) {
    chatsByUserAgent.delete(`${userId}:${agentId}`);
    return true;
  },
  async listChats(userId) {
    const out = [];
    for (const [key, messages] of chatsByUserAgent.entries()) {
      const [uid, agentId] = key.split(":");
      if (Number(uid) === Number(userId) && messages?.length) {
        out.push({ agentId, count: messages.length, messages });
      }
    }
    return out;
  },
  // --- Team / org (in-memory) ---
  async getOrgMembers(orgId) {
    return [...users.values()].filter(u => (u.orgId || u.id) === orgId)
      .map(u => ({ id: u.id, email: u.email, joined: u.createdAt, isOwner: u.id === orgId }));
  },
  async getInvites(orgId) {
    return teamInvites.filter(i => i.orgId === orgId).map(i => ({ id: i.id, email: i.email, status: i.status, when: i.createdAt }));
  },
  async addInvite(orgId, email) {
    const inv = { id: nextId++, orgId, email: email.toLowerCase(), status: "pending", createdAt: new Date().toISOString() };
    teamInvites.push(inv);
    return { id: inv.id, email: inv.email, status: inv.status };
  },
  async removeInvite(orgId, id) {
    const i = teamInvites.findIndex(x => x.orgId === orgId && x.id === id);
    if (i >= 0) teamInvites.splice(i, 1);
    return true;
  },
  async findInviteByEmail(email) {
    const inv = teamInvites.find(i => i.email === email.toLowerCase() && i.status === "pending");
    return inv ? { id: inv.id, orgId: inv.orgId, email: inv.email } : null;
  },
  async joinOrg(userId, orgId, inviteId) {
    const u = await this.findById(userId); if (u) u.orgId = orgId;
    const inv = teamInvites.find(i => i.id === inviteId); if (inv) inv.status = "joined";
    return true;
  },
  async removeMember(orgId, memberId) {
    if (memberId === orgId) return false;
    const u = await this.findById(memberId); if (u && (u.orgId === orgId)) u.orgId = memberId;
    return true;
  },
  async addFeatureRequest(userId, email, text) {
    featureRequests.push({ id: nextId++, userId, email, text, createdAt: new Date().toISOString() });
    return true;
  },
  async listBookings(userId) {
    return bookings.filter(b => b.userId === userId).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  },
  async addBooking(userId, b) {
    const row = { id: nextId++, userId, title: b.title, withWho: b.withWho || null,
      startsAt: b.startsAt, endsAt: b.endsAt || null, notes: b.notes || null, meetLink: b.meetLink || null };
    bookings.push(row); return row;
  },
  async deleteBooking(userId, id) {
    const i = bookings.findIndex(b => b.userId === userId && b.id === id);
    if (i >= 0) bookings.splice(i, 1);
    return true;
  },
  async getSettings(userId) {
    const s = settingsByUser.get(userId) || {};
    return { timezone: s.timezone || null, businessHours: s.businessHours || null,
      weeklyDigest: s.weeklyDigest !== false };
  },
  async setSettings(userId, patch) {
    const cur = settingsByUser.get(userId) || {};
    const clean = {};
    for (const k of Object.keys(patch)) if (patch[k] !== undefined) clean[k] = patch[k];
    settingsByUser.set(userId, { ...cur, ...clean }); return true;
  },
  async getDigestRecipients() {
    return [...users.values()]
      .filter(u => (settingsByUser.get(u.id)?.weeklyDigest !== false))
      .map(u => ({ id: u.id, email: u.email }));
  },
  async saveEpk(userId, shareCode, data) {
    epks.set(userId, { shareCode, data }); epkByCode.set(shareCode, userId); return { shareCode };
  },
  async getEpkByUser(userId) { return epks.get(userId) || null; },
  async getEpkByCode(code) { const uid = epkByCode.get(code); return uid ? (epks.get(uid)?.data || null) : null; },
  async listReleases(userId) {
    return releases.filter(r => r.userId === userId).sort((a, b) => b.id - a.id);
  },
  async addRelease(userId, r) {
    const row = { id: nextId++, userId, title: r.title, splits: r.splits || [], revenueCents: r.revenueCents || 0, shareCode: null };
    releases.push(row); return row;
  },
  async updateRelease(userId, id, patch) {
    const row = releases.find(r => r.userId === userId && r.id === id);
    if (!row) return null;
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.splits !== undefined) row.splits = patch.splits;
    if (patch.revenueCents !== undefined) row.revenueCents = patch.revenueCents;
    if (patch.shareCode !== undefined) row.shareCode = patch.shareCode;
    return row;
  },
  async deleteRelease(userId, id) {
    const i = releases.findIndex(r => r.userId === userId && r.id === id);
    if (i >= 0) releases.splice(i, 1);
    return true;
  },
  async getReleaseByCode(code) { return releases.find(r => r.shareCode === code) || null; },
  async listFans(userId) {
    return fans.filter(f => f.userId === userId).sort((a, b) => b.id - a.id)
      .map(f => ({ id: f.id, name: f.name, email: f.email, source: f.source, when: f.when }));
  },
  async addFan(userId, { name, email, source }) {
    if (fans.find(f => f.userId === userId && f.email === email)) return { duplicate: true };
    const row = { id: nextId++, userId, name: name || null, email, source: source || "manual", when: new Date().toISOString() };
    fans.push(row); return { id: row.id, name: row.name, email: row.email };
  },
  async deleteFan(userId, id) {
    const i = fans.findIndex(f => f.userId === userId && f.id === id);
    if (i >= 0) fans.splice(i, 1);
    return true;
  },
  async getFanCode(userId) { const u = await this.findById(userId); return u?.fanCode || null; },
  async setFanCode(userId, code) { const u = await this.findById(userId); if (u) u.fanCode = code; return true; },
  async findUserByFanCode(code) {
    const u = [...users.values()].find(x => x.fanCode === code);
    return u ? { id: u.id, email: u.email } : null;
  },
  async listSyncTracks(userId) {
    return syncTracks.filter(t => t.userId === userId).sort((a, b) => b.id - a.id)
      .map(t => ({ id: t.id, title: t.title, data: t.data || {} }));
  },
  async addSyncTrack(userId, title, data) {
    const row = { id: nextId++, userId, title, data: data || {} };
    syncTracks.push(row); return { id: row.id, title: row.title, data: row.data };
  },
  async updateSyncTrack(userId, id, patch) {
    const row = syncTracks.find(t => t.userId === userId && t.id === id);
    if (!row) return null;
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.data !== undefined) row.data = patch.data;
    return { id: row.id, title: row.title, data: row.data };
  },
  async deleteSyncTrack(userId, id) {
    const i = syncTracks.findIndex(t => t.userId === userId && t.id === id);
    if (i >= 0) syncTracks.splice(i, 1);
    return true;
  },
  async createChatJob(id, userId, agentId) {
    chatJobs.set(id, { id, userId, agentId, status: "pending", result: null, isSvg: false, error: null, createdAt: Date.now() });
    return { id, status: "pending" };
  },
  async finishChatJob(id, { result, isSvg, error }) {
    const j = chatJobs.get(id);
    if (j) { j.status = error ? "error" : "done"; j.result = result || null; j.isSvg = !!isSvg; j.error = error || null; }
    return true;
  },
  async getChatJob(userId, id) {
    const j = chatJobs.get(id);
    return (j && j.userId === userId) ? { id: j.id, agentId: j.agentId, status: j.status, result: j.result, isSvg: j.isSvg, error: j.error } : null;
  },
  async listPendingJobs(userId) {
    return [...chatJobs.values()].filter(j => j.userId === userId && (j.status === "pending" || j.status === "done"))
      .sort((a, b) => b.createdAt - a.createdAt).slice(0, 10)
      .map(j => ({ id: j.id, agentId: j.agentId, status: j.status, result: j.result, isSvg: j.isSvg, error: j.error }));
  },
  async listThreads() {
    return [...threads].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 100);
  },
  async getThread(id) {
    const t = threads.find(x => x.id === id);
    if (!t) return null;
    return { ...t, replies: forumReplies.filter(r => r.threadId === id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)) };
  },
  async addThread(userId, authorName, title, body) {
    const t = { id: nextId++, userId, author: authorName || "Artist", title, body: body || "",
      replyCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    threads.push(t); return t;
  },
  async addReply(threadId, userId, authorName, body) {
    const r = { id: nextId++, threadId, userId, author: authorName || "Artist", body, createdAt: new Date().toISOString() };
    forumReplies.push(r);
    const t = threads.find(x => x.id === threadId);
    if (t) { t.replyCount = (t.replyCount || 0) + 1; t.updatedAt = new Date().toISOString(); }
    return r;
  },
  async deleteThread(userId, id, isOwner) {
    const i = threads.findIndex(t => t.id === id && (isOwner || t.userId === userId));
    if (i >= 0) { threads.splice(i, 1); for (let j = forumReplies.length - 1; j >= 0; j--) if (forumReplies[j].threadId === id) forumReplies.splice(j, 1); }
    return true;
  },
};

export const db = useSupabase ? supabaseDb : memoryDb;
console.log(useSupabase ? "Store: Supabase (persistent)" : "Store: in-memory (dev only)");
