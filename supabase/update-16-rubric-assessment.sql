-- AI Nur · 16-жаңарту: дескриптор бойынша бағалау (өзін-өзі, жұптық, топтық) — QR арқылы.
-- Алдымен 15-жаңарту (update-15-class-polls.sql) орындалған болуы керек.
-- Supabase SQL Editor-інде бір рет орындаңыз. Қайта орындауға болады: бар деректерге зиян келтірмейді.
--
-- Жаңа сауалнама түрі 'rubric', әдісі: 'self' (өзін-өзі), 'peer' (жұбын), 'group' (басқа топты).
-- Дескрипторлар: [{text, points}]. Бағалау нысаны (targets): сынып тізімі немесе топ атаулары.
-- Жұптық және топтық бағалауда бір телефоннан бірнеше оқушыны/топты бағалауға болады
-- (әр нысанға бір жауап, қайта жіберсе — жаңартылады).

begin;

alter table public.class_polls drop constraint if exists class_polls_kind_check;
alter table public.class_polls add constraint class_polls_kind_check check (kind in ('traffic', 'self', 'reflection', 'rubric'));

alter table public.class_polls add column if not exists descriptors jsonb not null default '[]'::jsonb;
alter table public.class_polls add column if not exists targets jsonb not null default '[]'::jsonb;
alter table public.class_polls drop constraint if exists class_polls_descriptors_check;
alter table public.class_polls add constraint class_polls_descriptors_check check (jsonb_typeof(descriptors) = 'array' and jsonb_array_length(descriptors) <= 12);
alter table public.class_polls drop constraint if exists class_polls_targets_check;
alter table public.class_polls add constraint class_polls_targets_check check (jsonb_typeof(targets) = 'array' and jsonb_array_length(targets) <= 60);

alter table public.class_poll_responses add column if not exists target text;
alter table public.class_poll_responses add column if not exists group_name text;
alter table public.class_poll_responses add column if not exists marks jsonb;
alter table public.class_poll_responses add column if not exists comment text;
alter table public.class_poll_responses drop constraint if exists class_poll_responses_rubric_check;
alter table public.class_poll_responses add constraint class_poll_responses_rubric_check check (
  (target is null or length(target) <= 60)
  and (group_name is null or length(group_name) <= 60)
  and (marks is null or (jsonb_typeof(marks) = 'array' and jsonb_array_length(marks) <= 12))
  and (comment is null or length(comment) <= 500)
);

-- Бір телефон — бір нысанға бір жауап (бұрын: бір сауалнамаға бір жауап).
alter table public.class_poll_responses drop constraint if exists class_poll_responses_poll_id_device_key;
create unique index if not exists class_poll_responses_target_idx on public.class_poll_responses (poll_id, device, (coalesce(target, '')));

-- Ескі нұсқалар (параметрлері басқа) — жаңасымен ауыстырылады.
drop function if exists public.poll_create(text, text, text, jsonb, jsonb, boolean, text);
drop function if exists public.poll_answer(text, uuid, text, integer, jsonb);

create or replace function public.poll_create(
  p_kind text,
  p_method text,
  p_title text,
  p_options jsonb,
  p_prompts jsonb,
  p_ask_name boolean,
  p_lang text,
  p_descriptors jsonb default '[]'::jsonb,
  p_targets jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_id uuid;
  v_options jsonb := '[]'::jsonb;
  v_prompts jsonb := '[]'::jsonb;
  v_desc jsonb := '[]'::jsonb;
  v_targets jsonb := '[]'::jsonb;
  v_ask boolean := coalesce(p_ask_name, false);
begin
  if not exists (select 1 from profiles where id = auth.uid() and status = 'active') then
    raise exception 'not_allowed';
  end if;
  if p_kind not in ('traffic', 'self', 'reflection', 'rubric') then
    raise exception 'bad_poll';
  end if;

  if p_kind = 'reflection' then
    if jsonb_typeof(p_prompts) <> 'array' or jsonb_array_length(p_prompts) not between 1 and 6 then
      raise exception 'bad_poll';
    end if;
    select jsonb_agg(left(trim(p), 200) order by ord) into v_prompts
    from jsonb_array_elements_text(p_prompts) with ordinality as t(p, ord);
  elsif p_kind = 'rubric' then
    if p_method not in ('self', 'peer', 'group')
       or jsonb_typeof(p_descriptors) <> 'array' or jsonb_array_length(p_descriptors) not between 1 and 12 then
      raise exception 'bad_poll';
    end if;
    select jsonb_agg(jsonb_build_object(
             'text', left(trim(coalesce(d->>'text', '')), 300),
             'points', least(greatest(coalesce((d->>'points')::integer, 1), 1), 10)
           ) order by ord)
      into v_desc
    from jsonb_array_elements(p_descriptors) with ordinality as t(d, ord);
    if exists (select 1 from jsonb_array_elements(v_desc) d where length(d->>'text') = 0) then
      raise exception 'bad_poll';
    end if;
    if jsonb_typeof(coalesce(p_targets, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_targets, '[]'::jsonb)) > 60 then
      raise exception 'bad_poll';
    end if;
    select coalesce(jsonb_agg(distinct left(trim(t), 60)) filter (where length(trim(t)) > 0), '[]'::jsonb) into v_targets
    from jsonb_array_elements_text(coalesce(p_targets, '[]'::jsonb)) t;
    if p_method = 'group' and jsonb_array_length(v_targets) < 2 then
      raise exception 'bad_poll';
    end if;
    v_ask := true; -- бағалауда кім бағалағаны әрдайым көрінеді
  else
    if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) not between 2 and 6 then
      raise exception 'bad_poll';
    end if;
    select jsonb_agg(jsonb_build_object('emoji', left(coalesce(o->>'emoji', ''), 16), 'label', left(coalesce(o->>'label', ''), 80)) order by ord)
      into v_options
    from jsonb_array_elements(p_options) with ordinality as t(o, ord);
  end if;

  delete from class_polls where user_id = auth.uid() and created_at < now() - interval '30 days';
  if (select count(*) from class_polls where user_id = auth.uid() and created_at > now() - interval '1 day') >= 60 then
    raise exception 'too_many';
  end if;

  loop
    v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    continue when exists (select 1 from class_polls where code = v_code);
    insert into class_polls (user_id, code, kind, method, title, options, prompts, ask_name, lang, descriptors, targets)
    values (auth.uid(), v_code, p_kind, left(coalesce(p_method, ''), 40), left(trim(coalesce(p_title, '')), 300),
            v_options, v_prompts, v_ask,
            case when p_lang in ('ru', 'en') then p_lang else 'kk' end,
            v_desc, v_targets)
    returning id into v_id;
    return jsonb_build_object('id', v_id, 'code', v_code);
  end loop;
end;
$$;

create or replace function public.poll_host_state(p_poll uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p class_polls;
begin
  select * into p from class_polls where id = p_poll and user_id = auth.uid();
  if p.id is null then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'id', p.id,
    'code', p.code,
    'kind', p.kind,
    'method', p.method,
    'title', p.title,
    'options', p.options,
    'prompts', p.prompts,
    'descriptors', p.descriptors,
    'targets', p.targets,
    'ask_name', p.ask_name,
    'lang', p.lang,
    'is_open', p.is_open and p.created_at > now() - interval '1 day',
    'created_at', p.created_at,
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', r.name, 'choice', r.choice, 'texts', r.texts,
               'target', r.target, 'group', r.group_name, 'marks', r.marks, 'comment', r.comment,
               'at', r.updated_at) order by r.created_at)
      from class_poll_responses r where r.poll_id = p.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.poll_get(p_code text, p_device uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p class_polls;
  r class_poll_responses;
begin
  select * into p from class_polls where code = trim(p_code) and created_at > now() - interval '7 days';
  if p.id is null then
    raise exception 'not_found';
  end if;
  select * into r from class_poll_responses where poll_id = p.id and device = p_device and coalesce(target, '') = '';
  return jsonb_build_object(
    'kind', p.kind,
    'method', p.method,
    'title', p.title,
    'options', p.options,
    'prompts', p.prompts,
    'descriptors', p.descriptors,
    'targets', p.targets,
    'ask_name', p.ask_name,
    'lang', p.lang,
    'is_open', p.is_open and p.created_at > now() - interval '1 day',
    'answer', case when r.id is null then null else jsonb_build_object('name', r.name, 'choice', r.choice, 'texts', r.texts, 'marks', r.marks, 'comment', r.comment) end,
    -- Жұптық/топтық бағалауда осы телефоннан бағаланғандар.
    'assessed', coalesce((
      select jsonb_agg(jsonb_build_object('target', x.target, 'group', x.group_name, 'name', x.name) order by x.created_at)
      from class_poll_responses x where x.poll_id = p.id and x.device = p_device and coalesce(x.target, '') <> ''
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.poll_answer(
  p_code text,
  p_device uuid,
  p_name text,
  p_choice integer,
  p_texts jsonb,
  p_target text default null,
  p_group text default null,
  p_marks jsonb default null,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p class_polls;
  v_name text := nullif(left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 40), '');
  v_target text := nullif(left(regexp_replace(trim(coalesce(p_target, '')), '\s+', ' ', 'g'), 60), '');
  v_group text := nullif(left(trim(coalesce(p_group, '')), 60), '');
  v_comment text := nullif(left(trim(coalesce(p_comment, '')), 500), '');
  v_texts jsonb;
  v_n integer;
begin
  select * into p from class_polls where code = trim(p_code);
  if p.id is null then
    raise exception 'not_found';
  end if;
  if not p.is_open or p.created_at <= now() - interval '1 day' then
    raise exception 'closed';
  end if;
  if p_device is null then
    raise exception 'bad_answer';
  end if;
  if p.ask_name and (v_name is null or length(v_name) < 2) then
    raise exception 'bad_name';
  end if;
  if not p.ask_name then
    v_name := null;
  end if;

  if p.kind = 'rubric' then
    v_n := jsonb_array_length(p.descriptors);
    if p_marks is null or jsonb_typeof(p_marks) <> 'array' or jsonb_array_length(p_marks) <> v_n then
      raise exception 'bad_answer';
    end if;
    -- Әр баға: 0 … дескриптордың балы.
    if exists (
      select 1 from jsonb_array_elements(p_marks) with ordinality as m(v, ord)
      where jsonb_typeof(m.v) <> 'number'
         or (m.v)::text::numeric <> floor((m.v)::text::numeric)
         or (m.v)::text::integer not between 0 and ((p.descriptors->(ord::integer - 1))->>'points')::integer
    ) then
      raise exception 'bad_answer';
    end if;
    if p.method = 'self' then
      v_target := null;
      v_group := null;
    elsif p.method = 'peer' then
      v_group := null;
      if v_target is null or length(v_target) < 2 or lower(v_target) = lower(v_name) then
        raise exception 'bad_target';
      end if;
      if jsonb_array_length(p.targets) > 0 and not (p.targets ? v_target) then
        raise exception 'bad_target';
      end if;
    else
      if v_group is null or v_target is null or not (p.targets ? v_group) or not (p.targets ? v_target) or v_group = v_target then
        raise exception 'bad_target';
      end if;
    end if;
  elsif p.kind = 'reflection' then
    v_n := jsonb_array_length(p.prompts);
    if p_texts is null or jsonb_typeof(p_texts) <> 'array' or jsonb_array_length(p_texts) <> v_n then
      raise exception 'bad_answer';
    end if;
    select jsonb_agg(left(trim(coalesce(t, '')), 300) order by ord) into v_texts
    from jsonb_array_elements_text(p_texts) with ordinality as x(t, ord);
    if not exists (select 1 from jsonb_array_elements_text(v_texts) t where length(t) > 0) then
      raise exception 'bad_answer';
    end if;
    v_target := null;
    v_group := null;
  else
    if p_choice is null or p_choice not between 0 and jsonb_array_length(p.options) - 1 then
      raise exception 'bad_answer';
    end if;
    v_target := null;
    v_group := null;
  end if;

  if not exists (select 1 from class_poll_responses where poll_id = p.id and device = p_device and coalesce(target, '') = coalesce(v_target, ''))
     and (select count(*) from class_poll_responses where poll_id = p.id) >= (case when p.kind = 'rubric' then 300 else 100 end) then
    raise exception 'full';
  end if;

  insert into class_poll_responses (poll_id, device, name, choice, texts, target, group_name, marks, comment)
  values (p.id, p_device, v_name,
          case when p.kind in ('traffic', 'self') then p_choice end,
          case when p.kind = 'reflection' then v_texts end,
          v_target, v_group,
          case when p.kind = 'rubric' then p_marks end,
          case when p.kind = 'rubric' then v_comment end)
  on conflict (poll_id, device, (coalesce(target, ''))) do update
    set name = excluded.name, choice = excluded.choice, texts = excluded.texts, group_name = excluded.group_name,
        marks = excluded.marks, comment = excluded.comment, updated_at = now();
end;
$$;

revoke all on function public.poll_create(text, text, text, jsonb, jsonb, boolean, text, jsonb, jsonb) from public;
revoke all on function public.poll_host_state(uuid) from public;
revoke all on function public.poll_get(text, uuid) from public;
revoke all on function public.poll_answer(text, uuid, text, integer, jsonb, text, text, jsonb, text) from public;
grant execute on function public.poll_create(text, text, text, jsonb, jsonb, boolean, text, jsonb, jsonb) to authenticated;
grant execute on function public.poll_host_state(uuid) to authenticated;
grant execute on function public.poll_get(text, uuid) to anon, authenticated;
grant execute on function public.poll_answer(text, uuid, text, integer, jsonb, text, text, jsonb, text) to anon, authenticated;

commit;
