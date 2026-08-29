/**
 * Catalogue queries used as the oracle for grid assertions.
 *
 * The Book Store search is specified as a case-insensitive substring match
 * across the three columns the grid renders as text: title, author and
 * publisher. That specification lives here, exercised by its own unit tests
 * against fixed fixtures, so a UI test can state an expectation without
 * calling into the application to compute it.
 */

export type Book = {
  readonly isbn: string;
  readonly title: string;
  readonly subTitle: string;
  readonly author: string;
  readonly publisher: string;
  readonly pages: number;
  readonly description: string;
  readonly website: string;
};

const SEARCHED_FIELDS = ['title', 'author', 'publisher'] as const;

const containsIgnoringCase = (value: string, term: string): boolean =>
  value.toLowerCase().includes(term.toLowerCase());

export const booksMatchingSearchTerm = (books: readonly Book[], term: string): readonly Book[] =>
  books.filter((candidate) =>
    SEARCHED_FIELDS.some((field) => containsIgnoringCase(candidate[field], term)),
  );

export const bookByIsbn = (books: readonly Book[], isbn: string): Book => {
  const found = books.find((candidate) => candidate.isbn === isbn);

  if (found === undefined) {
    throw new Error(`No book in the catalogue has ISBN ${isbn}`);
  }

  return found;
};

export const titlesOf = (books: readonly Book[]): readonly string[] =>
  books.map((candidate) => candidate.title);
