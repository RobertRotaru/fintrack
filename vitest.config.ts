import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'server/test/**/*.test.ts', 'web/test/**/*.test.tsx'],
    // API tests share one SQLite file per worker; keep files isolated.
    pool: 'forks',
  },
});
