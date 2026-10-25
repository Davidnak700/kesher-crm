-- Security hardening. Run after security_hardening migration + rls_test.sql.
\set ON_ERROR_STOP on

-- sign-up still works after revoking EXECUTE: the trigger creates a profile and 6 stages
insert into auth.users (id, email) values ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'new@crm.test');
do $$
begin
  if (select count(*) from public.pipeline_stages where owner_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') = 6
     and exists (select 1 from public.profiles where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') then
    raise notice 'PASS: sign-up trigger still creates profile and pipeline';
  else
    raise exception 'FAIL: sign-up trigger broken';
  end if;
end $$;

-- a user can't call handle_new_user directly
set role authenticated;
set request.jwt.claim.sub = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
do $$
begin
  perform public.handle_new_user();
  raise exception 'FAIL: handle_new_user is callable';
exception when insufficient_privilege then
  raise notice 'PASS: handle_new_user cannot be called by users';
end $$;

-- deal triggers still run with the empty search_path: create, move to Won, check history + closed_at
do $$
declare v_deal uuid;
begin
  insert into public.deals (title, amount, stage_id)
  values ('Hardening test', 1000, (select id from public.pipeline_stages where key = 'lead'))
  returning id into v_deal;
  update public.deals set stage_id = (select id from public.pipeline_stages where key = 'won') where id = v_deal;
  if (select closed_at is not null from public.deals where id = v_deal)
     and (select count(*) from public.deal_stage_history where deal_id = v_deal) = 2 then
    raise notice 'PASS: deal triggers work with a fixed search_path';
  else
    raise exception 'FAIL: deal triggers broken';
  end if;
end $$;

reset role;
select proname, proconfig from pg_proc
where proname in ('set_updated_at', 'handle_deal_stage', 'log_deal_stage', 'handle_new_user') order by proname;
