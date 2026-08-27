import { defineConfig, devices } from '@playwright/test';
import { loadEnvironment } from './src/config/environment.js';

const DEVICE_BY_BROWSER = {
  chromium: 'Desktop Chrome',
  firefox: 'Desktop Firefox',
  webkit: 'Desktop Safari',
} as const;

const environment = loadEnvironment();
const isContinuousIntegration = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: environment.testTimeoutMs,
  expect: { timeout: environment.expectTimeoutMs },

  // Each spec owns the data it creates, so the whole suite runs in parallel.
  fullyParallel: true,
  ...(environment.workers === undefined ? {} : { workers: environment.workers }),

  // A retry that passes is still a defect, so retries are opt-in per
  // environment and default to none. `test.only` never reaches the pipeline.
  retries: environment.retries,
  forbidOnly: isContinuousIntegration,

  reporter: isContinuousIntegration
    ? [['blob'], ['junit', { outputFile: 'reports/e2e-junit.xml' }], ['github'], ['list']]
    : [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],

  use: {
    baseURL: environment.baseUrl,
    headless: environment.headless,
    // Diagnostics are captured on the failing attempt only, so a green run
    // stays cheap and a red one arrives with everything needed to triage it.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: environment.expectTimeoutMs,
    navigationTimeout: environment.testTimeoutMs,
    testIdAttribute: 'data-testid',
  },

  // The seeding fixtures build their own request context against
  // `apiBaseUrl`, so `baseURL` here belongs to the interface under test alone.
  projects: environment.browsers.map((browserName) => ({
    name: browserName,
    use: devices[DEVICE_BY_BROWSER[browserName]],
  })),
});
