// ----------------------------------------------------------------------------
// SIMPLE IN-MEMORY STORE (for development only).
//
// This lets the backend run with zero setup. For production, replace these
// functions with real database calls (Postgres via Supabase/Prisma, etc.).
// The function signatures are what the rest of the app depends on — keep them
// the same and only change the bodies.
// ----------------------------------------------------------------------------

const users = new Map();        // email -> user object
const usageByUser = new Map();  // userId -> number of tasks this period
const referrals = [];           // { code, referrerId, referredEmail, plan, status }

let nextId = 1;

export const db = {
  createUser({ email, passwordHash, referralCode }) {
    if (users.has(email)) throw new Error("Email already registered");
    const user = {
      id: nextId++,
      email,
      passwordHash,
      plan: "indie",
      referralCode: "AF-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      referredBy: referralCode || null,
      createdAt: new Date().toISOString(),
    };
    users.set(email, user);
    if (referralCode) {
      referrals.push({ code: referralCode, referredEmail: email, plan: "indie", status: "trial" });
    }
    return user;
  },
  findByEmail(email) { return users.get(email) || null; },
  findById(id) { return [...users.values()].find(u => u.id === id) || null; },
  findByReferralCode(code) { return [...users.values()].find(u => u.referralCode === code) || null; },
  setPlan(userId, plan) {
    const u = this.findById(userId);
    if (u) u.plan = plan;
  },
  // Stripe Connect account id for paying this user (referrer) out.
  setConnectAccount(userId, acctId) {
    const u = this.findById(userId);
    if (u) u.stripeConnectId = acctId;
  },

  // Usage metering
  getUsage(userId) { return usageByUser.get(userId) || 0; },
  incrementUsage(userId, by = 1) {
    usageByUser.set(userId, this.getUsage(userId) + by);
    return this.getUsage(userId);
  },

  // Referrals
  listReferralsFor(code) { return referrals.filter(r => r.code === code); },
  // When a referred user pays, mark active and credit the referrer's commission.
  recordReferralConversion(referredEmail, plan, monthlyCents) {
    const r = referrals.find(x => x.referredEmail === referredEmail);
    if (!r) return null;
    r.status = "active";
    r.plan = plan;
    r.commissionCents = Math.round(monthlyCents * COMMISSION_RATE);
    return r;
  },
  // Total owed to a referrer (sum of active referrals' monthly commission).
  commissionOwed(code) {
    return referrals.filter(r => r.code === code && r.status === "active")
      .reduce((sum, r) => sum + (r.commissionCents || 0), 0);
  },
};

export const COMMISSION_RATE = 0.30; // 30% recurring

// Monthly task caps per plan — enforce in the chat route.
export const PLAN_LIMITS = { indie: 500, artist: 10000, label: 100000 };
