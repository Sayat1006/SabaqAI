-- AI Nur · 6-жаңарту: Telegram бот (мұғалімге хабарламалар).
-- update-5-task-types.sql-дан КЕЙІН Supabase SQL Editor-інде бір рет орындаңыз.
-- Қайта орындауға болады: бар деректерге зиян келтірмейді.

-- Мұғалімнің Telegram чаты және хабарлама баптауы.
alter table public.profiles add column if not exists telegram_chat_id bigint;
alter table public.profiles add column if not exists telegram_notify boolean not null default true;

-- Бір реттік қосылу кодтары (30 минут жарамды). Тек telegram-bot функциясы
-- (service_role) оқиды — RLS қосулы, саясат жоқ.
create table if not exists public.telegram_links (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.telegram_links enable row level security;

-- Әр оқушы нәтижесі туралы хабарлама тек бір рет жіберілуі үшін.
alter table public.test_submissions add column if not exists notified boolean not null default false;

-- Мұғалімге бір реттік код береді (ескі кодтары өшіріледі).
create or replace function public.telegram_link_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := replace(gen_random_uuid()::text, '-', '');
begin
  if not exists (select 1 from profiles where id = auth.uid() and status = 'active') then
    raise exception 'Жүйеге кіру қажет';
  end if;
  delete from telegram_links where user_id = auth.uid() or created_at < now() - interval '1 day';
  insert into telegram_links (code, user_id) values (v_code, auth.uid());
  return v_code;
end;
$$;

create or replace function public.telegram_unlink()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set telegram_chat_id = null where id = auth.uid();
$$;

create or replace function public.telegram_set_notify(p_on boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set telegram_notify = p_on where id = auth.uid();
$$;

revoke all on function public.telegram_link_code() from public;
revoke all on function public.telegram_unlink() from public;
revoke all on function public.telegram_set_notify(boolean) from public;
grant execute on function public.telegram_link_code() to authenticated;
grant execute on function public.telegram_unlink() to authenticated;
grant execute on function public.telegram_set_notify(boolean) to authenticated;
