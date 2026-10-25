# Kesher (קשר) CRM

A bilingual (Hebrew / English) CRM for small businesses: contacts, a kanban sales pipeline, tasks and a KPI dashboard.
Built as a portfolio project with Next.js 16 and Supabase.

> **Status:** step 2 of the plan. Database, sign-in, bilingual layout and contacts are done; deals board, tasks and dashboard are next.

## What works today

- **Hebrew and English** with a full right-to-left layout. Language lives in the URL (`/he/…`, `/en/…`), is detected from the browser on first visit and remembered.
- **Sign-in** with email and password, plus a one-click **demo account** (credentials stay on the server).
- **Contacts**: list with search (name, email, phone — in either language), status filter, pagination, create / edit / delete in a dialog, with validation messages in both languages.
- **Security in the database**, not just the UI: Row Level Security on every table, composite foreign keys so no one can link to another user's records, owner set by the database from the session.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, Server Components, Server Actions, Cache Components), React 19, TypeScript |
| Styling | Tailwind CSS 4, logical properties (`ms-`, `text-start`) so one stylesheet serves RTL and LTR |
| Data & auth | Supabase (PostgreSQL 15+, Auth, RLS) via `@supabase/ssr` |
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
  src/app/[locale]/  pages: login, contacts, (dashboard, deals, tasks — next)
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

## Roadmap

1. ~~Database schema, RLS, demo data~~
2. ~~Bilingual app shell, sign-in, contacts~~
3. Deals kanban with drag and drop (dnd-kit), stage history
4. Contact page with timeline (activities, tasks)
5. Tasks list with due dates
6. Dashboard: pipeline value, weighted forecast, win rate, funnel
