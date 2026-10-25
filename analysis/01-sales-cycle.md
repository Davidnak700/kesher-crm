# 1. How long does a sale take, and where does it stall?

## Why ask
A small business plans cash flow around "when will this deal turn into money". If we know the typical length of a sale and the stage where deals wait longest, we know what to forecast and what to speed up.

## Metrics

| Metric | Definition |
|---|---|
| Sale length | Days from the moment a deal was created to the moment it moved to *Won* or *Lost* (`deals.closed_at − deals.created_at`). Only closed deals count. |
| Typical length | The **median**, not the average. A few deals that drag on for months would pull an average up; the median is the deal in the middle. The **p25–p75** range shows where the middle half of deals fall. |
| Time in stage | From entering a stage to the next move, taken from `deal_stage_history`, which a database trigger writes on every move. A deal still sitting in a stage isn't counted until it moves on. |
| Where deals are lost | For each lost deal, the last open stage before it moved to *Lost*. |

Rule: no conclusion from fewer than 5 deals.

## SQL
[`sql/01_sales_cycle.sql`](sql/01_sales_cycle.sql). The views live in [`supabase/migrations/20261025000300_analytics.sql`](../supabase/migrations/20261025000300_analytics.sql).

The key step is the window function that turns a log of moves into stays:

```sql
select
  h.to_stage_id as stage_id,
  h.changed_at  as entered_at,
  lead(h.changed_at) over (partition by h.deal_id order by h.changed_at, h.id) as left_at
from deal_stage_history h
```

`LEAD` looks at the deal's next move, so `left_at − entered_at` is the time spent in that stage.

## Findings (demo account)

| | Deals | Median | Middle half (p25–p75) |
|---|---|---|---|
| Won | 18 | **19.2 days** | 16.1 – 23.7 days |
| Lost | 24 | **8.9 days** | 7.4 – 12.2 days |

| Stage | Moves out | Average days | Median days |
|---|---|---|---|
| Lead | 52 | 4.2 | 4.2 |
| Qualified | 41 | 5.6 | 6.1 |
| **Proposal** | 25 | **8.0** | 7.1 |
| Negotiation | 20 | 4.9 | 4.1 |

Lost deals by the last stage they reached: Lead 7, Qualified 12, Proposal 3, Negotiation 2.

1. **A won deal takes about three weeks** (median 19 days); most fall between 16 and 24 days. That is the gap to plan cash flow around.
2. **Proposal is the bottleneck.** Deals wait 8.0 days there on average, about 1.6× the other stages. A proposal is where the client has to decide, and nothing on our side pushes them to.
3. **Losses happen early.** 19 of 24 lost deals (79%) dropped out at Lead or Qualified, after about 9 days. Few deals are lost after a proposal is sent, so time spent qualifying is time well spent.

## Recommendations
- **Put a follow-up on every proposal**: an automatic task 3 days after a deal enters *Proposal*. If the wait drops from 8 days toward the 5-day average of the other stages, a typical sale gets about 3 days shorter.
- **Qualify faster, not harder**: most losses are decided at Qualified, so a short checklist (budget, decision-maker, timing) on the first call saves days on deals that won't close.
- **Forecast with the distribution, not one number**: a deal opened today most likely closes in 16–24 days, if it closes.

## Limits
- Demo data is synthetic. The patterns were built into the generator on purpose (see the migration), so the method is what this shows, not a real business's results.
- Open deals are left out of sale length. Deals that are still open now are probably the slower ones, so the true typical length is likely a bit longer (right-censoring). With real data, a survival curve (Kaplan–Meier) would handle this properly.
- Averages per stage hide variation, so the median is shown next to each one.
