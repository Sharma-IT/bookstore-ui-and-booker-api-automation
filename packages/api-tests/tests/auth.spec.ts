import { describe, expect, it } from 'vitest';
import type Spec from 'pactum/src/models/Spec';
import { authApi, bookingApi, withBasicAuth, withTokenCookie } from '../src/clients/bookerApi.js';
import { loadEnvironment } from '../src/config/environment.js';
import { aBooking } from '../src/data/bookingBuilder.js';
import { seedBooking } from '../src/support/seed.js';

const { username, password } = loadEnvironment();

describe('POST /auth', () => {
  // Requirement: valid credentials yield a token that authorises write access.
  // Case: happy-path
  // Invariant: the token is a non-empty opaque string.
  it('issues a token for valid credentials @smoke', async () => {
    await authApi
      .createToken({ username, password })
      .expectStatus(200)
      .expectJsonSchema({
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string', minLength: 1 } },
      });
  });

  // Requirement: the token the service issues actually authorises a write.
  // A token that is well formed but powerless would pass a shape check.
  // Case: happy-path
  // Invariant: the issued token is accepted by a protected endpoint.
  it('issues a token that authorises a protected request', async () => {
    const token: string = await authApi
      .createToken({ username, password })
      .expectStatus(200)
      .returns('token');
    const seeded = await seedBooking();

    await withTokenCookie(bookingApi.update(seeded.id, { firstname: 'Authorised' }), token)
      .expectStatus(200)
      .expectJsonLike({ firstname: 'Authorised' });
  });

  // Requirement: bad credentials are refused without issuing a token.
  // Case: error
  // Invariant: no token is present in the response, whatever the status.
  it.each([
    { description: 'a wrong password', username, password: 'not-the-password' },
    { description: 'an unknown user', username: 'nobody-at-all', password },
    { description: 'both wrong', username: 'nobody-at-all', password: 'not-the-password' },
    { description: 'empty credentials', username: '', password: '' },
  ])('refuses $description without issuing a token', async ({ username: user, password: pass }) => {
    const body: unknown = await authApi
      .createToken({ username: user, password: pass })
      .returns('.');

    expect(body).not.toHaveProperty('token');
    expect(body).toMatchObject({ reason: 'Bad credentials' });
  });

  // Requirement: a rejected authentication attempt is an authentication
  // failure, and HTTP has a status for that.
  // Case: error
  // Invariant: the status alone tells a client whether it is authenticated.
  //
  // Known defect A-1: the service answers 200 OK with a `reason` body, so any
  // client checking the status code alone treats a rejection as a success.
  // Remove this annotation when the service is fixed.
  it.fails('answers 401 Unauthorized for bad credentials', async () => {
    await authApi.createToken({ username, password: 'not-the-password' }).expectStatus(401);
  });
});

describe('Authorisation of write operations', () => {
  // Requirement: writes require authentication.
  // Case: error
  // Invariant: every mutating verb is protected, not merely some of them.
  it.each([
    {
      description: 'PUT',
      send: (id: number): Spec => bookingApi.replace(id, aBooking().build()),
    },
    {
      description: 'PATCH',
      send: (id: number): Spec => bookingApi.update(id, { firstname: 'X' }),
    },
    { description: 'DELETE', send: (id: number): Spec => bookingApi.remove(id) },
  ])('refuses an unauthenticated $description with 403', async ({ send }) => {
    const seeded = await seedBooking();

    await send(seeded.id).expectStatus(403).expectBodyContains('Forbidden');
  });

  // Requirement: a token that was never issued must not authorise anything.
  // Case: error
  // Invariant: the token is verified rather than merely present.
  it('refuses a fabricated token', async () => {
    const seeded = await seedBooking();

    await withTokenCookie(
      bookingApi.update(seeded.id, { firstname: 'Forged' }),
      'deadbeefdeadbee',
    ).expectStatus(403);
  });

  // Requirement: the service documents HTTP Basic as an alternative to the
  // token cookie, so both routes must work.
  // Case: happy-path
  // Invariant: Basic credentials authorise the same operations as a token.
  it('accepts HTTP Basic as an alternative to the token cookie', async () => {
    const seeded = await seedBooking();

    await withBasicAuth(bookingApi.update(seeded.id, { firstname: 'ViaBasic' }), username, password)
      .expectStatus(200)
      .expectJsonLike({ firstname: 'ViaBasic' });
  });

  // Requirement: reads are public, so a booking can be looked up without
  // credentials.
  // Case: boundary
  // Invariant: authorisation applies to writes only.
  it('allows an unauthenticated read', async () => {
    const seeded = await seedBooking();

    await bookingApi.getById(seeded.id).expectStatus(200);
  });
});
