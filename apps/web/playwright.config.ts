import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Optional: reuse an installed Chrome (e.g. PLAYWRIGHT_CHROME_CHANNEL=chrome) when the
        // Playwright browser download is unavailable. CI keeps the bundled Chromium.
        ...(process.env.PLAYWRIGHT_CHROME_CHANNEL
          ? { channel: process.env.PLAYWRIGHT_CHROME_CHANNEL }
          : {}),
        // On Linux, Chromium builds download file names with the native charset. Without a
        // UTF-8 locale (bare containers) it replaces names such as "garantía-baní-ii.pdf"
        // with "download", so the browser always gets one here. No effect on Windows/macOS.
        launchOptions: { env: { ...process.env, LANG: process.env.LANG || 'C.UTF-8' } },
      },
    },
  ],
  // E2E runs against the production bundle served by `vite preview`: it exercises the real
  // lazy-loaded chunks and avoids the dev server compiling modules on demand while several
  // workers navigate at once (which made route chunks time out under parallel load).
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --strictPort',
    port: 4173,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
