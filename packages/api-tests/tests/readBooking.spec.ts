import { describe, expect, it } from 'vitest';
import { bookingApi, withTokenCookie } from '../src/clients/bookerApi.js';
import { aBooking } from '../src/data/bookingBuilder.js';
import { BOOKING_ID_LIST_JSON_SCHEMA, BOOKING_JSON_SCHEMA } from '../src/schemas/booking.js';
import { authenticate, seedBooking } from '../src/support/seed.js';

/**
 * An identifier no booking will ever carry. The service allots ids in the low
 * thousands, so this is far outside the range, and every use asserts that the
 * booking is absent. It is the one value here not created by the test that
 * uses it, and it is safe because the assertion runs in the direction the
 * shared dataset cannot invalidate.
 */
const ABSENT_BOOKING_ID = 999_999_999;

type BookingId = { bookingid: number };

describe('GET /booking', () => {
  // Requirement: the collection lists the identifier of every booking held.
  // Case: happy-path
  // Invariant: the response is a list of identifiers and nothing else.
  it('lists booking identifiers @smoke', async () => {
    await bookingApi
      .listIds()
      .expectStatus(200)
      .expectJsonSchema(BOOKING_ID_LIST_JSON_SCHEMA)
      .expectResponseTime(20_000);
  });

  // Requirement: a newly created booking appears in the collection.
  // Case: happy-path
  // Invariant: the list reflects writes, rather than being cached or stale.
  it('includes a booking created moments earlier', async () => {
    const seeded = await seedBooking();
    const ids: BookingId[] = await bookingApi.listIds().expectStatus(200).returns('.');

    expect(ids.map((entry) => entry.bookingid)).toContain(seeded.id);
  });

  // Requirement: the collection is filterable by guest name, so a caller can
  // find a booking without knowing its identifier.
  // Case: happy-path
  // Invariant: filtering returns exactly the bookings bearing that name. The
  // surname is generated per run precisely so this assertion can be exact
  // against a public dataset thousands of bookings deep.
  it('filters by first and last name', async () => {
    const booking = aBooking().withFirstName('Filterable').build();
    const seeded = await seedBooking(booking);

    const ids: BookingId[] = await bookingApi
      .listIds({ firstname: booking.firstname, lastname: booking.lastname })
      .expectStatus(200)
      .returns('.');

    expect(ids).toEqual([{ bookingid: seeded.id }]);
  });

  // Requirement: each filter narrows independently.
  // Case: happy-path
  // Invariant: a surname alone is sufficient, since it is unique per run.
  it('filters by surname alone', async () => {
    const booking = aBooking().build();
    const seeded = await seedBooking(booking);

    const ids: BookingId[] = await bookingApi
      .listIds({ lastname: booking.lastname })
      .expectStatus(200)
      .returns('.');

    expect(ids).toEqual([{ bookingid: seeded.id }]);
  });

  // Requirement: the collection is filterable by stay dates.
  // Case: happy-path
  // Invariant: a booking whose stay falls inside the window is returned.
  it('filters by a stay date window', async () => {
    const booking = aBooking().withStay({ checkin: '2035-04-10', checkout: '2035-04-14' }).build();
    const seeded = await seedBooking(booking);

    const ids: BookingId[] = await bookingApi
      .listIds({ checkin: '2035-04-09', checkout: '2035-04-15' })
      .expectStatus(200)
      .returns('.');

    expect(ids.map((entry) => entry.bookingid)).toContain(seeded.id);
  });

  // Requirement: a filter matching nothing is an empty result, not an error.
  // Case: error, boundary
  // Invariant: the empty list is returned with a success status.
  it('returns an empty list when a filter matches nothing', async () => {
    await bookingApi
      .listIds({ lastname: 'NoSuchSurnameWillEverExist' })
      .expectStatus(200)
      .expectJson([]);
  });

  // Requirement: a deleted booking leaves the collection.
  // Case: boundary
  // Invariant: the filter reflects deletions as well as creations.
  it('excludes a booking once it has been deleted', async () => {
    const booking = aBooking().build();
    const seeded = await seedBooking(booking);

    await bookingApi.listIds({ lastname: booking.lastname }).expectJson([{ bookingid: seeded.id }]);

    await withTokenCookie(bookingApi.remove(seeded.id), await authenticate()).expectStatus(201);

    await bookingApi.listIds({ lastname: booking.lastname }).expectStatus(200).expectJson([]);
  });
});

describe('GET /booking/{id}', () => {
  // Requirement: a booking is retrievable by its identifier, in full.
  // Case: happy-path
  // Invariant: every submitted field comes back unchanged.
  it('returns the whole booking @smoke', async () => {
    const booking = aBooking().withFirstName('Readable').build();
    const seeded = await seedBooking(booking);

    await bookingApi
      .getById(seeded.id)
      .expectStatus(200)
      .expectJsonSchema(BOOKING_JSON_SCHEMA)
      .expectJson(booking);
  });

  // Requirement: an unknown identifier is reported as absent.
  // Case: error
  // Invariant: the status distinguishes absent from broken.
  it('answers 404 for an identifier that does not exist', async () => {
    await bookingApi.getById(ABSENT_BOOKING_ID).expectStatus(404);
  });

  // Requirement: an identifier that is not a positive integer is absent rather
  // than a server error.
  // Case: error, boundary
  // Invariant: a malformed identifier does not reach the data layer.
  it.each(['not-a-number', '-1', '0', '%20'])('answers 404 for the identifier %s', async (id) => {
    await bookingApi.getById(id).expectStatus(404);
  });

  // Requirement: an identifier is a whole number, so a fractional one
  // addresses no booking and must be refused.
  // Case: error, boundary
  // Invariant: the service never answers with a resource the caller did not
  // ask for.
  //
  // Known defect A-9: a fractional identifier is truncated to its integer part
  // and answers 200 with that booking. A caller with a rounding error is handed
  // a booking it did not ask for, with a success status and no indication
  // anything went wrong. Remove this annotation when the service is fixed.
  //
  // The booking is seeded rather than borrowed. An earlier version asserted
  // against `/booking/1.5`, which depends on booking 1 existing in a shared
  // public dataset that resets periodically. When it reset, that booking
  // briefly did not exist, the endpoint answered 404 for the right reason by
  // accident, and this test passed unexpectedly and failed the build.
  it.fails('answers 404 for a fractional identifier rather than truncating it', async () => {
    const seeded = await seedBooking();

    await bookingApi.getById(`${seeded.id}.5`).expectStatus(404);
  });
});
