-- Behaviour tests for the CRM schema. Run after supabase_stub.sql + migrations.
\set ON_ERROR_STOP on
\pset footer off

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'demo@crm.test',  '{"full_name":"Demo User","locale":"he"}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'other@crm.test', '{"full_name":"Other User","locale":"en"}');

\echo '--- new users got a profile + 6 default stages'
select p.full_name, p.locale, count(s.*) as stages
from profiles p join pipeline_stages s on s.owner_id = p.id
group by p.id order by p.full_name;

select public.seed_demo_data('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- ===================== act as user A =====================================
set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

\echo '--- user A row counts'
select (select count(*) from companies) companies, (select count(*) from contacts) contacts,
       (select count(*) from deals) deals, (select count(*) from tasks) tasks,
       (select count(*) from activities) activities, (select count(*) from deal_stage_history) history;

\echo '--- pipeline_summary (kanban header numbers)'
select coalesce(key, name) stage, kind, deals_count, total_amount, weighted_amount
from pipeline_summary order by position;

\echo '--- monthly_sales'
select * from monthly_sales order by month;

\echo '--- funnel'
select coalesce(key, name) stage, deals_reached from funnel order by position;

\echo '--- sample of mixed he/en data'
select d.title, d.amount, c.first_name || ' ' || coalesce(c.last_name, '') contact
from deals d left join contacts c on c.id = d.contact_id order by d.created_at desc limit 5;

do $$
begin
  perform public.seed_demo_data(auth.uid());
  raise exception 'FAIL: app user could run seed_demo_data';
exception when insufficient_privilege then
  raise notice 'PASS: app user cannot call seed_demo_data';
end $$;

-- ===================== act as user B =====================================
set request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

do $$
declare n int; a_contact uuid := (select id from contacts limit 1);
begin
  select count(*) into n from deals;
  if n = 0 then raise notice 'PASS: user B sees none of A''s deals'; else raise exception 'FAIL: B sees % deals', n; end if;
  if a_contact is null then raise notice 'PASS: user B cannot read A''s contacts'; end if;
end $$;

do $$
begin
  insert into contacts (owner_id, first_name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Intruder');
  raise exception 'FAIL: B inserted a row owned by A';
exception when insufficient_privilege then
  raise notice 'PASS: B cannot insert rows owned by A (RLS)';
end $$;

do $$
declare a_contact uuid;
begin
  reset role;  -- peek as superuser to grab A's contact id, as if B guessed it
  select id into a_contact from contacts where owner_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' limit 1;
  set role authenticated;
  insert into deals (title, stage_id, contact_id)
  values ('Stolen link', (select id from pipeline_stages where key = 'lead'), a_contact);
  raise exception 'FAIL: B linked a deal to A''s contact';
exception when foreign_key_violation then
  raise notice 'PASS: B cannot link a deal to A''s contact (composite FK)';
end $$;
set role authenticated;
set request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

\echo '--- B: create contact + deal, drag lead -> proposal -> won'
insert into contacts (first_name, last_name) values ('Dana', 'Levi');
insert into deals (title, amount, stage_id, contact_id)
values ('Test deal', 12000, (select id from pipeline_stages where key = 'lead'), (select id from contacts where first_name = 'Dana'));
update deals set stage_id = (select id from pipeline_stages where key = 'proposal') where title = 'Test deal';
update deals set stage_id = (select id from pipeline_stages where key = 'won')      where title = 'Test deal';

select d.title, s.key stage, d.owner_id = auth.uid() owner_ok, d.closed_at is not null closed
from deals d join pipeline_stages s on s.id = d.stage_id;
select f.key from_stage, t.key to_stage
from deal_stage_history h left join pipeline_stages f on f.id = h.from_stage_id join pipeline_stages t on t.id = h.to_stage_id
order by h.id;

\echo '--- B: reopen deal -> closed_at cleared'
update deals set stage_id = (select id from pipeline_stages where key = 'negotiation') where title = 'Test deal';
select title, closed_at is null reopened from deals;

do $$
begin
  update deal_stage_history set to_stage_id = from_stage_id;
  raise exception 'FAIL: history is editable';
exception when insufficient_privilege then
  raise notice 'PASS: stage history is read-only for users';
end $$;

\echo '--- B: delete contact -> deal keeps owner, loses contact'
delete from contacts where first_name = 'Dana';
select title, contact_id is null contact_cleared, owner_id = auth.uid() owner_kept from deals;

do $$
begin
  delete from pipeline_stages where key = 'negotiation';
  raise exception 'FAIL: deleted a stage that still has deals';
exception when foreign_key_violation then
  raise notice 'PASS: cannot delete a stage that still has deals';
end $$;

-- ===================== anonymous visitor =================================
set role anon;
set request.jwt.claim.sub = '';
do $$
declare n int;
begin
  select count(*) into n from deals;
  if n = 0 then raise notice 'PASS: anonymous visitor sees nothing'; else raise exception 'FAIL: anon sees % deals', n; end if;
end $$;

reset role;
\echo '--- seed is deterministic and re-runnable'
select public.seed_demo_data('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select count(*) deals_after_reseed, sum(amount) total from deals where owner_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select public.seed_demo_data('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select count(*) deals_after_reseed, sum(amount) total from deals where owner_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
