// Central access rules: which agents a user can use, including the 2-day trial.
const TRIAL_DAYS = 2;

// OWNER ACCOUNTS — these emails get full access forever, free, no trial limit.
// Add your own email(s) here (lowercase). You can also set OWNER_EMAILS in the
// environment as a comma-separated list (it merges with this one).
const OWNER_EMAILS = [
  "gw@varietyvibesradio.com",
  // "you@example.com",
];
function ownerSet() {
  const fromEnv = (process.env.OWNER_EMAILS || "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return new Set([...OWNER_EMAILS.map(e => e.toLowerCase()), ...fromEnv]);
}
export function isOwner(user) {
  if (!user?.email) return false;
  return ownerSet().has(user.email.toLowerCase());
}

// Agents unlocked per paid plan. Indie = 2; Artist/Label = all.
const PLAN_AGENTS = {
  indie: ["anr", "social"],
  artist: ["anr", "social", "booking", "legal", "image", "blog", "chat", "finance"],
  label: ["anr", "social", "booking", "legal", "image", "blog", "chat", "finance"],
};
const ALL_AGENTS = PLAN_AGENTS.artist;

// Is the user still inside their free trial window?
export function inTrial(user) {
  if (!user?.createdAt) return false;
  const started = new Date(user.createdAt).getTime();
  if (Number.isNaN(started)) return false;
  return Date.now() - started < TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

// Can this user use this agent right now?
export function canUseAgent(user, agentId) {
  if (isOwner(user)) return true; // owners: everything, forever
  const plan = user?.plan || "trial";
  if (plan === "trial") {
    // Full access during the trial; nothing after it expires.
    return inTrial(user);
  }
  const allowed = PLAN_AGENTS[plan] || [];
  return allowed.includes(agentId);
}

// Team members inherit their org owner's access. Pass the member and the
// org owner record; if the member IS the owner, ownerUser can be the same.
export function canUseAgentInOrg(memberUser, ownerUser, agentId) {
  // Anthem owners (you) always have full access.
  if (isOwner(memberUser) || isOwner(ownerUser)) return true;
  // Use whichever account grants more — the member's own plan or the owner's.
  return canUseAgent(ownerUser || memberUser, agentId) || canUseAgent(memberUser, agentId);
}

export { TRIAL_DAYS, PLAN_AGENTS, ALL_AGENTS };
