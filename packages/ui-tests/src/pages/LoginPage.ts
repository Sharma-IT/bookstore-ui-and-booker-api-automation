import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage.js';
import type { TestAccount } from '../data/testAccount.js';

export class LoginPage extends BasePage {
  readonly userNameField: Locator;
  readonly passwordField: Locator;
  readonly loginButton: Locator;
  readonly newUserButton: Locator;
  readonly errorMessage: Locator;

  /**
   * `serviceTimeoutMs` budgets the one action here that waits on the Book Store
   * service rather than on a repaint.
   */
  constructor(
    page: Page,
    private readonly serviceTimeoutMs: number,
  ) {
    super(page, '/login');
    this.userNameField = page.locator('#userName');
    this.passwordField = page.locator('#password');
    this.loginButton = page.getByRole('button', { name: 'Login', exact: true });
    this.newUserButton = page.getByRole('button', { name: 'New User' });
    this.errorMessage = page.locator('#output #name');
  }

  /**
   * Submits the form and returns only once the service has answered.
   *
   * Both outcomes of a sign-in, the redirect to the profile and the error
   * message, are rendered from the response to `GenerateToken`, so an assertion
   * made immediately after the click is racing a network round trip while
   * carrying the assertion timeout, which is a budget for a repaint. Waiting
   * for the response here removes the race at its source rather than giving
   * every downstream assertion a longer timeout: against a shared deployment
   * that answer has been measured at up to thirteen seconds under load.
   */
  async signIn({ userName, password }: TestAccount): Promise<void> {
    const authenticated = this.page.waitForResponse(
      (response) => response.url().includes('/Account/v1/GenerateToken'),
      { timeout: this.serviceTimeoutMs },
    );

    await this.userNameField.fill(userName);
    await this.passwordField.fill(password);
    await this.loginButton.click();

    await authenticated;
  }

  /** A field the application has marked as failing its own validation. */
  invalidField(field: 'userName' | 'password'): Locator {
    return this.page.locator(`#${field}.is-invalid`);
  }
}
