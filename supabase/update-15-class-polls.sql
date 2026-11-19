-- AI Nur · 15-жаңарту: оқушылар телефоннан QR арқылы жауап беретін сауалнамалар
-- (бағдаршам, өзін-өзі бағалау, рефлексия).
-- Supabase SQL Editor-інде бір рет орындаңыз. Қайта орындауға болады: бар деректерге зиян келтірмейді.
--
-- Оқушылар тіркелмейді: 6 таңбалы код арқылы кіреді. Әр телефон өзіне кездейсоқ «device»
-- идентификаторын жасайды — бір телефоннан бір жауап (оқушы жауабын өзгерте алады).
-- Жауаптарды тек сауалнаманы жасаған мұғалім көреді. Барлық жазу/оқу — төмендегі функциялар арқылы.

create table if not exists public.class_polls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[0-9]{6}$'),
  kind text not null check (kind in ('traffic', 'self', 'reflection')),
  method text not null default '' check (length(method) <= 40),
  title text not null default '' check (length(title) <= 300),
  -- traffic/self: таңдау нұсқалары [{emoji, label}]; reflection: сұрақтар ["...", ...]
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 6),
  prompts jsonb not null default '[]'::jsonb check (jsonb_typeof(prompts) = 'array' and jsonb_array_length(prompts) <= 6),
  ask_name boolean not null default false,
  lang text not null default 'kk' check (lang in ('kk', 'ru', 'en')),
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists class_polls_user_idx on public.class_polls (user_id, created_at desc);

create table if not exists public.class_poll_responses (
  id bigint generated always as identity primary key,
  poll_id uuid not null references public.class_polls(id) on delete cascade,
  device uuid not null,
  name text check (name is null or length(name) <= 40),
  choice integer,
  texts jsonb check (texts is null or (jsonb_typeof(texts) = 'array' and jsonb_array_length(texts) <= 6)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (poll_id, device)
);

alter table public.class_polls enable row level security;
alter table public.class_poll_responses enable row level security;

-- Мұғалім тек өз сауалнамаларын көреді (тарих тізімі) және өшіре алады.
drop policy if exists "own polls select" on public.class_polls;
create policy "own polls select" on public.class_polls for select using (user_id = auth.uid());
drop policy if exists "own polls delete" on public.class_polls;
create policy "own polls delete" on public.class_polls for delete using (user_id = auth.uid());
-- Жауаптарға тікелей қатынау жоқ: тек функциялар арқылы.

revoke all on public.class_polls from anon;
revoke all on public.class_poll_responses from anon, authenticated;
grant select, delete on public.class_polls to authenticated;

-- Сауалнама жасау (мұғалім).
create or replace function public.poll_create(
  p_kind text,
  p_method text,
  p_title text,
  p_options jsonb,
  p_prompts jsonb,
  p_ask_name boolean,
  p_lang text
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
begin
  if not exists (select 1 from profiles where id = auth.uid() and status = 'active') then
    raise exception 'not_allowed';
  end if;
  if p_kind not in ('traffic', 'self', 'reflection') then
    raise exception 'bad_poll';
  end if;

  if p_kind = 'reflection' then
    if jsonb_typeof(p_prompts) <> 'array' or jsonb_array_length(p_prompts) not between 1 and 6 then
      raise exception 'bad_poll';
    end if;
    select jsonb_agg(left(trim(p), 200) order by ord) into v_prompts
    from jsonb_array_elements_text(p_prompts) with ordinality as t(p, ord);
  else
    if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) not between 2 and 6 then
      raise exception 'bad_poll';
    end if;
    select jsonb_agg(jsonb_build_object('emoji', left(coalesce(o->>'emoji', ''), 16), 'label', left(coalesce(o->>'label', ''), 80)) order by ord)
      into v_options
    from jsonb_array_elements(p_options) with ordinality as t(o, ord);
  end if;

  -- 30 күннен ескі сауалнамаларды тазалаймыз.
  delete from class_polls where user_id = auth.uid() and created_at < now() - interval '30 days';
  if (select count(*) from class_polls where user_id = auth.uid() and created_at > now() - interval '1 day') >= 60 then
    raise exception 'too_many';
  end if;

  loop
    v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    continue when exists (select 1 from class_polls where code = v_code);
    insert into class_polls (user_id, code, kind, method, title, options, prompts, ask_name, lang)
    values (auth.uid(), v_code, p_kind, left(coalesce(p_method, ''), 40), left(trim(coalesce(p_title, '')), 300),
            v_options, v_prompts, coalesce(p_ask_name, false),
            case when p_lang in ('ru', 'en') then p_lang else 'kk' end)
    returning id into v_id;
    return jsonb_build_object('id', v_id, 'code', v_code);
  end loop;
end;
$$;

-- Мұғалім экраны: сауалнама және барлық жауаптар (тек иесіне).
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
    'ask_name', p.ask_name,
    'lang', p.lang,
    'is_open', p.is_open and p.created_at > now() - interval '1 day',
    'created_at', p.created_at,
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object('name', r.name, 'choice', r.choice, 'texts', r.texts, 'at', r.updated_at) order by r.created_at)
      from class_poll_responses r where r.poll_id = p.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Мұғалім: жабу, қайта ашу, жауаптарды тазалау.
create or replace function public.poll_control(p_poll uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from class_polls where id = p_poll and user_id = auth.uid()) then
    raise exception 'not_found';
  end if;
  if p_action = 'close' then
    update class_polls set is_open = false where id = p_poll;
  elsif p_action = 'open' then
    -- 1 тәуліктен ескі сауалнама қайта ашылмайды — жаңасын жасаған дұрыс.
    update class_polls set is_open = true where id = p_poll and created_at > now() - interval '1 day';
  elsif p_action = 'reset' then
    delete from class_poll_responses where poll_id = p_poll;
  else
    raise exception 'bad_action';
  end if;
end;
$$;

-- Оқушы беті: сұрақ пен нұсқалар және осы телефонның бұрынғы жауабы.
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
  select * into r from class_poll_responses where poll_id = p.id and device = p_device;
  return jsonb_build_object(
    'kind', p.kind,
    'method', p.method,
    'title', p.title,
    'options', p.options,
    'prompts', p.prompts,
    'ask_name', p.ask_name,
    'lang', p.lang,
    'is_open', p.is_open and p.created_at > now() - interval '1 day',
    'answer', case when r.id is null then null else jsonb_build_object('name', r.name, 'choice', r.choice, 'texts', r.texts) end
  );
end;
$$;

-- Оқушы жауабы: бір телефоннан бір жауап, қайта жіберсе — жаңартылады.
create or replace function public.poll_answer(p_code text, p_device uuid, p_name text, p_choice integer, p_texts jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p class_polls;
  v_name text := nullif(left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 40), '');
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

  if p.kind = 'reflection' then
    v_n := jsonb_array_length(p.prompts);
    if p_texts is null or jsonb_typeof(p_texts) <> 'array' or jsonb_array_length(p_texts) <> v_n then
      raise exception 'bad_answer';
    end if;
    select jsonb_agg(left(trim(coalesce(t, '')), 300) order by ord) into v_texts
    from jsonb_array_elements_text(p_texts) with ordinality as x(t, ord);
    if not exists (select 1 from jsonb_array_elements_text(v_texts) t where length(t) > 0) then
      raise exception 'bad_answer';
    end if;
  else
    if p_choice is null or p_choice not between 0 and jsonb_array_length(p.options) - 1 then
      raise exception 'bad_answer';
    end if;
  end if;

  if not exists (select 1 from class_poll_responses where poll_id = p.id and device = p_device)
     and (select count(*) from class_poll_responses where poll_id = p.id) >= 100 then
    raise exception 'full';
  end if;

  insert into class_poll_responses (poll_id, device, name, choice, texts)
  values (p.id, p_device, v_name,
          case when p.kind = 'reflection' then null else p_choice end,
          case when p.kind = 'reflection' then v_texts else null end)
  on conflict (poll_id, device) do update
    set name = excluded.name, choice = excluded.choice, texts = excluded.texts, updated_at = now();
end;
$$;

revoke all on function public.poll_create(text, text, text, jsonb, jsonb, boolean, text) from public;
revoke all on function public.poll_host_state(uuid) from public;
revoke all on function public.poll_control(uuid, text) from public;
revoke all on function public.poll_get(text, uuid) from public;
revoke all on function public.poll_answer(text, uuid, text, integer, jsonb) from public;
grant execute on function public.poll_create(text, text, text, jsonb, jsonb, boolean, text) to authenticated;
grant execute on function public.poll_host_state(uuid) to authenticated;
grant execute on function public.poll_control(uuid, text) to authenticated;
grant execute on function public.poll_get(text, uuid) to anon, authenticated;
grant execute on function public.poll_answer(text, uuid, text, integer, jsonb) to anon, authenticated;
