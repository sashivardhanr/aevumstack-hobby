import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'frontend/tests/integration',
  outputDir: 'artifacts/phase4-playwright',
  workers: 1,
  timeout: 45_000,
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:5173',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
  },
});
