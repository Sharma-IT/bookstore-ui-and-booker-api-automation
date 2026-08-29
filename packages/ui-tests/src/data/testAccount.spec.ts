import { describe, expect, it } from 'vitest';
import { unmetPasswordRequirements } from './passwordPolicy.js';
import { anAccount } from './testAccount.js';

const fixedSources = {
  now: (): number => 1_700_000_000_000,
  randomInt: (): number => 0,
};

describe('anAccount', () => {
  // Requirement: every test seeds its own account, so a generated user name
  // must carry a prefix, the creation time and a random suffix.
  // Case: happy-path
  // Invariant: the name is fully determined by the injected sources.
  it('builds a user name from the prefix, base-36 creation time and suffix', () => {
    expect(anAccount(fixedSources).build().userName).toBe('qa-loyw3v28-aaaa');
  });

  // Requirement: suites running in parallel must not collide on user names.
  // Case: boundary
  // Invariant: the same millisecond with different entropy yields different names.
  it('distinguishes accounts created within the same millisecond', () => {
    let call = 0;
    const randomInt = (exclusiveMax: number): number => (call++ * 11 + 3) % exclusiveMax;

    expect(anAccount({ now: fixedSources.now, randomInt }).build().userName).toBe(
      'qa-loyw3v28-doza',
    );
  });

  // Requirement: a caller may name the account for readability in a report.
  // Case: happy-path
  // Invariant: an explicit prefix replaces the default without losing uniqueness.
  it('honours a caller supplied prefix', () => {
    expect(anAccount(fixedSources).withPrefix('checkout').build().userName).toBe(
      'checkout-loyw3v28-aaaa',
    );
  });

  // Requirement: builders must not leak state between tests running in parallel.
  // Case: boundary
  // Invariant: each with* call returns a new builder, leaving the original intact.
  it('returns a new builder rather than mutating the receiver', () => {
    const base = anAccount(fixedSources);
    const renamed = base.withPrefix('other');

    expect(base.build().userName).toBe('qa-loyw3v28-aaaa');
    expect(renamed.build().userName).toBe('other-loyw3v28-aaaa');
    expect(renamed).not.toBe(base);
  });

  // Requirement: a generated password must satisfy the Book Store policy.
  // Case: happy-path
  // Invariant: seeded accounts are never rejected for a weak password.
  it('generates a policy compliant password', () => {
    const { password } = anAccount(fixedSources).build();

    expect(unmetPasswordRequirements(password)).toEqual([]);
    expect(password).toHaveLength(16);
  });

  // Requirement: negative tests need to drive specific invalid credentials.
  // Case: happy-path
  // Invariant: explicit values override generation entirely.
  it('accepts an explicit user name and password', () => {
    const account = anAccount(fixedSources)
      .withUserName('known-user')
      .withPassword('Wrong0ne!')
      .build();

    expect(account).toEqual({ userName: 'known-user', password: 'Wrong0ne!' });
  });

  // Requirement: the built account is a plain immutable value safe to share.
  // Case: boundary
  // Invariant: building twice yields equal but independent values.
  it('builds an equal value on each call', () => {
    const builder = anAccount(fixedSources);

    expect(builder.build()).toEqual(builder.build());
    expect(builder.build()).not.toBe(builder.build());
  });

  // Requirement: with no sources injected the builder must still produce
  // usable, distinct accounts, since that is how every spec calls it.
  // Case: happy-path
  // Invariant: the wired-in clock and entropy source are both functional.
  it('produces a compliant account from its default sources', () => {
    const { userName, password } = anAccount().build();

    expect(userName).toMatch(/^qa-[0-9a-z]+-[0-9a-z]{4}$/);
    expect(unmetPasswordRequirements(password)).toEqual([]);
  });

  // Requirement: accounts created inside the same millisecond must still be
  // distinct, which is the whole purpose of the random suffix.
  // Case: boundary
  // Invariant: the default entropy source spans the suffix alphabet rather
  // than collapsing to a single value.
  it('varies the suffix across accounts from its default sources', () => {
    const suffixes = Array.from({ length: 20 }, () => anAccount().build().userName.split('-')[2]);

    expect(new Set(suffixes).size).toBeGreaterThan(1);
  });

  // Requirement: a prefix must stay readable in reports and in the API.
  // Case: error
  // Invariant: an empty prefix is a programming error.
  it('rejects an empty prefix', () => {
    expect(() => anAccount(fixedSources).withPrefix('')).toThrow(
      'Account prefix must not be empty',
    );
  });
});
