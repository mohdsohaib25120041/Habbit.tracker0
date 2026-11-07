-- GoalForce: optional social features (leaderboard, community wins, friend challenges).
-- Run ONCE in Supabase > SQL Editor. Safe to run again. Everything is opt-in per user.

create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  xp int not null default 0 check (xp >= 0),
  level int not null default 1,
  streak int not null default 0,
  week_score int not null default 0,
  public boolean not null default true,
  updated_at timestamptz not null default now()
);
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create table if not exists public.social_challenge_members (
  code text not null check (char_length(code) between 4 and 12),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  score int not null default 0 check (score >= 0),
  updated_at timestamptz not null default now(),
  primary key (code, user_id)
);
create index if not exists social_posts_created_idx on public.social_posts (created_at desc);

alter table public.social_profiles enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_challenge_members enable row level security;

drop policy if exists sp_read on public.social_profiles;
drop policy if exists sp_write on public.social_profiles;
create policy sp_read on public.social_profiles for select to authenticated using (public = true or user_id = auth.uid());
create policy sp_write on public.social_profiles for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists po_read on public.social_posts;
drop policy if exists po_insert on public.social_posts;
drop policy if exists po_delete on public.social_posts;
create policy po_read on public.social_posts for select to authenticated using (true);
create policy po_insert on public.social_posts for insert to authenticated with check (user_id = auth.uid());
create policy po_delete on public.social_posts for delete to authenticated using (user_id = auth.uid());

drop policy if exists cm_read on public.social_challenge_members;
drop policy if exists cm_write on public.social_challenge_members;
create policy cm_read on public.social_challenge_members for select to authenticated using (true);
create policy cm_write on public.social_challenge_members for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Moderation: delete any post from Supabase > Table editor > social_posts.

-- ===== Community upgrade: photo posts, likes, reports (safe to run again) =====
alter table public.social_posts add column if not exists image text;
alter table public.social_posts drop constraint if exists social_posts_content_check;
alter table public.social_posts add constraint social_posts_content_check check (
  (char_length(body) between 0 and 200)
  and (image is null or (char_length(image) < 130000 and image like 'data:image/jpeg;base64,%'))
  and (char_length(body) > 0 or image is not null)
);
alter table public.social_posts alter column body set default '';
-- the original "body between 1 and 200" rule is replaced by the check above
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid = 'public.social_posts'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%char_length(body) >= 1%' loop
    execute format('alter table public.social_posts drop constraint %I', c);
  end loop;
end $$;

create table if not exists public.social_likes (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.social_likes enable row level security;
drop policy if exists li_read on public.social_likes;
drop policy if exists li_insert on public.social_likes;
drop policy if exists li_delete on public.social_likes;
create policy li_read on public.social_likes for select to authenticated using (true);
create policy li_insert on public.social_likes for insert to authenticated with check (user_id = auth.uid());
create policy li_delete on public.social_likes for delete to authenticated using (user_id = auth.uid());

create table if not exists public.social_reports (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'reported',
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.social_reports enable row level security;
drop policy if exists re_insert on public.social_reports;
create policy re_insert on public.social_reports for insert to authenticated with check (user_id = auth.uid());
-- Reports are write-only for members. Review them in Supabase > Table editor > social_reports,
-- then delete the offending row from social_posts.

-- ===== Friends: requests + friends leaderboard (safe to run again) =====
create table if not exists public.social_friends (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
-- one relationship per pair, whichever way it was requested
create unique index if not exists social_friends_pair_idx on public.social_friends (least(requester, addressee), greatest(requester, addressee));
create index if not exists social_friends_addressee_idx on public.social_friends (addressee, status);
alter table public.social_friends enable row level security;
drop policy if exists fr_read on public.social_friends;
drop policy if exists fr_insert on public.social_friends;
drop policy if exists fr_accept on public.social_friends;
drop policy if exists fr_delete on public.social_friends;
create policy fr_read on public.social_friends for select to authenticated using (requester = auth.uid() or addressee = auth.uid());
create policy fr_insert on public.social_friends for insert to authenticated with check (requester = auth.uid() and status = 'pending');
create policy fr_accept on public.social_friends for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
create policy fr_delete on public.social_friends for delete to authenticated using (requester = auth.uid() or addressee = auth.uid());
-- Safety: the person accepting a request may change ONLY the status column (not who requested).
revoke update on public.social_friends from authenticated;
grant update (status) on public.social_friends to authenticated;
