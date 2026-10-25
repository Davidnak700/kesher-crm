-- =============================================================================
-- Nightly reset of the public demo account
--
-- The demo account is shared by every visitor, so anyone can delete contacts
-- or drag every deal to "Lost". Every night pg_cron rebuilds the account from
-- scratch with seed_demo_data(). Dates are relative to the run time, so the
-- demo always shows the last six months.
--
-- Change the email below if your demo user has a different one.
-- Runs at 01:00 UTC (03:00–04:00 in Israel).
-- =============================================================================

create extension if not exists pg_cron;

-- cron.schedule() with an existing name replaces that job, so this is safe to re-run.
select cron.schedule(
  'reset-demo-data',
  '0 1 * * *',
  $$ select public.seed_demo_data(
       (select id from auth.users where email = 'demo@example.com')
     ) $$
);
