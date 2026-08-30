import { describe, expect, it } from 'vitest';
import { describeIssuePath, loadEnvironment, parseEnvironment } from './environment.js';

describe('describeIssuePath', () => {
  // Requirement: a validation failure names the setting it concerns.
  // Case: happy-path
  // Invariant: a single segment is rendered as itself.
  it('renders a top level key as its own name', () => {
    expect(describeIssuePath(['BOOKER_BASE_URL'])).toBe('BOOKER_BASE_URL');
  });

  // Requirement: a nested setting names its full location, so a fault inside a
  // list or an object can be found rather than merely attributed to the whole
  // setting.
  // Case: boundary
  // Invariant: segments are separated by a dot, in order.
  it('joins nested segments with a dot', () => {
    expect(describeIssuePath(['BOOKER_BROWSERS', 1])).toBe('BOOKER_BROWSERS.1');
    expect(describeIssuePath(['credentials', 'username'])).toBe('credentials.username');
  });

  // Requirement: an issue concerning the whole document has no path.
  // Case: boundary
  // Invariant: an empty path renders as the empty string rather than throwing.
  it('renders an empty path as an empty string', () => {
    expect(describeIssuePath([])).toBe('');
  });
});

describe('parseEnvironment', () => {
  // Requirement: the suite runs against the public deployment with no setup.
  // Case: happy-path
  // Invariant: every setting has a documented default.
  it('falls back to defaults when nothing is configured', () => {
    expect(parseEnvironment({})).toEqual({
      baseUrl: 'https://restful-booker.herokuapp.com',
      timeoutMs: 30_000,
      username: 'admin',
      password: 'password123',
      retries: 0,
    });
  });

  // Requirement: the pipeline points the suite at a private instance.
  // Case: happy-path
  // Invariant: an explicit URL is used verbatim.
  it('reads the base URL from the environment', () => {
    expect(parseEnvironment({ BOOKER_BASE_URL: 'https://booker.internal' }).baseUrl).toBe(
      'https://booker.internal',
    );
  });

  // Requirement: a URL pasted from a pipeline variable may carry trailing
  // slashes, which would produce a double slash once a path is appended.
  // Case: boundary
  // Invariant: every trailing slash is removed, not just the last.
  it('strips repeated trailing slashes', () => {
    expect(parseEnvironment({ BOOKER_BASE_URL: 'https://booker.internal///' }).baseUrl).toBe(
      'https://booker.internal',
    );
  });

  // Requirement: CI exports declared-but-unset variables as the empty string,
  // which must not be mistaken for a deliberate override.
  // Case: boundary
  // Invariant: blank, whitespace and undefined all fall back to the default.
  it.each(['', '   ', undefined])('treats the blank value %j as unset', (value) => {
    expect(parseEnvironment({ BOOKER_BASE_URL: value }).baseUrl).toBe(
      'https://restful-booker.herokuapp.com',
    );
  });

  // Requirement: a private instance carries its own credentials.
  // Case: happy-path
  // Invariant: credentials are read as given.
  it('reads credentials from the environment', () => {
    const environment = parseEnvironment({
      BOOKER_USERNAME: 'tester',
      BOOKER_PASSWORD: 'hunter2',
    });

    expect(environment).toMatchObject({ username: 'tester', password: 'hunter2' });
  });

  // Requirement: timeouts and retries are tuned per environment.
  // Case: happy-path
  // Invariant: numeric settings are parsed as numbers, not left as strings.
  it('parses numeric settings', () => {
    expect(parseEnvironment({ BOOKER_TIMEOUT_MS: '5000', BOOKER_RETRIES: '2' })).toMatchObject({
      timeoutMs: 5_000,
      retries: 2,
    });
  });

  // Requirement: retries of zero is legitimate and distinct from unset.
  // Case: boundary
  // Invariant: zero survives parsing.
  it('accepts zero retries', () => {
    expect(parseEnvironment({ BOOKER_RETRIES: '0' }).retries).toBe(0);
  });

  // Requirement: nonsensical settings must stop the run rather than produce a
  // suite that hangs or fails for the wrong reason.
  // Case: error, boundary
  // Invariant: timeouts are positive, retries are not negative, credentials are
  // not empty, and the URL is a URL.
  it.each([
    ['BOOKER_TIMEOUT_MS', '0'],
    ['BOOKER_TIMEOUT_MS', 'soon'],
    ['BOOKER_RETRIES', '-1'],
    ['BOOKER_BASE_URL', 'not-a-url'],
  ])('rejects %s of %s', (key, value) => {
    expect(() => parseEnvironment({ [key]: value })).toThrow(/Invalid API test configuration/);
  });

  // Requirement: a misconfigured run reports every fault at once, so it is not
  // fixed one variable per red build.
  // Case: error
  // Invariant: faults are listed together and remain separately readable.
  it('reports every fault in one message', () => {
    expect(() => parseEnvironment({ BOOKER_BASE_URL: 'not-a-url', BOOKER_RETRIES: '-1' })).toThrow(
      'Invalid API test configuration. BOOKER_BASE_URL: Invalid URL; ' +
        'BOOKER_RETRIES: Too small: expected number to be >=0',
    );
  });
});

describe('loadEnvironment', () => {
  // Requirement: the suite reads its settings from the live process.
  // Case: happy-path
  // Invariant: values exported by the shell reach the parsed configuration.
  it('parses the live process environment', () => {
    process.env.BOOKER_BASE_URL = 'https://loaded.example.com';

    try {
      expect(loadEnvironment().baseUrl).toBe('https://loaded.example.com');
    } finally {
      delete process.env.BOOKER_BASE_URL;
    }
  });
});
