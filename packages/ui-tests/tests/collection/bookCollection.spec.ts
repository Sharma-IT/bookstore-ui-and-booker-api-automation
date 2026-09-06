import { bookByIsbn, titlesOf } from '../../src/data/catalogue.js';
import { COLLECTION_GRID_COLUMNS } from '../../src/pages/ProfilePage.js';
import type { TestInfo } from '@playwright/test';

import { expect, test } from '../../src/fixtures/test.js';

const A_BOOK = '9781449325862';
const ANOTHER_BOOK = '9781449331818';

/**
 * How long a test that pins a defect waits for the behaviour the application
 * owes the reader, before concluding it never arrives.
 */
const DEFECT_SETTLE_MS = 5_000;

/**
 * Playwright accepts a `test.fail()` test only when it fails an assertion. One
 * whose budget runs out first is reported as a timeout instead, which is not
 * the expected status, and the run goes red on a defect already known and
 * recorded. A settle window is spent by design rather than on a slow response,
 * so it is granted on top of the ordinary budget: a slow page load can then no
 * longer be what tips a pinned defect over.
 */
const budgetForSettling = (testInfo: TestInfo, windows: number): void => {
  test.setTimeout(testInfo.timeout + windows * DEFECT_SETTLE_MS);
};

test.describe('Building a collection', () => {
  // Requirement: a signed-in reader adds a book from its detail page and finds
  // it in their collection.
  // Case: happy-path
  // Invariant: the confirmation the reader is shown matches what is stored.
  test('adds a book to the collection @smoke', async ({
    accountApi,
    bookDetailPage,
    profilePage,
    catalogue,
    signedIn,
  }) => {
    const book = bookByIsbn(catalogue, A_BOOK);

    await bookDetailPage.gotoBook(book.isbn);
    const confirmation = await bookDetailPage.addToCollectionAndCaptureDialog();

    expect(confirmation).toBe('Book added to your collection.');

    await profilePage.goto();
    await expect(profilePage.titles).toHaveText([book.title]);
    expect(titlesOf((await accountApi.detailsOf(signedIn)).books)).toEqual([book.title]);
  });

  // Requirement: a book already held is not silently duplicated.
  // Case: error
  // Invariant: the collection is unchanged and the reader is told why.
  test('refuses to add a book the reader already holds', async ({
    bookDetailPage,
    bookStoreApi,
    profilePage,
    catalogue,
    signedIn,
  }) => {
    const book = bookByIsbn(catalogue, A_BOOK);
    await bookStoreApi.addToCollection(signedIn, [book.isbn]);

    await bookDetailPage.gotoBook(book.isbn);
    const message = await bookDetailPage.addToCollectionAndCaptureDialog();

    expect(message).toBe('Book already present in the your collection!');

    await profilePage.goto();
    await expect(profilePage.rows).toHaveCount(1);
  });

  // Requirement: adding to a collection requires a session.
  // Case: error
  // Invariant: a visitor is offered sign in rather than the add control.
  test('does not offer the add control to a visitor without a session', async ({
    bookDetailPage,
  }) => {
    await bookDetailPage.gotoBook(A_BOOK);

    await expect(bookDetailPage.loginButton).toBeVisible();
    await expect(bookDetailPage.addToCollectionButton).toHaveCount(0);
  });
});

test.describe('Managing a collection', () => {
  test.beforeEach(async ({ bookStoreApi, signedIn }) => {
    await bookStoreApi.addToCollection(signedIn, [A_BOOK, ANOTHER_BOOK]);
  });

  // Requirement: the collection lists what the reader holds.
  // Case: happy-path
  // Invariant: the grid matches the collection the service holds.
  test('lists the books the reader holds', async ({ profilePage, catalogue }) => {
    await profilePage.goto();

    await expect(profilePage.columnHeaders).toHaveText([...COLLECTION_GRID_COLUMNS]);
    await expect(profilePage.titles).toHaveText([
      ...titlesOf([bookByIsbn(catalogue, A_BOOK), bookByIsbn(catalogue, ANOTHER_BOOK)]),
    ]);
  });

  // Requirement: removing a book asks for confirmation before acting.
  // Case: happy-path
  // Invariant: only the chosen book leaves the collection.
  test('removes a single confirmed book @smoke', async ({
    profilePage,
    accountApi,
    catalogue,
    signedIn,
  }) => {
    await profilePage.goto();
    await expect(profilePage.rows).toHaveCount(2);

    await profilePage.deleteBook(A_BOOK);
    await expect(profilePage.confirmationModal.title).toHaveText('Delete Book');
    await expect(profilePage.confirmationModal.body).toHaveText('Do you want to delete this book?');
    await profilePage.confirmationModal.confirm();

    await expect(profilePage.titles).toHaveText([bookByIsbn(catalogue, ANOTHER_BOOK).title]);
    expect(titlesOf((await accountApi.detailsOf(signedIn)).books)).toEqual([
      bookByIsbn(catalogue, ANOTHER_BOOK).title,
    ]);
  });

  // Requirement: cancelling the confirmation leaves the collection untouched.
  // Case: boundary
  // Invariant: nothing is removed when the reader declines.
  test('keeps the book when removal is cancelled', async ({
    profilePage,
    accountApi,
    signedIn,
  }) => {
    await profilePage.goto();
    await expect(profilePage.rows).toHaveCount(2);

    await profilePage.deleteBook(A_BOOK);
    await profilePage.confirmationModal.cancel();

    await expect(profilePage.rows).toHaveCount(2);
    expect((await accountApi.detailsOf(signedIn)).books).toHaveLength(2);
  });

  // Requirement: a reader can empty their collection in one action.
  // Case: happy-path
  // Invariant: every book is removed, and the service agrees.
  test('empties the whole collection', async ({ page, profilePage, accountApi, signedIn }) => {
    await profilePage.goto();
    await expect(profilePage.rows).toHaveCount(2);

    await profilePage.deleteAllBooksButton.click();
    await expect(profilePage.confirmationModal.title).toHaveText('Delete All Books');
    await profilePage.confirmationModal.confirm();

    await expect.poll(async () => (await accountApi.detailsOf(signedIn)).books.length).toBe(0);

    await page.reload();
    await expect(profilePage.rows).toHaveCount(0);
  });

  // Requirement: emptying the collection updates the page the reader is
  // looking at, without them having to reload it.
  //
  // Known defect: the confirmation dialog stays open and the grid keeps
  // rendering the deleted books. The service does remove them, so only the
  // client is stale. Remove this annotation when the application is fixed.
  // Case: happy-path
  // Invariant: the view reflects the collection immediately after the action.
  test('refreshes the view after emptying the collection', async ({ profilePage }, testInfo) => {
    test.fail();
    budgetForSettling(testInfo, 2);

    await profilePage.goto();
    await expect(profilePage.rows).toHaveCount(2);

    await profilePage.deleteAllBooksButton.click();
    await profilePage.confirmationModal.confirm();

    await expect(profilePage.confirmationModal.okButton).toBeHidden({
      timeout: DEFECT_SETTLE_MS,
    });
    await expect(profilePage.rows).toHaveCount(0, { timeout: DEFECT_SETTLE_MS });
  });

  // Requirement: the collection has its own search.
  // Case: happy-path
  // Invariant: searching narrows the collection without removing anything.
  test('searches within the collection', async ({ profilePage, catalogue }) => {
    const book = bookByIsbn(catalogue, ANOTHER_BOOK);

    await profilePage.goto();
    await expect(profilePage.rows).toHaveCount(2);

    await profilePage.searchBox.fill(book.author);

    await expect(profilePage.titles).toHaveText([book.title]);
  });

  // Requirement: a reader reaches the store from their collection.
  // Case: happy-path
  // Invariant: the catalogue is shown in full.
  test('returns to the store from the collection', async ({
    profilePage,
    bookStorePage,
    catalogue,
  }) => {
    await profilePage.goto();
    await profilePage.goToBookStoreButton.click();

    await expect(bookStorePage.titles).toHaveText([...titlesOf(catalogue)]);
  });
});

test.describe('Closing an account', () => {
  // Requirement: a reader can delete their account, which ends the session and
  // takes the collection with it.
  // Case: happy-path
  // Invariant: the account no longer exists afterwards.
  test('deletes the account @smoke', async ({
    apiRequest,
    bookStoreApi,
    environment,
    profilePage,
    signedIn,
  }) => {
    await bookStoreApi.addToCollection(signedIn, [A_BOOK]);
    await profilePage.goto();
    await expect(profilePage.rows).toHaveCount(1);

    await profilePage.deleteAccountButton.click();
    await expect(profilePage.confirmationModal.title).toHaveText('Delete Account');
    await expect(profilePage.confirmationModal.body).toHaveText(
      'Do you want to delete your account?',
    );
    await profilePage.confirmationModal.confirm();

    await expect
      .poll(
        async () =>
          (
            await apiRequest.get(`/Account/v1/User/${signedIn.userId}`, {
              headers: { Authorization: `Bearer ${signedIn.token}` },
              timeout: environment.apiTimeoutMs,
            })
          ).status(),
        { message: 'The account should no longer be readable once it is deleted.' },
      )
      .toBe(401);
  });

  // Requirement: deleting an account ends the session, since the credentials
  // behind it no longer identify anybody.
  //
  // Known defect: the confirmation dialog stays open, the four session cookies
  // are left in place and the profile keeps rendering the deleted account's
  // collection. A reader is shown a signed-in view of an account the service
  // has already destroyed. Remove this annotation when the application is
  // fixed.
  // Case: error
  // Invariant: no session survives the account it belongs to.
  test('ends the session when the account is deleted', async ({ page, profilePage }, testInfo) => {
    test.fail();
    budgetForSettling(testInfo, 1);

    await profilePage.goto();
    await profilePage.deleteAccountButton.click();
    await profilePage.confirmationModal.confirm();

    await expect
      .poll(async () => (await page.context().cookies()).map((cookie) => cookie.name), {
        timeout: DEFECT_SETTLE_MS,
      })
      .not.toContain('token');
  });
});
