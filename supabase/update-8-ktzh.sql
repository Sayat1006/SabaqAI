-- AI Nur · 8-жаңарту: КТЖ (күнтізбелік-тақырыптық жоспар) жобалары.
-- update-7-docs-live.sql-дан КЕЙІН Supabase SQL Editor-інде бір рет орындаңыз.
-- Қайта орындауға болады: бар деректерге зиян келтірмейді.

alter table public.projects drop constraint if exists projects_kind_check;
alter table public.projects add constraint projects_kind_check
  check (kind in ('qmzh', 'presentation', 'image', 'test', 'document', 'ktzh'));

-- Оқушы прогресі үшін: мұғалімнің барлық нәтижелерін уақыт бойынша жылдам оқу.
create index if not exists test_submissions_created_idx on public.test_submissions (created_at desc);
