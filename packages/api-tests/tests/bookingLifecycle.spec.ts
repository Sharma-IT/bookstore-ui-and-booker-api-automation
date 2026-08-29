import { describe, expect, it } from 'vitest';
import { authApi, bookingApi, withTokenCookie } from '../src/clients/bookerApi.js';
import { loadEnvironment } from '../src/config/environment.js';
import { aBooking } from '../src/data/bookingBuilder.js';
import { BOOKING_JSON_SCHEMA, CREATED_BOOKING_JSON_SCHEMA } from '../src/schemas/booking.js';

/**
 * The data flow scenario.
 *
 * Every other file exercises one endpoint with its state arranged by the
 * shortest route. This one deliberately does the opposite: it starts with
 * nothing but credentials and threads the output of each call into the input
 * of the next, so a break anywhere in the chain of custody is caught.
 *
 * Values passed forward:
 *   POST /auth        -> token         -> every write below
 *   POST /booking     -> bookingid     -> read, filter, replace, patch, delete
 *   POST /booking     -> lastname      -> the collection filter
 *   PUT  /booking/id  -> new surname   -> the second filter
 *
 * Nothing is hard coded between the steps, and no step re-derives a value it
 * could have been handed. That is the point: a suite where each test arranges
 * its own state can pass while the handover between endpoints is broken.
 */
describe('Booking lifecycle', () => {
  const { username, password } = loadEnvironment();

  it('threads values from authentication through to deletion @smoke', async () => {
    // 1. Authenticate. The token is the only thing carried into every write.
    const token: string = await authApi
      .createToken({ username, password })
      .expectStatus(200)
      .returns('token');

    expect(token, 'authentication must yield a token before anything else runs').toMatch(/\S/);

    // 2. Create. The identifier and the generated surname both flow onward.
    const original = aBooking().withFirstName('Lifecycle').build();
    const bookingId: number = await bookingApi
      .create(original)
      .expectStatus(200)
      .expectJsonSchema(CREATED_BOOKING_JSON_SCHEMA)
      .expectJsonLike({ booking: original })
      .returns('bookingid');

    expect(bookingId, 'the created booking must be addressable').toBeGreaterThan(0);

    try {
      // 3. Read back by the identifier the create step returned.
      await bookingApi
        .getById(bookingId)
        .expectStatus(200)
        .expectJsonSchema(BOOKING_JSON_SCHEMA)
        .expectJson(original);

      // 4. Find the same booking by the surname the builder generated, and
      //    confirm the collection agrees with the identifier from step 2.
      await bookingApi
        .listIds({ firstname: original.firstname, lastname: original.lastname })
        .expectStatus(200)
        .expectJson([{ bookingid: bookingId }]);

      // 5. Replace it in full, using the token from step 1.
      const replacement = aBooking()
        .withFirstName('Relocated')
        .withTotalPrice(1234)
        .withDepositPaid(false)
        .withStay({ checkin: '2032-09-01', checkout: '2032-09-11' })
        .withAdditionalNeeds('Airport transfer')
        .build();

      await withTokenCookie(bookingApi.replace(bookingId, replacement), token)
        .expectStatus(200)
        .expectJson(replacement);

      // 6. The replacement's own surname now addresses the booking, and the
      //    original surname no longer finds anything.
      await bookingApi
        .listIds({ lastname: replacement.lastname })
        .expectStatus(200)
        .expectJson([{ bookingid: bookingId }]);

      await bookingApi.listIds({ lastname: original.lastname }).expectStatus(200).expectJson([]);

      // 7. Patch a single field. Everything else must survive from step 5.
      await withTokenCookie(bookingApi.update(bookingId, { totalprice: 4321 }), token)
        .expectStatus(200)
        .expectJson({ ...replacement, totalprice: 4321 });

      // 8. Delete, using the same token, and confirm every route to the
      //    booking is now closed.
      await withTokenCookie(bookingApi.remove(bookingId), token).expectStatus(201);

      await bookingApi.getById(bookingId).expectStatus(404);
      await bookingApi.listIds({ lastname: replacement.lastname }).expectStatus(200).expectJson([]);
    } catch (failure) {
      // The booking is removed inline at step 8 on the happy path. If the
      // scenario breaks before then, it still owns the row it created.
      await withTokenCookie(bookingApi.remove(bookingId), token).toss();
      throw failure;
    }
  });
});
