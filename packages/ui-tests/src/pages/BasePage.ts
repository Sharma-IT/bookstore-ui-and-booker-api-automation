import type { Page } from '@playwright/test';

/**
 * Page objects expose locators and intent-revealing actions. They never
 * assert: assertions stay visible in the spec, where the requirement is
 * stated, and use Playwright's web-first `expect` so waiting is implicit and
 * no scenario needs a fixed sleep.
 */
export abstract class BasePage {
  protected constructor(
    protected readonly page: Page,
    private readonly path: string,
  ) {}

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }

  get url(): string {
    return this.path;
  }
}
