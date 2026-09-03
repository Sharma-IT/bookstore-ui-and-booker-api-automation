import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { describeIssues } from './issueDescriptions.js';

/**
 * Fixtures are built by parsing deliberately wrong values against small local
 * schemas rather than by hand-constructing a `ZodError`, so the tests stay
 * honest about the shape zod actually produces.
 */
const issuesFrom = (schema: z.ZodType, value: unknown): readonly string[] => {
  const result = schema.safeParse(value);

  if (result.success) {
    throw new Error('Fixture parsed successfully, so it cannot describe an issue');
  }

  return describeIssues(result.error);
};

describe('describeIssues', () => {
  // Requirement: a rejected field is reported by name and reason.
  // Case: happy-path
  // Invariant: the description names the path and the message, in that order.
  it('names the field and the reason for a single rejected field', () => {
    const descriptions = issuesFrom(z.object({ token: z.string() }), { token: 7 });

    expect(descriptions).toEqual(['token: Invalid input: expected string, received number']);
  });

  // Requirement: every rejected field is reported, not just the first.
  // Case: boundary
  // Invariant: one description per issue, in the order zod reports them.
  it('describes every rejected field', () => {
    const descriptions = issuesFrom(z.object({ a: z.string(), b: z.number() }), { a: 1, b: 'x' });

    expect(descriptions).toHaveLength(2);
    expect(descriptions[0]).toMatch(/^a: /);
    expect(descriptions[1]).toMatch(/^b: /);
  });

  // Requirement: a field nested inside the response is reported by its full path.
  // Case: happy-path
  // Invariant: path segments are joined with a dot so the field can be located.
  it('joins a nested path with dots', () => {
    const schema = z.object({ books: z.array(z.object({ pages: z.number() })) });

    const descriptions = issuesFrom(schema, { books: [{ pages: 'many' }] });

    expect(descriptions).toEqual([
      'books.0.pages: Invalid input: expected number, received string',
    ]);
  });

  // Requirement: a fault carrying no path is still reported.
  // Case: boundary
  // Invariant: an empty path yields the message alone, with no leading separator.
  it('reports a root-level fault without a leading separator', () => {
    const descriptions = issuesFrom(z.string(), 42);

    expect(descriptions).toEqual(['Invalid input: expected string, received number']);
  });

  // Requirement: an unknown key is reported, which is what a contract test asserts on.
  // Case: error
  // Invariant: a strict object names the offending key rather than failing anonymously.
  it('names an unexpected key rejected by a strict object', () => {
    const descriptions = issuesFrom(z.strictObject({ isbn: z.string() }), {
      isbn: '1',
      publish_date: '2020-06-04T08:48:39.000Z',
    });

    expect(descriptions).toHaveLength(1);
    expect(descriptions[0]).toContain('publish_date');
  });
});
