import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@api': fileURLToPath(new URL('./src/api', import.meta.url)),
      '@config': fileURLToPath(new URL('./src/config', import.meta.url)),
      '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
      '@fixtures': fileURLToPath(new URL('./src/fixtures', import.meta.url)),
      '@pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
    },
  },
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
