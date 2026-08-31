import {
  type APIRequestContext,
  test as base,
  request as playwrightRequest,
} from '@playwright/test';
import { AccountApi, type SeededUser } from '../api/accountApi.js';
import { BookStoreApi } from '../api/bookStoreApi.js';
import { ServiceGateway } from '../api/serviceGateway.js';
import { type Environment, loadEnvironment } from '../config/environment.js';
import type { Book } from '../data/catalogue.js';
import { type TestAccount, anAccount } from '../data/testAccount.js';
import { BookDetailPage } from '../pages/BookDetailPage.js';
import { BookStorePage } from '../pages/BookStorePage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { ProfilePage } from '../pages/ProfilePage.js';

/**
 * The composition root for the suite.
 *
 * Playwright's fixtures are used as the dependency injection mechanism: a spec
 * declares what it needs, and construction, seeding and teardown happen here
 * once rather than in every file. Anything a scenario creates is removed when
 * it finishes, so specs are stateless, self-cleaning and safe to run in
 * parallel against a shared deployment.
 */

export type WorkerFixtures = {
  environment: Environment;
  /** Fetched once per worker: the catalogue is read-only shared state. */
  catalogue: readonly Book[];
};

export type TestFixtures = {
  /** A request context bound to the service, which may live on another host. */
  apiRequest: APIRequestContext;
  accountApi: AccountApi;
  bookStoreApi: BookStoreApi;
  /** A registered, authenticated account, deleted when the test finishes. */
  seededUser: SeededUser;
  /** The credentials of `seededUser`, for signing in through the interface. */
  credentials: TestAccount;
  /** A browser context already carrying the seeded user's session. */
  signedIn: SeededUser;
  loginPage: LoginPage;
  bookStorePage: BookStorePage;
  bookDetailPage: BookDetailPage;
  profilePage: ProfilePage;
};

/**
 * The application keeps its session in these four cookies and treats the
 * session as live while `expires` is in the future. Writing them directly lets
 * a scenario that is not about signing in start from a signed-in state without
 * paying for a form submission it is not testing.
 */
const SESSION_COOKIE_NAMES = ['token', 'expires', 'userID', 'userName'] as const;

export const test = base.extend<TestFixtures, WorkerFixtures>({
  environment: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use): Promise<void> => {
      await use(loadEnvironment());
    },
    { scope: 'worker' },
  ],

  catalogue: [
    async ({ environment }, use): Promise<void> => {
      const context = await playwrightRequest.newContext({ baseURL: environment.apiBaseUrl });

      try {
        await use(
          await new BookStoreApi(new ServiceGateway(context, environment.apiTimeoutMs)).catalogue(),
        );
      } finally {
        await context.dispose();
      }
    },
    { scope: 'worker' },
  ],

  apiRequest: async ({ environment }, use) => {
    const context = await playwrightRequest.newContext({ baseURL: environment.apiBaseUrl });

    try {
      await use(context);
    } finally {
      await context.dispose();
    }
  },

  accountApi: async ({ apiRequest, environment }, use) => {
    await use(new AccountApi(new ServiceGateway(apiRequest, environment.apiTimeoutMs)));
  },

  bookStoreApi: async ({ apiRequest, environment }, use) => {
    await use(new BookStoreApi(new ServiceGateway(apiRequest, environment.apiTimeoutMs)));
  },

  seededUser: async ({ accountApi }, use, testInfo) => {
    const prefix = testInfo.title.replace(/[^a-zA-Z0-9]+/g, '').slice(0, 20) || 'qa';
    const user = await accountApi.register(anAccount().withPrefix(prefix).build());

    await use(user);

    await accountApi.delete(user);
  },

  credentials: async ({ seededUser }, use) => {
    await use({ userName: seededUser.userName, password: seededUser.password });
  },

  signedIn: async ({ context, environment, seededUser }, use) => {
    const values: Record<(typeof SESSION_COOKIE_NAMES)[number], string> = {
      token: seededUser.token,
      expires: seededUser.expires,
      userID: seededUser.userId,
      userName: seededUser.userName,
    };

    await context.addCookies(
      SESSION_COOKIE_NAMES.map((name) => ({
        name,
        value: values[name],
        domain: new URL(environment.baseUrl).hostname,
        path: '/',
      })),
    );

    await use(seededUser);
  },

  loginPage: async ({ page, environment }, use) => {
    await use(new LoginPage(page, environment.apiTimeoutMs));
  },

  bookStorePage: async ({ page }, use) => {
    await use(new BookStorePage(page));
  },

  bookDetailPage: async ({ page, environment }, use) => {
    await use(new BookDetailPage(page, environment.apiTimeoutMs));
  },

  profilePage: async ({ page }, use) => {
    await use(new ProfilePage(page));
  },
});

export { expect } from '@playwright/test';
export type { SeededUser };
