# Worklog

Append-only. One entry per completed step. Never truncate the Result section.

## 2026-08-19 — Step 1: Env & tooling bootstrap
Status: DONE
Changed:
- `backend/.env` created from `.env.example` (placeholder values, gitignored)
- `backend/drizzle.config.ts` added (old-style `driver: 'pg'` config matching
  installed drizzle-kit 0.20.18; real correctness verified in Step 2)
- `backend/vitest.config.ts` added (minimal Node environment)
- `backend/package.json` — added `vitest` devDependency, `test`/`test:watch` scripts
- `frontend/tsconfig.json` + `frontend/src/vite-env.d.ts` added — these did not
  exist in the original scaffold at all
- `npm install` run in `backend/` and `frontend/`
- `npm audit fix` (non-breaking only) run in `backend/` — resolved nothing further
  fixable without breaking changes
Tested:
- `cd backend && npx tsc --noEmit`
- `cd backend && npx vitest run --passWithNoTests`
- `cd frontend && npx tsc --noEmit`
- `git status` + `git check-ignore -v backend/.env backend/node_modules
  frontend/node_modules`
Result:
- backend tsc: PASS, no errors
- backend vitest: "No test files found, exiting with code 0" (harness wired, no
  tests exist yet — expected, land in Step 4+)
- frontend tsc: FAILED first pass — `error TS2339: Property 'env' does not exist
  on type 'ImportMeta'` (no tsconfig.json / vite-env.d.ts existed at all) — fixed,
  then PASS
- git check-ignore confirmed `.env`, both `node_modules` trees are gitignored;
  `git status` shows only the single untracked project directory, nothing
  unexpected staged or trackable
Fixed: `frontend/tsconfig.json` and `frontend/src/vite-env.d.ts` were missing from
the original scaffold, so `npm run build` (`tsc && vite build`) was silently broken
before any of this session's changes — added standard Vite+React strict config.
Security flags:
- Injection (rule 7 checklist): `npm audit` surfaced `drizzle-orm` < 0.45.2 has a
  HIGH-severity SQL-identifier-escaping/injection advisory
  (GHSA-gpj5-g38j-94v9) — currently pinned `^0.30.0` (resolved 0.30.10). NOT fixed
  this step (breaking-change upgrade, outside Step 1 scope) — logged as OPEN in
  ASSUMPTIONS.md, asked user for a decision.
- API08 (secrets/config): confirmed `.env` and `node_modules` stay out of git via
  `.gitignore`; `backend/.env` holds placeholders only, no real secrets handled or
  logged this step.
- Wallets/private-key surface: no code touching the `wallets` table was added or
  changed this step — N/A this step, will re-confirm explicitly in Step 3 (seed).
Next action: get real `backend/.env` values from the user (DATABASE_URL at minimum
to unblock Step 2, full FARMING_WALLETS address to unblock Step 3), and get a
decision on the drizzle-orm CVE (fold into Step 2 vs. defer). Both are OPEN items
in ASSUMPTIONS.md blocking the next step.

## 2026-08-19 — Pre-Step-2: DB provider switch (Neon → Supabase)
Status: DONE
Changed:
- `backend/src/db/index.ts` — swapped `@neondatabase/serverless` +
  `drizzle-orm/neon-http` for `postgres` (postgres.js) + `drizzle-orm/postgres-js`
- `backend/package.json` — dependency swap to match
- `backend/.env` / `backend/.env.example` — DATABASE_URL comment/example updated to
  Supabase's direct-connection format (port 5432)
- `CLAUDE.md`, `docs/farming-tracker/FEATURE-BRIEF.md`, `PLAN.md`, `ASSUMPTIONS.md`
  — updated to reflect Supabase as the DB provider
Tested: `npm install` in backend, `npx tsc --noEmit`
Result: `postgres` package present in node_modules, `@neondatabase/serverless`
removed, tsc clean, no errors
Fixed: n/a — decision change, not a bug
Security flags: no code touching secrets/credentials handling changed beyond the
connection string shape itself; drizzle-orm CVE decision (deferred) unaffected by
this swap
Next action: still need the real Supabase `DATABASE_URL` (user is setting up a
Vercel project first, per their message) and the full FARMING_WALLETS address to
unblock Steps 2 and 3.

## 2026-08-19 — Pre-Step-2: Vercel project + Supabase provisioning
Status: DONE
Changed:
- Linked local repo to a new Vercel project: `monmargarcia-5863s-projects/farming-tracker`
  (`vercel link --yes`)
- Provisioned Supabase via Vercel Marketplace: `vercel integration add supabase`
  → resource `supabase-coral-tree`, connected to the project
- Pulled env vars via `vercel env pull .env.local --yes` (root-level, gitignored)
- Extracted `POSTGRES_URL_NON_POOLING` and wrote it into `backend/.env` as
  `DATABASE_URL`, via a script that never printed the value to terminal output
Tested: live connection test (`postgres` package, `SELECT current_database(),
current_user, version()`)
Result: `CONNECTED: postgres postgres` / `PostgreSQL 17.6 on
x86_64-pc-linux-gnu` — real Supabase connection confirmed working end-to-end
Fixed: n/a
Security flags:
- Secret handling: DATABASE_URL value was never echoed to terminal/logs — extracted
  and substituted via a script that only printed length + a boolean host check.
  `.env`, `.env.local` both confirmed gitignored.
- Noted for later, not fixed now: `vercel link` auto-generated `vercel.json` with
  serverless routing for `frontend`/`backend` as separate services. If this backend
  is ever deployed to Vercel as-is, `node-cron`'s in-process scheduling (weekly
  reminder, Paradex 6h poll) will not run under serverless functions — logged as
  OPEN in ASSUMPTIONS.md for whenever deployment is actually discussed.
Next action: Step 2 (drizzle migrations) is now unblocked — run `db:generate` then
`db:migrate` against the real Supabase DB and verify.

## 2026-08-19 — Step 2: Drizzle migrations against Supabase
Status: DONE
Changed:
- `backend/package.json` — `drizzle-kit` bumped `^0.20.0` → `^0.31.0` (dev-only CLI
  tool, no runtime risk; also fixes the moderate esbuild advisory `npm audit`
  flagged in Step 1); `drizzle-orm` bumped `^0.30.0` → `^0.45.2` (see below)
- `backend/drizzle.config.ts` — rewritten to the modern `defineConfig` /
  `dialect: 'postgresql'` / `dbCredentials.url` format (old `driver: 'pg'` /
  `connectionString` shape was for drizzle-kit 0.20.x)
- `backend/drizzle/0000_misty_satana.sql` + `backend/drizzle/meta/*` — generated
  initial migration (new files, not edits)
Tested:
- `npx drizzle-kit generate` (twice — first attempt hit a hard version
  incompatibility, see Fixed below)
- `npx tsc --noEmit` after the drizzle-orm bump
- `npx drizzle-kit migrate` against the real Supabase DB
- Live verification query (raw `postgres` client, not trusting the CLI's own
  success message): table list, numeric precision on `gas_usd`/`points`, all FK
  constraints, `wallets.address` unique constraint, full `wallets` column list
Result:
- `drizzle-kit generate`: "5 tables / activities 9 columns 0 indexes 2 fks /
  protocol_points 6 columns 0 indexes 2 fks / protocols 8 columns 0 indexes 0 fks /
  tasks 8 columns 0 indexes 1 fks / wallets 5 columns 0 indexes 0 fks" — migration
  SQL manually reviewed, matches schema.ts exactly
- `tsc --noEmit`: clean, no output — drizzle-orm 0.30→0.45 bump needed zero code
  changes in this repo
- `drizzle-kit migrate`: "[✓] migrations applied successfully!"
- Live query: `TABLES: activities, protocol_points, protocols, tasks, wallets` ·
  `NUMERIC PRECISION: gas_usd(10,4), points(20,4)` — matches spec exactly ·
  `FKS: 5` (activities→wallets, activities→protocols, protocol_points→wallets,
  protocol_points→protocols, tasks→protocols) — matches spec exactly ·
  `WALLETS UNIQUE: wallets_address_unique` present ·
  `WALLETS COLUMNS: id, address, chain, label, created_at` — no private-key/
  signing-credential column exists
Fixed:
- Root cause: old `drizzle-kit` 0.20.18 doesn't support the `generate`/`migrate`
  commands our scripts call at all (`error: unknown command 'generate'`) — it
  predates that CLI surface. Bumped to 0.31.10, which then refused to run
  ("This version of drizzle-kit requires newer version of drizzle-orm") — the
  drizzle-orm CVE upgrade deferred in Step 1 turned out to be a hard blocker for
  Step 2, not optional hygiene. Stopped and re-asked the user per rule 3 rather
  than silently reversing their earlier "defer" decision; they approved the
  upgrade. Bumped `drizzle-orm` to exactly 0.45.2, the advisory's fix version.
Security flags:
- Injection (rule 7): the deferred `drizzle-orm` SQL-injection CVE
  (GHSA-gpj5-g38j-94v9) is now actually fixed, not just deferred — 0.45.2 is
  confirmed installed.
- Data integrity: FK constraints and numeric precision verified live against the
  database, not assumed from the migration file alone.
- Wallets/private-key surface: explicitly re-confirmed via live column query —
  only `id, address, chain, label, created_at` exist on `wallets`.
- API08 (config): `DATABASE_URL` was read from `backend/.env` only; no secret
  values were printed in any verification command's output (schema/constraint
  metadata only).
Next action: Step 3 — seed script (4 protocols + 1 wallet). Still blocked on the
full `FARMING_WALLETS` address (ASSUMPTIONS.md, OPEN).

## 2026-08-19 — Step 3: Seed script
Status: DONE
Changed:
- `backend/src/db/seed.ts` (new) — seeds 4 protocols + wallet(s) from
  `FARMING_WALLETS`. Protocols have no unique DB constraint on `name`, so
  idempotency is done in application logic (select existing names, insert only the
  missing ones); wallets use `onConflictDoNothing({ target: wallets.address })`
  against the real unique constraint.
- `backend/package.json` — added `db:seed` script
Tested:
- `npx tsc --noEmit`
- `npm run db:seed` run twice in a row
- Independent live query (raw `postgres` client) of full row contents after both runs
Result:
- tsc: clean
- Run 1: "Inserted 4 protocol(s): MetaMask Rewards, Paradex, Pacifica, Ethereal" /
  "Inserted wallet 0xf56cB38c7422e684d79d14B56B95CDdA9DEfb342" / "Done.
  protocols=4 wallets=1"
- Run 2: "All protocols already present, skipping" / "Wallet ... already present,
  skipping" / "Done. protocols=4 wallets=1" — confirmed idempotent, no duplicates
- Live query confirmed exact row contents: all 4 protocols with correct
  chain/token_status/api_url (Paradex only), 1 wallet with correct
  address/chain=ethereum/label="Farming 01" — matches FEATURE-BRIEF.md exactly
Fixed: nothing failed
Security flags:
- Wallets/private-key surface: seed script only ever writes
  `address`/`chain`/`label` to `wallets` — no key material touched, confirmed by
  the insert statement itself and the live column check from Step 2.
- Injection: all values inserted via Drizzle's query builder
  (`.values()`/`.insert()`), no string concatenation anywhere in the script.
- FARMING_WALLETS address is public data per project rules — not treated as a
  secret, referenced in this log for traceability.
Next action: Step 4 — backend route tests + fix the `tasks.ts` redirect bug.

## 2026-08-19 — Step 4: Backend route tests + tasks.ts redirect fix
Status: DONE
Changed:
- `backend/src/app.ts` (new) — extracted a `buildApp()` factory (Fastify instance +
  plugins + routes, no listen/cron) so routes are testable via `.inject()`
- `backend/src/index.ts` — now just calls `buildApp()` then `startCronJobs()` +
  `app.listen()`; behavior unchanged for the real entrypoint
- `backend/src/routes/tasks.ts` — fixed the redirect bug: `GET /tasks` now
  re-queries and returns generated rows directly instead of
  `reply.redirect('/tasks')`; `getCurrentWeek` exported for tests; `PATCH
  /tasks/:id/complete` now 404s on a non-numeric or non-existent id instead of
  silently returning 200 with an empty body
- `backend/src/db/index.ts` — added `import 'dotenv/config'` (see Fixed) and
  exported the raw `client` for test teardown
- `backend/src/routes/activities.test.ts`, `backend/src/routes/tasks.test.ts`
  (new) — 8 tests total, each creates its own isolated wallet/protocol fixtures
  and deletes them (and anything they caused, e.g. generated tasks) afterward
- `backend/package.json` — `@fastify/cors` `^9.0.0`→`^11.0.0`, `@fastify/sensible`
  `^5.0.0`→`^6.0.0` (see Fixed)
- `backend/vitest.config.ts` — `poolOptions.threads.singleThread: true` (see Fixed)
Tested:
- `npx tsc --noEmit` after every change
- `npx vitest run`, twice consecutively
- Direct DB queries before/after to confirm no residue
Result:
- Final two consecutive runs: `Test Files 2 passed (2)` / `Tests 8 passed (8)`
  both times
- Post-run DB state, both times: `protocols: MetaMask Rewards, Paradex, Pacifica,
  Ethereal` (ids 1-4, exactly seed data) / `wallets: [Farming 01]` (exactly seed
  data) / `tasks count: 0` / `activities count: 0` — fully restored, no leftovers
Fixed (three separate root causes found via this step's testing, not assumed):
1. `GET /tasks` redirect bug (the one this step targeted) — `reply.redirect('/tasks')`
   pointed outside the `/api` prefix the route is actually mounted under, 404ing on
   the first request of every week. Replaced with a direct re-query + return.
2. **The app had never been able to boot at all**, in dev or prod, since it was
   originally scaffolded: `@fastify/cors@^9`/`@fastify/sensible@^5` only support
   Fastify 4.x, but `fastify@^5` was installed — every boot attempt threw
   `FST_ERR_PLUGIN_VERSION_MISMATCH`. This was invisible until now because nothing
   had ever actually started the server (`npm run dev` was never run this session
   before writing tests). Bumped both to their Fastify-5-compatible majors.
3. `backend/src/db/index.ts` didn't load `dotenv/config` itself — it relied on
   whichever entrypoint happened to import it first (`seed.ts`/`index.ts` both do,
   which is why Steps 2/3 never surfaced this). Under Vitest, nothing loaded
   `.env` first, so `DATABASE_URL` was `undefined` and `postgres()` silently
   connected to some local/fallback target instead of erroring — surfaced as
   `relation "protocols" does not exist` rather than a connection failure, which
   took a moment to diagnose. Fixed by making `db/index.ts` load its own env.
4. (Test-infra, not app code) Concurrent Vitest test files racing against the same
   shared real Supabase DB — see ASSUMPTIONS.md for detail. Also manually cleaned
   up two rounds of leftover rows from failed runs before this before/after
   verification was trustworthy (stray Vitest-prefixed protocols with FK'd tasks
   from the concurrency race; then 9 real-protocol tasks orphaned by a test that
   threw before reaching its own inline cleanup) — both cleanups scoped to
   specific IDs, confirmed test-created via naming/count history before deleting.
Security flags:
- API01: still no auth on any route — unchanged, not in scope for this step.
- Injection: all new test/query code goes through Drizzle's query builder, no raw
  SQL concatenation.
- Data integrity: PATCH now correctly 404s instead of silently no-op'ing on a bad
  id — closes a real gap from the original code review.
- API08: found and fixed a live misconfiguration (the plugin version mismatch)
  that meant this API's security posture was previously untestable because the
  server couldn't run at all.
Next action: Step 5 — price service (DeFiLlama) + gas auto-detect wiring on
`POST /api/activities`.

## 2026-08-19 — Step 5: Price service + gas auto-detect
Status: DONE
Changed:
- `backend/src/services/priceService.ts` (new) — `getEthPriceUsd()`, calls
  DeFiLlama's current-price endpoint for `coingecko:ethereum`, 10s timeout,
  returns `null` on any failure (never throws)
- `backend/src/routes/activities.ts` — `POST /api/activities`: when `gasUsd` is
  omitted and `txHash` + `chain === 'ethereum'` are present, calls
  `getEthPriceUsd()` then `walletService.getGasCostUsd()`; explicit `gasUsd`
  short-circuits this entirely (checked first, network calls never attempted);
  any failure anywhere in the auto-detect path leaves `gasUsd` undefined → saves
  as `null`, never throws
- `backend/src/services/walletService.ts` — all 3 catch blocks now log
  `err.message` instead of the raw error object (see Fixed)
- `backend/src/routes/activities.test.ts` — 3 new tests, mocking `axios.get`
  (DeFiLlama) and `axios.post` (Alchemy) via `vi.spyOn`, restored in `afterEach`
Tested:
- `npx tsc --noEmit`
- `npx vitest run`, twice consecutively
- DB state check before/after
Result:
- Both runs: `Test Files 2 passed (2)` / `Tests 11 passed (11)`
- Auto-detect test: mocked gasUsed=21000 (0x5208) × effectiveGasPrice=20 gwei
  (0x4a817c800) × mocked ETH price $1000 → asserted stored `gasUsd` ≈ $0.42,
  matched
- Manual-override test: asserted `axios.get`/`axios.post` spies were never called
  at all when `gasUsd` was provided — auto-detect path is fully skipped, not just
  overridden after the fact
- Graceful-failure test: mocked DeFiLlama rejection → response still 201, stored
  `gasUsd` is `null` — confirmed via response body, not just assumed
- Post-run DB state, both times: exactly seed data (4 protocols, 1 wallet), 0
  tasks, 0 activities
Fixed: `walletService.ts`'s 3 catch blocks logged the raw axios error object via
`console.error('...', err)`. Since `ALCHEMY_RPC_URL` embeds the Alchemy API key in
the URL path, and Node's default error inspection surfaces the AxiosError's
`.config` (including the full request URL), any Alchemy failure would have printed
the API key to stdout/logs. Confirmed the fix live — the graceful-failure test's
stderr output shows only the plain error message string, not a request/config
dump. Applied the same message-only pattern in the new `priceService.ts` from the
start.
Security flags:
- API08 (secrets in logs): the log-hygiene issue above is exactly this category —
  found and fixed, verified via actual test stderr output.
- Outbound calls: DeFiLlama call has an explicit 10s timeout, matching the
  existing Alchemy calls' pattern.
- Injection: no new DB query surface — only two new outbound HTTP calls (DeFiLlama
  GET, reused Alchemy POST), both through axios, no string-built SQL anywhere.
- Wallets/private-key surface: unaffected by this step — no wallet-table writes
  involved in the gas auto-detect path.
Next action: Step 6 — Paradex polling tests + light zod validation on the Paradex
response shape.

## 2026-08-19 — Step 6: Paradex polling tests + response validation
Status: DONE
Changed:
- `backend/src/services/paradexService.ts` — added `ParadexAccountSchema` (zod):
  `account: string`, `points: string|number → string`, `rank: coerced number`.
  `fetchParadexPoints` now `safeParse`s the response and returns `null` (with a
  `console.warn`) on a shape mismatch instead of trusting it blindly; the old
  hand-written `ParadexAccount` interface is now `z.infer`'d from the schema
  instead of hand-maintained separately. Also applied the same message-only error
  logging fix from Step 5 to both catch blocks in this file, and corrected a stale
  comment ("upsert into DB" → it's actually an append-only history table by
  design, flagged back in the original code review)
- `backend/src/services/paradexService.test.ts` (new) — 3 tests
Tested:
- `npx tsc --noEmit`
- `npx vitest run`, twice consecutively (now 3 test files, 14 tests total)
- DB state check before/after (protocols, wallets, tasks, activities,
  protocol_points all checked)
Result:
- Both runs: `Test Files 3 passed (3)` / `Tests 14 passed (14)`
- Insert-correctness test: mocked `{account, points: '1234.5678', rank: 42}` →
  confirmed stored `points` ≈ 1234.5678, `rank` === 42, `protocolId` matches the
  real seeded Paradex protocol id
- Append-not-overwrite test: two mocked polls (100.0000 then 150.0000 points) →
  confirmed exactly 2 rows exist afterward, in insert order, matching the
  deliverable's exact requirement ("second poll appends a new row rather than
  overwriting")
- Validation test: mocked an unrelated `{unexpected: 'shape'}` response → zero
  rows inserted; stderr shows the zod validation errors in full (missing
  `account`, missing `points`, `rank` NaN) confirming the rejection path runs
  end-to-end through `syncParadexPoints`, not just at the schema-unit level
- Post-run DB state, both times: protocols/wallets exactly seed data, `tasks
  count: 0`, `activities count: 0`, `protocol_points count: 0` — fully restored
Fixed: stale "Poll points...and upsert into DB" comment (it's insert-only, a
history table) — flagged back in the very first code review of this project,
closed out now while already in this file for other reasons.
Security flags:
- Data integrity (this step's core purpose): a Paradex API shape change can no
  longer silently insert malformed/garbage rows — confirmed live via the
  rejection test, not just asserted in code.
- API08 (secrets in logs): same message-only logging pattern applied here as
  Step 5's walletService fix, for consistency (Paradex URLs don't embed a key,
  but keeping the pattern uniform avoids reintroducing the issue if that ever
  changes).
- Injection: no raw SQL, only Drizzle's query builder; response validation
  happens before any DB write.
Next action: Step 7 — weekly reminder tests (mocked Resend) + cron error handling
in `weeklyReminder.ts`.

## 2026-08-19 — Step 7: Weekly reminder tests + cron error handling
Status: DONE
Changed:
- `backend/src/cron/weeklyReminder.ts` — both cron bodies extracted into named,
  exported, individually-callable functions (`runWeeklyReminder`,
  `runParadexSync`), each wrapped in try/catch + `console.error` logging;
  `startCronJobs()` now just schedules these instead of inline closures
- `backend/src/services/notificationService.ts` — exported `resend` (was a
  private module-level const) so tests can spy on `resend.emails.send`
- `backend/src/services/notificationService.test.ts` (new) — 3 tests
- `backend/src/cron/weeklyReminder.test.ts` (new) — 2 tests
- `backend/vitest.config.ts` — `testTimeout: 20_000` (see Fixed)
Tested:
- `npx tsc --noEmit`
- `npx vitest run`, three times total (one failing run diagnosed and fixed twice,
  then two clean consecutive passes)
- DB state check before/after the clean runs
Result:
- Final two consecutive runs: `Test Files 5 passed (5)` / `Tests 19 passed (19)`
  both times
- Inactive-pair test: mocked `resend.emails.send`, confirmed called exactly once
  with `to`/`from` matching env vars, and the email HTML contains the test
  wallet's label, the test protocol's name, and "never" (correct formatting for
  a wallet with zero activity ever)
- Active-pair-exclusion test: confirmed the wallet+protocol pair with fresh
  activity does not appear together in any `<tr>` row of the email, while
  correctly still appearing for other protocols it has no activity against (see
  Fixed — this was the second bug this step's testing caught)
- Zero-inactive test: temporarily gave the real seeded wallet fresh activity
  against every real active protocol (tagged, deleted immediately after in
  `afterEach`) → confirmed `resend.emails.send` was not called at all
- Cron wrapper tests: mocked each underlying service function to reject →
  confirmed `runWeeklyReminder()`/`runParadexSync()` both resolve (don't throw),
  and the expected `[Cron] ... failed: <message>` line is logged — proves the
  unhandled-rejection risk is actually closed, not just wrapped in theory
- Post-run DB state, both times: protocols/wallets exactly seed data, `tasks
  count: 0`, `activities count: 0`, `protocol_points count: 0`
Fixed (two issues found via this step's own test runs):
1. Two tests initially timed out at Vitest's 5s default — root cause:
   `findInactiveWallets` (pre-existing N+1 pattern, already flagged as
   acceptable-at-this-scale in the original code review) does 2 sequential DB
   round-trips per wallet×protocol pair; real Supabase network latency pushed
   that past 5s once test fixtures added a few more pairs to scan. Not an app
   bug — bumped `testTimeout` to 20s globally, consistent with this suite's
   established pattern of adjusting test infra (not app logic) for real-DB
   latency (see Step 4's `singleThread` fix).
2. My own "excludes an active pair" test initially asserted the wallet's label
   never appears anywhere in the email — wrong assertion, not an app bug: the
   wallet legitimately appears in rows for every OTHER active protocol it has
   zero activity against (correct `findInactiveWallets` behavior, global scan by
   design). Fixed the assertion to check the specific wallet+protocol row is
   absent, not the wallet's label globally.
Security flags:
- API08 (unhandled failures in unattended background jobs): closed — both cron
  jobs now catch and log instead of leaving an unhandled rejection; verified via
  direct function calls proving the promise resolves even when the underlying
  service throws.
- Noted but not fixed (outside this step's approved scope, logged in
  ASSUMPTIONS.md): `wallet.label`/`protocol.name` are interpolated unescaped into
  the reminder email's HTML. Low risk today (own-DB values, no auth layer for
  external injection), flagged for whenever those fields' trust boundary changes.
- Injection: no raw SQL; test/mock code touches only Drizzle's query builder and
  the Resend SDK surface.
- Wallets/private-key surface: the "zero-inactive" test temporarily wrote
  activity rows tied to the real seeded wallet — never touched `wallets` itself,
  and every inserted row was deleted by ID in the same test's `afterEach`,
  confirmed via the before/after DB check above.
Next action: Step 8 — frontend manual verification pass (run both dev servers,
click through every dashboard feature including the Step 5 gas auto-detect flow).

## 2026-08-19 — Step 8: Frontend manual verification
Status: DONE
Changed:
- `frontend/src/pages/Dashboard.tsx` — `PROTOCOLS` entries now carry a `chainId`
  (lowercase, matches the backend's `chain` values) alongside the existing
  display `chain` label; the Log Activity submit handler now sends
  `chain: PROTOCOLS.find(...).chainId` (was never sent at all before); gasUsd
  input placeholder updated to say "leave blank to auto-detect from tx hash"
- `frontend/src/api/client.ts` — `logActivity`'s payload type gained `chain?:
  string`
- `backend/src/app.ts` — CORS `methods` now explicitly `['GET', 'POST', 'PATCH']`
  (see Fixed #2)
No automated tests added — out of scope per the plan; verification was running
the real app.
Tested (all against the actual running app, not mocks):
- Backend: `npm run dev` in `backend/`, polled `/health` until ready
- Frontend: `npm run dev` in `frontend/`, polled port 5173 until ready
- Installed Playwright in a scratch dir (not a project dependency — this was a
  one-off manual QA pass, not a permanent addition) and drove system Chrome
  against the live dashboard: loaded the page, read all 4 metric cards, opened
  and read the task checklist, clicked a task checkbox, opened the Log Activity
  modal, filled and submitted a real activity (fake tx hash, real 'ethereum'
  chain), checked the Recent Activity list, captured console errors, screenshot
  after every step
- `npx vitest run` (backend, twice) and `npm run build` (frontend production
  build) after all fixes
- Direct DB queries throughout to verify actual persisted state, not just what
  the UI displayed
Result:
- All 4 metric cards render correctly (confirmed via screenshot:
  `$0.00 / 2 / 4 / 9`)
- Task checklist: 9 real tasks rendered, checkbox click persisted
  `completed: true` for the correct task (confirmed via `GET /api/tasks` after
  the CORS fix — see Fixed #2)
- Log Activity modal: submitted successfully, activity appeared in
  `GET /api/activities` with `chain: "ethereum"` correctly set for the first
  time ever (see Fixed #1) and `gasUsd: null` (expected — real Alchemy call
  attempted with placeholder credentials, failed gracefully per Step 5's design,
  never a 500)
- Recent Activity section: visually confirmed both logged entries appear with
  correct protocol/wallet/timestamp (my own driver script's content-check
  assertion was wrong — see Fixed #3, not an app issue)
- `npx tsc --noEmit`: clean in both packages after every change
- `npm run build` (frontend): succeeded, `dist/` produced (a chunk-size-over-500kb
  advisory printed — informational only, not an error, no action taken)
- Two consecutive `vitest run` after the CORS fix: `19 passed (19)` both times
- Final DB state: protocols/wallets exactly seed data, `tasks: 9 total, 0
  completed` (reverted after QA — see below), `activities count: 0`
Fixed (three real issues, none of which any prior automated test could have
caught — that's what this step is for):
1. **Gas auto-detect (Step 5) was completely unreachable through the UI.** The
   Log Activity form never had a `chain` field in its state at all, and
   `logActivity()`'s payload type didn't include one — so `POST /api/activities`
   always received `chain: undefined`, and the backend's auto-detect condition
   (`body.chain === 'ethereum'`) could never be true from real usage. Root cause:
   Step 5 was scoped to backend-only per its own plan text; the frontend wiring
   was never actually part of any step's file list. Fixed by adding `chainId` to
   each protocol and sending it on submit.
2. **Task completion was silently broken in the real browser.** Clicking a task
   checkbox threw a CORS preflight error (`Method PATCH is not allowed by
   Access-Control-Allow-Methods`) and the request never reached the server.
   Root cause: Step 4 bumped `@fastify/cors` v9→v11 to fix the Fastify-5
   incompatibility (itself a real fix), but v11's default `methods` list is
   `GET,HEAD,POST` only — narrower than v9's — which silently dropped PATCH
   support. Step 4's own tests used Fastify's `.inject()`, which calls route
   handlers directly and never goes through real CORS preflight, so this was
   invisible until an actual browser tried it. Fixed by listing methods
   explicitly (`GET, POST, PATCH`) so a future CORS bump can't silently drop one
   again. Verified via direct `curl -X OPTIONS` preflight check before and after,
   then via the full browser flow completing successfully.
3. My own driver script's "Recent Activity contains the QA note" check was a
   false negative — the notes field is stored but never rendered in that list
   (only actionType/protocol/wallet/timestamp are shown). Confirmed via
   screenshot that the activity genuinely appears; fixed my understanding, not
   any app code.
Not fixed (trivial, no functional impact): browser's automatic `/favicon.ico`
probe 404s — `index.html` has no `<link rel="icon">`. Purely cosmetic, not a
deliverable, left as-is.
Post-verification cleanup: deleted the 2 QA-tagged activity rows (fake tx hash,
notes explicitly marked "Playwright QA smoke test") by exact ID, and reverted the
one task checkbox back to incomplete — none of this was genuine manual user
confirmation, so it didn't belong in the real activity/task log per the project's
own business rules. The 9 real current-week tasks generated during this pass were
left in place — that's the actual deliverable working as intended for the first
time, not test pollution. Both dev servers stopped cleanly afterward (killed by
port, not by broad pattern-match).
Security flags:
- API08 (CORS misconfiguration): found and fixed a real, live misconfiguration
  that silently broke a real feature — exactly the category this flag exists for.
- Confirmed no secrets appeared in any console output or screenshot during this
  pass (Alchemy/Resend placeholder creds only, never touched real ones).
- Wallets/private-key surface: unaffected — this step only touched frontend
  request-shaping and CORS config, no wallet-table code.
Next action: Step 9 — final review pass (re-check ASSUMPTIONS.md for anything
still OPEN, full regression pass, explicit out-of-scope summary, then propose a
commit — re-raising the repo-hygiene issue before any push).

## 2026-08-19 — Step 9: Final review
Status: DONE
Changed:
- `docs/farming-tracker/ASSUMPTIONS.md` — reviewed every item; closed the stale
  `drizzle-kit` version-quirk entry (superseded by Step 2's bump, confirmed no
  stray warning with the current version); added a fully-characterized entry for
  the remaining `npm audit` findings (see Result)
No app code changed this step — this was verification + documentation only.
Tested:
- `npx tsc --noEmit` in both `backend/` and `frontend/`
- `npx vitest run` in `backend/`, twice consecutively
- `npm run build` in `frontend/`
- Direct DB query for full state
- `npm audit` / `npm audit --json`, read in full detail (not just the summary
  line) to correctly characterize what's actually still outstanding
- `git status` at the repo root, to see exactly what this whole session has (and
  hasn't) touched in git
Result:
- Both `tsc --noEmit`: clean
- `vitest run` ×2: `Test Files 5 passed (5)` / `Tests 19 passed (19)` both times
- `npm run build`: succeeded, `dist/index.html` + one JS bundle produced (a
  >500kb chunk-size advisory printed — informational, not an error, not acted on)
- DB state: protocols/wallets exactly seed data, `tasks: 9 total, 0 completed`
  (the real current-week checklist, correctly untouched since Step 8's QA
  cleanup), `activities count: 0`, `protocol_points count: 0`
- `npm audit`: 9 findings total, but on inspection: 8 of the 9 trace to
  `esbuild`, reachable only via `vitest`→`vite` and `drizzle-kit`→`@esbuild-kit/*`
  — both devDependencies, never in the production build. The one "critical"
  entry is specifically Vitest's `--ui` dev-server file-read/execute
  vulnerability; this project never passes `--ui` anywhere. The one production
  dependency involved, `node-cron`→`uuid`, needs a caller-supplied `buf` argument
  to be exploitable, which node-cron's internal usage never provides. Full detail
  written to ASSUMPTIONS.md rather than just repeating the raw count.
- `git status` at repo root: `?? farming-tracker/` — the entire project directory
  is still untracked. Nothing has been staged or committed at any point this
  session, in either this repo or any other.
Fixed: nothing — this step is a check, not a build step.
Security flags (final pass over everything, not just this step):
- Injection: `drizzle-orm` CVE fixed (Step 2), all queries go through Drizzle's
  builder throughout the codebase — confirmed again on this final pass.
- API08: CORS misconfiguration found and fixed (Step 8); secrets never printed to
  logs (Steps 1, 5, 6 fixes); `.env`/`node_modules` confirmed gitignored (Step 1).
- API01: still no auth on any route — final, explicit confirmation this remains
  an accepted, undone gap, not an oversight. Safe only if kept off a public network.
- Wallets/private-key surface: reconfirmed one final time — `wallets` table has
  exactly `id, address, chain, label, created_at`; no code anywhere in the
  repository writes anything else to it.
- Remaining `npm audit` findings: characterized in full above, none blocking.
Next action: present the full Step 9 summary to the user, including the
repo-hygiene issue (git root is the user's work repo, not a farming-tracker repo)
— this needs a decision before any commit is proposed, not just before any push.

## 2026-08-19 — Post-Step-9: standalone repo init + initial commit
Status: DONE
Changed:
- User chose (via AskUserQuestion): a new standalone git repo inside
  `farming-tracker/` itself, independent of the Projects-level work repo
  (`github.com/IFSRNG/fastify-internal-api`) — the repo-hygiene issue flagged
  since the very first review of this project.
- `git init` inside `farming-tracker/`, default branch renamed to `main`
- Removed `./{backend` / `./{backend/src/{db,services,routes,cron},frontend` —
  empty stray directories from a broken brace-expansion command in the original
  (pre-session) scaffold; confirmed empty before deleting
- `farming-tracker/.gitignore` (new) — node_modules, dist, .env/.env.local,
  `.vercel/`, logs, coverage, IDE files, .DS_Store. Deliberately does NOT ignore
  `package-lock.json` (diverges from the old parent-repo `.gitignore`'s
  convention) — committing lockfiles is the better default here given the real
  dependency-mismatch bugs this session already found and fixed
  (Fastify/cors, drizzle-kit/orm)
- Initial commit `c4355eb` — 49 files (`backend/`, `frontend/`,
  `docs/farming-tracker/`, `CLAUDE.md`, `.gitignore`, `vercel.json`, plus the
  Vercel-installed Supabase agent-skill files under `.agents/`/`.claude/`)
Tested:
- `git status` before staging, confirming `.env`/`.env.local`/`.vercel`/
  `node_modules`/`dist` were NOT present in the untracked-files list (i.e.
  correctly ignored) before ever running `git add`
- `git diff --cached | grep` across the full staged diff for secret-shaped
  strings (postgres connection strings, API keys, passwords) before committing
  — every hit was either placeholder text (`.env.example`, `your_alchemy_key`)
  or prose in this session's own WORKLOG referencing secret-handling, never an
  actual credential value
- `git status` after commit
Result:
- Pre-stage untracked list: `.agents/`, `.claude/`, `.gitignore`, `CLAUDE.md`,
  `backend/`, `docs/`, `frontend/`, `skills-lock.json`, `vercel.json` — exactly
  the intended set, secrets correctly absent
- Secrets grep: no real credential values found in the staged diff
- `git log --oneline -1`: `c4355eb Initial commit: farming tracker backend +
  frontend`
- `git status` post-commit: `nothing to commit, working tree clean`
Fixed: the stray empty brace-expansion directories (cosmetic cleanup, pre-dated
this session, unrelated to any deliverable).
Security flags:
- API08/secrets-in-git: this was the core concern of the whole repo-hygiene
  question — resolved by giving the project its own repo AND independently
  verifying no secret values were staged, not just trusting `.gitignore` alone.
- Not pushed anywhere — no remote configured on this new repo, and a push would
  need its own explicit ask regardless per rule 5.
Next action: none required from the plan — all 9 steps are done. Future sessions
should run the session-start ritual (read FEATURE-BRIEF.md, PLAN.md's first
non-done step — there isn't one — ASSUMPTIONS.md's OPEN items, and this entry)
before making changes. Remaining OPEN items in ASSUMPTIONS.md (no auth, unescaped
email HTML, npm audit dev-tooling findings, Vercel/node-cron deployment
architecture mismatch) are known, accepted gaps, not TODOs assigned to any step.

## 2026-08-20 — Post-Step-9: Vercel deployment via GitHub Actions cron
Status: DONE
Context: user asked to deploy to Vercel by linking the GitHub repo. Flagged
before starting that `node-cron` can't run on Vercel serverless functions
(no persistent process); user proposed GitHub Actions cron hitting HTTP
endpoints instead — adopted that design.
Changed:
- `backend/src/routes/cron.ts` (new) — `POST /api/cron/weekly-reminder` and
  `POST /api/cron/paradex-sync`, gated by `Authorization: Bearer $CRON_SECRET`
  (401 without/wrong secret)
- `backend/src/cron/weeklyReminder.ts` — dropped `node-cron` and
  `startCronJobs()` entirely; `runWeeklyReminder`/`runParadexSync` now return a
  success boolean instead of void, so the route layer can surface real HTTP
  failures (see Fixed #2)
- `backend/src/index.ts` — no longer calls `startCronJobs()`
- `backend/src/app.ts` — registers `cronRoutes` under `/api`
- `backend/src/services/notificationService.ts` — two fixes, see Fixed #1 and #2
- `backend/package.json` — removed `node-cron` + `@types/node-cron`
- `backend/src/routes/cron.test.ts` (new) — 6 tests (401 paths, success paths,
  failure→500 paths)
- `backend/src/cron/weeklyReminder.test.ts` — updated for the new boolean
  return, added 2 success-path tests (4 tests total, was 2)
- `package.json` (new, repo root) — npm workspaces (`backend`, `frontend`),
  `"type": "module"` (see Fixed #4), root `typescript`/`@types/node` devDeps
- `tsconfig.json` (new, repo root) — covers `api/`
- `api/index.ts` (new) — Vercel serverless function wrapping `buildApp()`,
  caches the built app across warm invocations
- `vercel.json` — replaced the auto-generated `services` multi-service config
  with `buildCommand`/`outputDirectory`/`installCommand` + an explicit
  `/api/(.*)` → `/api` rewrite (see Fixed #3)
- `frontend/src/api/client.ts` — `baseURL` now resolves to a relative `/api` in
  production (same-origin via the Vercel rewrite) instead of a hardcoded
  `localhost:3001` that would have been unreachable when deployed
- `frontend/package.json` — added `@rollup/rollup-linux-x64-gnu` as an
  `optionalDependency` (see Fixed #5)
- `backend/package-lock.json` + `frontend/package-lock.json` removed, replaced
  by one root-level `package-lock.json` (workspace-wide)
- `.github/workflows/cron.yml` (new) — two schedules (Monday 1am UTC reminder,
  every-6-hours Paradex sync) plus `workflow_dispatch`, each `curl -sf`ing the
  matching `/api/cron/*` route with the bearer secret
- `CLAUDE.md`, `README.md` — updated to describe the actual deployed
  architecture (was previously silent on deployment / described the
  now-removed node-cron scheduler)
- Vercel project (`monmargarcia-5863s-projects/farming-tracker`): framework
  preset reset from the stale auto-detected `services` to `other`
  (`vercel project update --framework other`); `DATABASE_URL`,
  `FARMING_WALLETS`, `CRON_SECRET` added as real env vars across
  production/preview/development (`RESEND_*`/`ALCHEMY_*` deliberately left
  unset — see ASSUMPTIONS.md, OPEN)
- GitHub repo secrets: `CRON_SECRET` (same value as Vercel), `APP_URL`
  (`https://farming-tracker.vercel.app`)
Tested:
- `npx tsc --noEmit` in `backend/`, `frontend/`, and the new repo root, after
  every change
- `npx vitest run` in `backend/`, multiple times through the sequence of fixes
  below, ending clean
- `vercel dev` locally against the real linked project — iterated here first,
  specifically to avoid burning real deploys on routing/config mistakes
- `vercel deploy --prod` — twice (first attempt failed at build, second at
  runtime — see Fixed #4/#5); verified the final live deployment directly with
  `curl` against `https://farming-tracker.vercel.app`: frontend HTML (200),
  `GET /api/tasks` (real Supabase data), `PATCH /api/tasks/999999/complete`
  (multi-segment path, correctly reaches Fastify's own 404), `POST
  /api/cron/*` both without a secret (401) and with the real secret (200,
  `{"ok":true}`) — the real secret was read from `backend/.env` and piped
  directly into `curl`/`vercel env add`, never printed
- `vercel logs` (JSON mode) to get full runtime stack traces for both
  production failures, rather than guessing from the truncated table view
Result: live and verified working end-to-end at
https://farming-tracker.vercel.app — frontend serves, `/api/*` reaches the real
Fastify app and real Supabase DB, multi-segment routing works, cron auth works
both ways (rejects without secret, executes with it).
Fixed (five distinct real bugs, four of them only catchable by an actual
deploy attempt — exactly why this was done as a real deploy-and-iterate
process rather than reasoned out and shipped blind):
1. `notificationService.ts` constructed the Resend client
   (`new Resend(process.env.RESEND_API_KEY)`) at module scope. The Resend SDK
   throws immediately if given no key at all (not just an invalid one) —
   since this module loads eagerly as part of the whole route tree, and
   `RESEND_API_KEY` was deliberately left unset on Vercel, this crashed the
   *entire* app on every single request, not just reminder-related ones.
   First caught via `vercel dev` locally (`FUNCTION_INVOCATION_FAILED` /
   "Missing API key"). Fixed by falling back to an obviously-fake placeholder
   string so construction always succeeds; an actually-missing/invalid key now
   only fails at send time, same graceful-failure contract as Steps 5/7 already
   established elsewhere.
2. Also in `notificationService.ts`: `sendWeeklyReminder()` awaited
   `resend.emails.send()` and unconditionally logged success afterward — never
   checking the SDK's returned `{ data, error }` shape. The Resend SDK doesn't
   throw on API-level failures (bad/expired key, etc.), it resolves with
   `error` populated instead. Caught by manually exercising the live cron
   endpoint with the real (placeholder) key during `vercel dev` testing and
   seeing a false "sent" log line. Fixed by throwing when `error` is present,
   which the existing try/catch in `runWeeklyReminder` already catches
   correctly — and while touching this, changed `runWeeklyReminder`/
   `runParadexSync` to return a success boolean so the route can respond with a
   real 500 on failure, making GitHub Actions correctly flag/notify on a truly
   broken reminder instead of always reporting success.
3. The initial `api/[...path].ts` catch-all-filename convention silently
   failed to route any multi-segment path (`/api/cron/weekly-reminder`,
   `/api/tasks/:id/complete`) to the function at all — Vercel's own router
   returned its own 404 before the function was ever invoked, while
   single-segment paths (`/api/tasks`) worked fine, which made this
   non-obvious until tested directly against several different path shapes.
   Root cause not fully diagnosed (the bracket catch-all convention may not
   behave as a true arbitrary-depth catch-all under the "Other" framework
   preset used here); switched to the more established pattern instead —
   `api/index.ts` (plain filename) plus an explicit `vercel.json` rewrite
   (`/api/(.*)` → `/api`), which preserves the real request path for Fastify's
   own internal router. Verified directly against both single- and
   multi-segment paths after the fix.
4. First production deploy attempt crashed immediately with `SyntaxError:
   Cannot use import statement outside a module` — the new repo-root
   `package.json` had no `"type": "module"` field, so Node defaulted the
   compiled `api/index.js` to CommonJS, which can't parse `import` syntax.
   This didn't surface under `vercel dev` (its local dev transform pipeline is
   less strict about this than the real production runtime) — only a real
   `vercel deploy --prod` caught it. Fixed by adding `"type": "module"` to the
   root `package.json`. Read the full stack trace via `vercel logs --json`
   rather than guessing from the truncated default table output.
5. First production *build* (before fix #4 was even reached) failed on
   `Cannot find module @rollup/rollup-linux-x64-gnu` — a well-known npm
   optional-dependencies bug (npm/cli#4828) where a lockfile generated on
   macOS doesn't correctly declare the Linux-specific Rollup binary Vercel's
   Linux build image needs, even on a reasonably current local npm (11.11.0).
   Fixed by explicitly adding `@rollup/rollup-linux-x64-gnu` as an
   `optionalDependency` in `frontend/package.json`, then regenerating the
   lockfile from a clean `node_modules`/`package-lock.json` deletion — the
   standard documented workaround for this exact error.
Security flags:
- API08 (secrets never printed): every credential handled this step
  (`CRON_SECRET`, `DATABASE_URL`, `FARMING_WALLETS`) was piped directly from
  `backend/.env` into `vercel env add` / `gh secret set` / `curl` without ever
  being echoed to a terminal command whose output I read, consistent with the
  pattern established since Step 2.
- New attack surface introduced and mitigated: the `/api/cron/*` routes are
  reachable from the public internet now that the app is deployed. Verified
  directly (not just asserted) that an unauthenticated request gets 401 and
  never reaches `sendWeeklyReminder`/`syncParadexPoints`.
- API01 (still no auth on data routes): unchanged accepted gap from Step 9,
  but now materially more relevant — the API is genuinely public, not
  localhost-only, as of this deployment. Explicitly re-flagged in README and
  ASSUMPTIONS.md rather than left as a stale "only matters if deployed" note.
- Confirmed no real secret value ever appeared in any tool output, log file, or
  chat-visible command result during this entire deployment process.
Next action: none required. If/when live email/gas-auto-detect functionality is
wanted, add real `RESEND_*`/`ALCHEMY_*` values to the Vercel project's env vars
(ASSUMPTIONS.md, OPEN). Vercel's GitHub integration (auto-deploy on push) has
not yet been explicitly connected in the dashboard — deploys so far were via
`vercel deploy --prod` from the CLI.
