-- AI Nur · 4-жаңарту: оқушыға кері байланыс (қатемен жұмыс) және саралау деңгейлері.
-- update-3-editing-sharing.sql-дан КЕЙІН Supabase SQL Editor-інде бір рет орындаңыз.
-- Қайта орындауға болады: бар деректерге зиян келтірмейді.

-- Мұғалім таңдайды: оқушы тапсырып болған соң қателерін түсіндірмесімен көре ме.
alter table public.test_shares add column if not exists show_review boolean not null default true;

create or replace function public.set_test_share_review(p_project_id uuid, p_show boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update test_shares set show_review = p_show where project_id = p_project_id and user_id = auth.uid();
end;
$$;

-- Оқушыға тест: сұрақ, нұсқалар және деңгей (A/B/C) — дұрыс жауаптарсыз.
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
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('question', q->>'question', 'options', q->'options', 'level', coalesce(q->>'level', '')) order by ord)
      from jsonb_array_elements(p.data->'questions') with ordinality as t(q, ord)
    ), '[]'::jsonb)
  )
  from test_shares s
  join projects p on p.id = s.project_id
  where s.code = lower(p_code) and s.is_open;
$$;

-- Жауаптарды тексеріп сақтайды. Мұғалім рұқсат етсе, жауаптар сақталғаннан КЕЙІН ғана
-- дұрыс жауаптар мен түсіндірмелер қайтарылады (оқушы қатемен жұмыс жасай алады).
create or replace function public.submit_test(p_code text, p_name text, p_class text, p_answers integer[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project uuid;
  v_questions jsonb;
  v_review boolean;
  v_total integer;
  v_score integer := 0;
  v_answers integer[];
  i integer;
begin
  select p.id, p.data->'questions', s.show_review into v_project, v_questions, v_review
  from test_shares s join projects p on p.id = s.project_id
  where s.code = lower(p_code) and s.is_open;

  if v_project is null then
    raise exception 'Тест жабық немесе табылмады';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Аты-жөніңізді жазыңыз';
  end if;
  if (select count(*) from test_submissions where project_id = v_project) >= 1000 then
    raise exception 'Бұл тестке жауап қабылдау шегі толды';
  end if;

  v_total := jsonb_array_length(v_questions);
  v_answers := (coalesce(p_answers, '{}'))[1:v_total];
  for i in 1..v_total loop
    if v_answers[i] is not null and v_answers[i] = (v_questions->(i - 1)->>'correctIndex')::integer then
      v_score := v_score + 1;
    end if;
  end loop;

  insert into test_submissions (project_id, student_name, student_class, answers, score, total)
  values (v_project, left(trim(p_name), 80), left(trim(coalesce(p_class, '')), 40), v_answers, v_score, v_total);

  return jsonb_build_object(
    'score', v_score,
    'total', v_total,
    'review', case when v_review then (
      select jsonb_agg(jsonb_build_object('correct', (q->>'correctIndex')::integer, 'explanation', coalesce(q->>'explanation', '')) order by ord)
      from jsonb_array_elements(v_questions) with ordinality as t(q, ord)
    ) end
  );
end;
$$;

revoke all on function public.set_test_share_review(uuid, boolean) from public;
grant execute on function public.set_test_share_review(uuid, boolean) to authenticated;
revoke all on function public.get_shared_test(text) from public;
revoke all on function public.submit_test(text, text, text, integer[]) from public;
grant execute on function public.get_shared_test(text) to anon, authenticated;
grant execute on function public.submit_test(text, text, text, integer[]) to anon, authenticated;
