import type { Book } from '../../src/data/catalogue.js';
import { booksMatchingSearchTerm, titlesOf } from '../../src/data/catalogue.js';
import { expect, test } from '../../src/fixtures/test.js';

/**
 * The store search is specified as a case-insensitive substring match across
 * the three text columns the grid renders. Expected results are derived from
 * the catalogue the service serves, through the independently unit-tested
 * `booksMatchingSearchTerm`, so these scenarios survive the catalogue changing
 * without asserting on titles this suite does not own.
 */

/**
 * Guards against a vacuous pass: were the catalogue to stop containing the
 * term, an empty grid would otherwise agree with an empty expectation.
 */
const expectedTitlesFor = (catalogue: readonly Book[], term: string): string[] => {
  const expected = titlesOf(booksMatchingSearchTerm(catalogue, term));

  expect(
    expected.length,
    `The catalogue no longer contains a book matching "${term}", so this scenario cannot prove anything.`,
  ).toBeGreaterThan(0);

  return [...expected];
};

test.describe('Book search', () => {
  test.beforeEach(async ({ bookStorePage }) => {
    await bookStorePage.goto();
  });

  // Requirement: searching narrows the grid to the matching books.
  // Case: happy-path
  // Invariant: the grid shows exactly the books the term matches.
  test('narrows the grid on a title fragment @smoke', async ({ bookStorePage, catalogue }) => {
    await bookStorePage.search('JavaScript');

    await expect(bookStorePage.titles).toHaveText(expectedTitlesFor(catalogue, 'JavaScript'));
  });

  // Requirement: the search covers the author column.
  // Case: happy-path
  // Invariant: an author's books are reachable by searching their name.
  test('narrows the grid on an author fragment', async ({ bookStorePage, catalogue }) => {
    await bookStorePage.search('Osmani');

    await expect(bookStorePage.titles).toHaveText(expectedTitlesFor(catalogue, 'Osmani'));
  });

  // Requirement: the search covers the publisher column.
  // Case: happy-path
  // Invariant: a publisher's books are reachable by searching its name.
  test('narrows the grid on a publisher fragment', async ({ bookStorePage, catalogue }) => {
    await bookStorePage.search('No Starch');

    await expect(bookStorePage.titles).toHaveText(expectedTitlesFor(catalogue, 'No Starch'));
  });

  // Requirement: the search ignores case.
  // Case: boundary
  // Invariant: a term differing only in case returns the same books.
  test('ignores the case of the search term', async ({ bookStorePage, catalogue }) => {
    await bookStorePage.search('jAvAsCrIpT');

    await expect(bookStorePage.titles).toHaveText(expectedTitlesFor(catalogue, 'JavaScript'));
  });

  // Requirement: a term matching nothing empties the grid rather than silently
  // showing the unfiltered catalogue.
  // Case: error
  // Invariant: no rows remain, and the paging count reflects that.
  test('empties the grid when nothing matches', async ({ bookStorePage }) => {
    await bookStorePage.search('a term no book contains');

    await expect(bookStorePage.rows).toHaveCount(0);
    await expect(bookStorePage.pageIndicator).toHaveText('Page 1 of 0');
  });

  // Requirement: clearing the search restores the full catalogue.
  // Case: boundary
  // Invariant: filtering is reversible and loses nothing.
  test('restores the catalogue when the search is cleared', async ({
    bookStorePage,
    catalogue,
  }) => {
    await bookStorePage.search('JavaScript');
    await expect(bookStorePage.titles).toHaveText(expectedTitlesFor(catalogue, 'JavaScript'));

    await bookStorePage.clearSearch();

    await expect(bookStorePage.titles).toHaveText([...titlesOf(catalogue)]);
  });

  // Requirement: the search reads the title, author and publisher columns only.
  // Case: boundary
  // Invariant: a term found only in a field the grid does not render, such as
  // the ISBN, matches nothing.
  test('does not search fields the grid never renders', async ({ bookStorePage, catalogue }) => {
    const isbn = catalogue[0]?.isbn ?? '';

    await bookStorePage.search(isbn);

    await expect(bookStorePage.rows).toHaveCount(0);
  });
});
