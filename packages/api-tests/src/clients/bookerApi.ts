import { spec } from 'pactum';
import type Spec from 'pactum/src/models/Spec';
import type { Booking } from '../data/bookingBuilder.js';

/**
 * One place that knows the shape of every Restful Booker request: its path,
 * verb, headers and how authentication is carried.
 *
 * Each operation returns an unexecuted pactum `Spec`, which the test then
 * chains its own expectations onto and awaits. That mirrors the rule the UI
 * suite follows for page objects: the client knows how to reach the service,
 * the test states what must be true. Assertions stay beside the requirement
 * they encode, and a scenario needing an unusual expectation is not blocked by
 * a client that already made its assertions for it.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' } as const;

/**
 * The service accepts either a token cookie or HTTP Basic. The cookie is the
 * documented route and is what the suite exercises by default, with Basic
 * covered separately so the alternative is not left unverified.
 */
export const withTokenCookie = (request: Spec, token: string): Spec =>
  request.withHeaders('Cookie', `token=${token}`);

export const withBasicAuth = (request: Spec, username: string, password: string): Spec =>
  request.withAuth(username, password);

export type BookingFilters = {
  readonly firstname?: string;
  readonly lastname?: string;
  readonly checkin?: string;
  readonly checkout?: string;
};

export const healthApi = {
  ping: (): Spec => spec().get('/ping'),
};

export const authApi = {
  createToken: (credentials: { username: string; password: string }): Spec =>
    spec().post('/auth').withHeaders(JSON_HEADERS).withJson(credentials),
};

export const bookingApi = {
  /**
   * pactum rejects an empty query object, so an unfiltered listing omits the
   * call entirely rather than passing `{}`. Keeping that quirk here means no
   * test has to know about it.
   */
  listIds: (filters: BookingFilters = {}): Spec => {
    const request = spec().get('/booking').withHeaders(JSON_HEADERS);

    return Object.keys(filters).length === 0 ? request : request.withQueryParams(filters);
  },

  getById: (bookingId: number | string): Spec =>
    spec().get(`/booking/${bookingId}`).withHeaders(JSON_HEADERS),

  create: (booking: Booking | Record<string, unknown>): Spec =>
    spec().post('/booking').withHeaders(JSON_HEADERS).withJson(booking),

  /** For bodies that are not valid JSON, which `withJson` could not express. */
  createRaw: (rawBody: string): Spec =>
    spec().post('/booking').withHeaders(JSON_HEADERS).withBody(rawBody),

  replace: (bookingId: number | string, booking: Booking | Record<string, unknown>): Spec =>
    spec().put(`/booking/${bookingId}`).withHeaders(JSON_HEADERS).withJson(booking),

  update: (bookingId: number | string, patch: Record<string, unknown>): Spec =>
    spec().patch(`/booking/${bookingId}`).withHeaders(JSON_HEADERS).withJson(patch),

  remove: (bookingId: number | string): Spec =>
    spec().delete(`/booking/${bookingId}`).withHeaders(JSON_HEADERS),
};
