import type { Locator, Page } from '@playwright/test';

/**
 * The single confirmation dialog the profile reuses for deleting a book, the
 * whole collection, or the account. Modelled as its own component object
 * because it is shared behaviour, not behaviour belonging to one page.
 */
export class ConfirmationModal {
  readonly title: Locator;
  readonly body: Locator;
  readonly okButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    const dialog = page.getByRole('dialog');

    this.title = dialog.locator('.modal-title');
    this.body = dialog.locator('.modal-body');
    this.okButton = page.locator('#closeSmallModal-ok');
    this.cancelButton = page.locator('#closeSmallModal-cancel');
  }

  async confirm(): Promise<void> {
    await this.okButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
