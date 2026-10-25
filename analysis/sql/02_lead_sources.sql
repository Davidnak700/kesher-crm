-- Q2. Which lead sources bring the best clients?

-- 2a. Volume, win rate, revenue and speed per source
select source, deals, won, lost, open, win_rate_pct, won_amount, avg_won_amount, median_days_to_win
from source_performance
order by won_amount desc;

-- 2b. Revenue per deal started (open deals included), and each source's share of all deals.
--     This is the number to compare against what a source costs (ads spend, event tickets).
select
  source,
  deals,
  round(100.0 * deals / sum(deals) over (), 0) as share_of_deals_pct,
  round(won_amount / deals)                    as revenue_per_deal
from source_performance
order by revenue_per_deal desc;

-- 2c. Small-sample guard: sources with fewer than 5 closed deals get no conclusion
select source, won + lost as closed, (won + lost) >= 5 as enough_to_conclude
from source_performance
order by closed desc;
