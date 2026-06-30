// ============================================================================
// STEP 2 — Additions to store.js for the social content calendar.
// Three pieces below: (A) Supabase methods, (B) in-memory array + methods,
// (C) a mapSocialPost helper. Paste each into the matching section of your
// existing store.js — do not replace the whole file.
// ============================================================================

// ---------------------------------------------------------------------------
// (A) Add these methods inside `supabaseDb { ... }`, near listBookings/addBooking/deleteBooking
// ---------------------------------------------------------------------------
/*
  async listSocialPosts(userId) {
    const { data } = await sb.from("social_posts").select("*").eq("user_id", userId).order("created_at", { ascending: true });
    return (data || []).map(mapSocialPost);
  },
  async addSocialPost(userId, p) {
    const { data, error } = await sb.from("social_posts").insert({
      user_id: userId, day: p.day, platform: p.platform, post_type: p.postType, note: p.note,
    }).select().single();
    if (error) throw new Error(error.message);
    return mapSocialPost(data);
  },
  async deleteSocialPost(userId, id) {
    const { error } = await sb.from("social_posts").delete().eq("user_id", userId).eq("id", id);
    return !error;
  },
*/

// ---------------------------------------------------------------------------
// (B) In the IN-MEMORY FALLBACK section:
//
// 1. Add this array alongside the other arrays (e.g. near `const bookings = []`):
//      const socialPosts = []; // { id, userId, day, platform, postType, note }
//
// 2. Add these three methods inside `const memoryDb = { ... }`, near listBookings/addBooking/deleteBooking:
// ---------------------------------------------------------------------------
/*
  async listSocialPosts(userId) {
    return socialPosts.filter(p => p.userId === userId);
  },
  async addSocialPost(userId, p) {
    const row = { id: nextId++, userId, day: p.day, platform: p.platform, postType: p.postType, note: p.note };
    socialPosts.push(row);
    return row;
  },
  async deleteSocialPost(userId, id) {
    const i = socialPosts.findIndex(p => p.userId === userId && p.id === id);
    if (i >= 0) socialPosts.splice(i, 1);
    return true;
  },
*/

// ---------------------------------------------------------------------------
// (C) Add this mapping helper near mapBooking/mapRelease, for the Supabase side:
// ---------------------------------------------------------------------------
/*
function mapSocialPost(r) {
  return { id: r.id, userId: r.user_id, day: r.day, platform: r.platform, postType: r.post_type, note: r.note };
}
*/

// ---------------------------------------------------------------------------
// (D) Supabase table — run this once in the Supabase SQL editor:
// ---------------------------------------------------------------------------
/*
create table if not exists social_posts (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  day text not null,
  platform text not null,
  post_type text not null default 'Post',
  note text not null,
  created_at timestamptz default now()
);
create index if not exists social_posts_user_id_idx on social_posts(user_id);
*/
