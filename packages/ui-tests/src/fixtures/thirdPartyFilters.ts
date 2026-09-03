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
export const THIRD_PARTY_FILTERS = [
  '! Advertising and analytics requests observed on the pages under test.',
  '||googletagservices.com^',
  '||googletagmanager.com^',
  '||google-analytics.com^',
  '||googlesyndication.com^',
  '||doubleclick.net^',
  '||ad.plus^',
  '||adsafeprotected.com^',
  '',
  '! The slots themselves, which reserve layout space even when empty.',
  '##.Advertisement-Section',
  '##.Google-Ad',
  '##[id^="Ad.Plus"]',
  '##[id="RightSide_Advertisement"]',
  '##ins.adsbygoogle',
].join('\n');
