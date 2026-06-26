import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 30_000,
    // Integration tests run against a single shared local Supabase database and
    // each suite calls resetDatabase() in beforeEach. Running test files in
    // parallel lets one file wipe another's data mid-flight, so force serial
    // execution across files.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
