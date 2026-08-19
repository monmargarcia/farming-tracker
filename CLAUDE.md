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
- Scheduler: node-cron
- Chain reads: viem (EVM), starknet.js (Paradex)

## Project structure
```
backend/   Fastify API + cron jobs
frontend/  React dashboard
```

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
sends Resend email if wallet has been inactive for 5+ days.

## Running locally
```bash
cd backend && npm run dev
cd frontend && npm run dev
```
