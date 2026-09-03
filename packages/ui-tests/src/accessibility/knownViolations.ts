/**
 * The accessibility gaps the application has today, per page.
 *
 * This is DEFECTS.md in a form the suite can compare against: every rule listed
 * here is a real WCAG 2.1 AA failure that exists on the deployment right now and
 * that nobody in this repository can fix, because the application belongs to
 * somebody else. Listing them is what lets the scan gate on change rather than
 * on an absolute nobody can reach.
 *
 * Entries only ever leave this file. A rule appearing that is not listed fails
 * the build as a regression; a listed rule that stops failing also fails the
 * build, so the list cannot quietly outlive the defects it records. See
 * `baseline.ts` for why the ratchet runs in both directions.
 *
 * Measured against `https://demoqa.com` with third-party advertising blocked,
 * so every rule here is the application's own markup rather than an ad
 * network's. Recorded as D-7 in DEFECTS.md.
 */
export const KNOWN_VIOLATIONS = {
  // `button-name`: the collapsed-navigation toggle carries no accessible name.
  // `color-contrast`: the book title links fail 4.5:1 against the grid.
  catalogue: ['button-name', 'color-contrast', 'image-alt', 'link-name'],
  bookDetail: ['color-contrast', 'image-alt', 'link-name'],
  signIn: ['image-alt', 'link-name'],
  profile: ['button-name', 'image-alt', 'link-name'],
  // `image-alt` and `link-name` are on every page: the site banner image has no
  // alternative text, and the link wrapping it has no discernible text either,
  // so the first thing in the tab order announces nothing on any page.
} as const satisfies Record<string, readonly string[]>;

export type AuditedPage = keyof typeof KNOWN_VIOLATIONS;
