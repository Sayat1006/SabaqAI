-- AI Nur · әкімшінің email-ін өзгерту (құпиясөз өзгермейді).
-- Supabase → SQL Editor → New query ішінде бір рет орындаңыз.
-- Әкімші біреу болса, ештеңе толтырудың қажеті жоқ. Бірнеше әкімші болса,
-- төмендегі v_old жолына өзгертілетін әкімшінің қазіргі email-ін жазыңыз.

do $$
declare
  v_new text := 'admin@ai.kz';
  v_old text := '';            -- бірнеше әкімші болса: 'қазіргі@email.kz'
  v_id uuid;
  v_count integer;
begin
  if v_old <> '' then
    select id into v_id from public.profiles where lower(email) = lower(v_old) and role = 'admin';
  else
    select count(*) into v_count from public.profiles where role = 'admin';
    if v_count <> 1 then
      raise exception 'Әкімшілер саны: %. v_old жолына өзгертілетін әкімшінің email-ін жазыңыз.', v_count;
    end if;
    select id into v_id from public.profiles where role = 'admin';
  end if;

  if v_id is null then
    raise exception 'Әкімші табылмады.';
  end if;
  if exists (select 1 from auth.users where lower(email) = lower(v_new) and id <> v_id) then
    raise exception '% бұрыннан басқа аккаунтта тіркелген.', v_new;
  end if;

  update auth.users
     set email = v_new, email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
   where id = v_id;
  update auth.identities
     set identity_data = identity_data || jsonb_build_object('email', v_new, 'email_verified', true), updated_at = now()
   where user_id = v_id and provider = 'email';
  update public.profiles set email = v_new where id = v_id;
end $$;

select name, email, role, status from public.profiles where role = 'admin';
