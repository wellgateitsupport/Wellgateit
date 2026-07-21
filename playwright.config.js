import { defineConfig } from '@playwright/test';
import fs from 'node:fs';

// ใน sandbox ใช้ Chromium ที่ติดตั้งไว้แล้ว; ใน CI ปล่อยให้ Playwright ใช้ตัวที่ดาวน์โหลดเอง
const localChromium = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = process.env.CHROMIUM_PATH
  || (fs.existsSync(localChromium) ? localChromium : undefined);

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
    viewport: { width: 1440, height: 900 },
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok'
  },
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
