import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage.js';
import { ConfirmationModal } from './components/ConfirmationModal.js';

/**
 * The profile renders four distinct buttons under the single element id
 * `submit`, and repeats two of them for its responsive layout. Every control
 * here is therefore addressed by its accessible role and name, and narrowed to
 * the copy actually on screen, which is both stable and what a user perceives.
 */
export const COLLECTION_GRID_COLUMNS = ['Image', 'Title', 'Author', 'Publisher', 'Action'] as const;

export class ProfilePage extends BasePage {
  readonly userName: Locator;
  readonly searchBox: Locator;
  readonly rows: Locator;
  readonly logOutButton: Locator;
  readonly deleteAllBooksButton: Locator;
  readonly deleteAccountButton: Locator;
  readonly goToBookStoreButton: Locator;
  readonly signedOutNotice: Locator;
  readonly columnHeaders: Locator;
  readonly pageIndicator: Locator;
  readonly confirmationModal: ConfirmationModal;

  constructor(page: Page) {
    super(page, '/profile');
    this.userName = page.locator('#userName-value');
    this.searchBox = page.locator('#searchBox');
    this.rows = page.locator('table tbody tr');
    this.logOutButton = this.visibleButton(page, 'Logout');
    this.deleteAllBooksButton = this.visibleButton(page, 'Delete All Books');
    this.deleteAccountButton = this.visibleButton(page, 'Delete Account');
    this.goToBookStoreButton = this.visibleButton(page, 'Go To Book Store');
    this.signedOutNotice = page.getByText('Currently you are not logged into the Book Store');
    this.columnHeaders = page.locator('table thead th');
    this.pageIndicator = page.getByText(/^Page \d+ of \d+$/);
    this.confirmationModal = new ConfirmationModal(page);
  }

  /**
   * Two of the profile's buttons are rendered twice for its responsive layout,
   * so a role and name alone is ambiguous. Narrowing to what is on screen
   * matches what a user can actually reach.
   */
  private visibleButton(page: Page, name: string): Locator {
    return page.getByRole('button', { name, exact: true }).filter({ visible: true });
  }

  get titles(): Locator {
    return this.rows.locator('td:nth-child(2)');
  }

  deleteButtonFor(isbn: string): Locator {
    return this.page.locator(`[id="delete-record-${isbn}"]`);
  }

  async deleteBook(isbn: string): Promise<void> {
    await this.deleteButtonFor(isbn).click();
  }
}
