# Analysis

Business questions answered from the CRM's own data. Each one follows the same steps:

**question → metric definition → SQL → finding → recommendation → limits**

| # | Question | Main finding (demo account) |
|---|---|---|
| 1 | [How long does a sale take, and where does it stall?](01-sales-cycle.md) | A won deal takes about 19 days. Deals wait longest at *Proposal*, and most lost deals are lost early. |
| 2 | [Which lead sources bring the best clients?](02-lead-sources.md) | Referrals win 83% of the time and fastest. The website brings the most revenue. Ads convert worst. |

The same numbers are live in the app on the **Analytics** page (`/en/analytics`, `/he/analytics`), which writes the findings as sentences from the current data and holds back any conclusion based on fewer than 5 deals.

## How to run the queries
The SQL in [`sql/`](sql/) runs in the Supabase SQL Editor or `psql`. It reads the analytics views (`sales_cycle_summary`, `stage_durations`, `source_performance`, `closed_deals`), which use `security_invoker`, so each user only ever sees their own deals.

The analysis also uses these SQL techniques:
- window functions (`LEAD … OVER (PARTITION BY …)`)
- `percentile_cont` for medians
- conditional aggregation (`count(*) filter (where …)`)
- `LATERAL` joins

## About the data
The demo account is filled by `seed_demo_data()`: 40 contacts and 64 deals over six months. The data is synthetic, and the generator has some patterns built in on purpose, so the analysis has something real to find:
- referrals convert better than ads;
- proposals are the slow stage;
- the business is growing.

The generator also keeps every timeline consistent: no deal starts before its contact, nothing happens in the future, and closed deals passed through their stages in order. `supabase/tests/analytics_test.sql` checks this.

Numbers are from the demo account as of October 2026. The generator is deterministic and dates are relative to the day it runs, so the demo shows the same figures after every nightly reset.
