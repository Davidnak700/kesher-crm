-- Q1. How long does a sale take, and where does it stall?
-- Runs as the signed-in user (views are security_invoker, so RLS applies).

-- 1a. Sale length, won vs lost: median and middle half (p25–p75)
select outcome, deals, median_days, p25_days, p75_days, avg_days
from sales_cycle_summary
order by outcome desc;

-- 1b. Time in each stage. The view uses a window function:
--     LEAD(changed_at) OVER (PARTITION BY deal_id ORDER BY changed_at)
--     = when the deal left the stage it just entered.
select key as stage, stays, avg_days, median_days
from stage_durations
order by position;

-- 1c. Where lost deals drop out: the last open stage before "Lost"
select s.key as last_open_stage, count(*) as lost_deals
from deals d
join pipeline_stages lost on lost.id = d.stage_id and lost.kind = 'lost'
join lateral (
  select from_stage_id
  from deal_stage_history h
  where h.deal_id = d.id
  order by changed_at desc, id desc
  limit 1
) last_move on true
join pipeline_stages s on s.id = last_move.from_stage_id
group by s.key, s.position
order by s.position;
