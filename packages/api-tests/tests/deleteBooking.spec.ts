import { beforeAll, describe, it } from 'vitest';
import { bookingApi, withBasicAuth, withTokenCookie } from '../src/clients/bookerApi.js';
import { loadEnvironment } from '../src/config/environment.js';
import { aBooking } from '../src/data/bookingBuilder.js';
import { authenticate, seedBooking } from '../src/support/seed.js';

const { username, password } = loadEnvironment();

let token: string;

beforeAll(async () => {
  token = await authenticate();
});

describe('DELETE /booking/{id}', () => {
  // Requirement: an authenticated caller removes a booking, and it is gone.
  // Case: happy-path
  // Invariant: the booking is unreadable and unlisted afterwards.
  it('removes a booking @smoke', async () => {
    const booking = aBooking().build();
    const seeded = await seedBooking(booking);

    await withTokenCookie(bookingApi.remove(seeded.id), token).expectStatus(201);

    await bookingApi.getById(seeded.id).expectStatus(404);
    await bookingApi.listIds({ lastname: booking.lastname }).expectStatus(200).expectJson([]);
  });

  // Requirement: Basic credentials authorise a delete as a token does.
  // Case: happy-path
  // Invariant: both documented authentication routes reach the same operation.
  it('accepts HTTP Basic authentication', async () => {
    const seeded = await seedBooking();

    await withBasicAuth(bookingApi.remove(seeded.id), username, password).expectStatus(201);
    await bookingApi.getById(seeded.id).expectStatus(404);
  });

  // Requirement: deleting one booking removes that booking alone.
  // Case: boundary
  // Invariant: a neighbouring booking survives.
  it('leaves other bookings intact', async () => {
    const target = await seedBooking();
    const bystander = await seedBooking();

    await withTokenCookie(bookingApi.remove(target.id), token).expectStatus(201);

    await bookingApi.getById(bystander.id).expectStatus(200);
  });

  // Requirement: deleting a booking that was never created is refused.
  // Case: error
  // Invariant: the service does not report success for work it did not do.
  it('refuses to delete a booking that does not exist', async () => {
    await withTokenCookie(bookingApi.remove(999_999_999), token).expectStatus(405);
  });

  // Requirement: a delete is safe to repeat, which matters because a client
  // that times out cannot know whether its first attempt landed.
  // Case: boundary
  // Invariant: the second attempt reports the booking is already gone.
  it('reports a second delete of the same booking', async () => {
    const seeded = await seedBooking();

    await withTokenCookie(bookingApi.remove(seeded.id), token).expectStatus(201);
    await withTokenCookie(bookingApi.remove(seeded.id), token).expectStatus(405);
  });

  // Requirement: a successful delete reports a status describing what happened.
  // Case: happy-path
  // Invariant: the status distinguishes a deletion from a creation.
  //
  // Known defect A-3: the service answers 201 Created with the body "Created"
  // for a deletion. 204 No Content, or 200, is the correct answer. A client
  // routing on the status would conclude a resource had just been made.
  // Remove this annotation when the service is fixed.
  it.fails('answers 204 No Content rather than 201 Created', async () => {
    const seeded = await seedBooking();

    await withTokenCookie(bookingApi.remove(seeded.id), token).expectStatus(204);
  });

  // Requirement: a delete of an absent booking is a missing resource.
  // Case: error
  // Invariant: the status distinguishes "no such booking" from "wrong verb".
  //
  // Known defect A-5: the service answers 405 Method Not Allowed, which tells a
  // client that DELETE is unsupported on the route rather than that the
  // booking is gone. Remove this annotation when the service is fixed.
  it.fails('answers 404 Not Found when the booking is already gone', async () => {
    const seeded = await seedBooking();

    await withTokenCookie(bookingApi.remove(seeded.id), token).expectStatus(201);
    await withTokenCookie(bookingApi.remove(seeded.id), token).expectStatus(404);
  });
});
