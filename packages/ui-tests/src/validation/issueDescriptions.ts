import type { z } from 'zod';

/**
 * Renders a rejected parse as one description per fault, each naming the field
 * and the reason.
 *
 * A schema failure that reports only pass or fail costs a debugging session
 * against a shared deployment. Naming the path and the message turns it into a
 * single line: which field, and what was wrong with it.
 *
 * Kept as an array rather than a joined string because the callers want
 * different things from it. The gateway and the environment parser fold it into
 * one sentence for an exception message; a contract assertion compares it
 * against an empty array, so an unmet contract is reported as a list of named
 * faults rather than as `false`.
 */
export const describeIssues = (error: z.ZodError): readonly string[] =>
  error.issues.map((issue) =>
    issue.path.length === 0 ? issue.message : `${issue.path.join('.')}: ${issue.message}`,
  );
