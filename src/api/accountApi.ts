import type { HttpClient } from './httpClient.js';
import { type UserDetail, createdUserSchema, tokenSchema, userDetailSchema } from './schemas.js';
import type { TestAccount } from '../data/testAccount.js';

export type SeededUser = TestAccount & {
  readonly userId: string;
  readonly token: string;
  readonly expires: string;
};

export class AccountApi {
  constructor(private readonly http: HttpClient) {}

  /**
   * Registers an account and authenticates it in one step. Registration is out
   * of the automated user interface scope, so every scenario that needs a
   * signed-in user gets a fresh one from here.
   */
  async register(account: TestAccount): Promise<SeededUser> {
    const created = await this.http.sendAndParse(createdUserSchema, 'post', '/Account/v1/User', {
      payload: account,
      expectedStatus: [201],
    });

    const authenticated = await this.http.sendAndParse(
      tokenSchema,
      'post',
      '/Account/v1/GenerateToken',
      { payload: account, expectedStatus: [200] },
    );

    return {
      ...account,
      userId: created.userID,
      token: authenticated.token,
      expires: authenticated.expires,
    };
  }

  async detailsOf(user: SeededUser): Promise<UserDetail> {
    return this.http.sendAndParse(userDetailSchema, 'get', `/Account/v1/User/${user.userId}`, {
      token: user.token,
      expectedStatus: [200],
    });
  }

  /**
   * Removes the account and everything it owns. Tolerates an already-deleted
   * user so a scenario that deletes its own account through the interface
   * still tears down cleanly.
   */
  async delete(user: SeededUser): Promise<void> {
    await this.http.send('delete', `/Account/v1/User/${user.userId}`, {
      token: user.token,
      expectedStatus: [204, 200, 401],
    });
  }
}
