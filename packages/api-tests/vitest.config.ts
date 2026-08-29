import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Two projects with the same runner, kept apart because they answer
    // different questions and run at different speeds. The unit project covers
    // pure modules and needs no network; the api project talks to a live
    // deployment and is the suite proper.
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.spec.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'api',
          include: ['tests/**/*.spec.ts'],
          environment: 'node',
          globalSetup: ['./tests/globalSetup.ts'],
          setupFiles: ['./tests/setup.ts'],
          // The public deployment sleeps and answers slowly when it wakes.
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
    // Bookings are created per test under names unique to the process, so spec
    // files are safe to run together.
    fileParallelism: true,
    reporters: process.env.CI ? ['dot', 'junit'] : ['default'],
    outputFile: { junit: 'reports/api-junit.xml' },
  },
});
