# Social Media Agent — Backend Integration

These files add two endpoints to your existing `anthem-backend` Express app on Railway.

## Files
- `lib/platformConfig.js` — platform rules (hashtag counts, format notes, post types), ported from the frontend artifact
- `lib/usageLimits.js` — monthly plan-limit checking against the `social_usage` table
- `routes/socialGenerateText.js` — POST `/api/social/generate-text` (replies, DMs, crisis, content, repurpose)
- `routes/socialGenerateImage.js` — POST `/api/social/generate-image` (DALL-E + Claude prompt enhancement)
- `migration_social_media_agent.sql` — creates `social_brand_profiles`, `social_calendar_posts`, `social_usage` tables with RLS

## Step 1 — Run the migration
Paste `migration_social_media_agent.sql` into the Supabase SQL editor for your `fiiubhgiuxtiperlreyz` project (or wherever Anthem's Supabase instance lives) and run it.

## Step 2 — Copy files into anthem-backend
Drop `lib/platformConfig.js` and `lib/usageLimits.js` into your backend's `lib/` (or equivalent) folder, and the two route files into `routes/`.

## Step 3 — Install dependencies (if not already present)
```bash
npm install @anthropic-ai/sdk openai
```

## Step 4 — Wire the routes into your main server file
In your main `index.js` / `server.js` (wherever you mount other routes):
```js
const socialGenerateText = require("./routes/socialGenerateText");
const socialGenerateImage = require("./routes/socialGenerateImage");

app.use(socialGenerateText);
app.use(socialGenerateImage);
```

## Step 5 — Make sure `req.user` and `req.supabase` are populated
Both routes expect:
- `req.user.id` — the authenticated user's Supabase UUID
- `req.user.planTier` — one of `"free" | "starter" | "pro" | "label"` (pull this from wherever you store subscription tier today, likely a `profiles` or `subscriptions` table you already query for Stripe status)
- `req.supabase` — a Supabase client initialized with the **service role key** (not anon key), since usage writes bypass RLS intentionally

If you already have middleware doing this for other Anthem routes (you should, given RLS is applied everywhere else), just make sure these two routes are mounted *after* that middleware.

## Step 6 — Environment variables
Confirm these exist in Railway's environment variables for the backend service:
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```
(Your Anthropic key is likely already set since Anthem uses Claude elsewhere. The OpenAI key is new — get one from platform.openai.com and add it as a new Railway variable.)

## Step 7 — Deploy
```bash
git add .
git commit -m "Add social media agent backend endpoints"
git push origin main
```
Railway will auto-deploy from the push (same as your other backend updates).

## Step 8 — Test
```bash
curl -X POST https://anthem-backend-production.up.railway.app/api/social/generate-text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <a real user JWT>" \
  -d '{
    "mode": "replies",
    "brand": { "brandName": "Test Brand", "brandVoice": "Warm & Caring", "platform": "Instagram" },
    "comment": "Do you ship internationally?",
    "tone": "Mix it up"
  }'
```

## Frontend changes needed (separate step)
Once these are live, update the React component to call your own backend instead of `api.anthropic.com` / `api.openai.com` directly:

```js
// Before (artifact version):
fetch("https://api.anthropic.com/v1/messages", { ... })

// After (Anthem version):
fetch("https://anthem-backend-production.up.railway.app/api/social/generate-text", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${userSessionToken}`,
  },
  body: JSON.stringify({ mode: "replies", brand, comment, tone }),
})
```

And swap `window.storage.get/set` calls for real Supabase reads/writes against `social_brand_profiles` and `social_calendar_posts`, scoped to the logged-in user.

I can write that frontend conversion next once this backend piece is deployed and tested.
