import { BOOK_GRID_COLUMNS } from '../../src/pages/BookStorePage.js';
import { bookByIsbn, titlesOf } from '../../src/data/catalogue.js';
import { expect, test } from '../../src/fixtures/test.js';

test.describe('Book catalogue', () => {
  test.beforeEach(async ({ bookStorePage }) => {
    await bookStorePage.goto();
  });

  // Requirement: a visitor sees every book the store holds, without signing in.
  // Case: happy-path
  // Invariant: the grid is the catalogue the service serves, in the same order.
  test('lists every book the service holds @smoke', async ({ bookStorePage, catalogue }) => {
    await expect(bookStorePage.titles).toHaveText([...titlesOf(catalogue)]);
  });

  // Requirement: the grid identifies each book by title, author and publisher.
  // Case: happy-path
  // Invariant: every row carries the values the service holds for that book.
  test('shows the author and publisher of each book', async ({ bookStorePage, catalogue }) => {
    for (const book of catalogue) {
      await expect(bookStorePage.cellFor(book.title, 'Author')).toHaveText(book.author);
      await expect(bookStorePage.cellFor(book.title, 'Publisher')).toHaveText(book.publisher);
    }
  });

  // Requirement: the grid is labelled so its columns can be read.
  // Case: happy-path
  // Invariant: the four documented columns appear in order.
  test('labels its columns', async ({ bookStorePage }) => {
    await expect(bookStorePage.columnHeaders).toHaveText([...BOOK_GRID_COLUMNS]);
  });

  // Requirement: a visitor who is not signed in is offered the way to sign in.
  // Case: happy-path
  // Invariant: the store is browsable anonymously.
  test('offers sign in to an anonymous visitor', async ({ bookStorePage }) => {
    await expect(bookStorePage.loginButton).toBeVisible();
  });

  // Requirement: selecting a title opens that book's details.
  // Case: happy-path
  // Invariant: every field shown is the value the service holds.
  test('opens the details of a selected book @smoke', async ({
    bookStorePage,
    bookDetailPage,
    catalogue,
  }) => {
    const book = bookByIsbn(catalogue, '9781449325862');

    await bookStorePage.openBook(book.title);

    await expect(bookDetailPage.value('isbn')).toHaveText(book.isbn);
    await expect(bookDetailPage.value('title')).toHaveText(book.title);
    await expect(bookDetailPage.value('subTitle')).toHaveText(book.subTitle);
    await expect(bookDetailPage.value('author')).toHaveText(book.author);
    await expect(bookDetailPage.value('publisher')).toHaveText(book.publisher);
    await expect(bookDetailPage.value('pages')).toHaveText(String(book.pages));
    await expect(bookDetailPage.value('website')).toHaveText(book.website);
  });

  // Requirement: a visitor can return to the store from a book's details.
  // Case: happy-path
  // Invariant: the grid is restored intact.
  test('returns to the store from a book detail', async ({
    bookStorePage,
    bookDetailPage,
    catalogue,
  }) => {
    await bookStorePage.openBook(bookByIsbn(catalogue, '9781449325862').title);
    await bookDetailPage.backToBookStoreButton.click();

    await expect(bookStorePage.titles).toHaveText([...titlesOf(catalogue)]);
  });

  // Requirement: the catalogue fits on one page at the current data volume, so
  // both paging controls are offered but inert.
  // Case: boundary
  // Invariant: paging is disabled exactly when there is a single page.
  test('disables paging while the catalogue fits one page', async ({
    bookStorePage,
    catalogue,
  }) => {
    test.skip(catalogue.length > 10, 'The catalogue no longer fits a single page.');

    await expect(bookStorePage.pageIndicator).toHaveText('Page 1 of 1');
    await expect(bookStorePage.previousPageButton).toBeDisabled();
    await expect(bookStorePage.nextPageButton).toBeDisabled();
  });
});
