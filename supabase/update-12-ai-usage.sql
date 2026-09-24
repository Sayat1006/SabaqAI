-- AI Nur · 12-жаңарту: AI қолдану статистикасы (әкімшіге).
-- Supabase SQL Editor-інде бір рет орындаңыз. Қайта орындауға болады: бар деректерге зиян келтірмейді.
-- Одан кейін ai-generate (және қаласаңыз telegram-bot) функциясын жаңа кодпен қайта жариялаңыз —
-- әр Gemini сұранысын солар жазады.

-- Әр AI сұранысы: кім, қай құралдан, қай модель, сәтті ме, қанша токен, неше рет қайталанды.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  source text not null default 'web',
  tool text not null default '',
  model text not null default '',
  ok boolean not null,
  status integer not null default 200,
  retries integer not null default 0,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  ms integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_created_idx on public.ai_usage (created_at desc);
create index if not exists ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

-- Жазуды тек Edge Function (service_role) жасайды; оқуды — тек әкімші.
alter table public.ai_usage enable row level security;

drop policy if exists "admin read ai usage" on public.ai_usage;
create policy "admin read ai usage" on public.ai_usage
  for select using (public.is_admin());

revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;

-- Әкімші панеліне арналған жиынтық (Қазақстан уақыты бойынша күндер).
create or replace function public.admin_ai_stats(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 7), 90);
  v_tz text := 'Asia/Almaty';
  v_today date := (now() at time zone v_tz)::date;
  v_from timestamptz := ((v_today - (v_days - 1))::timestamp at time zone v_tz);
  v_today_start timestamptz := (v_today::timestamp at time zone v_tz);
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;

  return jsonb_build_object(
    'days', v_days,
    'today', (
      select jsonb_build_object(
        'total', count(*),
        'ok', count(*) filter (where ok),
        'failed', count(*) filter (where not ok),
        'retried', count(*) filter (where retries > 0),
        'tokens', coalesce(sum(tokens_in + tokens_out), 0)
      )
      from ai_usage where created_at >= v_today_start
    ),
    'peak_minute_today', (
      select coalesce(max(c), 0) from (
        select count(*) as c from ai_usage
        where created_at >= v_today_start
        group by date_trunc('minute', created_at)
      ) m
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', to_char(d, 'YYYY-MM-DD'),
               'total', coalesce(u.total, 0),
               'failed', coalesce(u.failed, 0)
             ) order by d), '[]'::jsonb)
      from generate_series(v_today - (v_days - 1), v_today, interval '1 day') d
      left join (
        select (created_at at time zone v_tz)::date as day, count(*) as total, count(*) filter (where not ok) as failed
        from ai_usage where created_at >= v_from
        group by 1
      ) u on u.day = d::date
    ),
    'users', (
      select coalesce(jsonb_agg(x order by (x->>'month')::int desc, x->>'name'), '[]'::jsonb) from (
        select jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'email', p.email,
          'status', p.status,
          'today', count(a.id) filter (where a.created_at >= v_today_start),
          'week', count(a.id) filter (where a.created_at >= v_today_start - interval '6 days'),
          'month', count(a.id),
          'last_at', max(a.created_at)
        ) as x
        from profiles p
        left join ai_usage a on a.user_id = p.id and a.created_at >= v_from
        group by p.id, p.name, p.email, p.status
      ) s
    ),
    'tools', (
      select coalesce(jsonb_agg(jsonb_build_object('tool', tool, 'count', c) order by c desc), '[]'::jsonb)
      from (select case when source = 'telegram' then 'telegram' else tool end as tool, count(*) as c
            from ai_usage where created_at >= v_from group by 1) t
    ),
    'models', (
      select coalesce(jsonb_agg(jsonb_build_object('model', model, 'count', c) order by c desc), '[]'::jsonb)
      from (select model, count(*) as c from ai_usage where created_at >= v_from and ok group by 1) t
    ),
    'db_bytes', pg_database_size(current_database()),
    'projects', (
      select coalesce(jsonb_object_agg(kind, c), '{}'::jsonb)
      from (select kind, count(*) as c from projects group by kind) t
    )
  );
end;
$$;

revoke all on function public.admin_ai_stats(integer) from public;
grant execute on function public.admin_ai_stats(integer) to authenticated;
