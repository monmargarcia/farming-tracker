# Assumptions & Open Items

Append-only. `[OPEN]` items must be resolved before any step depending on them
executes. Never delete resolved items — mark `[RESOLVED]` in place.

- [RESOLVED] — `backend/src/db/schema.ts` matches the brief's table definitions
  exactly (columns, types, FK structure, chain/status/action_type string values) —
  step: Plan/exploration — resolution: confirmed via direct file read, no schema
  rewrite needed — 2026-08-19
- [RESOLVED] — Test framework — step: Plan approval — resolution: Vitest, chosen by
  user via AskUserQuestion — 2026-08-19
- [RESOLVED] — DB target for migrations/tests — step: Plan approval — resolution:
  single real Neon database for dev/test/prod, chosen by user via AskUserQuestion.
  Consequence: route/service tests that write to the DB must clean up rows they
  create (delete in `afterEach`) rather than truncate tables — binding requirement
  for Step 4 — 2026-08-19
- [RESOLVED] — walletService.ts (Alchemy) + DeFiLlama scope — step: Plan approval —
  resolution: wire it in now, chosen by user via AskUserQuestion. Adds
  `priceService.ts` + server-side gas auto-detect on `POST /api/activities` as Plan
  Step 5; explicit manual `gasUsd` always overrides auto-detect — 2026-08-19
- [RESOLVED] — `frontend/tsconfig.json` and `frontend/src/vite-env.d.ts` did not
  exist in the original scaffold, silently breaking `npm run build` (`tsc` had no
  project to compile against) — step: Step 1 — resolution: added standard
  Vite+React strict tsconfig and vite-env.d.ts; `tsc --noEmit` passes in both
  backend and frontend — 2026-08-19

- [RESOLVED] — Database provider switched from Neon to Supabase (both are Postgres,
  so `schema.ts` is unaffected) — step: pre-Step-2 — resolution: user chose
  Supabase over Neon. Code change: `backend/src/db/index.ts` now uses
  `postgres` (postgres.js) + `drizzle-orm/postgres-js` instead of
  `@neondatabase/serverless` + `drizzle-orm/neon-http` (Neon's driver is
  HTTP-only and Supabase-incompatible); `backend/package.json` swapped the
  dependency accordingly; `.env`/`.env.example` DATABASE_URL comment/example
  updated to Supabase's direct-connection format (port 5432, appropriate for
  this long-running Fastify server rather than the 6543 pooler meant for
  serverless functions). `drizzle.config.ts` needed no change — it already used
  the generic `driver: 'pg'`, not a Neon-specific driver. Verified: `tsc --noEmit`
  still passes after the swap — 2026-08-19
- [RESOLVED] — `DATABASE_URL` — step: pre-Step-2 — resolution: provisioned a real
  Supabase Postgres instance via `vercel integration add supabase` (project
  `farming-tracker`, org `monmargarcia-5863s-projects`, resource
  `supabase-coral-tree`), pulled `POSTGRES_URL_NON_POOLING` from
  `vercel env pull` into `backend/.env`. Verified with a live `SELECT
  current_database(), version()` — connected successfully to PostgreSQL 17.6.
  Note: despite the name, `POSTGRES_URL_NON_POOLING` resolves to Supabase's
  Supavisor pooler host on port 5432 (session mode) rather than the true direct
  host — this is expected on new Supabase projects (the direct host is
  IPv6-only), and session mode supports prepared statements fine for our
  persistent Fastify server — 2026-08-19
- [RESOLVED] — full `FARMING_WALLETS` address — step: Step 3 — resolution: user
  filled in the real address directly in `backend/.env`
  (`0xf56cB38c7422e684d79d14B56B95CDdA9DEfb342`, chain ethereum) — 2026-08-19
- [OPEN] — `RESEND_API_KEY/FROM/TO`, `ALCHEMY_API_KEY/RPC_URL` — still
  placeholders in `backend/.env` AND unset on Vercel (deliberately not pushed —
  see deployment WORKLOG entry). The app is now live and reachable, but the
  weekly reminder email and gas auto-detect won't actually do anything real
  until these are set as real Vercel env vars (they already fail gracefully
  without crashing, per Steps 5/7's design — this is a "not yet configured" gap,
  not a bug).
- [RESOLVED] — `node-cron`/Vercel serverless mismatch — step: post-Step-9
  deployment — resolution: replaced `node-cron` entirely with GitHub Actions
  cron (`.github/workflows/cron.yml`) hitting new secret-gated
  `POST /api/cron/*` routes; deployed for real to
  https://farming-tracker.vercel.app and verified end-to-end, including the
  authenticated cron path. Full detail in WORKLOG.md's deployment entry.
- [RESOLVED] — `drizzle-orm` ^0.30.0 (resolved 0.30.10) carried a HIGH-severity
  SQL-identifier-escaping / injection advisory (GHSA-gpj5-g38j-94v9), fixed in
  0.45.2 — step: Step 1 (`npm audit`) — resolution: initially deferred by user
  choice, then **reversed in Step 2**: `drizzle-kit` 0.31.10 (needed for the
  modern `generate`/`migrate` CLI) hard-required a newer `drizzle-orm` and refused
  to run at all against 0.30.10, so the deferred upgrade became a hard blocker,
  not just hygiene. Re-asked the user, who approved upgrading now. Bumped to
  `drizzle-orm@0.45.2` exactly — the advisory's fix version. `tsc --noEmit` passed
  clean after the bump, no code changes needed elsewhere — 2026-08-19
- [RESOLVED] — `drizzle-kit` pinned at `^0.20.0` (resolved 0.20.18) printed a
  stray "Failed to find Response internal state key" line under Node 24 — step:
  Step 1 (noted, not chased) — resolution: superseded by Step 2's bump to
  `drizzle-kit@^0.31.0` (required anyway to unblock `generate`/`migrate`, see the
  drizzle-orm CVE entry below). Confirmed at Step 9: `npx drizzle-kit --version`
  now prints cleanly, no stray line — 2026-08-19
- [OPEN] — `wallet.label` / `protocol.name` are interpolated unescaped into the
  weekly reminder email's HTML (`notificationService.ts`) — noted in the original
  code review, not fixed under any step so far. Low risk today (both values come
  from this app's own DB, not external input, and there's no auth layer for
  someone else to inject a malicious label through anyway), but worth escaping if
  either field ever becomes attacker-influenced. Not in scope for Step 7 as
  approved — flagging rather than fixing silently.
- [OPEN] — `npm audit` on backend reports 7 findings (5 moderate, 1 high, 1
  critical) as of the deployment work (down from 9 at Step 9 — removing
  `node-cron` while switching to GitHub Actions cron also removed its `uuid`
  dependency, the one finding that was in a production dependency) — checked in
  detail, not fixed:
  - All remaining findings trace back to `esbuild`, pulled in transitively by
    `vitest` (→ `vite` → `esbuild`) and `drizzle-kit` (→ `@esbuild-kit/*` →
    `esbuild`) — both **devDependencies only**, never shipped to the production
    build or to the deployed `api/index.ts` function.
  - The "critical" one is specifically Vitest's `--ui` dev server allowing
    arbitrary file read/execute when that UI server is listening — this project
    only ever runs `vitest run` / `vitest` (no `--ui` flag anywhere), so the
    vulnerable code path is never actually exercised here, though the package
    version is present.
  - The "high" one is a Vite dev-server path-traversal/NTLMv2/fs-deny-bypass
    cluster — again dev-server-only, not applicable to the deployed app.
  - Fixing any of this means `npm audit fix --force`, which would bump
    `vitest` 1.6→4.x (three major versions) — a real breaking-change risk to the
    whole test suite, not something to do silently in a "final review" step.
    Flagging for a deliberate decision later, not fixing now.
- [OPEN] — No authentication/authorization exists on any route (API01). Not a
  stated deliverable, so not being added under this plan — carried as a known,
  accepted gap unless told otherwise. Only safe if the API stays localhost-only.
- [RESOLVED] — The app had never actually been able to boot, in dev or prod, since
  it was scaffolded — step: Step 4, found via first real test-driven boot —
  resolution: `@fastify/cors@^9.0.0` and `@fastify/sensible@^5.0.0` only support
  Fastify 4.x, but `fastify@^5.0.0` is installed; bumped to `^11.0.0` /
  `^6.0.0` respectively. Also `backend/src/db/index.ts` never loaded its own
  `dotenv/config`, relying on whichever entrypoint imported it first — silently
  broke under Vitest (no entrypoint), causing `postgres()` to connect to an
  undefined/fallback target instead of failing loudly. Fixed by having
  `db/index.ts` load its own env — 2026-08-19
- [RESOLVED] — Running Vitest test files concurrently caused cross-file races
  against the shared real Supabase DB (one file's task-generation logic picked up
  another file's in-flight fixture protocol, then blocked that file's cleanup with
  an FK violation) — step: Step 4 — resolution: `vitest.config.ts` now forces
  `poolOptions.threads.singleThread: true`, serializing test file execution. This
  is the practical cost of the single-real-DB choice from Step 1 — documented so
  future test files don't reintroduce parallelism against this DB — 2026-08-19
- [OPEN] — Repo-hygiene issue (found during initial project review, predates this
  feature): this repo's git remote is the user's work repo
  (`github.com/IFSRNG/fastify-internal-api`, pushed under an `ifscapital.com.sg`
  identity). Its one existing commit is an unrelated Cognito auth service, now
  showing as deleted in the working tree, alongside several unrelated untracked
  project directories (`awsdesk/`, `eth-desk/`, `jwt-tool/`, `parkwise-api/`,
  `parkwise-web/`, `pdf-forge/`) sitting next to `farming-tracker/`. Not resolved.
  Per rule 5, this must be explicitly addressed before any commit/push — will be
  re-raised at that point regardless of code readiness.
