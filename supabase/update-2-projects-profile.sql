-- Sabaq AI · 2-жаңарту: мұғалімнің жобалары дерекқорда + «Жеке бет» өрістері.
-- schema.sql-дан КЕЙІН Supabase SQL Editor-інде бір рет орындаңыз.
-- Қайта орындауға болады: бар деректерге зиян келтірмейді.

-- 1. Профильдің қосымша өрістері ------------------------------------------

alter table public.profiles
  add column if not exists avatar_url text not null default '',
  add column if not exists grades text[] not null default '{}',
  add column if not exists category text not null default '',
  add column if not exists experience_years integer,
  add column if not exists phone text not null default '',
  add column if not exists bio text not null default '';

-- Аватар браузерде 256×256 JPEG-ке кішірейтіліп, data URL ретінде сақталады (~20–40 КБ).
alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check
  check (avatar_url = '' or (avatar_url like 'data:image/%;base64,%' and length(avatar_url) <= 300000));

-- Мұғалім өз профилін тек осы функция арқылы өзгерте алады: рөл, мәртебе, пошта
-- секілді өрістерге қол жетпейді (profiles кестесінде мұғалімге UPDATE саясаты жоқ).
create or replace function public.update_my_profile(
  p_name text,
  p_subject text,
  p_school text,
  p_grades text[],
  p_category text,
  p_experience_years integer,
  p_phone text,
  p_bio text,
  p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Жүйеге кіру қажет';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Аты-жөні кемінде 2 таңбадан тұруы керек';
  end if;

  update public.profiles set
    name = left(trim(p_name), 120),
    subject = left(trim(coalesce(p_subject, '')), 80),
    school = left(trim(coalesce(p_school, '')), 200),
    grades = coalesce(p_grades[1:11], '{}'),
    category = left(trim(coalesce(p_category, '')), 80),
    experience_years = case when p_experience_years between 0 and 70 then p_experience_years end,
    phone = left(trim(coalesce(p_phone, '')), 40),
    bio = left(coalesce(p_bio, ''), 1000),
    avatar_url = coalesce(p_avatar_url, '')
  where id = auth.uid() and status = 'active';
end;
$$;

revoke all on function public.update_my_profile(text, text, text, text[], text, integer, text, text, text) from public;
grant execute on function public.update_my_profile(text, text, text, text[], text, integer, text, text, text) to authenticated;

-- 2. Мұғалімнің жобалары ---------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('qmzh', 'presentation', 'image', 'test')),
  title text not null check (length(title) <= 300),
  detail text not null default '' check (length(detail) <= 300),
  data jsonb not null check (pg_column_size(data) <= 1000000),
  created_at timestamptz not null default now()
);

create index if not exists projects_user_created_idx on public.projects (user_id, created_at desc);

alter table public.projects enable row level security;

-- Әр мұғалім тек өз жобаларын көреді және өзгертеді.
drop policy if exists "own projects select" on public.projects;
create policy "own projects select" on public.projects
  for select using (user_id = auth.uid());

drop policy if exists "own projects insert" on public.projects;
create policy "own projects insert" on public.projects
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
  );

drop policy if exists "own projects delete" on public.projects;
create policy "own projects delete" on public.projects
  for delete using (user_id = auth.uid());
