-- ============================================================
-- Nexus Phase 4/5: Admin panel, premium, announcements, settings, feedback
-- Run AFTER 1_database_setup.sql (file 2 of 2):  SQL Editor > New query > paste > Run
-- Safe to run again (it uses "if not exists" / "or replace").
-- ============================================================

-- ---------- tables (locked: the website can NOT read them directly) ----------
create table if not exists public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  email          text,
  created_at     timestamptz not null default now(),
  last_seen      timestamptz,
  premium_until  timestamptz,
  banned         boolean not null default false,
  note           text
);

create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) <= 120),
  body       text not null default '' check (char_length(body) <= 1000),
  active     boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key        text primary key check (char_length(key) <= 60),
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_log (
  id         bigint generated always as identity primary key,
  admin_id   uuid,
  action     text not null,
  target     uuid,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete set null,
  kind       text not null default 'Idea',
  message    text not null check (char_length(message) between 1 and 2000),
  status     text not null default 'new',
  created_at timestamptz not null default now()
);

alter table public.profiles      enable row level security;
alter table public.admins        enable row level security;
alter table public.announcements enable row level security;
alter table public.app_settings  enable row level security;
alter table public.admin_log     enable row level security;
alter table public.feedback      enable row level security;
-- No policies on purpose: nobody can touch these tables directly.
-- Everything goes through the functions below, which check who is asking.
revoke all on public.profiles, public.admins, public.announcements, public.app_settings, public.admin_log, public.feedback from anon, authenticated;

-- ---------- helpers ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.is_banned()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select banned from public.profiles where user_id = auth.uid()), false);
$$;

-- every new account gets a profile row automatically
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email) values (new.id, new.email) on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- profiles for accounts that already exist
insert into public.profiles (user_id, email, created_at)
  select id, email, created_at from auth.users on conflict (user_id) do nothing;

-- suspended users can no longer back up to the cloud (the app itself keeps working on their device)
drop policy if exists "read own data"   on public.user_data;
drop policy if exists "insert own data" on public.user_data;
drop policy if exists "update own data" on public.user_data;
drop policy if exists "delete own data" on public.user_data;
create policy "read own data"   on public.user_data for select to authenticated using (auth.uid() = user_id and not public.is_banned());
create policy "insert own data" on public.user_data for insert to authenticated with check (auth.uid() = user_id and not public.is_banned());
create policy "update own data" on public.user_data for update to authenticated using (auth.uid() = user_id and not public.is_banned()) with check (auth.uid() = user_id and not public.is_banned());
create policy "delete own data" on public.user_data for delete to authenticated using (auth.uid() = user_id);

-- ---------- functions used by the app (any logged-in user) ----------
create or replace function public.app_bootstrap()
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare me uuid := auth.uid(); p public.profiles;
begin
  if me is null then raise exception 'not logged in' using errcode = '42501'; end if;
  insert into public.profiles (user_id, email) select id, email from auth.users where id = me on conflict (user_id) do nothing;
  update public.profiles set last_seen = now() where user_id = me returning * into p;
  return jsonb_build_object(
    'profile', jsonb_build_object(
      'plan', case when p.premium_until is not null and p.premium_until > now() then 'premium' else 'free' end,
      'premium_until', p.premium_until,
      'banned', p.banned,
      'is_admin', public.is_admin()),
    'announcements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body) order by a.created_at desc)
                               from public.announcements a where a.active and (a.expires_at is null or a.expires_at > now())), '[]'::jsonb),
    'settings', coalesce((select jsonb_object_agg(s.key, s.value) from public.app_settings s
                          where s.key in ('maintenance', 'ads_enabled', 'premium_themes', 'upgrade_text', 'support_email')), '{}'::jsonb)
  );
end;
$$;

create or replace function public.submit_feedback(kind text, msg text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not logged in' using errcode = '42501'; end if;
  if (select count(*) from public.feedback where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too many messages today' using errcode = 'P0001';
  end if;
  insert into public.feedback (user_id, kind, message) values (auth.uid(), left(coalesce(kind, 'Idea'), 20), left(msg, 2000));
end;
$$;

-- ---------- admin-only functions (each one checks is_admin() first) ----------
create or replace function public.admin_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total_users',    (select count(*) from public.profiles),
    'new_7d',         (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'new_30d',        (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'active_7d',      (select count(*) from public.profiles where last_seen > now() - interval '7 days'),
    'active_30d',     (select count(*) from public.profiles where last_seen > now() - interval '30 days'),
    'premium_active', (select count(*) from public.profiles where premium_until > now()),
    'banned',         (select count(*) from public.profiles where banned),
    'synced_users',   (select count(*) from public.user_data),
    'feedback_new',   (select count(*) from public.feedback where status = 'new'),
    'signups_by_day', coalesce((
        select jsonb_agg(jsonb_build_object('day', d::date, 'n', coalesce(c.n, 0)) order by d)
        from generate_series((current_date - 29)::timestamp, current_date::timestamp, interval '1 day') d
        left join (select created_at::date as day, count(*) as n from public.profiles group by 1) c on c.day = d::date
    ), '[]'::jsonb));
end;
$$;

create or replace function public.admin_users(q text default '', lim int default 25, off int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare total bigint; rows jsonb;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select count(*) into total from public.profiles p where coalesce(q, '') = '' or p.email ilike '%' || q || '%';
  select coalesce(jsonb_agg(r), '[]'::jsonb) into rows from (
    select p.user_id, p.email, p.created_at, p.last_seen, p.premium_until, p.banned, p.note,
           case when p.premium_until > now() then 'premium' else 'free' end as plan,
           case when jsonb_typeof(d.data -> 'habits') = 'array' then jsonb_array_length(d.data -> 'habits') else 0 end as habits,
           case when (d.data ->> 'totalXp') ~ '^[0-9]{1,9}$' then (d.data ->> 'totalXp')::bigint else 0 end as xp,
           d.updated_at as synced_at
    from public.profiles p left join public.user_data d on d.user_id = p.user_id
    where coalesce(q, '') = '' or p.email ilike '%' || q || '%'
    order by p.created_at desc
    limit least(greatest(lim, 1), 1000) offset greatest(off, 0)
  ) r;
  return jsonb_build_object('total', total, 'rows', rows);
end;
$$;

create or replace function public.admin_set_premium(target uuid, until timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.profiles set premium_until = until where user_id = target;
  insert into public.admin_log (admin_id, action, target, detail) values (auth.uid(), 'set_premium', target, jsonb_build_object('until', until));
end;
$$;

create or replace function public.admin_set_banned(target uuid, flag boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if target = auth.uid() then raise exception 'you cannot ban yourself' using errcode = 'P0001'; end if;
  update public.profiles set banned = flag where user_id = target;
  insert into public.admin_log (admin_id, action, target, detail) values (auth.uid(), case when flag then 'ban' else 'unban' end, target, null);
end;
$$;

create or replace function public.admin_set_note(target uuid, txt text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.profiles set note = left(txt, 500) where user_id = target;
  insert into public.admin_log (admin_id, action, target, detail) values (auth.uid(), 'set_note', target, null);
end;
$$;

create or replace function public.admin_announcements()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.announcements a), '[]'::jsonb);
end;
$$;

create or replace function public.admin_save_announcement(a_id uuid, a_title text, a_body text, a_active boolean, a_expires timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if a_id is null then
    insert into public.announcements (title, body, active, expires_at) values (a_title, coalesce(a_body, ''), coalesce(a_active, true), a_expires) returning id into rid;
  else
    update public.announcements set title = a_title, body = coalesce(a_body, ''), active = coalesce(a_active, true), expires_at = a_expires where id = a_id returning id into rid;
  end if;
  insert into public.admin_log (admin_id, action, detail) values (auth.uid(), 'save_announcement', jsonb_build_object('id', rid, 'title', a_title));
  return rid;
end;
$$;

create or replace function public.admin_delete_announcement(a_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.announcements where id = a_id;
  insert into public.admin_log (admin_id, action, detail) values (auth.uid(), 'delete_announcement', jsonb_build_object('id', a_id));
end;
$$;

create or replace function public.admin_get_settings()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return coalesce((select jsonb_object_agg(key, value) from public.app_settings), '{}'::jsonb);
end;
$$;

create or replace function public.admin_set_setting(k text, v jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into public.app_settings (key, value, updated_at) values (k, v, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.admin_log (admin_id, action, detail) values (auth.uid(), 'set_setting', jsonb_build_object('key', k));
end;
$$;

create or replace function public.admin_feedback(lim int default 50)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x) from (
    select f.id, f.kind, f.message, f.status, f.created_at, p.email
    from public.feedback f left join public.profiles p on p.user_id = f.user_id
    order by f.created_at desc limit least(greatest(lim, 1), 200)) x), '[]'::jsonb);
end;
$$;

create or replace function public.admin_feedback_status(f_id uuid, new_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.feedback set status = left(new_status, 20) where id = f_id;
end;
$$;

create or replace function public.admin_log_list(lim int default 100)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x) from (
    select l.id, l.action, l.target, l.detail, l.created_at, p.email as admin_email, t.email as target_email
    from public.admin_log l
    left join public.profiles p on p.user_id = l.admin_id
    left join public.profiles t on t.user_id = l.target
    order by l.id desc limit least(greatest(lim, 1), 500)) x), '[]'::jsonb);
end;
$$;

-- ---------- Premium codes (sell or gift Premium without Google Play) ----------
create table if not exists public.premium_codes (
  code        text primary key check (code ~ '^[A-Z0-9]{8,16}$'),
  days        int  not null check (days between 1 and 3650),
  max_uses    int  not null default 1 check (max_uses between 1 and 10000),
  used_count  int  not null default 0,
  expires_at  timestamptz,
  note        text,
  created_at  timestamptz not null default now()
);
create table if not exists public.code_redemptions (
  code        text not null references public.premium_codes (code) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);
create table if not exists public.code_attempts (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at      timestamptz not null default now()
);
alter table public.premium_codes   enable row level security;
alter table public.code_redemptions enable row level security;
alter table public.code_attempts   enable row level security;
revoke all on public.premium_codes, public.code_redemptions, public.code_attempts from anon, authenticated;

-- A user redeems a code. Failures RETURN {ok:false} instead of raising an error,
-- so that every try is counted (a raised error would undo the counting).
create or replace function public.redeem_code(c text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k public.premium_codes; base timestamptz; newuntil timestamptz; me uuid := auth.uid();
begin
  if me is null then raise exception 'not logged in' using errcode = '42501'; end if;
  if public.is_banned() then return jsonb_build_object('ok', false, 'error', 'suspended'); end if;
  insert into public.code_attempts (user_id) values (me);
  delete from public.code_attempts where at < now() - interval '2 days';
  if (select count(*) from public.code_attempts where user_id = me and at > now() - interval '1 hour') > 10 then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;
  select * into k from public.premium_codes where code = upper(btrim(coalesce(c, ''))) for update;
  if not found or (k.expires_at is not null and k.expires_at < now()) or k.used_count >= k.max_uses
     or exists (select 1 from public.code_redemptions r where r.code = k.code and r.user_id = me) then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select greatest(coalesce(premium_until, now()), now()) into base from public.profiles where user_id = me;
  newuntil := base + make_interval(days => k.days);
  update public.profiles set premium_until = newuntil where user_id = me;
  update public.premium_codes set used_count = used_count + 1 where code = k.code;
  insert into public.code_redemptions (code, user_id) values (k.code, me);
  return jsonb_build_object('ok', true, 'days', k.days, 'premium_until', newuntil);
end;
$$;

create or replace function public.admin_create_codes(n int, d int, m int, ex timestamptz, nt text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare made text[] := '{}'; one text; i int := 0;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if n < 1 or n > 200 then raise exception 'make 1 to 200 codes at a time' using errcode = 'P0001'; end if;
  while i < n loop
    one := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    begin
      insert into public.premium_codes (code, days, max_uses, expires_at, note) values (one, d, coalesce(m, 1), ex, left(nt, 200));
      made := made || one; i := i + 1;
    exception when unique_violation then null;
    end;
  end loop;
  insert into public.admin_log (admin_id, action, detail) values (auth.uid(), 'create_codes', jsonb_build_object('count', n, 'days', d));
  return to_jsonb(made);
end;
$$;

create or replace function public.admin_codes(lim int default 200)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from (select * from public.premium_codes order by created_at desc limit least(greatest(lim, 1), 1000)) c), '[]'::jsonb);
end;
$$;

create or replace function public.admin_delete_code(c text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  delete from public.premium_codes where code = c;
  insert into public.admin_log (admin_id, action, detail) values (auth.uid(), 'delete_code', jsonb_build_object('code', c));
end;
$$;

-- Used ONLY by the server-side store webhook (service key), never by the website:
create or replace function public.grant_premium_service(uid uuid, until timestamptz)
returns void language sql security definer set search_path = public as $$
  -- only ever extends Premium (a store event can never shorten time that an admin or a code gave)
  update public.profiles set premium_until = greatest(coalesce(premium_until, to_timestamp(0)), until) where user_id = uid;
$$;
revoke all on function public.grant_premium_service(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.grant_premium_service(uuid, timestamptz) to service_role;

-- ---------- who may call what ----------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'admin\_%' or p.proname in ('app_bootstrap', 'submit_feedback', 'redeem_code', 'is_admin', 'is_banned'))
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end;
$$;

-- ============================================================
-- LAST STEP (do it by hand, once): make YOURSELF the admin.
-- 1) Sign up in the app with your email. 2) Run this with your email:
--
--   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
--
-- ============================================================
