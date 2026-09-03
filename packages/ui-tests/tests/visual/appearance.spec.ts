import type { Page } from '@playwright/test';
import { expect, test } from '../../src/fixtures/withoutThirdParties.js';
import { AD_SLOT_SELECTOR } from '../../src/fixtures/thirdPartyFilters.js';
import { bookByIsbn } from '../../src/data/catalogue.js';

/**
 * Visual regression over the four flows the suite protects.
 *
 * This was left out of the original suite for a stated reason: the public
 * deployment carries live advertising slots that change on every load, so no
 * baseline could survive a second run. The fixture these specs import removes
 * that, blocking the advertising and analytics requests and collapsing the
 * slots that reserve space for them, which is what makes a stable comparison
 * possible at all rather than merely convenient.
 *
 * What remains variable is masked rather than tolerated. A threshold wide
 * enough to absorb a changing user name is wide enough to miss a moved control,
 * so the varying region is painted over and the rest of the frame is compared
 * strictly. `maxDiffPixelRatio` in the Playwright config exists for
 * antialiasing, not for content.
 *
 * These run only inside the Playwright image pinned in the Dockerfile, on a
 * laptop and in the pipeline alike, and `test:e2e` excludes them for that
 * reason. A baseline is only valid for the rendering stack that produced it, so
 * recording one against a host browser produces a file nobody else can
 * reproduce. `npm run test:visual` and `npm run test:visual:update` both go
 * through Docker.
 */

/**
 * Screenshots are compared against one engine. A second and third set of
 * baselines would treble what a deliberate design change costs to update, and
 * would report the engines' own font and form-control rendering as a
 * difference. The cross-engine suite covers behaviour; these cover appearance.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Baselines are recorded on one engine; the cross-engine suite covers behaviour.',
);

/**
 * Holds until nothing on the page is still arriving or still being restyled.
 *
 * Three conditions, each an observed cause of a capture that differs from the
 * baseline for a reason that is not a regression. The blocker injects its
 * cosmetic CSS when the frame navigates, so a capture can photograph the ad
 * slots mid-collapse. A web font that arrives after the capture reflows every
 * line of text. An image still decoding renders as a gap.
 *
 * `toHaveScreenshot` already retries until two consecutive captures agree, which
 * absorbs most of this, but agreement is not readiness: two captures taken
 * before the CSS lands agree with each other and disagree with the baseline.
 * This waits on the conditions themselves, so the comparison starts from a
 * settled page rather than relying on the retry to outlast the load.
 *
 * A condition rather than a delay, so it costs what it needs and no more.
 */
const waitForSettledPresentation = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    (adSlots) =>
      Array.from(document.querySelectorAll(adSlots)).every(
        (slot) => getComputedStyle(slot).display === 'none',
      ) &&
      document.fonts.status === 'loaded' &&
      Array.from(document.images).every((image) => image.complete),
    AD_SLOT_SELECTOR,
  );
};

test.describe('Appearance', () => {
  // Requirement: the catalogue renders as designed.
  // Case: happy-path
  // Invariant: the grid, its columns and the surrounding chrome are unchanged.
  test('renders the catalogue @visual', async ({ page, bookStorePage }) => {
    await bookStorePage.goto();
    await expect(bookStorePage.rows).toHaveCount(8);

    await waitForSettledPresentation(page);

    await expect(page).toHaveScreenshot('catalogue.png', { fullPage: true });
  });

  // Requirement: a book's details render as designed.
  // Case: happy-path
  // Invariant: every field keeps its position and its label.
  test('renders a book detail page @visual', async ({ page, bookDetailPage, catalogue }) => {
    const book = bookByIsbn(catalogue, '9781449325862');

    await bookDetailPage.gotoBook(book.isbn);
    await expect(bookDetailPage.value('title')).toHaveText(book.title);

    await waitForSettledPresentation(page);

    await expect(page).toHaveScreenshot('book-detail.png', { fullPage: true });
  });

  // Requirement: the sign-in form renders as designed.
  // Case: happy-path
  // Invariant: both fields and both controls keep their position.
  test('renders the sign-in form @visual', async ({ page, loginPage }) => {
    await loginPage.goto();
    await expect(loginPage.userNameField).toBeVisible();

    await waitForSettledPresentation(page);

    await expect(page).toHaveScreenshot('sign-in.png', { fullPage: true });
  });

  // Requirement: a populated collection renders as designed.
  // Case: happy-path
  // Invariant: the grid renders the held book. The user name is generated per
  //   run, so it is masked rather than absorbed by a wider threshold.
  test('renders a populated collection @visual', async ({
    page,
    profilePage,
    bookStoreApi,
    signedIn,
    catalogue,
  }) => {
    const book = bookByIsbn(catalogue, '9781449325862');

    await bookStoreApi.addToCollection(signedIn, [book.isbn]);
    await profilePage.goto();
    await expect(profilePage.rows).toHaveCount(1);

    await waitForSettledPresentation(page);

    await expect(page).toHaveScreenshot('collection.png', {
      fullPage: true,
      mask: [profilePage.userName],
    });
  });

  // Requirement: an empty collection tells the reader it is empty.
  // Case: boundary
  // Invariant: the empty state is a designed state, not an absence, so it is
  //   pinned like any other.
  test('renders an empty collection @visual', async ({ page, profilePage, signedIn }) => {
    await profilePage.goto();
    await expect(profilePage.userName).toHaveText(signedIn.userName);

    await waitForSettledPresentation(page);

    await expect(page).toHaveScreenshot('collection-empty.png', {
      fullPage: true,
      mask: [profilePage.userName],
    });
  });
});
