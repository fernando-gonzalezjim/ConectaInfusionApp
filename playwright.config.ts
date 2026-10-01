import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, retries: 0,
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'npm run dev -w @conecta/customer-web', url: 'http://localhost:5173', reuseExistingServer: false },
    { command: 'npm run dev -w @conecta/management-web', url: 'http://localhost:5174', reuseExistingServer: false }
  ]
});
