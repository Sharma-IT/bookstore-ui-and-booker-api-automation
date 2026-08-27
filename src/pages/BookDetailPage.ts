import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage.js';

/**
 * The detail view renders every field value under the same element id,
 * `userName-value`, eight times on one page. Each value is therefore addressed
 * through its own labelled wrapper, which is the only stable anchor the markup
 * offers. Keeping that knowledge here means a fix in the application changes
 * one file rather than every spec.
 */
const FIELD_WRAPPERS = {
  isbn: 'ISBN-wrapper',
  title: 'title-wrapper',
  subTitle: 'subtitle-wrapper',
  author: 'author-wrapper',
  publisher: 'publisher-wrapper',
  pages: 'pages-wrapper',
  description: 'description-wrapper',
  website: 'website-wrapper',
} as const;

export type BookDetailField = keyof typeof FIELD_WRAPPERS;

export class BookDetailPage extends BasePage {
  readonly addToCollectionButton: Locator;
  readonly backToBookStoreButton: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    super(page, '/books');
    this.addToCollectionButton = page.getByRole('button', { name: 'Add To Your Collection' });
    this.backToBookStoreButton = page.getByRole('button', { name: 'Back To Book Store' });
    this.loginButton = page.getByRole('button', { name: 'Login', exact: true });
  }

  async gotoBook(isbn: string): Promise<void> {
    await this.page.goto(`/books?search=${isbn}`);
  }

  value(field: BookDetailField): Locator {
    return this.page.locator(`#${FIELD_WRAPPERS[field]} #userName-value`);
  }

  /**
   * Adding to a collection reports its outcome through a native dialog, which
   * Playwright auto-dismisses unless a handler is registered first. The
   * message is captured before the click so the spec can assert on it.
   */
  async addToCollectionAndCaptureDialog(): Promise<string> {
    const dialogMessage = this.page.waitForEvent('dialog').then(async (dialog) => {
      const message = dialog.message();
      await dialog.dismiss();
      return message;
    });

    await this.addToCollectionButton.click();

    return dialogMessage;
  }
}
