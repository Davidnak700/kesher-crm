-- Analytics views + demo data v2. Run after rls_test.sql (which creates users A and B).
\set ON_ERROR_STOP on
\pset footer off

select public.seed_demo_data('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

set role authenticated;
set request.jwt.claim.sub = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

\echo '--- demo timeline is consistent (every count must be 0)'
do $$
declare r record; bad int := 0;
begin
  for r in
    select 'deal starts before its contact' chk, count(*) n from deals d join contacts c on c.id = d.contact_id where d.created_at < c.created_at
    union all select 'stage move in the future', count(*) from deal_stage_history where changed_at > now()
    union all select 'activity in the future', count(*) from activities where occurred_at > now()
    union all select 'stage move before the deal existed', count(*) from deal_stage_history h join deals d on d.id = h.deal_id where h.changed_at < d.created_at
    union all select 'closed before created', count(*) from deals where closed_at < created_at
    union all select 'history out of order', count(*) from (select changed_at < lag(changed_at) over (partition by deal_id order by id) b from deal_stage_history) x where b
    union all select 'won/lost without closed_at', count(*) from deals d join pipeline_stages s on s.id = d.stage_id where s.kind <> 'open' and d.closed_at is null
    union all select 'open deal with closed_at', count(*) from deals d join pipeline_stages s on s.id = d.stage_id where s.kind = 'open' and d.closed_at is not null
    union all select 'last move does not match the stage', count(*) from deals d
      join lateral (select to_stage_id from deal_stage_history h where h.deal_id = d.id order by changed_at desc, id desc limit 1) l on true
      where l.to_stage_id <> d.stage_id
    union all select 'won deal skipped a stage', count(*) from deals d join pipeline_stages s on s.id = d.stage_id
      where s.kind = 'won' and (select count(*) from deal_stage_history h where h.deal_id = d.id) <> 5
  loop
    if r.n <> 0 then raise warning 'FAIL: % (% rows)', r.chk, r.n; bad := bad + 1; end if;
  end loop;
  if bad > 0 then raise exception '% timeline checks failed', bad; end if;
  raise notice 'PASS: timeline consistent';
end $$;

\echo '--- sales_cycle_summary'
select * from sales_cycle_summary order by outcome desc;

\echo '--- stage_durations'
select key, stays, avg_days, median_days from stage_durations order by position;

\echo '--- source_performance'
select * from source_performance order by win_rate_pct desc nulls last;

do $$
declare v_views numeric; v_manual numeric; n int;
begin
  -- the view's win rate matches a hand count
  select win_rate_pct into v_views from source_performance where source = 'referral';
  select round(100.0 * count(*) filter (where s.kind = 'won') / count(*) filter (where s.kind in ('won','lost')), 1)
    into v_manual
    from deals d join pipeline_stages s on s.id = d.stage_id join contacts c on c.id = d.contact_id
    where c.source = 'referral';
  if v_views is distinct from v_manual then raise exception 'FAIL: referral win rate % <> %', v_views, v_manual; end if;

  -- closed deals in the cycle summary = won + lost on the board
  select sum(deals) into v_views from sales_cycle_summary;
  select count(*) into v_manual from deals d join pipeline_stages s on s.id = d.stage_id where s.kind in ('won','lost');
  if v_views <> v_manual then raise exception 'FAIL: cycle summary counts % closed deals, board has %', v_views, v_manual; end if;

  -- every finished stay is counted once: moves out of an open stage = history rows minus one per deal
  select sum(stays) into v_views from stage_durations;
  select count(*) - count(distinct deal_id) into v_manual from deal_stage_history;
  if v_views <> v_manual then raise exception 'FAIL: stage stays % <> moves %', v_views, v_manual; end if;

  -- built-in patterns the analysis relies on
  if (select win_rate_pct from source_performance where source = 'referral')
     <= (select win_rate_pct from source_performance where source = 'ads') then
    raise exception 'FAIL: referrals should convert better than ads';
  end if;
  if (select median_days_to_win from source_performance where source = 'referral')
     >= (select median_days_to_win from source_performance where source = 'ads') then
    raise exception 'FAIL: referrals should close faster than ads';
  end if;
  if (select avg_days from stage_durations where key = 'proposal')
     <> (select max(avg_days) from stage_durations) then
    raise exception 'FAIL: proposal should be the slowest stage';
  end if;
  if (select source from source_performance order by deals desc limit 1) <> 'website' then
    raise exception 'FAIL: website should bring the most deals';
  end if;
  raise notice 'PASS: view numbers match hand counts, patterns present';
end $$;

-- ===================== user B sees none of A's analytics =================
set request.jwt.claim.sub = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
do $$
declare n int;
begin
  select (select count(*) from closed_deals where owner_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
       + (select coalesce(sum(deals), 0) from source_performance where source = 'website')
    into n;
  if n = 0 then raise notice 'PASS: user B sees none of user A''s analytics';
  else raise exception 'FAIL: user B sees % of A''s rows', n; end if;
end $$;

set role anon;
set request.jwt.claim.sub = '';
do $$
declare n int;
begin
  select (select count(*) from closed_deals) + (select count(*) from source_performance)
       + (select count(*) from sales_cycle_summary) + (select coalesce(sum(stays), 0) from stage_durations) into n;
  if n = 0 then raise notice 'PASS: anonymous visitor sees no analytics';
  else raise exception 'FAIL: anon sees % analytics rows', n; end if;
exception when insufficient_privilege then
  raise notice 'PASS: anonymous visitor cannot read analytics';
end $$;

reset role;
