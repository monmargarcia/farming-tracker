# Farming Tracker — Project Brief

_Standing instruction set for this feature. Written once; do not overwrite._
_Superseded root-level copies (`FEATURE-BRIEF.md`, `ASSUMPTIONS.md`) removed in favor of this location._

## What we are building
A personal airdrop farming tracker and reminder system. The app helps a single user
track weekly activity across multiple DeFi protocols, log gas costs, monitor points
balances, and receive email reminders when a protocol has been inactive for 5+ days.

This is NOT a trading bot. Transactions are always executed manually by the user.
The app only reads chain data and manages a checklist + activity log.

## Stack
- Backend: Fastify 5 + TypeScript + Drizzle ORM
- Frontend: React 18 + Vite + TanStack Query + Recharts
- Database: Supabase (PostgreSQL) — _amended 2026-08-19, was originally Neon; see
  ASSUMPTIONS.md_
- Notifications: Resend (email)
- Scheduler: node-cron (weekly reminder, every Monday 9am SGT)
- Chain reads (read-only, no signing):
  - viem — EVM chains (Ethereum, Polygon)
  - starknet.js — Starknet (Paradex)
- External APIs:
  - Alchemy — EVM tx history + gas cost lookup
  - Paradex REST API (api.prod.paradex.trade/v1) — XP points + fills
  - DeFiLlama API — ETH price

## Repo structure (already scaffolded)
```
backend/
  src/
    db/
      schema.ts        ← Drizzle schema (5 tables, see below)
      index.ts         ← Neon DB connection
    services/
      paradexService.ts
      walletService.ts
      notificationService.ts
    routes/
      activities.ts
      tasks.ts
    cron/
      weeklyReminder.ts
    index.ts           ← Fastify entry point
  package.json
  tsconfig.json
  drizzle.config.ts     ← added Step 1
  vitest.config.ts       ← added Step 1
  .env.example
  .env                   ← added Step 1, placeholder values only (gitignored)
frontend/
  src/
    api/client.ts
    pages/Dashboard.tsx
    App.tsx
    main.tsx
    vite-env.d.ts         ← added Step 1
  index.html
  vite.config.ts
  tsconfig.json           ← added Step 1, was missing from original scaffold
  package.json
CLAUDE.md
docs/farming-tracker/      ← this directory
```

## Database schema (Drizzle, Neon PostgreSQL)

### wallets
- id: serial PK
- address: varchar(100) unique not null   ← public 0x address only, never private key
- chain: varchar(50) not null             ← ethereum | starknet | solana
- label: varchar(100)                     ← e.g. "Farming 01"
- created_at: timestamp default now()

### protocols
- id: serial PK
- name: varchar(100) not null
- chain: varchar(50) not null
- token_status: varchar(50) not null      ← confirmed | speculative | points_live
- website_url: varchar(255)
- api_url: varchar(255)
- active: boolean default true
- created_at: timestamp default now()

### activities  ← most important table, sybil defense log
- id: serial PK
- wallet_id: int FK wallets.id not null
- protocol_id: int FK protocols.id not null
- action_type: varchar(50) not null       ← swap | bridge | lp_deposit | lp_withdraw | lend | borrow | nft_mint | trade
- tx_hash: varchar(100)
- gas_usd: numeric(10,4)
- chain: varchar(50)
- notes: text
- created_at: timestamp default now()

### protocol_points  ← polled automatically from protocol APIs
- id: serial PK
- wallet_id: int FK wallets.id not null
- protocol_id: int FK protocols.id not null
- points: numeric(20,4)
- rank: int
- fetched_at: timestamp default now()

### tasks  ← weekly checklist, auto-generated every Monday
- id: serial PK
- protocol_id: int FK protocols.id not null
- week_number: int not null               ← ISO week 1–52
- year: int not null
- action_desc: varchar(255) not null
- completed: boolean default false
- completed_at: timestamp
- created_at: timestamp default now()

Confirmed (Step 1 exploration): this matches `backend/src/db/schema.ts` exactly —
no rewrite needed, only migrations + seed.

## Protocols being farmed (seed data)
1. MetaMask Rewards — chain: ethereum — status: confirmed
2. Paradex — chain: starknet — status: points_live — api: api.prod.paradex.trade/v1
3. Pacifica — chain: solana — status: points_live
4. Ethereal — chain: ethereum — status: speculative

## Farming wallet (seed data)
- address: 0xf56c...Efb342 (full address in .env as FARMING_WALLETS)
- chain: ethereum
- label: Farming 01

## Key business rules
1. NEVER store private keys, seed phrases, or signing credentials anywhere in the
   codebase or DB
2. All transaction signing happens client-side in the user's wallet app
   (MetaMask, Phantom)
3. Backend is read-only for chain data — Alchemy reads only, no write transactions
4. Activity logging is always manual — user clicks Log Activity, fills the form,
   confirms
5. Notification emails sent via Resend every Monday 9am SGT if any wallet/protocol
   pair has had zero activity for 5+ days
6. Paradex XP synced automatically every 6 hours via cron

## Env vars required
DATABASE_URL, RESEND_API_KEY, RESEND_FROM, RESEND_TO, ALCHEMY_API_KEY,
ALCHEMY_RPC_URL, FARMING_WALLETS, PORT

## Deliverables expected
1. All migrations running cleanly against Supabase (amended, was Neon)
2. Seed data inserted (4 protocols + 1 wallet)
3. Backend routes working:
   - GET /api/activities
   - POST /api/activities
   - GET /api/activities/summary
   - GET /api/tasks (auto-generates weekly tasks if none exist)
   - PATCH /api/tasks/:id/complete
4. Paradex XP polling working (6h cron)
5. Weekly reminder email working (Monday 9am SGT cron)
6. Frontend dashboard showing:
   - 4 metric cards (gas spent, actions logged, protocols, tasks this week)
   - Weekly task checklist with checkboxes
   - Gas per protocol bar chart
   - Recent activity log
   - Log Activity modal (form to manually record an action)

Scope addition (resolved via AskUserQuestion before Step 1, see ASSUMPTIONS.md):
wiring `walletService.ts` (Alchemy) + a new DeFiLlama price service into server-side
gas auto-detection on `POST /api/activities` is now in scope, as Plan Step 5.

---

## How to work — MANDATORY, follow exactly

### 0. Session continuity
Work on this feature spans multiple sessions across multiple days. Persistent state
lives in `docs/farming-tracker/`:
- `FEATURE-BRIEF.md` (this file) — standing instructions, written once, never overwritten.
- `PLAN.md` — approved execution plan, one status marker per step: `[ ]` pending,
  `[~]` in progress, `[x]` done (date), `[!]` blocked: reason. Never delete a
  completed step.
- `WORKLOG.md` — append-only session log, one entry per completed step (see format
  in that file). Never end a step without updating it.
- `ASSUMPTIONS.md` — append-only, `[OPEN]` / `[RESOLVED]` markers. OPEN items must
  be resolved before any step depending on them executes. Never delete resolved
  items.

Session start ritual (run at the start of every session, especially "continue"):
read FEATURE-BRIEF.md in full, PLAN.md's first non-done step, ASSUMPTIONS.md's OPEN
items, and WORKLOG.md's last entry — then state in one short paragraph what's done,
what's next, and any blockers, and continue without waiting to be re-briefed.

Root `CLAUDE.md` carries a pointer to this directory.

### 1. Plan before code
First deliverable is a PLAN, not code. Explore the repo and DB schema (ask for any
DDL not readable from the schema file). Produce an ordered execution plan, each step
small enough to review in one sitting, covering migrations, seed data, each route,
Paradex polling, cron jobs, notifications, and the frontend dashboard. Each step
lists: files touched, and how it's verified before moving on.

### 2. Wait for plan approval before writing any code.

### 3. Execute one step at a time
Cycle: implement → test immediately → fix what fails → repeat until green → present.
A step isn't complete until its verification actually ran and passed:
- Run the repo's test suite (at least tests touching this feature) plus any
  step-specific check (typecheck/lint, a route smoke via Fastify inject, a DB query
  against seeded data).
- Fix failures now, within the step — never present broken work, never defer a red
  test, never ask the user to run tests.
- If a fix needs to go outside the step's scope or contradicts the approved plan,
  stop and ask instead of quietly expanding scope.
- When presenting a completed step: what changed, what was tested, the actual
  result (paste test output, don't truncate), anything fixed along the way with
  root cause in one line. Then STOP and wait for go-ahead. Don't batch steps.

### 4. Schema mismatches
If actual table schemas differ from brief assumptions (column names, chain values,
enum values, FK structure), STOP and ask — never guess silently. List every forced
assumption.

### 5. Deploys and pushes need explicit approval, every time
State exactly what would be deployed/pushed, where (branch/remote/environment), and
the commands. Wait for confirmation. Approval covers that one action only. Never
deploy with failing tests or unresolved OPEN items the deployment depends on.
Commit messages: conventional commits, scoped to the feature.

### 6. Match the repo's test setup; every route needs a test
Paradex polling needs a test with a mocked API response proving: points inserted
correctly, rank stored, a second poll appends rather than overwrites. Weekly
reminder needs a test proving: inactive wallets trigger an email, active wallets do
not.

### 7. Security/data-integrity flags every step (OWASP API Top 10 framing)
Flag what's NOT handled, don't stay silent. Minimum checks:
- API01 Broken Object Level Authorization — routes scoped to the right wallet?
- API03 Broken Object Property Level Exposure — leaking fields we shouldn't?
- API08 Security Misconfiguration — env vars, CORS, exposed error details
- API09 Improper Inventory Management — test/debug routes removed before deploy?
- Data integrity — FK constraints enforced? numeric precision correct?
- Injection — all DB values parameterized via Drizzle, never raw string concat?

Hardest constraint for this project: wallet addresses are public data but must never
be confused with signing credentials. Any step touching `wallets` must explicitly
confirm no private-key surface exists in that step's code.
