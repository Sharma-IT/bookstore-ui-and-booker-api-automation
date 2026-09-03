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
  expect: {
    timeout: environment.expectTimeoutMs,
    toHaveScreenshot: {
      // Antialiasing differs by a pixel or two between runs on the same engine,
      // so a strict comparison reports a difference nobody can see or act on.
      // One per cent of the frame absorbs that and still fails on a moved
      // control, a changed colour or a dropped element.
      maxDiffPixelRatio: 0.01,
      // Both remove a source of difference that has nothing to do with layout:
      // an animation caught mid-frame, and a blinking caret in a focused field.
      animations: 'disabled',
      caret: 'hide',
      // Comparisons are in CSS pixels, so a run on a high-density display
      // produces the same image as one on an ordinary display.
      scale: 'css',
    },
  },

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
