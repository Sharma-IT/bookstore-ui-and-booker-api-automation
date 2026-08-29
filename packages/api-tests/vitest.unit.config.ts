import { defineConfig } from 'vitest/config';

/**
 * The configuration the mutation runner uses.
 *
 * Stryker's Vitest runner has no option to select one project from a projects
 * config, so pointing it at the main config would run the network-backed API
 * suite once per mutant. This config collects the pure unit tests only, which
 * is both the correct scope for mutation testing and the difference between a
 * run measured in seconds and one measured in hours.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    reporters: ['dot'],
  },
});
