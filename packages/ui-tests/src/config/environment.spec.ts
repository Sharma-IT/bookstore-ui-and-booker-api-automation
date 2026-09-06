import { describe, expect, it } from 'vitest';
import { loadEnvironment, parseEnvironment } from './environment.js';

describe('parseEnvironment', () => {
  // Requirement: a developer with no .env file still gets a runnable suite
  // pointed at the public DemoQA deployment.
  // Case: happy-path
  // Invariant: every setting has a documented default.
  it('falls back to defaults when nothing is configured', () => {
    expect(parseEnvironment({})).toEqual({
      baseUrl: 'https://demoqa.com',
      apiBaseUrl: 'https://demoqa.com',
      browsers: ['chromium'],
      headless: true,
      testTimeoutMs: 60_000,
      navigationTimeoutMs: 45_000,
      expectTimeoutMs: 10_000,
      apiTimeoutMs: 30_000,
      retries: 0,
      workers: undefined,
    });
  });

  // Requirement: the pipeline points the suite at a deployed environment.
  // Case: happy-path
  // Invariant: an explicit E2E_BASE_URL is used verbatim.
  it('reads the base URL from the environment', () => {
    expect(parseEnvironment({ E2E_BASE_URL: 'https://staging.example.com' }).baseUrl).toBe(
      'https://staging.example.com',
    );
  });

  // Requirement: the API may be deployed separately from the UI.
  // Case: boundary
  // Invariant: E2E_API_BASE_URL defaults to E2E_BASE_URL but overrides it when set.
  it('defaults the API URL to the base URL and honours an override', () => {
    expect(parseEnvironment({ E2E_BASE_URL: 'https://ui.example.com' }).apiBaseUrl).toBe(
      'https://ui.example.com',
    );
    expect(
      parseEnvironment({
        E2E_BASE_URL: 'https://ui.example.com',
        E2E_API_BASE_URL: 'https://api.example.com',
      }).apiBaseUrl,
    ).toBe('https://api.example.com');
  });

  // Requirement: a trailing slash in a configured URL must not produce a
  // double slash once a path is appended.
  // Case: boundary
  // Invariant: URLs are stored without a trailing slash.
  it('strips a trailing slash from configured URLs', () => {
    expect(parseEnvironment({ E2E_BASE_URL: 'https://demoqa.com/' }).baseUrl).toBe(
      'https://demoqa.com',
    );
  });

  // Requirement: a URL pasted from a pipeline variable may carry more than one
  // trailing slash.
  // Case: boundary
  // Invariant: every trailing slash is removed, not just the last.
  it('strips repeated trailing slashes', () => {
    expect(parseEnvironment({ E2E_BASE_URL: 'https://demoqa.com///' }).baseUrl).toBe(
      'https://demoqa.com',
    );
  });

  // Requirement: CI systems export declared-but-unset variables as the empty
  // string, which must not be mistaken for a deliberate override.
  // Case: boundary
  // Invariant: blank and whitespace-only values fall back to the default.
  it.each(['', '   '])('treats the blank value %j as unset', (value) => {
    expect(parseEnvironment({ E2E_BASE_URL: value }).baseUrl).toBe('https://demoqa.com');
  });

  // Requirement: an explicitly undefined key behaves the same as an absent one.
  // Case: boundary
  // Invariant: reading the value never throws on undefined.
  it('treats an undefined value as unset', () => {
    expect(parseEnvironment({ E2E_BASE_URL: undefined }).baseUrl).toBe('https://demoqa.com');
  });

  // Requirement: cross-browser coverage is selected per pipeline stage.
  // Case: happy-path, boundary
  // Invariant: the list is comma separated, trimmed, and order is preserved.
  it('parses a comma separated browser list', () => {
    expect(parseEnvironment({ E2E_BROWSERS: 'firefox, webkit ,chromium' }).browsers).toEqual([
      'firefox',
      'webkit',
      'chromium',
    ]);
  });

  // Requirement: a typo in the browser list must stop the run, not silently
  // reduce coverage.
  // Case: error
  // Invariant: the offending value is named in the failure.
  it('rejects an unknown browser, naming the offending position', () => {
    expect(() => parseEnvironment({ E2E_BROWSERS: 'chromium,chrome' })).toThrow(
      'Invalid test environment configuration. E2E_BROWSERS.1: ' +
        'Invalid option: expected one of "chromium"|"firefox"|"webkit"',
    );
  });

  // Requirement: local debugging runs headed.
  // Case: boundary
  // Invariant: only the exact strings true and false are accepted.
  it('parses the headless flag', () => {
    expect(parseEnvironment({ E2E_HEADLESS: 'false' }).headless).toBe(false);
    expect(parseEnvironment({ E2E_HEADLESS: 'true' }).headless).toBe(true);
    expect(() => parseEnvironment({ E2E_HEADLESS: 'yes' })).toThrow(/E2E_HEADLESS/);
  });

  // Requirement: timeouts and retries are tuned per environment.
  // Case: happy-path
  // Invariant: numeric settings are parsed as numbers, not left as strings.
  it('parses numeric settings', () => {
    const environment = parseEnvironment({
      E2E_TEST_TIMEOUT_MS: '60000',
      E2E_EXPECT_TIMEOUT_MS: '15000',
      E2E_API_TIMEOUT_MS: '20000',
      E2E_RETRIES: '2',
      E2E_WORKERS: '4',
    });

    expect(environment).toMatchObject({
      testTimeoutMs: 60_000,
      expectTimeoutMs: 15_000,
      apiTimeoutMs: 20_000,
      retries: 2,
      workers: 4,
    });
  });

  // Requirement: a nonsensical timeout would hang or instantly fail the suite.
  // Case: error, boundary
  // Invariant: timeouts are positive, retries are not negative.
  it.each([
    ['E2E_TEST_TIMEOUT_MS', '0'],
    ['E2E_EXPECT_TIMEOUT_MS', '-1'],
    ['E2E_RETRIES', '-1'],
    ['E2E_WORKERS', '0'],
    ['E2E_API_TIMEOUT_MS', '0'],
    ['E2E_NAVIGATION_TIMEOUT_MS', '0'],
    ['E2E_TEST_TIMEOUT_MS', 'soon'],
  ])('rejects %s of %s', (key, value) => {
    expect(() => parseEnvironment({ [key]: value })).toThrow(
      /Invalid test environment configuration/,
    );
  });

  // Requirement: retries of zero is legitimate and must not be confused with
  // an unset value.
  // Case: boundary
  // Invariant: zero retries survives parsing.
  it('accepts zero retries', () => {
    expect(parseEnvironment({ E2E_RETRIES: '0' }).retries).toBe(0);
  });

  // Requirement: a malformed URL must be caught before a browser is launched.
  // Case: error
  // Invariant: the URL is validated, not merely copied.
  it('rejects a malformed base URL', () => {
    expect(() => parseEnvironment({ E2E_BASE_URL: 'not-a-url' })).toThrow(
      'Invalid test environment configuration. E2E_BASE_URL: Invalid URL',
    );
  });
});

describe('parseEnvironment failure reporting', () => {
  // Requirement: a run misconfigured in several places must report every fault
  // at once, so the pipeline is not fixed one variable per red build.
  // Case: error
  // Invariant: faults are listed together and remain separately readable.
  it('reports every fault in one message', () => {
    expect(() => parseEnvironment({ E2E_BASE_URL: 'not-a-url', E2E_RETRIES: '-1' })).toThrow(
      'Invalid test environment configuration. E2E_BASE_URL: Invalid URL; ' +
        'E2E_RETRIES: Too small: expected number to be >=0',
    );
  });
});

describe('loadEnvironment', () => {
  // Requirement: the Playwright configuration reads its settings from the live
  // process environment.
  // Case: happy-path
  // Invariant: values exported by the shell reach the parsed configuration.
  it('parses the live process environment', () => {
    process.env.E2E_BASE_URL = 'https://loaded.example.com';

    try {
      expect(loadEnvironment().baseUrl).toBe('https://loaded.example.com');
    } finally {
      delete process.env.E2E_BASE_URL;
    }
  });
});
