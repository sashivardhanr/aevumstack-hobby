import { defineConfig } from '@playwright/test';

const origin = 'http://127.0.0.1:3177';

export default defineConfig({
  testDir: 'frontend/tests/parity',
  outputDir: 'artifacts/phase7-parity',
  workers: 1,
  use: { baseURL: origin, reducedMotion: 'reduce' },
  webServer: {
    command: 'node backend/dist/server.js --static',
    url: origin + '/api/health/live',
    reuseExistingServer: false,
    env: {
      API_HOST: '127.0.0.1',
      API_PORT: '3177',
      API_ALLOWED_ORIGINS: origin,
      DATABASE_URL: 'postgres://unused@127.0.0.1:1/unused',
      IDEMPOTENCY_HMAC_KEY: 'phase7-synthetic-browser-fixture-only',
    },
  },
});
