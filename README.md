# Farming Tracker

A personal airdrop farming tracker and reminder system. Tracks weekly manual
activity across a few DeFi protocols, logs gas costs, polls points balances, and
emails a reminder when a protocol has gone quiet for too long.

This is **not** a trading bot. All transactions are executed manually by you, in
your own wallet app. The backend only reads public chain/API data and manages a
checklist + activity log — it never signs or broadcasts anything.

Live at **https://farming-tracker.vercel.app**.

## Features

- **Weekly checklist** — auto-generates a task list per active protocol every
  week, checked off manually as you complete each action.
- **Activity log** — a manual record of every action you take (swap, bridge, LP,
  lend, borrow, mint, trade), with tx hash, chain, and gas cost.
- **Gas cost auto-detect** — leave the gas field blank on an EVM activity and the
  backend looks up the real cost via Alchemy + a live ETH price from DeFiLlama.
  Falls back to a blank value (never an error) if either lookup fails; an
  explicit manual value always wins.
- **Paradex XP polling** — points + leaderboard rank synced every 6 hours,
  recorded as a time series (not overwritten) so you can track progress.
- **Weekly reminder email** — sent via Resend if any wallet/protocol pair has
  had zero logged activity for 5+ days.
- **Dashboard** — gas spent per protocol, action counts, recent activity, and the
  current week's checklist, all in one view.

## Stack

- **Backend** — Fastify 5, TypeScript, Drizzle ORM, `postgres` (postgres.js)
- **Frontend** — React 18, Vite, TanStack Query, Recharts
- **Database** — Supabase (Postgres)
- **Email** — Resend
- **Scheduling** — GitHub Actions cron, hitting protected `POST /api/cron/*`
  routes (see [Deployment](#deployment) below) — no in-process scheduler
- **Deployment** — Vercel, one project serving both the static frontend and the
  backend as a serverless function
- **External reads** — Alchemy (EVM tx/gas lookups), Paradex's public REST API,
  DeFiLlama (ETH price)

## Project structure

```
api/index.ts       Vercel serverless function — wraps the Fastify app for deploy
backend/
  src/
    db/            Drizzle schema, DB client, seed script
    routes/        Fastify routes — activities, tasks, cron
    services/      Alchemy, Paradex, DeFiLlama, Resend integrations
    cron/          Weekly reminder + Paradex sync job logic (see Deployment)
    app.ts         Fastify app factory (routes + plugins, no listen) — reused
                    by both the local dev entrypoint and the Vercel function
    index.ts       Local dev entrypoint — builds the app and listens
  drizzle/         Generated SQL migrations
frontend/
  src/
    pages/         Dashboard
    api/           Backend API client
.github/workflows/cron.yml   Scheduled triggers for the cron routes
docs/farming-tracker/        Build log — plan, worklog, and open assumptions
```

Root is an npm workspace (`package.json` → `workspaces: [backend, frontend]`) so
`api/index.ts` can import `backend/src/app.js` directly, and so Vercel's build
can install both packages' dependencies in one pass.

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (or any Postgres instance)
- Optional for full functionality: a [Resend](https://resend.com) API key, an
  [Alchemy](https://alchemy.com) API key

### 1. Install dependencies

```bash
npm install   # from the repo root — this is an npm workspace
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. On Supabase, use the direct/session-mode connection (port 5432) — this is a long-running server, not serverless functions. |
| `PORT` | No | Defaults to `3001`. Only used by the local dev entrypoint; irrelevant on Vercel. |
| `FARMING_WALLETS` | Yes, for seeding | Comma-separated wallet address(es) to seed. |
| `RESEND_API_KEY` / `RESEND_FROM` / `RESEND_TO` | Only for live reminder emails | Safe to leave as placeholders otherwise. |
| `ALCHEMY_API_KEY` / `ALCHEMY_RPC_URL` | Only for gas auto-detect | Auto-detect fails gracefully (saves with no gas value) if unset or invalid. |
| `CRON_SECRET` | Yes, to trigger `/api/cron/*` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Must match what's set in Vercel and in the GitHub Actions repo secrets. |

### 3. Run migrations and seed data

```bash
cd backend
npm run db:generate   # only needed after changing schema.ts
npm run db:migrate
npm run db:seed        # inserts the 4 tracked protocols + your wallet(s)
```

### 4. Run it

```bash
# terminal 1
cd backend && npm run dev     # http://localhost:3001

# terminal 2
cd frontend && npm run dev    # http://localhost:5173
```

## API

All routes are prefixed with `/api`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/activities` | Last 100 logged activities, joined with wallet/protocol names. |
| `POST` | `/activities` | Log a new activity. Auto-detects gas cost if `gasUsd` is omitted and `chain` is `"ethereum"`. |
| `GET` | `/activities/summary` | Gas spent + action counts, grouped by protocol. |
| `GET` | `/tasks` | This week's checklist — auto-generates it on first request of the week. |
| `PATCH` | `/tasks/:id/complete` | Mark a task done. |
| `POST` | `/cron/weekly-reminder` | Triggers the reminder email job. Requires `Authorization: Bearer $CRON_SECRET`; returns 401 without it, 500 if the job itself fails. Called by GitHub Actions, not meant for browser/dashboard use. |
| `POST` | `/cron/paradex-sync` | Triggers a Paradex XP poll. Same auth requirement as above. |

`GET /health` (unprefixed) returns a basic liveness check.

## Testing

```bash
cd backend && npm test
```

27 Vitest tests cover every route and background service, run against a real
database (no mocking of Drizzle/Postgres — only third-party APIs like
Alchemy/DeFiLlama/Paradex/Resend are mocked). Test files run sequentially
(`vitest.config.ts`) since they share one live database with no per-test
transaction isolation.

## Security notes

- **Wallet addresses are public data** and the only wallet-identifying field
  ever stored — the `wallets` table has no column for private keys, seed
  phrases, or any signing credential, and no code in this repo writes one.
- **All chain reads are read-only.** Nothing in the backend can sign or submit a
  transaction; every activity is a manual, after-the-fact log entry.
- **No authentication exists on the data routes** (`/activities`, `/tasks`).
  This is intentional for a single-user tool, but it *is* now deployed on a
  public URL — that tradeoff is a live decision, not just a local-dev one.
- **The `/cron/*` routes are gated by a shared secret**, checked against an
  `Authorization: Bearer` header, so an arbitrary internet request can't
  trigger a real email send or burn third-party API calls.

## Deployment

Deployed on Vercel as a single project: the frontend builds as a static site,
and `api/index.ts` wraps the Fastify app (via `backend/src/app.ts`'s
`buildApp()`) as one serverless function handling all `/api/*` requests —
`vercel.json` rewrites `/api/(.*)` to it so Fastify sees the real request path
and does its own internal routing.

There is deliberately **no in-process scheduler**. `node-cron` needs a
long-running process, which serverless functions don't provide. Instead,
`.github/workflows/cron.yml` runs on GitHub's schedule (Monday 1am UTC for the
reminder, every 6 hours for the Paradex sync) and calls the protected
`POST /api/cron/*` routes over HTTP — a normal short-lived request, which is
exactly what serverless functions are built for. A failed job returns a
non-2xx response, which fails the GitHub Actions run (and can notify you),
rather than failing silently.

To redeploy manually: `vercel deploy --prod`. Required env vars
(`DATABASE_URL`, `FARMING_WALLETS`, `CRON_SECRET`, and optionally
`RESEND_*`/`ALCHEMY_*`) are set per-environment in the Vercel project, not read
from `backend/.env` at deploy time.

## More detail

`docs/farming-tracker/` has the full build history: `FEATURE-BRIEF.md` (the
original spec), `PLAN.md` (execution plan with status per step), `WORKLOG.md`
(what was built, tested, and found at each step), and `ASSUMPTIONS.md` (every
decision made and every open item still outstanding).
