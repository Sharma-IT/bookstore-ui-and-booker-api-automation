import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage.js';

export const BOOK_GRID_COLUMNS = ['Image', 'Title', 'Author', 'Publisher'] as const;

export class BookStorePage extends BasePage {
  readonly searchBox: Locator;
  readonly loginButton: Locator;
  readonly grid: Locator;
  readonly rows: Locator;
  readonly columnHeaders: Locator;
  readonly previousPageButton: Locator;
  readonly nextPageButton: Locator;
  readonly pageIndicator: Locator;

  constructor(page: Page) {
    super(page, '/books');
    this.searchBox = page.locator('#searchBox');
    this.loginButton = page.getByRole('button', { name: 'Login', exact: true });
    this.grid = page.locator('table');
    this.rows = this.grid.locator('tbody tr');
    this.columnHeaders = this.grid.locator('thead th');
    this.previousPageButton = page.getByRole('button', { name: 'Previous' });
    this.nextPageButton = page.getByRole('button', { name: 'Next' });
    this.pageIndicator = page.getByText(/^Page \d+ of \d+$/);
  }

  /**
   * The grid filters as you type with no request in flight, so the assertion
   * that follows a search is what waits for the result, not a fixed delay.
   */
  async search(term: string): Promise<void> {
    await this.searchBox.fill(term);
  }

  async clearSearch(): Promise<void> {
    await this.searchBox.clear();
  }

  /** Titles in display order, which is what a grid assertion compares. */
  get titles(): Locator {
    return this.rows.locator('td:nth-child(2) a');
  }

  bookLink(title: string): Locator {
    return this.page.locator(`[id="see-book-${title}"] a`);
  }

  async openBook(title: string): Promise<void> {
    await this.bookLink(title).click();
  }

  cellFor(title: string, column: 'Author' | 'Publisher'): Locator {
    const columnIndex = BOOK_GRID_COLUMNS.indexOf(column) + 1;

    return this.rows
      .filter({ has: this.page.locator(`[id="see-book-${title}"]`) })
      .locator(`td:nth-child(${columnIndex})`);
  }
}
