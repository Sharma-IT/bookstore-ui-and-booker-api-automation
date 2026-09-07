import { BLOCKED_HOSTS } from '../../src/fixtures/thirdPartyFilters.js';
import { expect, test } from '../../src/fixtures/test.js';

/**
 * The pages under test carry third-party advertising and analytics, and the
 * behavioural suite deliberately leaves it in place so the scenarios meet the
 * application as a visitor does. What must not follow from that is a suite
 * whose navigations depend on those hosts answering: an advertising network
 * that stops responding is not a Book Store defect, and reporting it as one
 * costs a run and teaches everyone to re-run the pipeline until it passes.
 *
 * The hosts are taken from the filter list the appearance and accessibility
 * fixtures already block, so the two cannot drift apart.
 *
 * Only Firefox holds `load` open for these requests. Chromium and WebKit fire
 * it while they are still outstanding, so this scenario passes on those two
 * whatever `BasePage` waits for, and it is Firefox that fails without the fix,
 * which is also the engine the scheduled run failed on. It is kept as the pin
 * for the failure that was observed rather than widened into one that would
 * bite on every engine, because a pull request pays for Chromium alone and no
 * arrangement of this test changes that.
 */

/**
 * A route handler that settles by neither `fulfil` nor `abort`, so the request
 * stays in flight for the life of the context. That is what a host which has
 * stopped answering looks like, and what an aborted request does not: an abort
 * lets `load` fire, which is the condition under test.
 */
const staysInFlight = (): Promise<never> => new Promise<never>(() => undefined);

test.describe('Navigation', () => {
  // Requirement: a page is usable once the application has rendered it,
  //   whatever the advertising on it is doing.
  // Case: error
  // Invariant: navigation and the assertions after it depend on the
  //   application's own responses alone.
  test('reaches the catalogue while the advertising hosts never answer', async ({
    page,
    bookStorePage,
    catalogue,
  }) => {
    await page.route(
      (url) => BLOCKED_HOSTS.some((host) => url.hostname.endsWith(host)),
      staysInFlight,
    );

    await bookStorePage.goto();

    await expect(bookStorePage.rows).toHaveCount(catalogue.length);
  });
});
