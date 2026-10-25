# Kesher (קשר) CRM

A bilingual (Hebrew / English) CRM for small businesses: contacts, a kanban sales pipeline, tasks and a KPI dashboard.
Built as a portfolio project with Next.js 16 and Supabase.

**Live demo: https://kesher-crm-rose.vercel.app** — press *Open the demo account* (or *כניסה לחשבון הדגמה*); no sign-up needed.

![Dashboard in English](docs/screenshots/dashboard-en.jpg)

| Deals board, Hebrew (right-to-left) | Dashboard, Hebrew |
|---|---|
| ![Kanban deals board in Hebrew](docs/screenshots/deals-he.jpg) | ![Dashboard in Hebrew](docs/screenshots/dashboard-he.jpg) |

> **Status:** all six planned steps are done: database, sign-in, bilingual layout, contacts, deals board, contact page, tasks and dashboard.

## What works today

- **Dashboard** (home page): won revenue this month vs last month, open pipeline, probability-weighted forecast, win rate and average won deal over 6 months; a month-by-month revenue chart with hover details and a table view; a funnel showing how far deals get; and what needs attention today (overdue tasks, deals past their close date).
- **Hebrew and English** with a full right-to-left layout. Language lives in the URL (`/he/…`, `/en/…`), is detected from the browser on first visit and remembered.
- **Sign-in** with email and password, plus a one-click **demo account** (credentials stay on the server).
- **Contacts**: list with search (name, email, phone — in either language), status filter, pagination, create / edit / delete in a dialog, with validation messages in both languages.
- **Contact page**: details, the contact's deals, their tasks (tick off, add, delete) and an activity timeline that mixes logged notes, calls, emails and meetings with automatic entries for every move of their deals through the pipeline.
- **Tasks**: every open task grouped into Overdue, Today, Next 7 days, Later and No due date, linked to its contact and deal; tick off, add (optionally for a contact), delete; a Completed view.
- **Deals board (kanban)**: drag deals between stages with mouse, touch or keyboard. Each column shows its total and the stage's chance of closing; the header shows the pipeline value and the probability-weighted forecast. Moves appear instantly and roll back if the save fails. Won / Lost show the last 30 days. Screen reader announcements in both languages.
- **Security in the database**, not just the UI: Row Level Security on every table, composite foreign keys so no one can link to another user's records, owner set by the database from the session.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, Server Components, Server Actions, Cache Components), React 19, TypeScript |
| Styling | Tailwind CSS 4, logical properties (`ms-`, `text-start`) so one stylesheet serves RTL and LTR |
| Data & auth | Supabase (PostgreSQL 15+, Auth, RLS) via `@supabase/ssr` |
| Drag and drop | dnd-kit (mouse, touch and keyboard sensors) |
| Validation | Zod |
| Font | Rubik — one family that covers Hebrew and Latin |

## Project layout

```
supabase/
  migrations/        schema, RLS, triggers, dashboard views, demo data generator
  tests/             SQL tests: user isolation, composite keys, triggers, views
web/
  src/proxy.ts       language routing + session refresh + route protection
  src/i18n/          locales, dictionaries (he.json / en.json)
  src/lib/supabase/  server and proxy clients
  src/lib/data/      data access (runs as the signed-in user)
  src/app/[locale]/  pages: login, dashboard, contacts, contact page, deals, tasks
```

## Run it locally

1. **Supabase project.** Create one at supabase.com. In the SQL Editor run the two files in `supabase/migrations/` in order.
2. **Demo user.** Authentication → Users → Add user (e.g. `demo@yourdomain.com`, auto-confirm). Then in the SQL Editor:
   ```sql
   select public.seed_demo_data((select id from auth.users where email = 'demo@yourdomain.com'));
   ```
3. **Environment.** Copy `web/.env.example` to `web/.env.local` and fill in the project URL, publishable key and the demo credentials.
4. **Start.**
   ```bash
   cd web
   npm install
   npm run dev
   ```
   Open http://localhost:3000.

## Deploy

Import the repo into Vercel with **Root Directory = `web`**, add the same four environment variables, deploy. In Supabase → Authentication → URL Configuration add the Vercel URL as the Site URL.

## Design decisions worth reading

- `supabase/README.md` explains the schema and why the foreign keys are composite.
- `web/src/proxy.ts` — one place decides language and access before a page renders.
- `web/src/lib/supabase/server.ts` — why the Supabase client calls `connection()` under Cache Components.
- `web/src/app/[locale]/(app)/contacts/actions.ts` — Server Actions return error *codes*; the form translates them, so the server stays language-free.
- `web/src/app/[locale]/(app)/contacts/[id]/contact-detail-view.tsx` — the timeline is built on the server from two sources (logged activities and the stage-history table the database trigger fills), with every date formatted in Israel's time zone so the browser can't disagree.
- `web/src/lib/data/dashboard.ts` — every dashboard number comes from a database view, so "open", "won" and "forecast" mean the same thing on the board, the contact page and the dashboard.
- `web/src/lib/time.ts` — "today" and "overdue" are decided in Israel's time zone, including the summer-time switch.
- `web/src/app/[locale]/(app)/deals/deals-board.tsx` — optimistic drag and drop: a moved card gets a position halfway between its neighbours, so one row is written per move; the database trigger logs the stage change and stamps the close date.

## Roadmap

1. ~~Database schema, RLS, demo data~~
2. ~~Bilingual app shell, sign-in, contacts~~
3. ~~Deals kanban with drag and drop (dnd-kit), stage history~~
4. ~~Contact page with timeline (activities, tasks)~~
5. ~~Tasks list with due dates~~
6. ~~Dashboard: pipeline value, weighted forecast, win rate, funnel~~
