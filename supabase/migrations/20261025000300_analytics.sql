-- =============================================================================
-- Analytics: how long sales take, where they stall, and which lead sources pay off
--
-- Four views answer the questions on the Analytics page (and in analysis/):
--   closed_deals        one row per won or lost deal, with its cycle length and lead source
--   sales_cycle_summary days from opening a deal to closing it, for won and for lost deals
--   stage_durations     how long deals stay in each stage before moving on (window function LEAD)
--   source_performance  deals, win rate, revenue and speed for each lead source
-- All are security_invoker, so each user only ever sees their own numbers (RLS).
--
-- The demo-data generator is updated too: timestamps are always in order, and the
-- synthetic data has built-in patterns by lead source so the analysis has something to find.
-- =============================================================================

create or replace view public.closed_deals
with (security_invoker = true) as
select
  d.id,
  d.owner_id,
  d.title,
  d.amount,
  s.kind                                                  as outcome,   -- 'won' | 'lost'
  d.created_at,
  d.closed_at,
  extract(epoch from (d.closed_at - d.created_at)) / 86400.0 as cycle_days,
  c.source
from public.deals d
join public.pipeline_stages s on s.id = d.stage_id
left join public.contacts c on c.id = d.contact_id
where s.kind in ('won', 'lost')
  and d.closed_at is not null;

-- Median as well as average: one very slow deal shouldn't decide what "typical" means.
create or replace view public.sales_cycle_summary
with (security_invoker = true) as
select
  outcome,
  count(*)                                                                              as deals,
  round(avg(cycle_days)::numeric, 1)                                                    as avg_days,
  round((percentile_cont(0.5)  within group (order by cycle_days))::numeric, 1)         as median_days,
  round((percentile_cont(0.25) within group (order by cycle_days))::numeric, 1)         as p25_days,
  round((percentile_cont(0.75) within group (order by cycle_days))::numeric, 1)         as p75_days
from public.closed_deals
group by outcome;

-- Time in stage = from entering a stage until the next move (LEAD over the deal's history).
-- Only finished stays count; a deal still sitting in a stage has no "left_at" yet.
create or replace view public.stage_durations
with (security_invoker = true) as
with stays as (
  select
    h.to_stage_id as stage_id,
    h.changed_at  as entered_at,
    lead(h.changed_at) over (partition by h.deal_id order by h.changed_at, h.id) as left_at
  from public.deal_stage_history h
)
select
  s.id        as stage_id,
  s.key,
  s.name,
  s.position,
  count(st.left_at)                                                                                    as stays,
  round(avg(extract(epoch from (st.left_at - st.entered_at)) / 86400.0)::numeric, 1)                   as avg_days,
  round((percentile_cont(0.5) within group (order by extract(epoch from (st.left_at - st.entered_at)) / 86400.0))::numeric, 1) as median_days
from public.pipeline_stages s
left join stays st on st.stage_id = s.id and st.left_at is not null
where s.kind = 'open'
group by s.id;

create or replace view public.source_performance
with (security_invoker = true) as
select
  c.source,
  count(d.id)                                              as deals,
  count(*) filter (where s.kind = 'won')                   as won,
  count(*) filter (where s.kind = 'lost')                  as lost,
  count(*) filter (where s.kind = 'open')                  as open,
  round(100.0 * count(*) filter (where s.kind = 'won')
        / nullif(count(*) filter (where s.kind in ('won', 'lost')), 0), 1)          as win_rate_pct,
  coalesce(sum(d.amount) filter (where s.kind = 'won'), 0)                          as won_amount,
  round(avg(d.amount) filter (where s.kind = 'won'), 0)                             as avg_won_amount,
  round((percentile_cont(0.5) within group (order by extract(epoch from (d.closed_at - d.created_at)) / 86400.0)
         filter (where s.kind = 'won'))::numeric, 1)                                as median_days_to_win
from public.deals d
join public.pipeline_stages s on s.id = d.stage_id
join public.contacts c on c.id = d.contact_id
where c.source is not null
group by c.source;

revoke all on public.closed_deals, public.sales_cycle_summary, public.stage_durations, public.source_performance
  from anon;
grant select on public.closed_deals, public.sales_cycle_summary, public.stage_durations, public.source_performance
  to authenticated;

-- -----------------------------------------------------------------------------
-- Demo data generator, v2
-- -----------------------------------------------------------------------------

create or replace function public.seed_demo_data(p_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  company_names text[] := array[
    'אלפא מערכות', 'Blue Harbor Studio', 'נגב סולאר', 'Cedar Logistics',
    'מאפיית השוק', 'Northwind Apps', 'כרמל נדל"ן', 'Pixel & Co',
    'גלבוע תיירות', 'Brightpath Education', 'יעלים קפה', 'Orion Fitness'
  ];
  industries text[] := array[
    'Software', 'Design', 'Energy', 'Logistics', 'Food', 'Software',
    'Real estate', 'Marketing', 'Tourism', 'Education', 'Food', 'Fitness'
  ];
  first_he text[] := array['נועה','יוסי','מיכל','אבי','שירה','דניאל','תמר','איתי','רוני','עומר'];
  last_he  text[] := array['כהן','לוי','מזרחי','פרץ','ביטון','אברהם','פרידמן','שפירא','גולן','אזולאי'];
  first_en text[] := array['Emma','Liam','Olivia','Noah','Ava','Ethan','Mia','Lucas','Sophia','Mason'];
  last_en  text[] := array['Smith','Johnson','Brown','Miller','Davis','Wilson','Taylor','Clark','Lewis','Walker'];
  positions_ text[] := array['CEO','Marketing Manager','מנהלת תפעול','Founder','סמנכ"ל כספים','Office Manager','Head of Sales','בעלים'];
  -- lead-source mix, repeated every 20 contacts: website brings the most leads, referrals fewer
  sources public.contact_source[] := array[
    'website','ads','referral','website','social','ads','website','cold','referral','website',
    'event','ads','social','website','referral','cold','website','ads','social','other'
  ]::public.contact_source[];
  deal_templates text[] := array[
    'אתר תדמית חדש', 'Website redesign', 'קמפיין ממומן', 'Annual support plan',
    'חנות אונליין', 'Mobile app MVP', 'ייעוץ שיווקי', 'SEO package',
    'מיתוג ולוגו', 'CRM integration', 'דף נחיתה', 'Analytics dashboard'
  ];
  task_titles text[] := array[
    'להתקשר ולתאם פגישה', 'Send proposal', 'לשלוח הצעת מחיר מעודכנת', 'Follow up on invoice',
    'Prepare demo', 'לבדוק משוב על הסקיצות', 'Renewal call', 'לשלוח חוזה לחתימה'
  ];
  activity_bodies text[] := array[
    'שיחה ראשונה — מתעניינים בחבילה המלאה',
    'Intro call, budget confirmed',
    'נשלחה הצעת מחיר במייל',
    'Meeting at their office, met the team',
    'ביקשו הנחה של 10%',
    'Sent case studies and references',
    'אישרו את לוח הזמנים',
    'Asked for a revised scope'
  ];

  open_stages uuid[];   -- lead, qualified, proposal, negotiation (by position)
  won_stage   uuid;
  lost_stage  uuid;

  company_ids uuid[] := '{}';
  contact_ids uuid[] := '{}';
  contact_company uuid[] := '{}';
  contact_created timestamptz[] := '{}';
  contact_source public.contact_source[] := '{}';
  v_source     public.contact_source;
  v_win_rate   numeric;   -- chance a closed deal is won, by lead source
  v_pace       int;       -- max days per stage step, by lead source
  path_times   timestamptz[];
  src_n        jsonb := '{}';   -- deals generated so far per source
  v_n          int;
  deal_ids uuid[] := '{}';

  v_id         uuid;
  v_company    uuid;
  v_contact    uuid;
  v_created    timestamptz;
  v_t          timestamptz;
  v_steps      int;
  v_outcome    text;
  v_final      uuid;
  v_closed     timestamptz;
  v_idx        int;
  i            int;
  k            int;
begin
  perform setseed(0.42);

  -- reset this user's data (stage history cascades with deals)
  delete from activities where owner_id = p_owner;
  delete from tasks      where owner_id = p_owner;
  delete from deals      where owner_id = p_owner;
  delete from contacts   where owner_id = p_owner;
  delete from companies  where owner_id = p_owner;

  select array_agg(id order by position) into open_stages
    from pipeline_stages where owner_id = p_owner and kind = 'open';
  select id into won_stage  from pipeline_stages where owner_id = p_owner and kind = 'won'  order by position limit 1;
  select id into lost_stage from pipeline_stages where owner_id = p_owner and kind = 'lost' order by position limit 1;

  if coalesce(array_length(open_stages, 1), 0) = 0 or won_stage is null or lost_stage is null then
    raise exception 'User % has no pipeline stages', p_owner;
  end if;

  -- companies --------------------------------------------------------------
  for i in 1 .. array_length(company_names, 1) loop
    v_created := now() - make_interval(days => 150 + (random() * 40)::int);
    insert into companies (owner_id, name, industry, website, phone, created_at, updated_at)
    values (
      p_owner, company_names[i], industries[i],
      'https://example.com/' || i,
      '05' || (2 + (random() * 7)::int) || '-' || lpad((random() * 9999999)::int::text, 7, '0'),
      v_created, v_created
    )
    returning id into v_id;
    company_ids := company_ids || v_id;
  end loop;

  -- contacts (half Hebrew, half English names) -----------------------------
  for i in 1 .. 40 loop
    v_company := case when random() < 0.8 then company_ids[1 + (random() * (array_length(company_ids, 1) - 1))::int] end;
    -- the business is growing: more new contacts in recent months than six months ago
    v_created := now() - make_interval(days => (175 * (1 - sqrt(random())))::int, hours => (random() * 23)::int);
    insert into contacts (owner_id, company_id, first_name, last_name, email, phone, position, status, source, tags, created_at, updated_at)
    values (
      p_owner,
      v_company,
      case when i % 2 = 0 then first_he[1 + (random() * 9)::int] else first_en[1 + (random() * 9)::int] end,
      case when i % 2 = 0 then last_he[1 + (random() * 9)::int]  else last_en[1 + (random() * 9)::int]  end,
      'contact' || i || '@example.com',
      '05' || (2 + (random() * 7)::int) || '-' || lpad((random() * 9999999)::int::text, 7, '0'),
      positions_[1 + (random() * 7)::int],
      (array['lead','lead','customer','customer','customer','inactive']::public.contact_status[])[1 + (random() * 5)::int],
      sources[1 + (i - 1) % array_length(sources, 1)],
      case when random() < 0.3 then array['vip'] when random() < 0.3 then array['newsletter'] else '{}' end,
      v_created, v_created
    )
    returning id, source into v_id, v_source;
    contact_ids := contact_ids || v_id;
    contact_company := contact_company || v_company;
    contact_created := contact_created || v_created;
    contact_source := contact_source || v_source;
  end loop;

  -- deals with a realistic stage path ---------------------------------------
  -- Built-in patterns for the analytics page (this is synthetic demo data):
  --   * referrals and events close more often and faster; ads and cold outreach least and slowest
  --   * "proposal" is the slow stage: clients take longest to decide on a quote
  -- Each deal is played forward from its start date: a step that would land in the
  -- future hasn't happened yet, so recent deals are still open and old ones are closed.
  for i in 1 .. 64 loop
    v_idx     := 1 + (i - 1) % array_length(contact_ids, 1);   -- every contact gets a deal, some get two
    v_contact := contact_ids[v_idx];
    v_company := contact_company[v_idx];
    v_source  := contact_source[v_idx];
    -- most deals start within a few weeks of meeting the contact
    v_created := least(contact_created[v_idx] + make_interval(days => (random() * 30)::int, hours => (random() * 23)::int),
                       now() - interval '1 day');

    v_win_rate := case v_source
                    when 'referral' then 0.75 when 'event' then 0.60 when 'website' then 0.50
                    when 'social' then 0.40 when 'ads' then 0.25 when 'cold' then 0.15 else 0.45 end;
    v_pace     := case v_source
                    when 'referral' then 6 when 'event' then 7 when 'website' then 9
                    when 'social' then 9 when 'ads' then 11 when 'cold' then 15 else 9 end;

    -- where the deal is headed: won deals go through every open stage, lost ones drop out anywhere
    -- spread wins evenly inside each source so the built-in rates survive a small sample
    v_n   := coalesce((src_n ->> v_source::text)::int, 0);
    src_n := src_n || jsonb_build_object(v_source::text, v_n + 1);
    if floor((v_n + 1) * v_win_rate + 0.5) > floor(v_n * v_win_rate + 0.5) then
      v_outcome := 'won';
      v_steps   := array_length(open_stages, 1);
    else
      v_outcome := 'lost';
      v_steps   := 1 + (random() * (array_length(open_stages, 1) - 1))::int;
    end if;
    -- a few deals simply stall and stay open (they show up as "past close date")
    if random() < 0.08 then
      v_outcome := 'stalled';
    end if;

    -- play the path forward; stop at the first step that would be in the future
    v_t := v_created;
    path_times := array[v_t];
    v_closed := null;
    for k in 1 .. v_steps loop
      -- time spent in stage k before the next move ("proposal" = position 3 is the slow one)
      v_t := v_t + make_interval(days => 1 + (random() * (v_pace - 1) * case k when 1 then 0.7 when 3 then 2.5 else 1 end)::int,
                                 hours => (random() * 8)::int);
      exit when v_t > now() - interval '1 hour';
      if k < v_steps then
        path_times := path_times || v_t;
      elsif v_outcome <> 'stalled' then
        v_closed := v_t;
      end if;
    end loop;
    v_steps := array_length(path_times, 1);   -- open stages actually reached
    if v_closed is null then
      v_outcome := 'open';
    end if;

    v_final := case v_outcome
                 when 'won'  then won_stage
                 when 'lost' then lost_stage
                 else open_stages[v_steps]
               end;
    v_t := path_times[v_steps];

    insert into deals (owner_id, title, amount, stage_id, contact_id, company_id, position,
                       expected_close_date, closed_at, created_at, updated_at)
    values (
      p_owner,
      deal_templates[1 + (random() * (array_length(deal_templates, 1) - 1))::int]
        || coalesce(' — ' || (select name from companies where id = v_company), ''),
      round((2000 + random() * 78000) / 500) * 500,
      v_final, v_contact, v_company, i * 1000,
      (v_created + make_interval(days => 20 + (random() * 40)::int))::date,
      v_closed, v_created, coalesce(v_closed, v_t)
    )
    returning id into v_id;
    deal_ids := deal_ids || v_id;

    -- replace the auto-logged single history row with the back-dated path
    delete from deal_stage_history where deal_id = v_id;
    for k in 1 .. v_steps loop
      insert into deal_stage_history (owner_id, deal_id, from_stage_id, to_stage_id, changed_at)
      values (p_owner, v_id, case when k > 1 then open_stages[k - 1] end, open_stages[k], path_times[k]);
    end loop;
    if v_closed is not null then
      insert into deal_stage_history (owner_id, deal_id, from_stage_id, to_stage_id, changed_at)
      values (p_owner, v_id, open_stages[v_steps], v_final, v_closed);
    end if;
  end loop;

  -- tasks: some overdue, some upcoming, some done ---------------------------
  for i in 1 .. 24 loop
    v_t := now() + make_interval(days => -10 + (random() * 24)::int, hours => (random() * 8)::int);
    insert into tasks (owner_id, title, priority, due_at, completed_at, deal_id, contact_id)
    values (
      p_owner,
      task_titles[1 + (random() * (array_length(task_titles, 1) - 1))::int],
      (array['low','medium','medium','high']::public.task_priority[])[1 + (random() * 3)::int],
      v_t,
      case when v_t < now() and random() < 0.6 then v_t - interval '2 hours' end,
      case when i % 3 <> 0 then deal_ids[1 + (random() * (array_length(deal_ids, 1) - 1))::int] end,
      case when i % 3 = 0  then contact_ids[1 + (random() * (array_length(contact_ids, 1) - 1))::int] end
    );
  end loop;

  -- activities on deals ----------------------------------------------------
  for i in 1 .. array_length(deal_ids, 1) loop
    for k in 1 .. 1 + (random() * 2)::int loop
      select created_at into v_created from deals where id = deal_ids[i];
      insert into activities (owner_id, type, body, deal_id, contact_id, occurred_at, created_at)
      select
        p_owner,
        (array['note','call','email','meeting']::public.activity_type[])[1 + (random() * 3)::int],
        activity_bodies[1 + (random() * (array_length(activity_bodies, 1) - 1))::int],
        d.id, d.contact_id,
        least(now(), v_created + make_interval(days => k * (1 + (random() * 5)::int))),
        now()
      from deals d where d.id = deal_ids[i];
    end loop;
  end loop;
end;
$$;

revoke all on function public.seed_demo_data(uuid) from public, anon, authenticated;
