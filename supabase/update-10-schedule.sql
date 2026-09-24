-- AI Nur · 10-жаңарту: мұғалімнің апталық сабақ кестесі.
-- Supabase SQL Editor-інде бір рет орындаңыз. Қайта орындауға болады: бар деректерге зиян келтірмейді.

-- Әр мұғалімге бір жол: сабақтар тізімі JSON түрінде
-- [{id, day (1=Дс … 6=Сн), time "08:00", subject, grade "7-сынып", letter "А"}].
create table if not exists public.lesson_schedules (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  slots jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint lesson_schedules_slots_check check (jsonb_typeof(slots) = 'array' and jsonb_array_length(slots) <= 120)
);

alter table public.lesson_schedules enable row level security;

-- Әр мұғалім тек өз кестесін көреді және өзгертеді.
drop policy if exists "own schedule select" on public.lesson_schedules;
create policy "own schedule select" on public.lesson_schedules
  for select using (user_id = auth.uid());

drop policy if exists "own schedule insert" on public.lesson_schedules;
create policy "own schedule insert" on public.lesson_schedules
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
  );

drop policy if exists "own schedule update" on public.lesson_schedules;
create policy "own schedule update" on public.lesson_schedules
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
  );

drop policy if exists "own schedule delete" on public.lesson_schedules;
create policy "own schedule delete" on public.lesson_schedules
  for delete using (user_id = auth.uid());

revoke all on public.lesson_schedules from anon;
grant select, insert, update, delete on public.lesson_schedules to authenticated;
