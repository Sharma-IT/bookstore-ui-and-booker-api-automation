import { describe, expect, it } from 'vitest';
import { bookingApi } from '../src/clients/bookerApi.js';
import { type ValidBookingRow, invalidBookings, validBookings } from '../src/data/datasets.js';
import type { Booking, BookingBuilder } from '../src/data/bookingBuilder.js';
import { aBooking } from '../src/data/bookingBuilder.js';
import { CREATED_BOOKING_JSON_SCHEMA } from '../src/schemas/booking.js';
import { seedBooking } from '../src/support/seed.js';

/**
 * A dataset row states only what makes its case distinctive, and each applier
 * below sets a field only when the row supplies one. Anything the row omits is
 * left to the builder, which keeps the defaults in exactly one place: repeating
 * them here would mean two sources of truth that could drift apart silently.
 */
const applyScalars = (builder: BookingBuilder, row: ValidBookingRow): BookingBuilder => {
  const named = row.firstname === undefined ? builder : builder.withFirstName(row.firstname);
  const surnamed = row.lastname === undefined ? named : named.withLastName(row.lastname);
  const priced = row.totalprice === undefined ? surnamed : surnamed.withTotalPrice(row.totalprice);

  return row.depositpaid === undefined ? priced : priced.withDepositPaid(row.depositpaid);
};

const applyStay = (builder: BookingBuilder, row: ValidBookingRow): BookingBuilder =>
  row.startsInDays === undefined && row.nights === undefined
    ? builder
    : builder.withStayInDays({ startsInDays: row.startsInDays ?? 1, nights: row.nights ?? 2 });

const applyExtras = (builder: BookingBuilder, row: ValidBookingRow): BookingBuilder => {
  if (row.omitAdditionalNeeds === true) {
    return builder.withoutAdditionalNeeds();
  }

  return row.additionalneeds === undefined
    ? builder
    : builder.withAdditionalNeeds(row.additionalneeds);
};

const bookingFrom = (row: ValidBookingRow): Booking =>
  applyExtras(applyStay(applyScalars(aBooking(), row), row), row).build();

describe('POST /booking', () => {
  // Requirement: a booking is created and echoed back exactly as submitted,
  // with an identifier a caller can use to retrieve it.
  // Case: happy-path
  // Invariant: the response body equals the submitted booking, field for field.
  it.each(validBookings())('creates $description', async (row) => {
    const booking = bookingFrom(row);

    await bookingApi
      .create(booking)
      .expectStatus(200)
      .expectJsonSchema(CREATED_BOOKING_JSON_SCHEMA)
      .expectJsonLike({ booking })
      .expectResponseTime(15_000);
  });

  // Requirement: the identifier the service returns addresses the booking that
  // was just created, not some other one.
  // Case: happy-path
  // Invariant: reading the returned id yields the submitted booking.
  it('returns an identifier that resolves to the created booking @smoke', async () => {
    const booking = aBooking().withFirstName('Retrievable').build();
    const seeded = await seedBooking(booking);

    await bookingApi.getById(seeded.id).expectStatus(200).expectJsonLike(booking);
  });

  // Requirement: two identical submissions are two distinct bookings, since
  // the service offers no idempotency key.
  // Case: boundary
  // Invariant: identical payloads receive different identifiers.
  it('treats an identical resubmission as a separate booking', async () => {
    const booking = aBooking().withFirstName('Duplicated').build();
    const first = await seedBooking(booking);
    const second = await seedBooking(booking);

    expect(second.id).not.toBe(first.id);
  });

  // Requirement: the optional field is genuinely optional, and omitting it must
  // not cause the service to invent a value.
  // Case: boundary
  // Invariant: an omitted additionalneeds is absent from the response.
  it('omits additional needs from the response when none was supplied', async () => {
    const booking = aBooking().withoutAdditionalNeeds().build();
    const body: unknown = await bookingApi.create(booking).expectStatus(200).returns('.');

    expect(body).toMatchObject({ booking });
    expect((body as { booking: Record<string, unknown> }).booking).not.toHaveProperty(
      'additionalneeds',
    );
  });
});

/**
 * Negative rows the service handles correctly, and rows it mishandles, are
 * driven from the same dataset and asserted against the same expectation: the
 * status the service *should* return. The only difference is that a row
 * carrying a `knownDefect` runs under `it.fails`, so the suite stays green
 * while documenting the defect, and turns red the moment it is fixed.
 */
const correctlyRejected = invalidBookings().filter((row) => row.knownDefect === undefined);
const mishandled = invalidBookings().filter((row) => row.knownDefect !== undefined);

describe('POST /booking with an invalid payload', () => {
  it.each(correctlyRejected)(
    'rejects $description with $expectedStatus',
    async ({ payload, rawBody, expectedStatus }) => {
      const request =
        rawBody === undefined ? bookingApi.create(payload ?? {}) : bookingApi.createRaw(rawBody);

      await request.expectStatus(expectedStatus);
    },
  );

  // Each of these is a known defect, traceable by its identifier to
  // API-DEFECTS.md. The assertion states the correct behaviour.
  it.fails.each(mishandled)(
    'rejects $description with $expectedStatus (known defect $knownDefect.id)',
    async ({ payload, rawBody, expectedStatus }) => {
      const request =
        rawBody === undefined ? bookingApi.create(payload ?? {}) : bookingApi.createRaw(rawBody);

      await request.expectStatus(expectedStatus);
    },
  );

  // Requirement: whatever the service decides about an unparseable price, it
  // must not silently store a booking with no price at all.
  // Case: error
  // Invariant: a submitted price is either honoured or the request is refused.
  //
  // Known defect A-8: the service answers 200 and stores `totalprice: null`,
  // so a booking is created that nobody was ever charged for.
  it.fails('never stores a booking whose price was silently discarded', async () => {
    const body: unknown = await bookingApi
      .create({
        firstname: 'Stringy',
        lastname: 'Guest',
        totalprice: 'one hundred',
        depositpaid: true,
        bookingdates: { checkin: '2030-01-01', checkout: '2030-01-03' },
      })
      .returns('.');

    expect((body as { booking?: { totalprice?: unknown } }).booking?.totalprice).not.toBeNull();
  });
});
