import { describe, expect, it } from 'vitest';
import { parseEnvironment } from './environment.js';

describe('parseEnvironment API timeout', () => {
  // Requirement: seeding calls to the Book Store service are far slower than
  // any interaction with the interface, so they carry their own budget rather
  // than borrowing the assertion timeout.
  // Case: boundary
  // Invariant: the API budget is configured independently of the UI budget.
  it('keeps the API timeout independent of the assertion timeout', () => {
    const environment = parseEnvironment({ E2E_EXPECT_TIMEOUT_MS: '5000' });

    expect(environment.expectTimeoutMs).toBe(5_000);
    expect(environment.apiTimeoutMs).toBe(30_000);
  });
});

describe('parseEnvironment navigation budget', () => {
  // Requirement: a navigation that runs out of time reports that the page did
  // not load, while the test still has time left to say so.
  // Case: happy-path
  // Invariant: the navigation budget is strictly below the test budget.
  it('derives a navigation budget below the test budget when none is configured', () => {
    const environment = parseEnvironment({});

    expect(environment.navigationTimeoutMs).toBe(45_000);
    expect(environment.navigationTimeoutMs).toBeLessThan(environment.testTimeoutMs);
  });

  // Requirement: shortening the test budget for a local run must not have to be
  // paired with a second edit to keep the pair coherent.
  // Case: happy-path
  // Invariant: the derived budget tracks whatever test budget is configured.
  it('derives the navigation budget from a configured test budget', () => {
    expect(parseEnvironment({ E2E_TEST_TIMEOUT_MS: '20000' }).navigationTimeoutMs).toBe(15_000);
  });

  // Requirement: a budget is a whole number of milliseconds.
  // Case: boundary
  // Invariant: a test budget that does not divide evenly still derives an integer.
  it('rounds a derived budget down to whole milliseconds', () => {
    expect(parseEnvironment({ E2E_TEST_TIMEOUT_MS: '1001' }).navigationTimeoutMs).toBe(750);
  });

  // Requirement: an environment whose deployment is slower than the default
  // allows can raise the navigation budget on its own.
  // Case: happy-path
  // Invariant: a configured budget is used verbatim rather than derived.
  it('uses a configured navigation budget verbatim', () => {
    expect(
      parseEnvironment({ E2E_TEST_TIMEOUT_MS: '60000', E2E_NAVIGATION_TIMEOUT_MS: '50000' })
        .navigationTimeoutMs,
    ).toBe(50_000);
  });

  // Requirement: the two budgets may sit as close together as the configurer
  // wants, provided the navigation one still ends first.
  // Case: boundary
  // Invariant: one millisecond of headroom is enough.
  it('accepts a navigation budget one millisecond below the test budget', () => {
    expect(
      parseEnvironment({ E2E_TEST_TIMEOUT_MS: '60000', E2E_NAVIGATION_TIMEOUT_MS: '59999' })
        .navigationTimeoutMs,
    ).toBe(59_999);
  });

  // Requirement: a navigation entitled to the whole test budget cannot report
  // its own failure, because the test runs out of time at the same moment.
  // Case: error, boundary
  // Invariant: equalling the test budget is rejected, not merely exceeding it.
  it.each(['60000', '60001'])(
    'rejects a navigation budget of %s against a 60000 test budget',
    (navigation) => {
      expect(() =>
        parseEnvironment({ E2E_TEST_TIMEOUT_MS: '60000', E2E_NAVIGATION_TIMEOUT_MS: navigation }),
      ).toThrow(/Invalid test environment configuration/);
    },
  );

  // Requirement: the fault names both budgets, so the fix does not need a
  // reading of the parser.
  // Case: error
  // Invariant: the message carries the field and the budget it must sit below.
  it('names both budgets when the navigation budget is not smaller', () => {
    expect(() =>
      parseEnvironment({ E2E_TEST_TIMEOUT_MS: '30000', E2E_NAVIGATION_TIMEOUT_MS: '30000' }),
    ).toThrow(
      'E2E_NAVIGATION_TIMEOUT_MS: must be below E2E_TEST_TIMEOUT_MS (30000), or a slow ' +
        'navigation exhausts the test budget at the same moment and is reported as a test ' +
        'timeout rather than as a page that did not load',
    );
  });
});
