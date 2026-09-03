import { describe, expect, it } from 'vitest';
import { compareToBaseline, ruleIdsOf } from './baseline.js';

describe('ruleIdsOf', () => {
  // Requirement: a scan is reduced to the set of rules it broke.
  // Case: happy-path
  // Invariant: rule ids come back sorted, so two scans compare directly.
  it('sorts the rule ids of a scan', () => {
    expect(ruleIdsOf([{ id: 'link-name' }, { id: 'button-name' }, { id: 'image-alt' }])).toEqual([
      'button-name',
      'image-alt',
      'link-name',
    ]);
  });

  // Requirement: a rule broken in several places is one finding, not several.
  // Case: boundary
  // Invariant: the result is a set, so node counts cannot inflate it.
  it('reports a repeated rule once', () => {
    expect(ruleIdsOf([{ id: 'image-alt' }, { id: 'image-alt' }])).toEqual(['image-alt']);
  });

  // Requirement: a clean scan reduces to nothing.
  // Case: boundary
  // Invariant: no violations yields an empty list rather than a falsy value.
  it('reduces a clean scan to an empty list', () => {
    expect(ruleIdsOf([])).toEqual([]);
  });
});

describe('compareToBaseline', () => {
  // Requirement: a rule broken today and recorded as known is not a failure.
  // Case: happy-path
  // Invariant: an exact match drifts in neither direction.
  it('reports no drift when the scan matches the baseline', () => {
    const drift = compareToBaseline({
      measured: ['image-alt', 'link-name'],
      baseline: ['image-alt', 'link-name'],
    });

    expect(drift).toEqual({ unexpected: [], resolved: [] });
  });

  // Requirement: a rule broken today but not recorded is a new regression.
  // Case: error
  // Invariant: only the unrecorded rule is reported, and only as unexpected.
  it('reports a rule that is broken but not recorded as unexpected', () => {
    const drift = compareToBaseline({
      measured: ['image-alt', 'label'],
      baseline: ['image-alt'],
    });

    expect(drift).toEqual({ unexpected: ['label'], resolved: [] });
  });

  // Requirement: a recorded rule that no longer breaks means the fix has landed.
  // Case: error
  // Invariant: the baseline must then shrink, so the ratchet reports it rather
  //   than silently tolerating a stale entry.
  it('reports a recorded rule that no longer breaks as resolved', () => {
    const drift = compareToBaseline({
      measured: ['image-alt'],
      baseline: ['image-alt', 'link-name'],
    });

    expect(drift).toEqual({ unexpected: [], resolved: ['link-name'] });
  });

  // Requirement: drift in both directions at once is reported in full.
  // Case: boundary
  // Invariant: neither direction masks the other.
  it('reports drift in both directions at once', () => {
    const drift = compareToBaseline({
      measured: ['button-name', 'label'],
      baseline: ['image-alt', 'label'],
    });

    expect(drift).toEqual({ unexpected: ['button-name'], resolved: ['image-alt'] });
  });

  // Requirement: an application with no known gaps stays at none.
  // Case: boundary
  // Invariant: an empty baseline makes every measured rule unexpected.
  it('treats every rule as unexpected against an empty baseline', () => {
    const drift = compareToBaseline({ measured: ['image-alt'], baseline: [] });

    expect(drift).toEqual({ unexpected: ['image-alt'], resolved: [] });
  });

  // Requirement: a clean scan against a populated baseline resolves everything.
  // Case: boundary
  // Invariant: every recorded rule is reported, not just the first.
  it('resolves every recorded rule when the scan is clean', () => {
    const drift = compareToBaseline({ measured: [], baseline: ['image-alt', 'link-name'] });

    expect(drift).toEqual({ unexpected: [], resolved: ['image-alt', 'link-name'] });
  });

  // Requirement: the report is stable regardless of how either side was ordered.
  // Case: boundary
  // Invariant: both directions come back sorted, so a failure message is stable.
  it('sorts both directions regardless of input order', () => {
    const drift = compareToBaseline({
      measured: ['label', 'button-name'],
      baseline: ['link-name', 'image-alt'],
    });

    expect(drift).toEqual({
      unexpected: ['button-name', 'label'],
      resolved: ['image-alt', 'link-name'],
    });
  });
});
