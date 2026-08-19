# Farming Tracker

Airdrop farming activity tracker and reminder system.

> Farming tracker feature: state lives in `docs/farming-tracker/` — read
> `FEATURE-BRIEF.md`, `PLAN.md`, and the last `WORKLOG.md` entry before touching
> anything in this project.

## Stack
- Backend: Fastify 5 + TypeScript + Drizzle ORM
- Frontend: React 18 + Vite + TanStack Query + Recharts
- Database: Supabase (PostgreSQL)
- Notifications: Resend (email)
- Scheduler: GitHub Actions (`.github/workflows/cron.yml`) hitting protected
  `POST /api/cron/*` routes — not node-cron; Vercel deploys the backend as
  stateless serverless functions, which can't host an in-process scheduler
- Chain reads: viem (EVM), starknet.js (Paradex)
- Deployment: Vercel (single project — static frontend + `api/index.ts`
  serverless function wrapping the Fastify app), linked to the GitHub repo

## Project structure
```
api/index.ts   Vercel serverless function — wraps the Fastify app for deploy
backend/       Fastify API (routes, services, DB, cron job logic)
frontend/      React dashboard
```
Root is an npm workspace (`backend` + `frontend`) so `api/index.ts` can import
`backend/src/app.js` directly — see `package.json`.

## Protocols being farmed
1. MetaMask Rewards (EVM) — token confirmed
2. Paradex (Starknet) — $DIME, Season 2 live
3. Pacifica (Solana) — tokenless, points live
4. Ethereal (EVM) — tokenless, speculative

## Key rules
- NEVER store private keys or seed phrases in the database
- wallet.address is public — safe to store
- All chain reads are read-only (no signing on backend)
- Activity logging is manual — user confirms every tx themselves

## Database schema
See backend/src/db/schema.ts

## Env vars
See backend/.env.example

## Weekly cron
Runs every Monday 9am SGT — checks last activity date per protocol,
sends Resend email if wallet has been inactive for 5+ days. Triggered by
GitHub Actions, not an in-process scheduler (see Stack above).

## Running locally
```bash
npm install              # from repo root — this is an npm workspace
cd backend && npm run dev
cd frontend && npm run dev
```
