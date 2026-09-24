-- AI Nur · 13-жаңарту: мұғалімге бекітілген пәндер (ең көбі 2).
-- Supabase SQL Editor-інде бір рет орындаңыз. Қайта орындауға болады: бар деректерге зиян келтірмейді.
--
-- profiles.subjects — әкімші бекіткен пәндер. Бос болса (әкімші не бұрынғы аккаунт) — шектеу жоқ.
-- Мұғалім бұл өрісті өзгерте алмайды: profiles кестесінде мұғалімге UPDATE саясаты жоқ,
-- ал update_my_profile тек бекітілген пәндердің бірін негізгі пән етіп қоя алады.

alter table public.profiles add column if not exists subjects text[] not null default '{}';

alter table public.profiles drop constraint if exists profiles_subjects_check;
alter table public.profiles add constraint profiles_subjects_check check (cardinality(subjects) <= 2);

-- Мұғалім өз профилін өзгерткенде негізгі пәні бекітілген пәндерден тыс бола алмайды.
create or replace function public.update_my_profile(
  p_name text,
  p_subject text,
  p_school text,
  p_grades text[],
  p_category text,
  p_experience_years integer,
  p_phone text,
  p_bio text,
  p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Жүйеге кіру қажет';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Аты-жөні кемінде 2 таңбадан тұруы керек';
  end if;

  update public.profiles set
    name = left(trim(p_name), 120),
    subject = case
      when cardinality(subjects) > 0 and not (trim(coalesce(p_subject, '')) = any (subjects)) then subjects[1]
      else left(trim(coalesce(p_subject, '')), 80)
    end,
    school = left(trim(coalesce(p_school, '')), 200),
    grades = coalesce(p_grades[1:11], '{}'),
    category = left(trim(coalesce(p_category, '')), 80),
    experience_years = case when p_experience_years between 0 and 70 then p_experience_years end,
    phone = left(trim(coalesce(p_phone, '')), 40),
    bio = left(coalesce(p_bio, ''), 1000),
    avatar_url = coalesce(p_avatar_url, '')
  where id = auth.uid() and status = 'active';
end;
$$;

revoke all on function public.update_my_profile(text, text, text, text[], text, integer, text, text, text) from public;
grant execute on function public.update_my_profile(text, text, text, text[], text, integer, text, text, text) to authenticated;

-- Жобаларды сақтағанда тексеру: материалдың пәні мұғалімге бекітілген болуы керек
-- (сайттан да, Telegram боттан да). Пәні жоқ материалдарға (сурет, презентация) шектеу жоқ.
create or replace function public.check_project_subject()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed text[];
  v_subject text := nullif(trim(coalesce(new.data->>'subject', '')), '');
begin
  if v_subject is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and v_subject is not distinct from nullif(trim(coalesce(old.data->>'subject', '')), '') then
    return new; -- бұрын сақталған материалды өңдеу (пәні өзгермеген) — рұқсат
  end if;
  select subjects into v_allowed from profiles where id = new.user_id;
  if cardinality(coalesce(v_allowed, '{}')) > 0 and not (v_subject = any (v_allowed)) then
    raise exception 'Бұл пәнге рұқсат жоқ: «%». Сізге бекітілген пәндер: %', v_subject, array_to_string(v_allowed, ', ')
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_subject_check on public.projects;
create trigger projects_subject_check
  before insert or update of data on public.projects
  for each row execute function public.check_project_subject();
