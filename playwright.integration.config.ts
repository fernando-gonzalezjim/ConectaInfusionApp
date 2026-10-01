import { defineConfig, devices } from '@playwright/test';

// Only the isolated integration runner may supply this connection.
const databaseUrl = process.env.FOUNDATION_TEST_DATABASE_URL;
if (databaseUrl !== 'postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser') {
  throw new Error('Run npm run test:integration to use the isolated browser database.');
}

export default defineConfig({
  testDir: './tests/integration', retries: 0,
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'npm run start -w @conecta/api', url: 'http://localhost:3001/api/v1/ready', reuseExistingServer: false,
      env: { DATABASE_URL: databaseUrl, PORT: '3001' } },
    { command: 'npm run dev -w @conecta/customer-web', url: 'http://localhost:5173', reuseExistingServer: false },
    { command: 'npm run dev -w @conecta/management-web', url: 'http://localhost:5174', reuseExistingServer: false }
  ]
});
