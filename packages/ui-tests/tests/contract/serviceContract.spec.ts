import type { APIResponse } from '@playwright/test';
import type { z } from 'zod';
import { test as base, expect } from '../../src/fixtures/test.js';
import { bookByIsbn } from '../../src/data/catalogue.js';
import { type TestAccount, anAccount } from '../../src/data/testAccount.js';
import { describeIssues } from '../../src/validation/issueDescriptions.js';
import {
  authorisationContract,
  catalogueContract,
  collectionAdditionContract,
  errorContract,
  failedTokenContract,
  registrationContract,
  successfulTokenContract,
  userDetailContract,
} from '../../src/api/serviceContract.js';

/**
 * Contract tests against the Book Store service.
 *
 * These deliberately bypass `ServiceGateway` and talk to the service with a
 * bare request context. The gateway exists to make the suite tolerant of the
 * service: it applies the narrowed schemas in `schemas.ts` and lets zod discard
 * whatever the interface does not render, so a contract asserted through it
 * could only ever detect the drift the suite already fails on. The point of
 * these tests is to catch a change in a response before it surfaces somewhere
 * puzzling, which means measuring the service as it actually answers.
 *
 * The rest of the suite asks whether the interface behaves. These ask whether
 * the service still sends what the interface was built against.
 */

/** Every assertion here compares named faults against none, so a breach reads as a list. */
const contractFaults = (result: z.ZodSafeParseResult<unknown>): readonly string[] =>
  result.success ? [] : describeIssues(result.error);

type ContractSubject = {
  readonly account: TestAccount;
  readonly registration: APIResponse;
  readonly authentication: APIResponse;
  readonly userId: string;
  readonly token: string;
};

/**
 * A registered, authenticated account together with the two raw responses that
 * created it, so the shapes of registration and authentication can be asserted
 * without paying for a second account to observe them.
 */
const test = base.extend<{ subject: ContractSubject }>({
  subject: async ({ apiRequest, environment }, use) => {
    const account = anAccount().withPrefix('contract').build();
    const credentialled = {
      headers: { 'Content-Type': 'application/json' },
      data: account,
      timeout: environment.apiTimeoutMs,
    };

    const registration = await apiRequest.post('/Account/v1/User', credentialled);
    const authentication = await apiRequest.post('/Account/v1/GenerateToken', credentialled);
    const { userID } = (await registration.json()) as { userID: string };
    const { token } = (await authentication.json()) as { token: string };

    await use({ account, registration, authentication, userId: userID, token });

    await apiRequest.delete(`/Account/v1/User/${userID}`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: environment.apiTimeoutMs,
    });
  },
});

/**
 * The contract is HTTP, so it is identical on every engine. Asserting it once
 * per browser project would triple the load on a shared deployment the pipeline
 * already throttles itself against, and would measure nothing new.
 */
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'The service contract is browser independent, so it is asserted once.',
);

test.describe('Book Store service contract', () => {
  // Requirement: the catalogue answers with every field the service holds.
  // Case: happy-path
  // Invariant: no field is added, renamed or withdrawn, `publish_date` included.
  test('serves the catalogue in the documented shape @smoke', async ({
    apiRequest,
    environment,
  }) => {
    const response = await apiRequest.get('/BookStore/v1/Books', {
      timeout: environment.apiTimeoutMs,
    });

    expect(response.status()).toBe(200);
    expect(contractFaults(catalogueContract.safeParse(await response.json()))).toEqual([]);
  });

  // Requirement: registration returns the new identifier and an empty collection.
  // Case: happy-path
  // Invariant: `books` is present and empty, though the interface never reads it.
  test('answers registration with an identifier and an empty collection', async ({ subject }) => {
    const body: unknown = await subject.registration.json();

    expect(subject.registration.status()).toBe(201);
    expect(contractFaults(registrationContract.safeParse(body))).toEqual([]);
    expect(registrationContract.parse(body).books).toEqual([]);
  });

  // Requirement: a valid sign-in returns a bearer token with its expiry.
  // Case: happy-path
  // Invariant: the success response carries `result`, which `schemas.ts` discards.
  test('answers a valid sign-in with a token @smoke', async ({ subject }) => {
    const body: unknown = await subject.authentication.json();

    expect(subject.authentication.status()).toBe(200);
    expect(contractFaults(successfulTokenContract.safeParse(body))).toEqual([]);
  });

  // Requirement: a refused sign-in is distinguishable from an accepted one.
  // Case: error
  // Invariant: refusal is reported at HTTP 200, in the body alone. This pins
  //   D-6, so it fails when the service starts signalling refusal by status
  //   code, which is exactly the change a consumer needs to hear about.
  test('reports a refused sign-in at 200 with a null token', async ({
    subject,
    apiRequest,
    environment,
  }) => {
    const response = await apiRequest.post('/Account/v1/GenerateToken', {
      headers: { 'Content-Type': 'application/json' },
      data: { userName: subject.account.userName, password: 'Wrong1!password' },
      timeout: environment.apiTimeoutMs,
    });

    expect(response.status()).toBe(200);
    expect(contractFaults(failedTokenContract.safeParse(await response.json()))).toEqual([]);
  });

  // Requirement: the authorisation check reports whether the credentials hold.
  // Case: happy-path
  // Invariant: the body is a bare boolean rather than the usual object envelope.
  test('answers the authorisation check with a bare boolean', async ({
    subject,
    apiRequest,
    environment,
  }) => {
    const response = await apiRequest.post('/Account/v1/Authorized', {
      headers: { 'Content-Type': 'application/json' },
      data: subject.account,
      timeout: environment.apiTimeoutMs,
    });

    expect(response.status()).toBe(200);
    expect(contractFaults(authorisationContract.safeParse(await response.json()))).toEqual([]);
  });

  // Requirement: reading an account returns its details and its collection.
  // Case: happy-path
  // Invariant: the identifier is spelled `userId` here and `userID` on create
  //   (D-5), and each held book arrives in full rather than as an identifier.
  //   A book is seeded first so the expanded shape is actually exercised: read
  //   against an empty collection this test cannot see the book contract at all.
  test('serves account details with the collection expanded', async ({
    subject,
    apiRequest,
    environment,
    catalogue,
  }) => {
    const book = bookByIsbn(catalogue, '9781449325862');

    await apiRequest.post('/BookStore/v1/Books', {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${subject.token}` },
      data: { userId: subject.userId, collectionOfIsbns: [{ isbn: book.isbn }] },
      timeout: environment.apiTimeoutMs,
    });

    const response = await apiRequest.get(`/Account/v1/User/${subject.userId}`, {
      headers: { Authorization: `Bearer ${subject.token}` },
      timeout: environment.apiTimeoutMs,
    });
    const detail = userDetailContract.safeParse(await response.json());

    expect(response.status()).toBe(200);
    expect(contractFaults(detail)).toEqual([]);
    expect(detail.success && detail.data.books.map((held) => held.isbn)).toEqual([book.isbn]);
  });

  // Requirement: adding a book echoes what the collection now holds.
  // Case: happy-path
  // Invariant: the echo carries identifiers only, a different shape from the
  //   catalogue's `books` despite sharing the key.
  test('echoes only identifiers when a book is added', async ({
    subject,
    apiRequest,
    environment,
    catalogue,
  }) => {
    const book = bookByIsbn(catalogue, '9781449325862');

    const response = await apiRequest.post('/BookStore/v1/Books', {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${subject.token}` },
      data: { userId: subject.userId, collectionOfIsbns: [{ isbn: book.isbn }] },
      timeout: environment.apiTimeoutMs,
    });

    expect(response.status()).toBe(201);
    expect(contractFaults(collectionAdditionContract.safeParse(await response.json()))).toEqual([]);
  });

  // Requirement: a rejected registration explains itself in the shared envelope.
  // Case: error
  // Invariant: every refusal is `{code, message}`, with the code carried as a string.
  test('refuses a duplicate registration in the shared error envelope', async ({
    subject,
    apiRequest,
    environment,
  }) => {
    const response = await apiRequest.post('/Account/v1/User', {
      headers: { 'Content-Type': 'application/json' },
      data: subject.account,
      timeout: environment.apiTimeoutMs,
    });

    expect(response.status()).toBe(406);
    expect(contractFaults(errorContract.safeParse(await response.json()))).toEqual([]);
  });

  // Requirement: a password breaching the policy is refused with a reason.
  // Case: error
  // Invariant: the refusal uses the same envelope as every other refusal.
  test('refuses a password that breaches the policy', async ({ apiRequest, environment }) => {
    const response = await apiRequest.post('/Account/v1/User', {
      headers: { 'Content-Type': 'application/json' },
      data: { ...anAccount().withPrefix('weak').build(), password: 'short' },
      timeout: environment.apiTimeoutMs,
    });

    expect(response.status()).toBe(400);
    expect(contractFaults(errorContract.safeParse(await response.json()))).toEqual([]);
  });

  // Requirement: reading an account without a token is refused, not served.
  // Case: error
  // Invariant: the refusal arrives as 401 in the shared envelope.
  test('refuses an unauthenticated read', async ({ subject, apiRequest, environment }) => {
    const response = await apiRequest.get(`/Account/v1/User/${subject.userId}`, {
      timeout: environment.apiTimeoutMs,
    });

    expect(response.status()).toBe(401);
    expect(contractFaults(errorContract.safeParse(await response.json()))).toEqual([]);
  });
});
