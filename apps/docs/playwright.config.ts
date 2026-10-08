import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke + axe over the built site (`pnpm build` first). Not part of
 * `pnpm test`; meant for a separate, non-blocking CI job:
 * `pnpm --filter @color-kit/docs test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4319',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'pnpm exec vite preview --port 4319 --strictPort',
    url: 'http://localhost:4319',
    reuseExistingServer: !process.env.CI,
  },
});
