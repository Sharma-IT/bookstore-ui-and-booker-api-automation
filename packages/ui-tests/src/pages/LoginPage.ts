import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage.js';
import type { TestAccount } from '../data/testAccount.js';

export class LoginPage extends BasePage {
  readonly userNameField: Locator;
  readonly passwordField: Locator;
  readonly loginButton: Locator;
  readonly newUserButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page, '/login');
    this.userNameField = page.locator('#userName');
    this.passwordField = page.locator('#password');
    this.loginButton = page.getByRole('button', { name: 'Login', exact: true });
    this.newUserButton = page.getByRole('button', { name: 'New User' });
    this.errorMessage = page.locator('#output #name');
  }

  async signIn({ userName, password }: TestAccount): Promise<void> {
    await this.userNameField.fill(userName);
    await this.passwordField.fill(password);
    await this.loginButton.click();
  }

  /** A field the application has marked as failing its own validation. */
  invalidField(field: 'userName' | 'password'): Locator {
    return this.page.locator(`#${field}.is-invalid`);
  }
}
