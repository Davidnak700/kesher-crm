# 2. Which lead sources bring the best clients?

## Why ask
Marketing money and time are limited. "Where do our leads come from" is only half the question; what matters is which sources turn into **revenue**, how **fast**, and at what **win rate**.

## Metrics

| Metric | Definition |
|---|---|
| Source | `contacts.source`, how the contact found the business (website, referral, social, ads, event, cold outreach, other). A deal takes its contact's source. |
| Win rate | won ÷ (won + lost). Open deals are left out until they close. |
| Won revenue | Sum of `amount` on won deals. |
| Revenue per deal started | Won revenue ÷ all deals from the source, open ones included. This is the figure to set against what a source costs. |
| Days to win | Median days from creation to *Won*. |

Rule: no conclusion about a source with fewer than 5 closed deals. It still appears in the table, marked.

## SQL
[`sql/02_lead_sources.sql`](sql/02_lead_sources.sql), built on the `source_performance` view in [`supabase/migrations/20261025000300_analytics.sql`](../supabase/migrations/20261025000300_analytics.sql) (conditional aggregation with `count(*) filter (where …)` and `percentile_cont`).

## Findings (demo account)

| Source | Deals | Share | Win rate | Won revenue | Revenue per deal | Days to win |
|---|---|---|---|---|---|---|
| Website | 20 | 31% | 44% (7 of 16) | ₪274,500 | ₪13,725 | 23.7 |
| Referral | 10 | 16% | **83% (5 of 6)** | ₪231,000 | **₪23,100** | **14.7** |
| Social media | 9 | 14% | 40% (2 of 5) | ₪102,500 | ₪11,389 | 18.6 |
| Ads | 13 | 20% | **13% (1 of 8)** | ₪78,000 | **₪6,000** | 40.8 |
| *Event* | 3 | 5% | *2 of 2* | ₪72,000 | ₪24,000 | 15.6 |
| *Cold outreach* | 6 | 9% | *1 of 3* | ₪19,000 | ₪3,167 | 31.8 |
| *Other* | 3 | 5% | *0 of 2* | ₪0 | ₪0 | — |

*Italic: fewer than 5 closed deals, so no conclusion.*

1. **Referrals are the best clients**: 83% win rate and the fastest close (15 days), and each referral deal brings almost 4× the revenue of an ads deal (₪23,100 vs ₪6,000).
2. **The website brings the most business**: the largest share of deals (31%) and the most won revenue, with an average win rate. It's the volume channel.
3. **Ads underperform**: a fifth of all deals, but 7 of 8 closed ones were lost, and the one win took 41 days. Ads bring leads that look busy but rarely buy.
4. **Events look promising but aren't proven**: 2 of 2 won is too small a sample to act on.

## Recommendations
- **Ask for referrals on purpose**: a "who else should we talk to?" step after every won deal, maybe a small thank-you. It is the cheapest and best-converting source.
- **Check ad spend against ₪6,000 per deal started**: if a deal costs more than a fraction of that to acquire through ads, move budget to the website (₪13,725 per deal).
- **Keep tracking events**: after 5 closed event deals, the number becomes worth acting on.
- **Make "source" required** on new contacts, so this analysis keeps working.

## Limits
- Demo data is synthetic, with these patterns built in (see the migration). The method is the point, not the numbers.
- There is no cost data in the CRM, so this measures revenue per source, not return on spend. Adding cost per source is the natural next step.
- Source is stored per contact. A contact found through an ad who was also referred is counted once, under the source someone typed in.
- Correlation, not cause: referral clients may convert better because they already trust the business, not because the channel itself is better. A real test would be to change one channel and watch the numbers.
