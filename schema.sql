-- TNB Poker Club production schema
-- Run once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'member');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now()
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[0-9]{4}-S[0-9]+$'),
  name text not null,
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 24),
  tagline text not null default '' check (char_length(tagline) <= 60),
  color text not null default '#c73948' check (color ~ '^#[0-9a-fA-F]{6}$'),
  avatar_url text,
  joined_at date not null default current_date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id),
  played_at date not null,
  event_name text not null check (char_length(event_name) between 1 and 80),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_results (
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references public.players(id),
  points integer not null check (points between -1000000 and 1000000),
  primary key (game_id, player_id)
);

create index games_season_date_idx on public.games(season_id, played_at desc);
create index results_player_idx on public.game_results(player_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.create_game_with_results(
  p_season_code text,
  p_played_at date,
  p_event_name text,
  p_results jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_game_id uuid;
  result_count integer;
begin
  if not public.is_admin() then raise exception '仅管理员可以录入赛果'; end if;
  select jsonb_array_length(p_results) into result_count;
  if result_count < 2 then raise exception '至少需要两名参赛选手'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_results) as r(player_id uuid, points integer)
    group by player_id having count(*) > 1
  ) then raise exception '参赛选手不能重复'; end if;

  insert into public.games(season_id, played_at, event_name, created_by)
  select id, p_played_at, p_event_name, auth.uid() from public.seasons where code = p_season_code
  returning id into new_game_id;
  if new_game_id is null then raise exception '赛季不存在'; end if;

  insert into public.game_results(game_id, player_id, points)
  select new_game_id, r.player_id, r.points
  from jsonb_to_recordset(p_results) as r(player_id uuid, points integer);
  return new_game_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_results enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.seasons, public.players, public.games, public.game_results to anon, authenticated;
grant select on public.profiles to authenticated;
grant insert, update, delete on public.seasons, public.players, public.games, public.game_results to authenticated;

create policy "Profiles readable by signed users" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Public seasons read" on public.seasons for select using (true);
create policy "Admins manage seasons" on public.seasons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Public players read" on public.players for select using (true);
create policy "Admins create players" on public.players for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy "Admins update players" on public.players for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Public games read" on public.games for select using (true);
create policy "Admins manage games" on public.games for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Public results read" on public.game_results for select using (true);
create policy "Admins manage results" on public.game_results for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant execute on function public.create_game_with_results(text,date,text,jsonb) to authenticated;

insert into public.seasons(code, name, starts_on, ends_on, is_active) values
  ('2026-S1','2026 第 1 赛季','2026-01-01','2026-04-30',false),
  ('2026-S2','2026 第 2 赛季','2026-05-01','2026-08-31',false),
  ('2026-S3','2026 第 3 赛季','2026-09-01','2026-12-31',true)
on conflict (code) do nothing;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=5242880;

create policy "Public avatar read" on storage.objects for select using (bucket_id = 'avatars');
create policy "Admins upload avatars" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and public.is_admin());
create policy "Admins update avatars" on storage.objects for update to authenticated using (bucket_id = 'avatars' and public.is_admin());
create policy "Admins delete avatars" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and public.is_admin());

-- Prevent members from changing their own role through the profiles update policy.
revoke update on public.profiles from authenticated;
grant update(display_name) on public.profiles to authenticated;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Realtime publications (safe to re-run).
do $$ begin
  alter publication supabase_realtime add table public.players;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.games;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.game_results;
exception when duplicate_object then null; end $$;
