import { beforeAll, describe, expect, it } from 'vitest';
import { bookingApi, withTokenCookie } from '../src/clients/bookerApi.js';
import { aBooking } from '../src/data/bookingBuilder.js';
import { partialUpdates } from '../src/data/datasets.js';
import { BOOKING_JSON_SCHEMA } from '../src/schemas/booking.js';
import { authenticate, seedBooking } from '../src/support/seed.js';

/**
 * An identifier no booking will ever carry. The service allots ids in the low
 * thousands, so this is far outside the range, and every use asserts that the
 * booking is absent. It is the one value here not created by the test that
 * uses it, and it is safe because the assertion runs in the direction the
 * shared dataset cannot invalidate.
 */
const ABSENT_BOOKING_ID = 999_999_999;

let token: string;

beforeAll(async () => {
  token = await authenticate();
});

describe('PUT /booking/{id}', () => {
  // Requirement: a full update replaces every field of the booking.
  // Case: happy-path
  // Invariant: the response and a subsequent read both show the new booking.
  it('replaces the whole booking @smoke', async () => {
    const seeded = await seedBooking();
    const replacement = aBooking()
      .withFirstName('Replaced')
      .withTotalPrice(999)
      .withDepositPaid(false)
      .withStay({ checkin: '2033-03-03', checkout: '2033-03-09' })
      .withAdditionalNeeds('Sea view')
      .build();

    await withTokenCookie(bookingApi.replace(seeded.id, replacement), token)
      .expectStatus(200)
      .expectJsonSchema(BOOKING_JSON_SCHEMA)
      .expectJson(replacement);

    await bookingApi.getById(seeded.id).expectStatus(200).expectJson(replacement);
  });

  // Requirement: a replacement drops fields the new booking does not carry,
  // which is what distinguishes PUT from PATCH.
  // Case: boundary
  // Invariant: an omitted optional field is removed rather than retained.
  //
  // Known defect A-10: the prior `additionalneeds` survives the replacement,
  // so PUT behaves as a merge. The practical consequence is that there is no
  // way to remove `additionalneeds` from a booking through the API at all.
  // Remove this annotation when the service is fixed.
  it.fails('drops an optional field the replacement omits', async () => {
    const seeded = await seedBooking(aBooking().withAdditionalNeeds('Breakfast').build());
    const replacement = aBooking().withoutAdditionalNeeds().build();

    await withTokenCookie(bookingApi.replace(seeded.id, replacement), token).expectStatus(200);

    const body: unknown = await bookingApi.getById(seeded.id).expectStatus(200).returns('.');

    expect(body).not.toHaveProperty('additionalneeds');
  });

  // Requirement: a full update requires a full booking.
  // Case: error
  // Invariant: a partial body is refused rather than partially applied.
  it('refuses a partial body', async () => {
    const seeded = await seedBooking();

    await withTokenCookie(
      bookingApi.replace(seeded.id, { firstname: 'OnlyFirst' }),
      token,
    ).expectStatus(400);
  });

  // Requirement: an update to a booking that does not exist is refused.
  // Case: error
  // Invariant: PUT does not create a booking at an arbitrary identifier.
  it('refuses to replace a booking that does not exist', async () => {
    await withTokenCookie(
      bookingApi.replace(ABSENT_BOOKING_ID, aBooking().build()),
      token,
    ).expectStatus(405);
  });
});

describe('PATCH /booking/{id}', () => {
  // Requirement: a partial update changes only the fields it names.
  // Case: happy-path
  // Invariant: every field not named keeps the value it had.
  it.each(partialUpdates())('updates $description', async ({ patch }) => {
    const original = aBooking().build();
    const seeded = await seedBooking(original);
    const expected = { ...original, ...patch };

    await withTokenCookie(bookingApi.update(seeded.id, patch), token)
      .expectStatus(200)
      .expectJsonSchema(BOOKING_JSON_SCHEMA)
      .expectJson(expected);

    await bookingApi.getById(seeded.id).expectStatus(200).expectJson(expected);
  });

  // Requirement: a patch is applied to the booking it addresses and no other.
  // Case: boundary
  // Invariant: a neighbouring booking is untouched.
  it('leaves other bookings untouched', async () => {
    const untouched = aBooking().withFirstName('Untouched').build();
    const target = await seedBooking();
    const bystander = await seedBooking(untouched);

    await withTokenCookie(
      bookingApi.update(target.id, { firstname: 'Changed' }),
      token,
    ).expectStatus(200);

    await bookingApi.getById(bystander.id).expectStatus(200).expectJson(untouched);
  });

  // Requirement: patching a booking that does not exist is refused.
  // Case: error
  // Invariant: PATCH does not create a booking.
  it('refuses to patch a booking that does not exist', async () => {
    await withTokenCookie(
      bookingApi.update(ABSENT_BOOKING_ID, { firstname: 'Ghost' }),
      token,
    ).expectStatus(405);
  });
});
