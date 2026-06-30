// lib/usageLimits.js
// Tracks monthly AI usage per user so plan limits can be enforced.
// Assumes a Supabase table `social_usage` with columns:
//   user_id (uuid), month (text, e.g. "2026-06"), text_count (int), image_count (int)
// and RLS enabled so users can only read their own row (writes happen via service role from backend).

const PLAN_LIMITS = {
  free: { text: 20, images: 0 },
  starter: { text: 300, images: 20 },
  pro: { text: 1500, images: 100 },
  label: { text: 5000, images: 400 }, // matches your "Comp free (Label)" / higher tier accounts
};

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Checks whether a user can make another AI call of the given kind ("text" | "image"),
 * and returns the current usage row. Throws a 429-style error object if over limit.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - service-role client
 * @param {string} userId
 * @param {string} planTier - e.g. "free" | "starter" | "pro" | "label"
 * @param {"text"|"image"} kind
 */
async function checkAndReserveUsage(supabase, userId, planTier, kind) {
  const month = currentMonthKey();
  const limits = PLAN_LIMITS[planTier] || PLAN_LIMITS.free;

  const { data: existing, error: fetchErr } = await supabase
    .from("social_usage")
    .select("*")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle();

  if (fetchErr) {
    const err = new Error("Failed to read usage");
    err.status = 500;
    throw err;
  }

  const textCount = existing?.text_count || 0;
  const imageCount = existing?.image_count || 0;

  if (kind === "text" && textCount >= limits.text) {
    const err = new Error("Monthly text generation limit reached. Upgrade your plan to continue.");
    err.status = 429;
    throw err;
  }
  if (kind === "image" && imageCount >= limits.images) {
    const err = new Error("Monthly image generation limit reached. Upgrade your plan to continue.");
    err.status = 429;
    throw err;
  }

  // Upsert incremented count
  const nextText = kind === "text" ? textCount + 1 : textCount;
  const nextImage = kind === "image" ? imageCount + 1 : imageCount;

  const { error: upsertErr } = await supabase.from("social_usage").upsert(
    {
      user_id: userId,
      month,
      text_count: nextText,
      image_count: nextImage,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,month" }
  );

  if (upsertErr) {
    const err = new Error("Failed to update usage");
    err.status = 500;
    throw err;
  }

  return { textCount: nextText, imageCount: nextImage, limits };
}

module.exports = { checkAndReserveUsage, PLAN_LIMITS, currentMonthKey };
