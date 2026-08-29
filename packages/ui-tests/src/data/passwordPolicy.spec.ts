import { describe, expect, it } from 'vitest';
import {
  PASSWORD_REQUIREMENT_IDS,
  generatePassword,
  satisfiesPasswordPolicy,
  unmetPasswordRequirements,
} from './passwordPolicy.js';

describe('unmetPasswordRequirements', () => {
  // Requirement: the Book Store password field enforces lowercase, uppercase,
  // digit, symbol from !@#$%^&* and a minimum length of eight characters.
  // Case: happy-path
  // Invariant: a compliant password has no unmet requirements.
  it('reports no unmet requirements for a compliant password', () => {
    expect(unmetPasswordRequirements('Passw0rd!')).toEqual([]);
  });

  // Requirement: each class of character is required independently.
  // Case: error
  // Invariant: exactly the violated requirement is named, in declaration order.
  it.each([
    ['PASSW0RD!', ['lowercase']],
    ['passw0rd!', ['uppercase']],
    ['Password!', ['digit']],
    ['Passw0rdd', ['symbol']],
    ['Pw0rd!', ['minimumLength']],
  ])('names the violated requirement for %s', (password, expected) => {
    expect(unmetPasswordRequirements(password)).toEqual(expected);
  });

  // Requirement: multiple violations are all reported, not just the first.
  // Case: error
  // Invariant: the order of reported ids matches PASSWORD_REQUIREMENT_IDS.
  it('reports every violated requirement in declaration order', () => {
    expect(unmetPasswordRequirements('abc')).toEqual([
      'uppercase',
      'digit',
      'symbol',
      'minimumLength',
    ]);
  });

  // Requirement: an empty password violates every requirement.
  // Case: boundary
  // Invariant: the empty string is never accepted.
  it('reports every requirement for an empty password', () => {
    expect(unmetPasswordRequirements('')).toEqual([...PASSWORD_REQUIREMENT_IDS]);
  });

  // Requirement: the minimum length is eight characters inclusive.
  // Case: boundary
  // Invariant: seven characters fail, eight characters pass.
  it('treats eight characters as the inclusive minimum length', () => {
    expect(unmetPasswordRequirements('Pas0rd!x')).toEqual([]);
    expect(unmetPasswordRequirements('Pas0rd!')).toEqual(['minimumLength']);
  });

  // Requirement: only !@#$%^&* count as symbols, matching the field pattern.
  // Case: boundary
  // Invariant: a symbol outside the allowed set does not satisfy the rule.
  it('rejects symbols outside the set the application accepts', () => {
    expect(unmetPasswordRequirements('Passw0rd(')).toEqual(['symbol']);
    expect(unmetPasswordRequirements('Passw0rd*')).toEqual([]);
  });
});

describe('satisfiesPasswordPolicy', () => {
  // Requirement: a boolean view of the policy for call sites that only branch.
  // Case: happy-path, error
  // Invariant: true exactly when there are no unmet requirements.
  it('is true only when no requirement is unmet', () => {
    expect(satisfiesPasswordPolicy('Passw0rd!')).toBe(true);
    expect(satisfiesPasswordPolicy('password')).toBe(false);
  });
});

describe('generatePassword', () => {
  // Requirement: generated passwords are compliant so account seeding never
  // fails on validation.
  // Case: happy-path
  // Invariant: one character per requirement in declaration order, then filler
  // drawn from the combined alphabet, all chosen by the injected source.
  it('produces a deterministic password for a fixed integer source', () => {
    expect(generatePassword({ randomInt: () => 0, length: 8 })).toBe('aA0!aaaa');
  });

  // Requirement: the integer source drives both selection and shuffling.
  // Case: happy-path
  // Invariant: a different source yields a different, still compliant password.
  it('varies the password with the integer source', () => {
    let call = 0;
    const randomInt = (exclusiveMax: number): number => (call++ * 7) % exclusiveMax;

    expect(generatePassword({ randomInt, length: 10 })).toBe('aH4^CJQX4@');
  });

  // Requirement: every generated password must pass the policy.
  // Case: happy-path
  // Invariant: holds for every length the generator accepts.
  it.each([8, 9, 12, 24, 64])('generates a compliant password of length %i', (length) => {
    let call = 0;
    const randomInt = (exclusiveMax: number): number => (call++ * 13 + 5) % exclusiveMax;
    const password = generatePassword({ randomInt, length });

    expect(password).toHaveLength(length);
    expect(unmetPasswordRequirements(password)).toEqual([]);
  });

  // Requirement: a length shorter than the policy minimum is a programming
  // error and must fail loudly rather than emit an unusable password.
  // Case: error
  // Invariant: the boundary is eight, inclusive.
  it('rejects a requested length below the policy minimum', () => {
    expect(() => generatePassword({ randomInt: () => 0, length: 7 })).toThrow(
      'Password length must be at least 8, received 7',
    );
    expect(() => generatePassword({ randomInt: () => 0, length: 8 })).not.toThrow();
  });

  // Requirement: a misbehaving integer source must fail loudly rather than
  // silently emit a password that breaches the policy.
  // Case: error
  // Invariant: the index is validated against the alphabet it indexes.
  it.each([
    [99, 'Random index 99 is out of range for an alphabet of length 26'],
    [-1, 'Random index -1 is out of range for an alphabet of length 26'],
  ])('rejects an out-of-range index %i from the integer source', (index, message) => {
    expect(() => generatePassword({ randomInt: () => index, length: 8 })).toThrow(message);
  });

  // Requirement: the guard reports the alphabet actually being indexed, so a
  // fault in symbol selection is not misreported as a lowercase fault.
  // Case: error
  // Invariant: the reported length matches the requirement under selection.
  it('names the alphabet under selection when the index is out of range', () => {
    let call = 0;
    const randomInt = (): number => (call++ === 3 ? 8 : 0);

    expect(() => generatePassword({ randomInt, length: 8 })).toThrow(
      'Random index 8 is out of range for an alphabet of length 8',
    );
  });

  // Requirement: the generator defaults to a length comfortably above the
  // minimum so seeded accounts are not trivially guessable.
  // Case: boundary
  // Invariant: the default length is 16.
  it('defaults to a length of sixteen', () => {
    expect(generatePassword({ randomInt: () => 0 })).toHaveLength(16);
  });
});
