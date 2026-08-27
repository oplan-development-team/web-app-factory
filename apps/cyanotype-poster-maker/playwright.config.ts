import { defineConfig, devices } from '@playwright/test';

const PORT = 4327;

/**
 * E2E は開発サーバーではなく本番ビルドに当てる（NFR-008.4）。
 * `base: './'` や CSS の取り込みなど、ビルドを通してはじめて効く設定があるため。
 *
 * baseURL / webServer.url は `localhost` で揃える。vite preview は環境によって
 * IPv6 の localhost にだけバインドされ、`127.0.0.1` で繋がらないことがある。
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'line' : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
