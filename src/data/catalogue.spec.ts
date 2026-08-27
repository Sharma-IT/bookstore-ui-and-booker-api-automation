import { describe, expect, it } from 'vitest';
import { type Book, bookByIsbn, booksMatchingSearchTerm, titlesOf } from './catalogue.js';

const book = (overrides: Partial<Book> & Pick<Book, 'isbn' | 'title'>): Book => ({
  subTitle: '',
  author: 'Unknown Author',
  publisher: 'Unknown Publisher',
  pages: 1,
  description: '',
  website: 'https://example.invalid',
  ...overrides,
});

const oreilly = "O'Reilly Media";

const catalogue: readonly Book[] = [
  book({
    isbn: '1',
    title: 'Git Pocket Guide',
    author: 'Richard E. Silverman',
    publisher: oreilly,
  }),
  book({
    isbn: '2',
    title: 'Speaking JavaScript',
    author: 'Axel Rauschmayer',
    publisher: oreilly,
  }),
  book({
    isbn: '3',
    title: 'Understanding ECMAScript 6',
    author: 'Nicholas C. Zakas',
    publisher: 'No Starch Press',
  }),
];

describe('booksMatchingSearchTerm', () => {
  // Requirement: the store search filters on title, author and publisher.
  // Case: happy-path
  // Invariant: a title fragment returns only the books whose title contains it.
  it('matches on a title fragment', () => {
    expect(titlesOf(booksMatchingSearchTerm(catalogue, 'JavaScript'))).toEqual([
      'Speaking JavaScript',
    ]);
  });

  // Requirement: the search matches the author column.
  // Case: happy-path
  // Invariant: an author fragment selects that author's books.
  it('matches on an author fragment', () => {
    expect(titlesOf(booksMatchingSearchTerm(catalogue, 'Zakas'))).toEqual([
      'Understanding ECMAScript 6',
    ]);
  });

  // Requirement: the search matches the publisher column.
  // Case: happy-path
  // Invariant: a publisher fragment selects every book from that publisher.
  it('matches on a publisher fragment', () => {
    expect(titlesOf(booksMatchingSearchTerm(catalogue, 'Starch'))).toEqual([
      'Understanding ECMAScript 6',
    ]);
  });

  // Requirement: the search is case insensitive.
  // Case: boundary
  // Invariant: casing of the term and of the data are both ignored.
  it('ignores case in the term and in the data', () => {
    expect(titlesOf(booksMatchingSearchTerm(catalogue, 'jAvAsCrIpT'))).toEqual([
      'Speaking JavaScript',
    ]);
  });

  // Requirement: an unmatched term yields an empty grid.
  // Case: error
  // Invariant: no book is returned for a term present in no searched column.
  it('returns nothing for a term that matches no book', () => {
    expect(booksMatchingSearchTerm(catalogue, 'Kotlin')).toEqual([]);
  });

  // Requirement: the search does not consult the ISBN or description columns,
  // which the grid never renders.
  // Case: boundary
  // Invariant: a term found only outside title, author and publisher matches nothing.
  it('does not match on fields the grid never searches', () => {
    const withDescription = [
      book({ isbn: '9781449325862', title: 'Only Title', description: 'Kotlin' }),
    ];

    expect(booksMatchingSearchTerm(withDescription, '9781449325862')).toEqual([]);
    expect(booksMatchingSearchTerm(withDescription, 'Kotlin')).toEqual([]);
  });

  // Requirement: clearing the search box restores the whole catalogue.
  // Case: boundary
  // Invariant: the empty term is a substring of every field.
  it('returns the whole catalogue for an empty term', () => {
    expect(booksMatchingSearchTerm(catalogue, '')).toHaveLength(3);
  });

  // Requirement: the grid preserves the order the catalogue was served in.
  // Case: boundary
  // Invariant: filtering never reorders the remaining books.
  it('preserves catalogue order', () => {
    expect(titlesOf(booksMatchingSearchTerm(catalogue, 'e'))).toEqual([
      'Git Pocket Guide',
      'Speaking JavaScript',
      'Understanding ECMAScript 6',
    ]);
  });
});

describe('bookByIsbn', () => {
  // Requirement: tests address a specific book by its ISBN.
  // Case: happy-path
  // Invariant: the returned book carries the requested ISBN.
  it('returns the book carrying the ISBN', () => {
    expect(bookByIsbn(catalogue, '2').title).toBe('Speaking JavaScript');
  });

  // Requirement: an absent ISBN means the fixture assumption is stale, which
  // must fail as a setup error rather than as a misleading assertion.
  // Case: error
  // Invariant: the missing ISBN is named in the failure.
  it('fails loudly when no book carries the ISBN', () => {
    expect(() => bookByIsbn(catalogue, '404')).toThrow('No book in the catalogue has ISBN 404');
  });
});

describe('titlesOf', () => {
  // Requirement: assertions on the grid compare titles in display order.
  // Case: happy-path, boundary
  // Invariant: order is preserved and an empty list maps to an empty list.
  it('maps books to titles in order', () => {
    expect(titlesOf(catalogue)).toEqual([
      'Git Pocket Guide',
      'Speaking JavaScript',
      'Understanding ECMAScript 6',
    ]);
    expect(titlesOf([])).toEqual([]);
  });
});
