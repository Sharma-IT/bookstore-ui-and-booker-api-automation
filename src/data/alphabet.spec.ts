import { describe, expect, it } from 'vitest';
import { characterAt, characterFrom } from './alphabet.js';

describe('characterAt', () => {
  // Requirement: index into a generator alphabet without silently producing a
  // malformed value.
  // Case: happy-path, boundary
  // Invariant: the first and last positions are both addressable.
  it('returns the character at the index', () => {
    expect(characterAt('abc', 0)).toBe('a');
    expect(characterAt('abc', 2)).toBe('c');
  });

  // Requirement: an index outside the alphabet is a fault in the caller and
  // must be reported rather than absorbed.
  // Case: error, boundary
  // Invariant: both ends of the range are guarded, and the alphabet length is
  // named so the faulty selection can be identified.
  it.each([
    [3, 'Random index 3 is out of range for an alphabet of length 3'],
    [-1, 'Random index -1 is out of range for an alphabet of length 3'],
  ])('rejects the out-of-range index %i', (index, message) => {
    expect(() => characterAt('abc', index)).toThrow(message);
  });
});

describe('characterFrom', () => {
  // Requirement: selection is driven by an injected integer source so callers
  // stay deterministic under test.
  // Case: happy-path
  // Invariant: the source is asked for an index bounded by the alphabet length.
  it('asks the source for an index bounded by the alphabet', () => {
    const requested: number[] = [];
    const randomInt = (exclusiveMax: number): number => {
      requested.push(exclusiveMax);
      return 1;
    };

    expect(characterFrom('abc', randomInt)).toBe('b');
    expect(requested).toEqual([3]);
  });

  // Requirement: a faulty source must not yield an undefined character.
  // Case: error
  // Invariant: the guard from characterAt applies to injected selection too.
  it('propagates the out-of-range failure from the source', () => {
    expect(() => characterFrom('abc', () => 9)).toThrow(
      'Random index 9 is out of range for an alphabet of length 3',
    );
  });
});
