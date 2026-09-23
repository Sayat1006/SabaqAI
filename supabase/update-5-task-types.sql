-- AI Nur · 5-жаңарту: «Тапсырмалар» бөлімі (PISA жағдаяттары, ҰБТ форматы).
-- update-4-feedback.sql-дан КЕЙІН Supabase SQL Editor-інде бір рет орындаңыз.
-- Қайта орындауға болады: бар деректерге зиян келтірмейді.

-- Оқушыға тест: әр сұрақтың барлық өрістері (жағдаят мәтіні, деңгей т.б.),
-- тек дұрыс жауап пен түсіндірме АЛЫНЫП тасталады. Жаңа өрістер қосылса да, SQL өзгертудің қажеті жоқ.
create or replace function public.get_shared_test(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'title', p.title,
    'subject', p.data->>'subject',
    'grade', p.data->>'grade',
    'topic', p.data->>'topic',
    'objective', coalesce(p.data->>'objective', ''),
    'taskType', coalesce(p.data->>'taskType', 'levels'),
    'questions', coalesce((
      select jsonb_agg((q - 'correctIndex' - 'explanation') order by ord)
      from jsonb_array_elements(p.data->'questions') with ordinality as t(q, ord)
    ), '[]'::jsonb)
  )
  from test_shares s
  join projects p on p.id = s.project_id
  where s.code = lower(p_code) and s.is_open;
$$;

revoke all on function public.get_shared_test(text) from public;
grant execute on function public.get_shared_test(text) to anon, authenticated;
