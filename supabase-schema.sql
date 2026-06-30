-- ============================================================================
-- Anthem — Supabase database schema
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- ============================================================================

-- Users
create table if not exists users (
  id                bigint generated always as identity primary key,
  email             text unique not null,
  password_hash     text not null,
  plan              text not null default 'indie',
  referral_code     text unique not null,
  referred_by       text,
  stripe_connect_id text,
  created_at        timestamptz not null default now()
);

-- Usage metering (one row per user, current period count)
create table if not exists usage (
  user_id     bigint primary key references users(id) on delete cascade,
  count       integer not null default 0,
  image_count integer not null default 0
);

-- Referrals
create table if not exists referrals (
  id               bigint generated always as identity primary key,
  code             text not null,                 -- referrer's referral_code
  referred_email   text not null,
  plan             text,
  status           text not null default 'trial', -- trial | active
  commission_cents integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists referrals_code_idx on referrals(code);

-- Saved items (lyrics, EPK, grants, agent replies, etc.)
create table if not exists saved_items (
  id         bigint generated always as identity primary key,
  user_id    bigint not null references users(id) on delete cascade,
  tool       text,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists saved_items_user_idx on saved_items(user_id);

-- Note on security: the backend connects with the SERVICE key and enforces
-- per-user access in code (every query filters by user_id). Because the service
-- key bypasses Row Level Security, do NOT expose it to the browser — it lives
-- only in your backend env vars. If you later let the browser talk to Supabase
-- directly, enable RLS and add per-user policies.

-- Brain items: notes & website content that feed the AI agents.
create table if not exists brain_items (
  id         bigint generated always as identity primary key,
  user_id    bigint not null references users(id) on delete cascade,
  kind       text not null default 'note',  -- note | link
  label      text,
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists brain_items_user_idx on brain_items(user_id);

-- Chat history: one row per user per agent, storing the conversation as JSON.
create table if not exists chats (
  user_id    bigint not null references users(id) on delete cascade,
  agent_id   text not null,
  messages   jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (user_id, agent_id)
);

-- Team / org support: org_id groups users into one shared workspace.
-- A user with org_id = their own id is an owner; members point to the owner's id.
alter table users add column if not exists org_id bigint;
update users set org_id = id where org_id is null;

-- Pending invites (teammate invited by email, not yet signed up/joined).
create table if not exists team_invites (
  id         bigint generated always as identity primary key,
  org_id     bigint not null references users(id) on delete cascade,
  email      text not null,
  status     text not null default 'pending',  -- pending | joined
  created_at timestamptz not null default now()
);

-- Paid team seats (how many $10 seats the org owner has purchased)
alter table users add column if not exists seats int not null default 0;

-- Feature requests submitted by users
create table if not exists feature_requests (
  id bigint generated always as identity primary key,
  user_id bigint,
  email text,
  text text not null,
  created_at timestamptz not null default now()
);

-- Bookings (in-app calendar)
create table if not exists bookings (
  id         bigint generated always as identity primary key,
  user_id    bigint not null references users(id) on delete cascade,
  title      text not null,
  with_who   text,
  starts_at  timestamptz not null,
  ends_at    timestamptz,
  notes      text,
  meet_link  text,
  created_at timestamptz not null default now()
);

-- User settings: timezone + business hours
alter table users add column if not exists timezone text;
alter table users add column if not exists business_hours jsonb;

-- Weekly digest opt-in (default true)
alter table users add column if not exists weekly_digest boolean not null default true;

-- Public EPK / press kit (shareable by code)
create table if not exists epks (
  user_id    bigint primary key references users(id) on delete cascade,
  share_code text unique not null,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Royalty releases (each has a JSON list of collaborator splits)
create table if not exists releases (
  id         bigint generated always as identity primary key,
  user_id    bigint not null references users(id) on delete cascade,
  title      text not null,
  splits     jsonb not null default '[]',
  revenue_cents bigint not null default 0,
  share_code text unique,
  created_at timestamptz not null default now()
);

-- Fan CRM: an artist's fans (collected manually or via public signup)
create table if not exists fans (
  id         bigint generated always as identity primary key,
  user_id    bigint not null references users(id) on delete cascade,
  name       text,
  email      text not null,
  source     text default 'manual',
  created_at timestamptz not null default now()
);
-- Public fan-signup code per artist
alter table users add column if not exists fan_code text;

-- Sync-ready tracks (metadata + readiness checklist)
create table if not exists sync_tracks (
  id         bigint generated always as identity primary key,
  user_id    bigint not null references users(id) on delete cascade,
  title      text not null,
  data       jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Background chat jobs (so an answer finishes server-side even if the user leaves)
create table if not exists chat_jobs (
  id         text primary key,
  user_id    bigint not null references users(id) on delete cascade,
  agent_id   text not null,
  status     text not null default 'pending',
  result     text,
  is_svg     boolean default false,
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_jobs_user_idx on chat_jobs(user_id, status);

-- Community forum: threads and replies
create table if not exists forum_threads (
  id          bigint generated always as identity primary key,
  user_id     bigint not null references users(id) on delete cascade,
  author_name text,
  title       text not null,
  body        text not null default '',
  reply_count int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists forum_replies (
  id          bigint generated always as identity primary key,
  thread_id   bigint not null references forum_threads(id) on delete cascade,
  user_id     bigint not null references users(id) on delete cascade,
  author_name text,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists forum_replies_thread_idx on forum_replies(thread_id);

-- Website chat widget: per-artist public code so fans can chat with Cleo on the artist's site
alter table users add column if not exists widget_code text;
-- Optional extra info the artist wants Cleo to know (FAQ, tour, merch links)
alter table users add column if not exists widget_info text;
