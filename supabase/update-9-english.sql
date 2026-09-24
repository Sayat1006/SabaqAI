-- AI Nur · 9-жаңарту: ағылшынша материалдар (тірі викторина тілі).
-- update-7-docs-live.sql-дан КЕЙІН Supabase SQL Editor-інде бір рет орындаңыз.
-- Қайта орындауға болады: бар деректерге зиян келтірмейді.

-- Тірі викторина енді ағылшынша да болады (оқушы экранындағы мәтіндер ойын тілімен шығады).
alter table public.live_games drop constraint if exists live_games_lang_check;
alter table public.live_games add constraint live_games_lang_check check (lang in ('kk', 'ru', 'en'));

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
            case when p_lang in ('ru', 'en') then p_lang else 'kk' end)
    returning id into v_id;
    return jsonb_build_object('id', v_id, 'code', v_code);
  end loop;
end;
$$;

revoke all on function public.live_create(text, jsonb, integer, text) from public;
grant execute on function public.live_create(text, jsonb, integer, text) to authenticated;
