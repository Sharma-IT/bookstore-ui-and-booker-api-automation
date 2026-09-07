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
    await this.navigate(this.path);
  }

  /**
   * Every navigation in the suite goes through here, so the readiness a page
   * object waits for is decided once rather than per subclass.
   *
   * `domcontentloaded` rather than the default `load`, because `load` also
   * covers the advertising and analytics the pages carry, which puts hosts
   * nobody here controls on the critical path of every scenario. Firefox is
   * where that bites: it holds the event open until those requests settle, and
   * a scheduled run failed there with the navigation spending its whole budget
   * while the application itself had already rendered. Nothing is given up by
   * not waiting, because the grid the specs assert on arrives after `load` on
   * every engine measured, and the web-first assertions that follow are what
   * wait for it.
   */
  protected async navigate(path: string): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  get url(): string {
    return this.path;
  }
}
