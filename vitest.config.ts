import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the pure support modules are unit tested here. Browser-driven
    // behaviour is covered by the Playwright suite under tests/.
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    reporters: process.env.CI ? ['dot', 'junit'] : ['dot'],
    outputFile: { junit: 'reports/unit-junit.xml' },
    coverage: {
      provider: 'v8',
      include: ['src/data/**/*.ts', 'src/config/**/*.ts'],
      exclude: ['**/*.spec.ts'],
    },
  },
});
