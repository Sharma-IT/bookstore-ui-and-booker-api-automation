import { PlaywrightBlocker } from '@ghostery/adblocker-playwright';
import { test as base } from './test.js';
import { THIRD_PARTY_FILTERS } from './thirdPartyFilters.js';

/**
 * The suite's fixtures, with third-party advertising and analytics blocked.
 *
 * Two kinds of test need this and neither can work without it. A screenshot
 * comparison cannot have a stable baseline while live ad slots change on every
 * load, which is why visual regression was left out of the original suite. An
 * accessibility scan is worse than unstable: it would report faults in markup
 * an ad network injected, filed against an application whose authors cannot fix
 * them, and the real findings would be lost among them.
 *
 * This overrides the built-in `page` fixture rather than adding a second one,
 * so every page object wired to `page` keeps working unchanged. The suite's
 * other specs import from `./test.js` and are unaffected: they exercise the
 * application as a visitor actually meets it, adverts and all, which is the
 * right condition for a behavioural test and the wrong one for these two.
 *
 * Requests are blocked rather than the whole origin being denied, so a change
 * in what the application loads shows up as a new request getting through
 * rather than as a silent failure to render.
 */

export const test = base.extend<Record<never, never>, { blocker: PlaywrightBlocker }>({
  /**
   * Parsing the filter list builds an index, so it is done once per worker
   * rather than once per test.
   */
  blocker: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use): Promise<void> => {
      await use(PlaywrightBlocker.parse(THIRD_PARTY_FILTERS));
    },
    { scope: 'worker' },
  ],

  page: async ({ page, blocker }, use) => {
    await blocker.enableBlockingInPage(page);

    await use(page);

    await blocker.disableBlockingInPage(page);
  },
});

export { expect } from '@playwright/test';
