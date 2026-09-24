-- AI Nur · 11-жаңарту: әкімшінің хабарландырулары (басты беттегі қоңырау).
-- Supabase SQL Editor-інде бір рет орындаңыз. Қайта орындауға болады: бар деректерге зиян келтірмейді.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint announcements_title_check check (char_length(btrim(title)) between 1 and 200),
  constraint announcements_body_check check (char_length(body) <= 3000)
);

create index if not exists announcements_created_idx on public.announcements (created_at desc);

alter table public.announcements enable row level security;

-- Белсенді аккаунттың бәрі оқи алады.
drop policy if exists "active users read announcements" on public.announcements;
create policy "active users read announcements" on public.announcements
  for select using (exists (select 1 from public.profiles where id = auth.uid() and status = 'active'));

-- Жазу, өзгерту, жою — тек әкімші.
drop policy if exists "admin insert announcements" on public.announcements;
create policy "admin insert announcements" on public.announcements
  for insert with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "admin update announcements" on public.announcements;
create policy "admin update announcements" on public.announcements
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin delete announcements" on public.announcements;
create policy "admin delete announcements" on public.announcements
  for delete using (public.is_admin());

revoke all on public.announcements from anon;
grant select, insert, update, delete on public.announcements to authenticated;
