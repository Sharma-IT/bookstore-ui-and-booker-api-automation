import { describe, expect, it } from 'vitest';
import {
  AD_SLOT_SELECTOR,
  AD_SLOT_SELECTORS,
  BLOCKED_HOSTS,
  THIRD_PARTY_FILTERS,
} from './thirdPartyFilters.js';

describe('THIRD_PARTY_FILTERS', () => {
  // Requirement: every blocked host becomes a network rule the parser accepts.
  // Case: happy-path
  // Invariant: Adblock Plus host syntax, anchored at both ends, so
  //   `||ad.plus^` cannot also match `ad.plus.example.com`.
  it('renders each blocked host as an anchored network rule', () => {
    for (const host of BLOCKED_HOSTS) {
      expect(THIRD_PARTY_FILTERS).toContain(`||${host}^`);
    }
  });

  // Requirement: every ad slot becomes a cosmetic rule.
  // Case: happy-path
  // Invariant: unscoped `##` rules, so they apply to any deployment of the
  //   application rather than only to the public one.
  it('renders each ad slot as an unscoped cosmetic rule', () => {
    for (const selector of AD_SLOT_SELECTORS) {
      expect(THIRD_PARTY_FILTERS).toContain(`\n##${selector}`);
    }
  });

  // Requirement: the list carries both halves, since each does a different job.
  // Case: boundary
  // Invariant: neither list is empty, so a filter list that blocks nothing
  //   cannot pass for a working one.
  it('carries both a network and a cosmetic half', () => {
    expect(BLOCKED_HOSTS.length).toBeGreaterThan(0);
    expect(AD_SLOT_SELECTORS.length).toBeGreaterThan(0);
  });

  // Requirement: the same selectors drive the filters and the readiness check.
  // Case: boundary
  // Invariant: they compose into one selector list with no empty segment. An
  //   empty segment makes `querySelectorAll` throw in the browser, which would
  //   surface as an unexplained failure inside a spec rather than here. The
  //   check is structural rather than a call into a DOM, because the unit
  //   suite runs on Node and one assertion does not justify a DOM for all of it.
  it('composes the ad slots into one selector list with no empty segment', () => {
    expect(AD_SLOT_SELECTOR).toBe(AD_SLOT_SELECTORS.join(', '));
    expect(AD_SLOT_SELECTOR.split(',').map((segment) => segment.trim())).not.toContain('');
  });

  // Requirement: a rule never lands on the same line as another.
  // Case: error
  // Invariant: the parser reads one rule per line, so a missing separator
  //   silently drops both rules rather than failing.
  it('puts every rule on its own line', () => {
    expect(THIRD_PARTY_FILTERS.split('\n')).toHaveLength(
      BLOCKED_HOSTS.length + AD_SLOT_SELECTORS.length,
    );
  });

  // Requirement: the list is rules and nothing else.
  // Case: boundary
  // Invariant: no blank line and no `!` comment. Adblock ignores both, so they
  //   are inert content inside a value rather than part of the filter set.
  it('carries no blank or comment lines', () => {
    for (const line of THIRD_PARTY_FILTERS.split('\n')) {
      expect(line).not.toBe('');
      expect(line.startsWith('!')).toBe(false);
    }
  });
});
