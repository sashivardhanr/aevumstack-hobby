import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'frontend/tests/local-runtime',
  outputDir: 'artifacts/phase5-playwright',
  workers: 1,
  timeout: 100_000,
  use: { browserName: 'chromium', baseURL: 'http://127.0.0.1:3000', reducedMotion: 'reduce' },
});
