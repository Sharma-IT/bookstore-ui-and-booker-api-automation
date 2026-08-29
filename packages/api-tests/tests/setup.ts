import { beforeAll } from 'vitest';
import { request, settings } from 'pactum';
import { loadEnvironment } from '../src/config/environment.js';

/**
 * Runs once per test file. Vitest gives each file its own worker process, so
 * pactum's module-level configuration is per-file state rather than shared
 * mutable state, and files stay safe to run in parallel.
 */
beforeAll(() => {
  const environment = loadEnvironment();

  request.setBaseUrl(environment.baseUrl);
  request.setDefaultTimeout(environment.timeoutMs);

  // Report the request and response on failure. The value of an API suite is
  // largely in what it tells you when it goes red, and a bare status mismatch
  // sends the reader back to the terminal with curl.
  settings.setLogLevel('WARN');
});
