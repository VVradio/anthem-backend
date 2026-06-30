-- migration: social_media_agent.sql
-- Run this in Supabase SQL editor (or your migration tool) for anthem-backend.

-- Brand profile, one row per user (replaces the artifact's local storage)
create table if not exists social_brand_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  brand_name text,
  brand_history text,
  brand_voice text,
  custom_voice text,
  brand_values text,
  default_platform text default 'Instagram',
  updated_at timestamptz default now()
);

alter table social_brand_profiles enable row level security;

create policy "Users can view own brand profile"
  on social_brand_profiles for select
  using (auth.uid() = user_id);

create policy "Users can upsert own brand profile"
  on social_brand_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own brand profile"
  on social_brand_profiles for update
  using (auth.uid() = user_id);


-- Calendar posts, one row per planned post
create table if not exists social_calendar_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  day text not null,           -- "Mon" | "Tue" | ...
  post_type text not null,     -- platform-specific, e.g. "Reel", "Thread"
  platform text not null,
  note text not null,
  created_at timestamptz default now()
);

alter table social_calendar_posts enable row level security;

create policy "Users can view own calendar posts"
  on social_calendar_posts for select
  using (auth.uid() = user_id);

create policy "Users can insert own calendar posts"
  on social_calendar_posts for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own calendar posts"
  on social_calendar_posts for delete
  using (auth.uid() = user_id);


-- Monthly usage tracking, one row per user per month
create table if not exists social_usage (
  user_id uuid references auth.users(id) on delete cascade,
  month text not null,         -- "2026-06"
  text_count int default 0,
  image_count int default 0,
  updated_at timestamptz default now(),
  primary key (user_id, month)
);

alter table social_usage enable row level security;

create policy "Users can view own usage"
  on social_usage for select
  using (auth.uid() = user_id);

-- Note: inserts/updates to social_usage happen server-side via the service-role
-- key in usageLimits.js, so no insert/update policy is needed for regular users.
