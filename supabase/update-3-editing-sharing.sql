-- Sabaq AI · 3-жаңарту: презентацияны өңдеу + тестті оқушыларға сілтемемен жіберу.
-- update-2-projects-profile.sql-дан КЕЙІН Supabase SQL Editor-інде бір рет орындаңыз.
-- Қайта орындауға болады: бар деректерге зиян келтірмейді.

-- 1. Мұғалім өз жобасын өзгерте алады (презентацияны өңдеу) -----------------

drop policy if exists "own projects update" on public.projects;
create policy "own projects update" on public.projects
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and status = 'active')
  );

-- 2. Тестті оқушыларға жіберу ------------------------------------------------

-- Бір тестке бір сілтеме коды. Оқушылар тіркелмей, осы код арқылы тапсырады.
create table if not exists public.test_shares (
  code text primary key check (code ~ '^[a-z0-9]{8}$'),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.test_submissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  student_name text not null check (length(student_name) between 2 and 80),
  student_class text not null default '' check (length(student_class) <= 40),
  answers integer[] not null,
  score integer not null,
  total integer not null,
  created_at timestamptz not null default now()
);

create index if not exists test_submissions_project_idx on public.test_submissions (project_id, created_at desc);

alter table public.test_shares enable row level security;
alter table public.test_submissions enable row level security;

-- Мұғалім тек өз сілтемелерін көреді; жасау/жабу төмендегі функциялар арқылы ғана.
drop policy if exists "own shares select" on public.test_shares;
create policy "own shares select" on public.test_shares
  for select using (user_id = auth.uid());

-- Мұғалім тек өз тесттерінің нәтижелерін көреді және өшіре алады.
-- Оқушы нәтижесі тек submit_test функциясы арқылы жазылады.
drop policy if exists "own submissions select" on public.test_submissions;
create policy "own submissions select" on public.test_submissions
  for select using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

drop policy if exists "own submissions delete" on public.test_submissions;
create policy "own submissions delete" on public.test_submissions
  for delete using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

-- Сілтеме жасау (немесе барын қайта ашу). Кодты қайтарады.
create or replace function public.share_test(p_project_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not exists (select 1 from profiles where id = auth.uid() and status = 'active') then
    raise exception 'Жүйеге кіру қажет';
  end if;
  if not exists (select 1 from projects where id = p_project_id and user_id = auth.uid() and kind = 'test') then
    raise exception 'Тест табылмады';
  end if;

  select code into v_code from test_shares where project_id = p_project_id;
  if v_code is not null then
    update test_shares set is_open = true where project_id = p_project_id;
    return v_code;
  end if;

  loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    continue when exists (select 1 from test_shares where code = v_code);
    insert into test_shares (code, project_id, user_id) values (v_code, p_project_id, auth.uid());
    return v_code;
  end loop;
end;
$$;

-- Сілтемені жабу/ашу: жабық сілтеме арқылы тест тапсыруға болмайды.
create or replace function public.set_test_share_open(p_project_id uuid, p_open boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update test_shares set is_open = p_open where project_id = p_project_id and user_id = auth.uid();
end;
$$;

-- Оқушыға тест: сұрақтар мен нұсқалар ғана, дұрыс жауаптарсыз.
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
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('question', q->>'question', 'options', q->'options') order by ord)
      from jsonb_array_elements(p.data->'questions') with ordinality as t(q, ord)
    ), '[]'::jsonb)
  )
  from test_shares s
  join projects p on p.id = s.project_id
  where s.code = lower(p_code) and s.is_open;
$$;

-- Оқушы жауаптарын тексеріп сақтайды; тек ұпайды қайтарады (дұрыс жауаптар жария болмайды).
create or replace function public.submit_test(p_code text, p_name text, p_class text, p_answers integer[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project uuid;
  v_questions jsonb;
  v_total integer;
  v_score integer := 0;
  v_answers integer[];
  i integer;
begin
  select p.id, p.data->'questions' into v_project, v_questions
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

  return jsonb_build_object('score', v_score, 'total', v_total);
end;
$$;

revoke all on function public.share_test(uuid) from public;
revoke all on function public.set_test_share_open(uuid, boolean) from public;
revoke all on function public.get_shared_test(text) from public;
revoke all on function public.submit_test(text, text, text, integer[]) from public;
grant execute on function public.share_test(uuid) to authenticated;
grant execute on function public.set_test_share_open(uuid, boolean) to authenticated;
grant execute on function public.get_shared_test(text) to anon, authenticated;
grant execute on function public.submit_test(text, text, text, integer[]) to anon, authenticated;
