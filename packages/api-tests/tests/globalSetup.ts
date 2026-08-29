import { loadEnvironment } from '../src/config/environment.js';

/**
 * Restful Booker is hosted on a free dyno that sleeps when idle and can take
 * tens of seconds to wake. Waking it once, here, means the first real scenario
 * is not the one that pays for it and is not the one that fails when the wake
 * exceeds its timeout.
 *
 * This is a readiness check rather than a test: it asserts nothing about
 * behaviour, and its only job is to fail the run early, with a clear message,
 * when the service is unreachable.
 */
export default async function warmUpService(): Promise<void> {
  const { baseUrl, timeoutMs } = loadEnvironment();
  const deadline = Date.now() + timeoutMs;
  const attemptDelayMs = 2_000;

  let lastFailure = 'no attempt was made';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/ping`, {
        signal: AbortSignal.timeout(attemptDelayMs * 5),
      });

      if (response.ok) {
        return;
      }

      lastFailure = `${baseUrl}/ping answered ${response.status}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, attemptDelayMs));
  }

  throw new Error(
    `Restful Booker at ${baseUrl} did not become ready within ${timeoutMs}ms. Last attempt: ${lastFailure}`,
  );
}
