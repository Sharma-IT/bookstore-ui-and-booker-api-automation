import { z } from 'zod';

/**
 * Configuration is parsed once, here, at the boundary between the shell and
 * the suite. A misconfigured pipeline then fails at startup naming the field,
 * rather than as a puzzling 403 twenty tests later.
 *
 * Keys carry a BOOKER_ prefix so they cannot collide with the UI suite's E2E_
 * keys, with Vite's reserved BASE_URL, or with anything a CI runner exports.
 */

export type Environment = {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly username: string;
  readonly password: string;
  readonly retries: number;
};

const withoutTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const url = z.url().transform(withoutTrailingSlash);

const environmentSchema = z
  .object({
    BOOKER_BASE_URL: url.default('https://restful-booker.herokuapp.com'),
    BOOKER_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    // Documented publicly by the service as its only credentials. They are a
    // default rather than a secret, and are overridable for a private instance.
    BOOKER_USERNAME: z.string().min(1).default('admin'),
    BOOKER_PASSWORD: z.string().min(1).default('password123'),
    BOOKER_RETRIES: z.coerce.number().int().nonnegative().default(0),
  })
  .transform((raw): Environment => ({
    baseUrl: raw.BOOKER_BASE_URL,
    timeoutMs: raw.BOOKER_TIMEOUT_MS,
    username: raw.BOOKER_USERNAME,
    password: raw.BOOKER_PASSWORD,
    retries: raw.BOOKER_RETRIES,
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

/**
 * Renders the location of a validation issue.
 *
 * Every key in the schema above is a flat scalar, so today this only ever
 * receives a single segment. It is a separate, separately tested function
 * because rendering a path is its own contract rather than a detail of this
 * one schema: the moment a setting becomes a list or an object, the nested
 * case is live, and the behaviour it needs is already pinned.
 */
export const describeIssuePath = (path: readonly PropertyKey[]): string => path.join('.');

export const parseEnvironment = (
  source: Readonly<Record<string, string | undefined>>,
): Environment => {
  const result = environmentSchema.safeParse(withoutBlanks(source));

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${describeIssuePath(issue.path)}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid API test configuration. ${detail}`);
  }

  return result.data;
};

export const loadEnvironment = (): Environment => parseEnvironment(process.env);
