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

export const parseEnvironment = (
  source: Readonly<Record<string, string | undefined>>,
): Environment => {
  const result = environmentSchema.safeParse(withoutBlanks(source));

  if (!result.success) {
    // Every key in this schema is a flat scalar, so an issue path is always a
    // single segment and the path separator never appears in the output. The
    // mutation run therefore reports the separator as a surviving mutant, and
    // it is a proven equivalent one: no input to this schema can distinguish
    // it. The join is kept rather than simplified away because it is correct
    // for the nested paths a future setting would produce, and because the UI
    // package's schema, which carries an array, has a test that does
    // distinguish it. Stryker's disable directive is not honoured for this
    // construct, so the equivalence is recorded here rather than suppressed.
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid API test configuration. ${detail}`);
  }

  return result.data;
};

export const loadEnvironment = (): Environment => parseEnvironment(process.env);
