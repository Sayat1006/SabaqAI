-- AI Nur · 14-жаңарту: AI лимиттерінің баптаулары (әкімшіге).
-- Supabase SQL Editor-інде бір рет орындаңыз. Қайта орындауға болады: бар деректерге зиян келтірмейді.
--
-- app_settings.ai_limits = {"day": 60, "minute": 15, "perUser": 5}
--   day, minute — Gemini кілтінің лимиттері (Статистика бетінде салыстыру үшін);
--   perUser     — бір мұғалімге тәулігіне берілетін генерация саны (0 — шектеусіз).
-- perUser-ді ai-generate функциясы тексереді: бір мұғалім ортақ лимитті тауысып қоймайды.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Оқу да, жазу да — тек әкімші (функция service_role арқылы оқиды).
drop policy if exists "admin manage settings" on public.app_settings;
create policy "admin manage settings" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

revoke all on public.app_settings from anon;
grant select, insert, update on public.app_settings to authenticated;

insert into public.app_settings (key, value)
values ('ai_limits', '{"day": 60, "minute": 15, "perUser": 0}'::jsonb)
on conflict (key) do nothing;
