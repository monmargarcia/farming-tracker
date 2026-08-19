import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Tests run against a single real Supabase DB (no per-test transaction
    // isolation), and some routes (e.g. weekly task generation) scan DB-wide
    // state. Running test files concurrently caused cross-file races against
    // shared rows — force sequential execution instead.
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    // findInactiveWallets does 2 sequential DB round-trips per wallet×protocol
    // pair (accepted N+1 pattern, fine for this app's real usage scale — a
    // weekly cron, not a user-facing path). Real network latency to Supabase
    // pushes that past Vitest's 5s default under test.
    testTimeout: 20_000,
  },
})
