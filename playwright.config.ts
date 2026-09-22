import { defineConfig, devices } from '@playwright/test'
const e2eDb=`artifacts/e2e-${Date.now()}.sqlite`
export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
    { command: 'node server/app.mjs', url: 'http://127.0.0.1:1435/api/health', reuseExistingServer: !process.env.CI, env: { TELO_DB: e2eDb } }
  ],
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1672, height: 1050 } } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }]
})
