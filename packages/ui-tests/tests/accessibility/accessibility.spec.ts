import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '../../src/fixtures/withoutThirdParties.js';
import { compareToBaseline, ruleIdsOf } from '../../src/accessibility/baseline.js';
import { type AuditedPage, KNOWN_VIOLATIONS } from '../../src/accessibility/knownViolations.js';

/**
 * Accessibility scans over the four flows the suite protects.
 *
 * Scanned with axe-core through the page the suite already drives, so an audit
 * costs one navigation and no second browser stack. The tags select WCAG 2.1 AA
 * and below, which is the standard worth gating on: axe's best-practice and
 * experimental rules are advice rather than conformance, and mixing them into a
 * gate makes the gate an opinion.
 *
 * Each scan compares against the gaps already recorded for that page and fails
 * on any drift, in either direction. `knownViolations.ts` explains why the
 * comparison is against a baseline rather than against zero.
 *
 * Note that axe cannot see the defect that prompted these scans. D-3 records
 * duplicate element ids on the profile and the detail page, and axe-core
 * retired `duplicate-id` and `duplicate-id-active` as obsolete in 4.x, leaving
 * only `duplicate-id-aria`, which fires solely on ids referenced by ARIA or a
 * label. These ids are referenced by neither, so the rule stays silent. The
 * scans below still earn their place, but they do not cover D-3 and nothing
 * here should be read as though they do.
 */

const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const scan = async (page: Page): Promise<readonly string[]> =>
  ruleIdsOf((await new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze()).violations);

/**
 * Axe evaluates computed style, and colour contrast in particular resolves
 * differently across engines, so a shared baseline would have to be either
 * per-engine or loose enough to be worthless. The markup is the same on all
 * three, so the audit runs once on the engine every pull request already pays
 * for, and the cross-engine suite keeps covering behaviour.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Axe resolves computed style per engine, so the baseline is measured on one.',
);

const expectNoDrift = (measured: readonly string[], page: AuditedPage): void => {
  const drift = compareToBaseline({ measured, baseline: KNOWN_VIOLATIONS[page] });

  expect(
    drift.unexpected,
    `New WCAG 2.1 AA failures on the ${page} page. Fix them, or record them in knownViolations.ts with a DEFECTS.md entry.`,
  ).toEqual([]);
  expect(
    drift.resolved,
    `These ${page} failures are fixed. Remove them from knownViolations.ts and close the DEFECTS.md entry.`,
  ).toEqual([]);
};

test.describe('Accessibility', () => {
  // Requirement: the catalogue is reachable by assistive technology.
  // Case: happy-path
  // Invariant: no WCAG 2.1 AA failure beyond those already recorded.
  test('scans the catalogue against its recorded gaps @smoke', async ({ page, bookStorePage }) => {
    await bookStorePage.goto();
    await expect(bookStorePage.rows.first()).toBeVisible();

    expectNoDrift(await scan(page), 'catalogue');
  });

  // Requirement: a book's details are reachable by assistive technology.
  // Case: happy-path
  // Invariant: no WCAG 2.1 AA failure beyond those already recorded.
  test('scans a book detail page against its recorded gaps', async ({
    page,
    bookDetailPage,
    catalogue,
  }) => {
    const [book] = catalogue;

    await bookDetailPage.gotoBook(book?.isbn ?? '');
    await expect(bookDetailPage.value('title')).toBeVisible();

    expectNoDrift(await scan(page), 'bookDetail');
  });

  // Requirement: the sign-in form is reachable by assistive technology.
  // Case: happy-path
  // Invariant: no WCAG 2.1 AA failure beyond those already recorded. This is
  //   the flow that gates every other, so a fault here locks a user out of the
  //   product rather than out of one page.
  test('scans the sign-in form against its recorded gaps @smoke', async ({ page, loginPage }) => {
    await loginPage.goto();
    await expect(loginPage.userNameField).toBeVisible();

    expectNoDrift(await scan(page), 'signIn');
  });

  // Requirement: a reader's collection is reachable by assistive technology.
  // Case: happy-path
  // Invariant: no WCAG 2.1 AA failure beyond those already recorded, with the
  //   grid populated so the rendered rows are scanned rather than an empty table.
  test('scans a populated collection against its recorded gaps', async ({
    page,
    profilePage,
    bookStoreApi,
    signedIn,
    catalogue,
  }) => {
    const [book] = catalogue;

    await bookStoreApi.addToCollection(signedIn, [book?.isbn ?? '']);
    await profilePage.goto();
    await expect(profilePage.rows.first()).toBeVisible();

    expectNoDrift(await scan(page), 'profile');
  });
});
