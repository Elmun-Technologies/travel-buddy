import { defineConfig, devices } from "@playwright/test";

// Uncommon port: other local projects use 3000/3100. Never reuse a server we did not start —
// it may be another project (it happened: a foreign app answered on 3100).
const port = Number(process.env.E2E_PORT ?? 3917);
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  // Smoke tests run against the production build. Test-only bot token signs fake Telegram logins.
  webServer: {
    command: `pnpm start --port ${port}`,
    port,
    reuseExistingServer: false,
    env: {
      APP_URL: `http://localhost:${port}`,
      TELEGRAM_BOT_TOKEN: process.env.E2E_BOT_TOKEN ?? "1:e2e-test-token",
      TELEGRAM_BOT_USERNAME: "e2e_test_bot",
      APP_ENV: "test",
    },
  },
});
