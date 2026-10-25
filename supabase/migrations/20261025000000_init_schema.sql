-- =============================================================================
-- CRM — initial schema
-- Target: Supabase (PostgreSQL 15+)
--
-- Model: every row belongs to one user (owner_id = auth.uid()).
-- Row Level Security guarantees that a user only ever sees and changes
-- their own data, and composite foreign keys (id, owner_id) guarantee that a
-- user cannot link their deal to somebody else's contact by guessing an id.
-- =============================================================================

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.app_locale      as enum ('he', 'en');
create type public.contact_status  as enum ('lead', 'customer', 'inactive');
create type public.contact_source  as enum ('website', 'referral', 'social', 'ads', 'event', 'cold', 'other');
create type public.stage_kind      as enum ('open', 'won', 'lost');
create type public.task_priority   as enum ('low', 'medium', 'high');
create type public.activity_type   as enum ('note', 'call', 'email', 'meeting');

-- -----------------------------------------------------------------------------
-- Helper: keep updated_at fresh
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles — one row per auth user (UI language, currency)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  locale      public.app_locale not null default 'he',
  currency    char(3)           not null default 'ILS',
  created_at  timestamptz       not null default now(),
  updated_at  timestamptz       not null default now()
);

-- -----------------------------------------------------------------------------
-- companies
-- -----------------------------------------------------------------------------
create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  website     text,
  industry    text,
  phone       text,
  address     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, owner_id)
);

-- -----------------------------------------------------------------------------
-- contacts
-- -----------------------------------------------------------------------------
create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id  uuid,
  first_name  text not null check (length(trim(first_name)) > 0),
  last_name   text,
  email       text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text,
  position    text,
  status      public.contact_status not null default 'lead',
  source      public.contact_source,
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (company_id, owner_id)
    references public.companies (id, owner_id)
    on delete set null (company_id)
);

-- -----------------------------------------------------------------------------
-- pipeline_stages — the kanban columns, customisable per user.
-- Default stages carry a `key` that the UI translates (he / en);
-- stages the user creates carry their own `name`.
-- -----------------------------------------------------------------------------
create table public.pipeline_stages (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key          text,
  name         text,
  position     int  not null,
  kind         public.stage_kind not null default 'open',
  probability  int  not null default 0 check (probability between 0 and 100),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, owner_id),
  unique (owner_id, key),
  check (key is not null or length(trim(name)) > 0)
);

-- -----------------------------------------------------------------------------
-- deals — the cards on the kanban board
-- -----------------------------------------------------------------------------
create table public.deals (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title                text not null check (length(trim(title)) > 0),
  amount               numeric(12, 2) not null default 0 check (amount >= 0),
  currency             char(3) not null default 'ILS',
  stage_id             uuid not null,
  contact_id           uuid,
  company_id           uuid,
  position             double precision not null default 0,  -- order inside a kanban column
  expected_close_date  date,
  closed_at            timestamptz,                           -- set automatically on won/lost
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (stage_id, owner_id)
    references public.pipeline_stages (id, owner_id)
    on delete restrict,
  foreign key (contact_id, owner_id)
    references public.contacts (id, owner_id)
    on delete set null (contact_id),
  foreign key (company_id, owner_id)
    references public.companies (id, owner_id)
    on delete set null (company_id)
);

-- -----------------------------------------------------------------------------
-- deal_stage_history — every move on the board; powers conversion analytics
-- -----------------------------------------------------------------------------
create table public.deal_stage_history (
  id             bigint generated always as identity primary key,
  owner_id       uuid not null references auth.users (id) on delete cascade,
  deal_id        uuid not null,
  from_stage_id  uuid,
  to_stage_id    uuid not null,
  changed_at     timestamptz not null default now(),
  foreign key (deal_id, owner_id)
    references public.deals (id, owner_id)
    on delete cascade
);

-- -----------------------------------------------------------------------------
-- tasks
-- -----------------------------------------------------------------------------
create table public.tasks (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null check (length(trim(title)) > 0),
  description   text,
  priority      public.task_priority not null default 'medium',
  due_at        timestamptz,
  completed_at  timestamptz,
  contact_id    uuid,
  deal_id       uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (contact_id, owner_id)
    references public.contacts (id, owner_id)
    on delete set null (contact_id),
  foreign key (deal_id, owner_id)
    references public.deals (id, owner_id)
    on delete set null (deal_id)
);

-- -----------------------------------------------------------------------------
-- activities — timeline on the contact / deal card (notes, calls, emails, meetings)
-- -----------------------------------------------------------------------------
create table public.activities (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type         public.activity_type not null default 'note',
  body         text not null check (length(trim(body)) > 0),
  contact_id   uuid,
  deal_id      uuid,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  check (contact_id is not null or deal_id is not null),
  foreign key (contact_id, owner_id)
    references public.contacts (id, owner_id)
    on delete cascade,
  foreign key (deal_id, owner_id)
    references public.deals (id, owner_id)
    on delete cascade
);

-- -----------------------------------------------------------------------------
-- Indexes (foreign keys + the queries the UI actually runs)
-- -----------------------------------------------------------------------------
create index on public.companies (owner_id, name);
create index on public.contacts  (owner_id, created_at desc);
create index on public.contacts  (company_id);
create index on public.contacts  using gin (tags);
create index on public.pipeline_stages (owner_id, position);
create index on public.deals     (owner_id, stage_id, position);
create index on public.deals     (contact_id);
create index on public.deals     (company_id);
create index on public.deal_stage_history (deal_id, changed_at);
create index on public.deal_stage_history (owner_id, changed_at);
create index on public.tasks     (owner_id, completed_at, due_at);
create index on public.tasks     (contact_id);
create index on public.tasks     (deal_id);
create index on public.activities (contact_id, occurred_at desc);
create index on public.activities (deal_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.profiles        for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.companies       for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.contacts        for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.pipeline_stages for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.deals           for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tasks           for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Deals: log stage changes and stamp closed_at on won / lost
-- -----------------------------------------------------------------------------
create or replace function public.handle_deal_stage()
returns trigger
language plpgsql
as $$
declare
  v_kind public.stage_kind;
begin
  if tg_op = 'UPDATE' and new.stage_id is not distinct from old.stage_id then
    return new;
  end if;

  select kind into v_kind from public.pipeline_stages where id = new.stage_id;

  if v_kind in ('won', 'lost') then
    new.closed_at := coalesce(new.closed_at, now());
  else
    new.closed_at := null;  -- reopened
  end if;

  return new;
end;
$$;

create or replace function public.log_deal_stage()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    insert into public.deal_stage_history (owner_id, deal_id, from_stage_id, to_stage_id)
    values (new.owner_id, new.id, case when tg_op = 'UPDATE' then old.stage_id end, new.stage_id);
  end if;
  return null;
end;
$$;

create trigger handle_deal_stage
  before insert or update of stage_id on public.deals
  for each row execute function public.handle_deal_stage();

create trigger log_deal_stage
  after insert or update of stage_id on public.deals
  for each row execute function public.log_deal_stage();

-- -----------------------------------------------------------------------------
-- New user → profile + default pipeline
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale public.app_locale;
begin
  v_locale := case when new.raw_user_meta_data ->> 'locale' = 'en' then 'en' else 'he' end;

  insert into public.profiles (id, full_name, locale)
  values (new.id, new.raw_user_meta_data ->> 'full_name', v_locale);

  insert into public.pipeline_stages (owner_id, key, position, kind, probability) values
    (new.id, 'lead',        1, 'open',  10),
    (new.id, 'qualified',   2, 'open',  25),
    (new.id, 'proposal',    3, 'open',  50),
    (new.id, 'negotiation', 4, 'open',  75),
    (new.id, 'won',         5, 'won',  100),
    (new.id, 'lost',        6, 'lost',   0);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.companies          enable row level security;
alter table public.contacts           enable row level security;
alter table public.pipeline_stages    enable row level security;
alter table public.deals              enable row level security;
alter table public.deal_stage_history enable row level security;
alter table public.tasks              enable row level security;
alter table public.activities         enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "own rows" on public.companies       for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "own rows" on public.contacts        for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "own rows" on public.pipeline_stages for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "own rows" on public.deals           for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "own rows" on public.tasks           for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "own rows" on public.activities      for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- History is written only by the trigger; users may read it, never edit it.
create policy "read own history" on public.deal_stage_history
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "trigger writes own history" on public.deal_stage_history
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

revoke update, delete on public.deal_stage_history from authenticated, anon;

-- -----------------------------------------------------------------------------
-- Dashboard views (security_invoker → they respect RLS of the caller)
-- -----------------------------------------------------------------------------

-- Board summary per stage: count, total, probability-weighted forecast
create view public.pipeline_summary
with (security_invoker = true) as
select
  s.id                                          as stage_id,
  s.key,
  s.name,
  s.position,
  s.kind,
  s.probability,
  count(d.id)                                   as deals_count,
  coalesce(sum(d.amount), 0)                    as total_amount,
  coalesce(sum(d.amount * s.probability / 100.0), 0)::numeric(14, 2) as weighted_amount
from public.pipeline_stages s
left join public.deals d on d.stage_id = s.id
group by s.id;

-- Monthly results: won revenue, won / lost counts, win rate, average deal size
create view public.monthly_sales
with (security_invoker = true) as
select
  date_trunc('month', d.closed_at)::date                                   as month,
  count(*) filter (where s.kind = 'won')                                    as won_count,
  count(*) filter (where s.kind = 'lost')                                   as lost_count,
  coalesce(sum(d.amount) filter (where s.kind = 'won'), 0)                  as won_amount,
  round(avg(d.amount) filter (where s.kind = 'won'), 2)                     as avg_won_amount,
  round(100.0 * count(*) filter (where s.kind = 'won') / nullif(count(*), 0), 1) as win_rate_pct
from public.deals d
join public.pipeline_stages s on s.id = d.stage_id
where d.closed_at is not null
  and s.kind in ('won', 'lost')
group by 1;

-- Funnel: how many deals got at least as far as each stage.
-- A deal dragged straight from "lead" to "proposal" still counts as having
-- passed "qualified", so we use the furthest position each deal reached.
create view public.funnel
with (security_invoker = true) as
with reached as (
  select h.deal_id, max(s.position) as max_position
  from public.deal_stage_history h
  join public.pipeline_stages s on s.id = h.to_stage_id
  where s.kind <> 'lost'
  group by h.deal_id
)
select
  s.id        as stage_id,
  s.key,
  s.name,
  s.position,
  count(r.deal_id) as deals_reached
from public.pipeline_stages s
left join reached r on r.max_position >= s.position
where s.kind <> 'lost'
group by s.id;

grant select on public.pipeline_summary, public.monthly_sales, public.funnel to authenticated;
