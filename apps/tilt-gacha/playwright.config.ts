import { defineConfig, devices } from "@playwright/test";

const PORT = 4327;

/**
 * E2E は開発サーバーではなく本番ビルドに当てる。
 * `base: './'` や CSS の取り込みなど、ビルドを通してはじめて効く設定があるため。
 *
 * ヘッドレスブラウザには DeviceMotion センサーが存在しないので、この環境そのものが
 * FR-020（ジャイロ非対応環境のフォールバック）の検証対象になる。
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? "line" : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
