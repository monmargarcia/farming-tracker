# Farming Tracker

A personal airdrop farming tracker and reminder system. Tracks weekly manual
activity across a few DeFi protocols, logs gas costs, polls points balances, and
emails a reminder when a protocol has gone quiet for too long.

This is **not** a trading bot. All transactions are executed manually by you, in
your own wallet app. The backend only reads public chain/API data and manages a
checklist + activity log — it never signs or broadcasts anything.

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
- **Scheduling** — node-cron (in-process — see [Deployment](#deployment) below)
- **External reads** — Alchemy (EVM tx/gas lookups), Paradex's public REST API,
  DeFiLlama (ETH price)

## Project structure

```
backend/
  src/
    db/            Drizzle schema, DB client, seed script
    routes/        Fastify routes — activities, tasks
    services/      Alchemy, Paradex, DeFiLlama, Resend integrations
    cron/          Weekly reminder + Paradex polling schedules
    app.ts         Fastify app factory (routes + plugins, no listen)
    index.ts       Real entrypoint — builds the app, starts cron, listens
  drizzle/         Generated SQL migrations
frontend/
  src/
    pages/         Dashboard
    api/           Backend API client
docs/farming-tracker/   Build log — plan, worklog, and open assumptions
```

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (or any Postgres instance)
- Optional for full functionality: a [Resend](https://resend.com) API key, an
  [Alchemy](https://alchemy.com) API key

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. On Supabase, use the direct/session-mode connection (port 5432) — this is a long-running server, not serverless functions. |
| `PORT` | No | Defaults to `3001`. |
| `FARMING_WALLETS` | Yes, for seeding | Comma-separated wallet address(es) to seed. |
| `RESEND_API_KEY` / `RESEND_FROM` / `RESEND_TO` | Only for live reminder emails | Safe to leave as placeholders otherwise. |
| `ALCHEMY_API_KEY` / `ALCHEMY_RPC_URL` | Only for gas auto-detect | Auto-detect fails gracefully (saves with no gas value) if unset or invalid. |

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

`GET /health` (unprefixed) returns a basic liveness check.

## Testing

```bash
cd backend && npm test
```

19 Vitest tests cover every route and background service, run against a real
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
- **No authentication exists on any route.** This is intentional for a
  single-user, localhost-only tool — do not expose this API on a public network
  without adding an auth layer first.

## Deployment

`node-cron`'s scheduling relies on a long-running process. It will not run
correctly on serverless platforms (e.g. Vercel Functions) without being
re-architected around a platform-native cron trigger — keep that in mind before
deploying the backend anywhere serverless.

## More detail

`docs/farming-tracker/` has the full build history: `FEATURE-BRIEF.md` (the
original spec), `PLAN.md` (execution plan with status per step), `WORKLOG.md`
(what was built, tested, and found at each step), and `ASSUMPTIONS.md` (every
decision made and every open item still outstanding).
