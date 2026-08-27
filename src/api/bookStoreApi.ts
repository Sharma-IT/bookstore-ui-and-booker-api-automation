import type { ServiceGateway } from './serviceGateway.js';
import { bookListSchema } from './schemas.js';
import type { SeededUser } from './accountApi.js';
import type { Book } from '../data/catalogue.js';

export class BookStoreApi {
  constructor(private readonly gateway: ServiceGateway) {}

  /**
   * The catalogue as the service holds it. UI assertions are measured against
   * this rather than against titles hard coded in a spec, so the suite states
   * what the grid must show without asserting on data it does not own.
   */
  async catalogue(): Promise<readonly Book[]> {
    const { books } = await this.gateway.sendAndParse(
      bookListSchema,
      'get',
      '/BookStore/v1/Books',
      {
        expectedStatus: [200],
      },
    );

    return books;
  }

  async addToCollection(user: SeededUser, isbns: readonly string[]): Promise<void> {
    await this.gateway.send('post', '/BookStore/v1/Books', {
      token: user.token,
      payload: { userId: user.userId, collectionOfIsbns: isbns.map((isbn) => ({ isbn })) },
      expectedStatus: [201],
    });
  }

  async emptyCollection(user: SeededUser): Promise<void> {
    await this.gateway.send('delete', `/BookStore/v1/Books?UserId=${user.userId}`, {
      token: user.token,
      expectedStatus: [204],
    });
  }
}
