import { defineConfig } from 'vitest/config';

// API contract tests run against a live backend (see tests/contract/api.contract.test.ts).
export default defineConfig({
  test: {
    include: ['tests/contract/**/*.test.ts'],
    testTimeout: 20_000,
    // One file, run in order: some checks (login throttling) rely on sequence.
    fileParallelism: false,
  },
});
