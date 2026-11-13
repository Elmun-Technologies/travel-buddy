import { defineConfig, devices } from "@playwright/test";

const port = 3100;
export default defineConfig({
  testDir: "e2e",
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  // Smoke tests run against the production build (no DB needed for page render).
  webServer: { command: `pnpm start --port ${port}`, port, reuseExistingServer: !process.env.CI },
});
