-- AI Nur · 7-жаңарту: «Құжаттар» бөлімі, тірі викторина және орысша тесттер.
-- update-5-task-types.sql-дан КЕЙІН Supabase SQL Editor-інде бір рет орындаңыз.
-- Қайта орындауға болады: бар деректерге зиян келтірмейді.

-- 1. Жаңа жоба түрі: құжат (мінездеме, баяндама, сценарий, есеп) ----------------

alter table public.projects drop constraint if exists projects_kind_check;
alter table public.projects add constraint projects_kind_check
  check (kind in ('qmzh', 'presentation', 'image', 'test', 'document'));

-- 2. Оқушыға тест: материал тілі де қайтарылады (орысша тестте оқушы беті орысша шығады) ---

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
    'lang', coalesce(p.data->>'lang', 'kk'),
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

-- 3. Тірі викторина -------------------------------------------------------------
-- Мұғалім тақтаға сұрақ шығарады, оқушылар телефоннан 6 таңбалы код арқылы кіріп
-- жауап береді. Оқушылар тіркелмейді: кірген кезде құпия token алады, әрі қарай
-- тек сол token арқылы жауап бере алады. Дұрыс жауаптар оқушыға тек «reveal»
-- кезеңінде ғана көрінеді.

create table if not exists public.live_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[0-9]{6}$'),
  title text not null check (length(title) <= 300),
  questions jsonb not null check (jsonb_typeof(questions) = 'array' and pg_column_size(questions) <= 300000),
  time_limit integer not null default 20 check (time_limit between 5 and 120),
  lang text not null default 'kk' check (lang in ('kk', 'ru')),
  state text not null default 'lobby' check (state in ('lobby', 'question', 'reveal', 'finished')),
  current integer not null default -1,
  started_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.live_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.live_games(id) on delete cascade,
  name text not null check (length(name) between 2 and 30),
  token uuid not null default gen_random_uuid(),
  score integer not null default 0,
  joined_at timestamptz not null default now()
);

create unique index if not exists live_players_name_idx on public.live_players (game_id, lower(name));

create table if not exists public.live_answers (
  player_id uuid not null references public.live_players(id) on delete cascade,
  game_id uuid not null references public.live_games(id) on delete cascade,
  q integer not null,
  choice integer not null,
  correct boolean not null,
  points integer not null,
  answered_at timestamptz not null default now(),
  primary key (player_id, q)
);

create index if not exists live_answers_game_idx on public.live_answers (game_id, q);

alter table public.live_games enable row level security;
alter table public.live_players enable row level security;
alter table public.live_answers enable row level security;

-- Мұғалім тек өз ойындарын көреді және өшіре алады. Жасау мен басқару — төмендегі функциялар арқылы.
drop policy if exists "own live games select" on public.live_games;
create policy "own live games select" on public.live_games for select using (user_id = auth.uid());
drop policy if exists "own live games delete" on public.live_games;
create policy "own live games delete" on public.live_games for delete using (user_id = auth.uid());
-- Ойыншылар мен жауаптарға тікелей қатынау жоқ: барлығы функциялар арқылы.

-- Ойын жасау. Сұрақтар: [{question, options[], correctIndex}] (2–6 нұсқа, 1–50 сұрақ).
create or replace function public.live_create(p_title text, p_questions jsonb, p_time integer, p_lang text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_id uuid;
  v_qs jsonb;
begin
  if not exists (select 1 from profiles where id = auth.uid() and status = 'active') then
    raise exception 'not_allowed';
  end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) not between 1 and 50 then
    raise exception 'bad_questions';
  end if;

  -- Тек қажетті өрістерді қалдырамыз және тексереміз.
  select jsonb_agg(jsonb_build_object(
           'question', left(q->>'question', 1000),
           'options', (select jsonb_agg(left(o, 300)) from jsonb_array_elements_text(q->'options') o),
           'correctIndex', (q->>'correctIndex')::integer
         ) order by ord)
    into v_qs
  from jsonb_array_elements(p_questions) with ordinality as t(q, ord);

  if exists (
    select 1 from jsonb_array_elements(v_qs) q
    where jsonb_array_length(coalesce(q->'options', '[]')) not between 2 and 6
       or (q->>'correctIndex')::integer not between 0 and jsonb_array_length(q->'options') - 1
  ) then
    raise exception 'bad_questions';
  end if;

  -- Ескі ойындарды тазалаймыз.
  delete from live_games where user_id = auth.uid() and created_at < now() - interval '2 days';

  loop
    v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    continue when exists (select 1 from live_games where code = v_code);
    insert into live_games (user_id, code, title, questions, time_limit, lang)
    values (auth.uid(), v_code, left(coalesce(p_title, ''), 300), v_qs,
            least(greatest(coalesce(p_time, 20), 5), 120),
            case when p_lang = 'ru' then 'ru' else 'kk' end)
    returning id into v_id;
    return jsonb_build_object('id', v_id, 'code', v_code);
  end loop;
end;
$$;

-- Мұғалім экраны: ойын күйі, ойыншылар, ағымдағы сұраққа жауаптар.
create or replace function public.live_host_state(p_game uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g live_games;
begin
  select * into g from live_games where id = p_game and user_id = auth.uid();
  if g.id is null then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'code', g.code,
    'state', g.state,
    'current', g.current,
    'total', jsonb_array_length(g.questions),
    'timeLimit', g.time_limit,
    'remaining', case when g.state = 'question' and g.started_at is not null
                      then greatest(0, g.time_limit - extract(epoch from now() - g.started_at)) else null end,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'score', p.score) order by p.score desc, p.joined_at)
      from live_players p where p.game_id = g.id
    ), '[]'::jsonb),
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object('player', a.player_id, 'choice', a.choice, 'correct', a.correct, 'points', a.points))
      from live_answers a where a.game_id = g.id and a.q = g.current
    ), '[]'::jsonb)
  );
end;
$$;

-- Ойынды басқару: next — келесі сұрақ (соңғысынан кейін — аяқтау), reveal — жауапты көрсету, finish — аяқтау.
create or replace function public.live_control(p_game uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g live_games;
begin
  select * into g from live_games where id = p_game and user_id = auth.uid() for update;
  if g.id is null then
    raise exception 'not_found';
  end if;
  if p_action = 'next' then
    if g.current + 1 >= jsonb_array_length(g.questions) then
      update live_games set state = 'finished' where id = g.id;
    else
      update live_games set state = 'question', current = g.current + 1, started_at = now() where id = g.id;
    end if;
  elsif p_action = 'reveal' then
    if g.state = 'question' then
      update live_games set state = 'reveal' where id = g.id;
    end if;
  elsif p_action = 'finish' then
    update live_games set state = 'finished' where id = g.id;
  else
    raise exception 'bad_action';
  end if;
end;
$$;

-- Оқушы ойынға кіреді. Қайтарады: player id және құпия token.
create or replace function public.live_join(p_code text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g live_games;
  v_name text := left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 30);
  p live_players;
begin
  select * into g from live_games
  where code = trim(p_code) and state <> 'finished' and created_at > now() - interval '1 day';
  if g.id is null then
    raise exception 'not_found';
  end if;
  if length(v_name) < 2 then
    raise exception 'bad_name';
  end if;
  if (select count(*) from live_players where game_id = g.id) >= 200 then
    raise exception 'full';
  end if;
  if exists (select 1 from live_players where game_id = g.id and lower(name) = lower(v_name)) then
    raise exception 'name_taken';
  end if;
  insert into live_players (game_id, name) values (g.id, v_name) returning * into p;
  return jsonb_build_object('player', p.id, 'token', p.token, 'name', p.name);
end;
$$;

-- Оқушы экраны: ағымдағы сұрақ (дұрыс жауапсыз), өз жауабы, ұпайы, орны.
create or replace function public.live_state(p_code text, p_player uuid, p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g live_games;
  p live_players;
  a live_answers;
  q jsonb;
begin
  select pl.* into p from live_players pl join live_games lg on lg.id = pl.game_id
  where pl.id = p_player and pl.token = p_token and lg.code = trim(p_code);
  if p.id is null then
    raise exception 'not_found';
  end if;
  select * into g from live_games where id = p.game_id;
  if g.current >= 0 then
    q := g.questions->g.current;
    select * into a from live_answers where player_id = p.id and live_answers.q = g.current;
  end if;
  return jsonb_build_object(
    'title', g.title,
    'lang', g.lang,
    'state', g.state,
    'current', g.current,
    'total', jsonb_array_length(g.questions),
    'timeLimit', g.time_limit,
    'remaining', case when g.state = 'question' and g.started_at is not null
                      then greatest(0, g.time_limit - extract(epoch from now() - g.started_at)) else null end,
    'question', case when g.state in ('question', 'reveal') then jsonb_build_object('question', q->'question', 'options', q->'options') else null end,
    'correct', case when g.state = 'reveal' then q->'correctIndex' else null end,
    'answer', case when a.player_id is null then null
                   else jsonb_build_object('choice', a.choice,
                                           'correct', case when g.state = 'reveal' then a.correct else null end,
                                           'points', case when g.state = 'reveal' then a.points else null end) end,
    'name', p.name,
    'score', case when g.state in ('reveal', 'finished') then p.score else null end,
    'rank', case when g.state in ('reveal', 'finished')
                 then 1 + (select count(*) from live_players o where o.game_id = g.id and o.score > p.score) else null end,
    'players', (select count(*) from live_players o where o.game_id = g.id)
  );
end;
$$;

-- Жауап беру: тек сұрақ ашық тұрғанда, бір рет. Жылдам әрі дұрыс жауапқа көбірек ұпай (500–1000).
create or replace function public.live_answer(p_code text, p_player uuid, p_token uuid, p_q integer, p_choice integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g live_games;
  p live_players;
  v_elapsed numeric;
  v_correct boolean;
  v_points integer;
begin
  select pl.* into p from live_players pl join live_games lg on lg.id = pl.game_id
  where pl.id = p_player and pl.token = p_token and lg.code = trim(p_code);
  if p.id is null then
    raise exception 'not_found';
  end if;
  select * into g from live_games where id = p.game_id;
  if g.state <> 'question' or g.current <> p_q then
    raise exception 'closed';
  end if;
  v_elapsed := extract(epoch from now() - g.started_at);
  if v_elapsed > g.time_limit + 1.5 then
    raise exception 'closed';
  end if;
  if p_choice is null or p_choice < 0 or p_choice >= jsonb_array_length(g.questions->g.current->'options') then
    raise exception 'bad_choice';
  end if;

  v_correct := p_choice = (g.questions->g.current->>'correctIndex')::integer;
  v_points := case when v_correct
                   then 500 + round(500 * greatest(0, 1 - v_elapsed / g.time_limit))::integer else 0 end;

  insert into live_answers (player_id, game_id, q, choice, correct, points)
  values (p.id, g.id, p_q, p_choice, v_correct, v_points)
  on conflict (player_id, q) do nothing;
  if found then
    update live_players set score = score + v_points where id = p.id;
  end if;
end;
$$;

revoke all on function public.live_create(text, jsonb, integer, text) from public;
revoke all on function public.live_host_state(uuid) from public;
revoke all on function public.live_control(uuid, text) from public;
revoke all on function public.live_join(text, text) from public;
revoke all on function public.live_state(text, uuid, uuid) from public;
revoke all on function public.live_answer(text, uuid, uuid, integer, integer) from public;
grant execute on function public.live_create(text, jsonb, integer, text) to authenticated;
grant execute on function public.live_host_state(uuid) to authenticated;
grant execute on function public.live_control(uuid, text) to authenticated;
grant execute on function public.live_join(text, text) to anon, authenticated;
grant execute on function public.live_state(text, uuid, uuid) to anon, authenticated;
grant execute on function public.live_answer(text, uuid, uuid, integer, integer) to anon, authenticated;
