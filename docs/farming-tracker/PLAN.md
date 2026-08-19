# Farming Tracker — Execution Plan

Status markers: `[ ]` pending · `[~]` in progress · `[x]` done (date) · `[!]` blocked: reason

## [x] Step 1 — Env & tooling bootstrap (2026-08-19)
Files: `backend/.env` (from `.env.example`), `backend/drizzle.config.ts`,
`backend/vitest.config.ts`, `backend/package.json` (vitest devDep + test scripts),
`frontend/tsconfig.json` + `frontend/src/vite-env.d.ts` (found missing, fixed).
`npm install` in both `backend/` and `frontend/`.
Verify: `tsc --noEmit` clean in both packages, `vitest run --passWithNoTests`
executes cleanly. See WORKLOG.md for full result.

## [x] Step 2 — Drizzle migrations against Supabase (2026-08-19)
Generated + ran the initial migration from `schema.ts`. All 5 tables, 5 FKs,
correct numeric precision, `wallets.address` unique constraint, no private-key
surface — all verified live against Supabase. See WORKLOG.md for full result.

## [x] Step 3 — Seed script (2026-08-19)
`backend/src/db/seed.ts`: 4 protocols + 1 wallet, idempotent. Verified: ran twice,
second run inserted nothing, counts stayed 4/1, row contents match spec exactly.
See WORKLOG.md for full result.

## [x] Step 4 — Backend route tests + fix tasks.ts redirect bug (2026-08-19)
Fixed the redirect bug, added a testable `buildApp()` factory, wrote 8 Vitest
route tests (all passing, twice in a row, DB left in exact seed state both times).
Also fixed two pre-existing bugs the tests caught on first real boot: a
Fastify-5-incompatible `@fastify/cors`/`@fastify/sensible` pin (app never actually
started before this), and `db/index.ts` not loading its own `DATABASE_URL`. See
WORKLOG.md for full detail.

## [x] Step 5 — Price service + gas auto-detect (2026-08-19)
`backend/src/services/priceService.ts` added, wired into `POST /api/activities`
exactly as planned. 3 new tests (auto-detect, manual-override, graceful-failure),
11/11 suite passing twice in a row, DB left in exact seed state both times. Also
fixed a pre-existing log-hygiene gap in `walletService.ts` (raw axios errors could
print the Alchemy-API-key-bearing URL to logs). See WORKLOG.md for full detail.

## [x] Step 6 — Paradex polling tests (2026-08-19)
Added zod validation on the Paradex leaderboard response shape (rejects malformed
responses instead of inserting garbage) and 3 tests: correct insert of
points+rank, second poll appends rather than overwrites, malformed response is
rejected end-to-end. 14/14 suite passing twice in a row, DB in exact seed state
both times. See WORKLOG.md for full detail.

## [x] Step 7 — Weekly reminder tests + cron error handling (2026-08-19)
Wrapped both cron callbacks in try/catch + logging, extracted them as testable
named functions. 5 new tests (inactive-pair content, active-pair exclusion,
zero-inactive → no send, both cron wrappers swallow errors). 19/19 suite passing
twice in a row, DB in exact seed state both times. See WORKLOG.md for full detail.

## [x] Step 8 — Frontend manual verification (2026-08-19)
Ran both dev servers, drove the real UI with a Playwright script against system
Chrome (chromium-cli unavailable). Found and fixed 3 real bugs no prior step could
have caught: gas auto-detect was unreachable (frontend never sent `chain`), task
completion was silently blocked by CORS in the actual browser (Fastify `.inject()`
tests bypass real preflight), and a stray missing-favicon 404 (cosmetic, left
as-is). Frontend production build verified clean. See WORKLOG.md for full detail.

## [x] Step 9 — Final review (2026-08-19)
All 6 previously-OPEN items reviewed; 2 closed out as stale/superseded (drizzle-kit
version quirk resolved by Step 2's bump), 1 newly characterized in detail (npm
audit remainder — dev-tooling only + one low-real-risk production dependency).
Full regression: tsc clean (both packages), vitest 19/19 twice, frontend
production build clean, DB in exact seed state. See WORKLOG.md for full detail and
ASSUMPTIONS.md for the final OPEN-item list presented to the user.
Re-check ASSUMPTIONS.md for anything still OPEN, full `tsc`+`vitest` regression
pass, explicit summary of what's intentionally out of scope (API01/no-auth). Only
then propose a commit — re-raise the repo-hygiene issue (ASSUMPTIONS.md, OPEN)
before proposing any push, since it's independent of code readiness.
