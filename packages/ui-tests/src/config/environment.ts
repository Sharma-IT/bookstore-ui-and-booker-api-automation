import { z } from 'zod';
import { describeIssues } from '../validation/issueDescriptions.js';

/**
 * The process environment is a trust boundary: it arrives as untyped strings
 * from a shell, a CI secret store or a .env file. It is parsed once, here,
 * and every consumer downstream works with validated values. A misconfigured
 * pipeline fails at startup with a named field rather than as a puzzling
 * timeout twenty minutes into a run.
 *
 * Keys carry an E2E_ prefix because Vite, which underpins the unit test
 * runner, reserves the bare name BASE_URL and populates it with its own base
 * path inside worker processes.
 */

export const BROWSER_NAMES = ['chromium', 'firefox', 'webkit'] as const;

export type BrowserName = (typeof BROWSER_NAMES)[number];

export type Environment = {
  readonly baseUrl: string;
  readonly apiBaseUrl: string;
  readonly browsers: readonly BrowserName[];
  readonly headless: boolean;
  readonly testTimeoutMs: number;
  readonly navigationTimeoutMs: number;
  readonly expectTimeoutMs: number;
  readonly apiTimeoutMs: number;
  readonly retries: number;
  readonly workers: number | undefined;
};

const withoutTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const url = z.url().transform(withoutTrailingSlash);

const booleanFlag = z.enum(['true', 'false']).transform((value) => value === 'true');

const positiveInteger = z.coerce.number().int().positive();

const nonNegativeInteger = z.coerce.number().int().nonnegative();

/**
 * The share of a test's budget one navigation may spend when no navigation
 * budget is configured. Below one by construction, so a derived pair can never
 * express the fault the check below rejects.
 */
const NAVIGATION_BUDGET_SHARE = 0.75;

const browserList = z
  .string()
  .transform((value) => value.split(',').map((name) => name.trim()))
  .pipe(z.array(z.enum(BROWSER_NAMES)).nonempty());

const environmentSchema = z
  .object({
    E2E_BASE_URL: url.default('https://demoqa.com'),
    E2E_API_BASE_URL: url.optional(),
    E2E_BROWSERS: browserList.default(['chromium']),
    E2E_HEADLESS: booleanFlag.default(true),
    E2E_TEST_TIMEOUT_MS: positiveInteger.default(60_000),
    E2E_NAVIGATION_TIMEOUT_MS: positiveInteger.optional(),
    E2E_EXPECT_TIMEOUT_MS: positiveInteger.default(10_000),
    E2E_API_TIMEOUT_MS: positiveInteger.default(30_000),
    E2E_RETRIES: nonNegativeInteger.default(0),
    E2E_WORKERS: positiveInteger.optional(),
  })
  /**
   * A navigation entitled to the whole test budget cannot report its own
   * failure: the test runs out of time at the same moment, so a page that never
   * loaded is indistinguishable from a test that ran long. Only a configured
   * budget is checked, because a derived one holds the invariant already.
   */
  .check((context) => {
    const navigation = context.value.E2E_NAVIGATION_TIMEOUT_MS;
    const test = context.value.E2E_TEST_TIMEOUT_MS;

    if (navigation === undefined || navigation < test) {
      return;
    }

    context.issues.push({
      // Equivalent: zod's type contract requires a discriminator on a raw
      // issue, but nothing downstream reads it. `describeIssues` renders the
      // path and the message alone, so `parseEnvironment` throws a
      // byte-identical message whatever this says, and no test through the
      // module's public surface can tell the difference.
      // Stryker disable next-line StringLiteral
      code: 'custom',
      input: navigation,
      path: ['E2E_NAVIGATION_TIMEOUT_MS'],
      message:
        `must be below E2E_TEST_TIMEOUT_MS (${test}), or a slow navigation exhausts the ` +
        'test budget at the same moment and is reported as a test timeout rather than as ' +
        'a page that did not load',
    });
  })
  .transform((raw): Environment => ({
    baseUrl: raw.E2E_BASE_URL,
    apiBaseUrl: raw.E2E_API_BASE_URL ?? raw.E2E_BASE_URL,
    browsers: raw.E2E_BROWSERS,
    headless: raw.E2E_HEADLESS,
    testTimeoutMs: raw.E2E_TEST_TIMEOUT_MS,
    navigationTimeoutMs:
      raw.E2E_NAVIGATION_TIMEOUT_MS ??
      Math.floor(raw.E2E_TEST_TIMEOUT_MS * NAVIGATION_BUDGET_SHARE),
    expectTimeoutMs: raw.E2E_EXPECT_TIMEOUT_MS,
    apiTimeoutMs: raw.E2E_API_TIMEOUT_MS,
    retries: raw.E2E_RETRIES,
    workers: raw.E2E_WORKERS,
  }));

/** Values a shell leaves empty are treated as absent so defaults still apply. */
const withoutBlanks = (
  source: Readonly<Record<string, string | undefined>>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, string] => entry[1] !== undefined && entry[1].trim() !== '',
    ),
  );

export const parseEnvironment = (
  source: Readonly<Record<string, string | undefined>>,
): Environment => {
  const result = environmentSchema.safeParse(withoutBlanks(source));

  if (!result.success) {
    throw new Error(
      `Invalid test environment configuration. ${describeIssues(result.error).join('; ')}`,
    );
  }

  return result.data;
};

/**
 * Deliberately a function rather than a module-level constant: importing this
 * module must not fail, so a unit test can exercise the parser without a valid
 * environment present, and a caller can reload after changing a variable.
 */
export const loadEnvironment = (): Environment => parseEnvironment(process.env);
