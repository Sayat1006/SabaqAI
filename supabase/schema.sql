-- Sabaq AI аутентификация схемасы (Supabase Postgres).
-- Supabase жобаңыздың SQL Editor-інде осы файлдың толық мазмұнын бір рет орындаңыз.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'teacher' check (role in ('admin', 'teacher')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  subject text not null default '',
  school text not null default '',
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action text not null,
  detail text not null default '',
  ts timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;

-- Ағымдағы пайдаланушы белсенді әкімші ме, соны тексереді.
-- SECURITY DEFINER: RLS-ты айналып өтіп кестені оқиды, сондықтан
-- саясаттардың өзінде шексіз рекурсия болмайды.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

drop policy if exists "select own profile" on public.profiles;
create policy "select own profile" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "admins select all profiles" on public.profiles;
create policy "admins select all profiles" on public.profiles
  for select using (public.is_admin());

drop policy if exists "admins insert profiles" on public.profiles;
create policy "admins insert profiles" on public.profiles
  for insert with check (public.is_admin());

drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles" on public.profiles
  for update using (public.is_admin());

drop policy if exists "admins delete profiles" on public.profiles;
create policy "admins delete profiles" on public.profiles
  for delete using (public.is_admin());

drop policy if exists "admins select audit" on public.audit_log;
create policy "admins select audit" on public.audit_log
  for select using (public.is_admin());

-- Пайдаланушы кірген сайын өз жолының last_login_at өрісін жаңартады.
-- Тікелей UPDATE саясаты жоқ (оқушы өз рөлін/мәртебесін өзгертпес үшін),
-- сондықтан бұл жалғыз "өзіне рұқсат етілген жазу" жолы.
create or replace function public.touch_last_login()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set last_login_at = now() where id = auth.uid();
$$;

-- Әрекеттер журналына жазба қосады; actor_email әрдайым шақырушының
-- өз профилінен алынады, сондықтан оны жалғандай жазу мүмкін емес.
create or replace function public.log_audit(p_action text, p_detail text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from public.profiles where id = auth.uid();
  insert into public.audit_log (actor_email, action, detail)
  values (coalesce(v_email, 'белгісіз'), p_action, p_detail);
end;
$$;

-- ЕСКЕРТУ: Бірінші (бастапқы) әкімші аккаунтын осы SQL құрмайды.
-- Оны Supabase Dashboard → Authentication → Users → "Add user" арқылы
-- қолмен жасаңыз, содан кейін төмендегі жолды сол пайдаланушының
-- нақты UUID/email-іне ауыстырып орындаңыз:
--
-- insert into public.profiles (id, name, email, role, status)
-- values ('<auth.users кестесіндегі UUID>', 'Бас әкімші', 'admin@example.com', 'admin', 'active');
