# Anthem — Backend

A working API for the Anthem AI-agent platform. It keeps your AI keys secure
on the server, proxies the agent chat calls, and provides auth, subscription
billing (Stripe + optional PayPal), and referral endpoints.

## What's inside

```
src/
  server.js            # Express app + route wiring
  store.js             # In-memory data store (swap for a real DB in production)
  middleware/auth.js   # JWT auth guard
  routes/
    auth.js            # POST /api/auth/signup, /login
    chat.js            # POST /api/chat  (the core agent proxy — holds your key)
    billing.js         # Stripe checkout + webhook; PayPal placeholder
    referral.js        # GET /api/referral
```

## Run locally

1. Install Node.js 18+.
2. `npm install`
3. `cp .env.example .env` and fill in your values (at minimum `JWT_SECRET` and `ANTHROPIC_API_KEY`).
4. `npm run dev`
5. Server runs on http://localhost:4000 — check http://localhost:4000/api/health

## Connect the front end

The front end (`Anthem.jsx`) is already wired. Open it and set one line near the top:

```js
const API_BASE = "https://your-backend-url.com";  // leave "" for preview/demo mode
```

- **Empty string** (default): demo mode — agents call the AI directly so the preview works.
- **Your backend URL**: live mode — the app shows a login screen, then routes every
  agent message through `POST /api/chat` with the user's token. Your AI key stays
  server-side. The image agent (Inkwell) returns SVG; the rest return text.

That's the key security fix: in live mode the API key never touches the browser.

## Payments

- **Stripe (recommended):** create 3 subscription Prices in the Stripe dashboard,
  put their IDs in `.env`, and point a webhook at `/api/billing/webhook`.
- **PayPal (optional):** supported via PayPal's Subscriptions API — see the
  commented section in `routes/billing.js` to finish wiring it.
- **Cash App:** not supported for recurring SaaS billing; use Stripe/PayPal.

## Going to production

- Replace `store.js` with a real database (Supabase/Postgres recommended).
- Deploy the backend to Railway, Render, or Fly.io.
- Deploy the front end to Vercel or Netlify, pointing it at your backend URL.
- Set all `.env` values as environment variables in your host (never commit `.env`).
```
