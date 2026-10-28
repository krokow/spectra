import { defineConfig } from 'vitest/config'

// Tests SQL (RLS, RPC, triggers) sur un Postgres réel. `npm run test:db`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/tests/db/**/*.test.ts'],
    globalSetup: ['supabase/tests/db/globalSetup.ts'],
    testTimeout: 20_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
})
