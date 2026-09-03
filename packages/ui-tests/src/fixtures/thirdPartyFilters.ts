/**
 * Filters that strip third-party advertising and analytics from the page.
 *
 * Written in Adblock Plus syntax and parsed by `@ghostery/adblocker-playwright`.
 * Kept here as a literal rather than fetched from one of Ghostery's prebuilt
 * lists, because a prebuilt list is downloaded from a CDN at run time: it would
 * make every scan depend on a third-party service being reachable, and would
 * let the definition of a passing run change without a commit. This list is
 * small, reviewable, and moves only when someone edits it.
 *
 * Both halves are needed and they do different jobs. The network rules stop the
 * requests, which is what makes a run reproducible. The cosmetic rules collapse
 * the containers that remain, which is what makes a screenshot comparable: the
 * slots reserve space whether or not anything arrives to fill them.
 *
 * The rules are deliberately unscoped rather than written against `demoqa.com`,
 * so they still apply when `E2E_BASE_URL` points at another deployment of the
 * same application.
 *
 * The hosts and selectors were taken from the pages under test rather than from
 * a general-purpose list, so this blocks what this application actually loads
 * and nothing else.
 */

/** Advertising and analytics hosts observed loading on the pages under test. */
export const BLOCKED_HOSTS = [
  'googletagservices.com',
  'googletagmanager.com',
  'google-analytics.com',
  'googlesyndication.com',
  'doubleclick.net',
  'ad.plus',
  'adsafeprotected.com',
] as const;

/**
 * The slots themselves, which reserve layout space even when empty.
 *
 * Exported because a screenshot must not be taken until these have collapsed.
 * The blocker injects its cosmetic CSS when the frame navigates, so a capture
 * can otherwise race the injection and photograph the page mid-collapse. Two
 * separate lists of selectors would drift apart the first time a slot is added,
 * so the filter rules and the readiness check are generated from this one.
 */
export const AD_SLOT_SELECTORS = [
  '.Advertisement-Section',
  '.Google-Ad',
  '[id^="Ad.Plus"]',
  '[id="RightSide_Advertisement"]',
  'ins.adsbygoogle',
] as const;

/** One CSS selector list matching every ad slot, for waiting on the collapse. */
export const AD_SLOT_SELECTOR = AD_SLOT_SELECTORS.join(', ');

/**
 * The two lists rendered into one filter list: `||host^` blocks a request,
 * `##selector` hides an element.
 *
 * Rules only, with no `!` comment lines and no blank separators. Adblock treats
 * a comment and a blank line alike, so both are inert content sitting inside a
 * value, and the documentation above already says what each half is for. Prose
 * that no behaviour depends on is prose the reader should find in a comment,
 * where it cannot be mistaken for part of the data.
 */
export const THIRD_PARTY_FILTERS = [
  ...BLOCKED_HOSTS.map((host) => `||${host}^`),
  ...AD_SLOT_SELECTORS.map((selector) => `##${selector}`),
].join('\n');
