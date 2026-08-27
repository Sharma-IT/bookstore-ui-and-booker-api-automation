import { type RandomInt, characterFrom } from './alphabet.js';
import { generatePassword } from './passwordPolicy.js';

/**
 * Test data builder for Book Store accounts.
 *
 * Every scenario seeds and destroys its own account so specs stay stateless
 * and safe to run in parallel. Time and entropy are injected rather than
 * reached for, which keeps the builder pure and lets the unit tests assert on
 * exact values instead of shapes.
 */

export type TestAccount = {
  readonly userName: string;
  readonly password: string;
};

export type AccountSources = {
  /** Milliseconds since the epoch, used to make user names sortable. */
  readonly now: () => number;
  readonly randomInt: RandomInt;
};

type AccountDraft = {
  readonly prefix: string;
  readonly userName: string | undefined;
  readonly password: string | undefined;
};

const SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SUFFIX_LENGTH = 4;
const DEFAULT_PREFIX = 'qa';
const TIME_RADIX = 36;

const defaultSources: AccountSources = {
  now: () => Date.now(),
  randomInt: (exclusiveMax) => Math.floor(Math.random() * exclusiveMax),
};

const suffixFrom = (randomInt: RandomInt): string =>
  Array.from({ length: SUFFIX_LENGTH }, () => characterFrom(SUFFIX_ALPHABET, randomInt)).join('');

const generateUserName = (prefix: string, sources: AccountSources): string =>
  `${prefix}-${sources.now().toString(TIME_RADIX)}-${suffixFrom(sources.randomInt)}`;

class TestAccountBuilder {
  readonly #draft: AccountDraft;
  readonly #sources: AccountSources;

  constructor(draft: AccountDraft, sources: AccountSources) {
    this.#draft = draft;
    this.#sources = sources;
  }

  #with(changes: Partial<AccountDraft>): TestAccountBuilder {
    return new TestAccountBuilder({ ...this.#draft, ...changes }, this.#sources);
  }

  withPrefix(prefix: string): TestAccountBuilder {
    if (prefix.length === 0) {
      throw new Error('Account prefix must not be empty');
    }

    return this.#with({ prefix });
  }

  withUserName(userName: string): TestAccountBuilder {
    return this.#with({ userName });
  }

  withPassword(password: string): TestAccountBuilder {
    return this.#with({ password });
  }

  build(): TestAccount {
    return {
      userName: this.#draft.userName ?? generateUserName(this.#draft.prefix, this.#sources),
      password: this.#draft.password ?? generatePassword({ randomInt: this.#sources.randomInt }),
    };
  }
}

export const anAccount = (sources: AccountSources = defaultSources): TestAccountBuilder =>
  new TestAccountBuilder(
    { prefix: DEFAULT_PREFIX, userName: undefined, password: undefined },
    sources,
  );

export type { TestAccountBuilder };
