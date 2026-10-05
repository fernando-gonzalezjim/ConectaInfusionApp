import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';

// Only the isolated integration runner may supply this connection.
const databaseUrl = process.env.FOUNDATION_TEST_DATABASE_URL;
if (databaseUrl !== 'postgresql://foundation_test:foundation_test_only@127.0.0.1:55432/foundation_browser') {
  throw new Error('Run npm run test:integration to use the isolated browser database.');
}
// Inherited by test workers and the API, never persisted or used outside disposable tests.
const outboxKeys = process.env.FOUNDATION_TEST_OUTBOX_KEYS ??= JSON.stringify({ integration: randomBytes(32).toString('base64') });
const throttleKey = process.env.FOUNDATION_TEST_THROTTLE_KEY ??= randomBytes(32).toString('base64');

export default defineConfig({
  // Email suites share one disposable Mailpit service; serialize its lifecycle across files.
  workers: 1,
  testDir: './tests/integration', retries: 0,
  use: { trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'npm run dev', url: 'http://localhost:3001/api/v1/ready', reuseExistingServer: false,
      env: { DATABASE_URL: databaseUrl, PORT: '3001', NODE_ENV: 'test', IDENTITY_ENABLED: 'true',
        IDENTITY_PHOTO_DIRECTORY:process.env.FOUNDATION_TEST_PHOTO_DIRECTORY??'',
        WEB_ORIGINS: 'http://localhost:5173,http://localhost:5174', IDENTITY_PUBLIC_ORIGIN: 'http://localhost:5173',
        IDENTITY_OUTBOX_ACTIVE_KEY_ID: 'integration',
        IDENTITY_OUTBOX_KEYS: outboxKeys,
        IDENTITY_THROTTLE_KEY: throttleKey, IDENTITY_MAIL_TRANSPORT: 'mailpit',
        SMTP_HOST: '127.0.0.1', SMTP_PORT: '11025', SMTP_FROM: 'no-reply@conecta.example.test',
        SMTP_USER: '', SMTP_PASSWORD: '', SMTP_TLS_MODE: '' } }
  ]
});
