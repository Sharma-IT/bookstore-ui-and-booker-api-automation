import { onTestFinished } from 'vitest';
import { z } from 'zod';
import { authApi, bookingApi, withTokenCookie } from '../clients/bookerApi.js';
import { loadEnvironment } from '../config/environment.js';
import { type Booking, aBooking } from '../data/bookingBuilder.js';
import { authTokenSchema, createdBookingSchema } from '../schemas/booking.js';

/**
 * Arrangement helpers.
 *
 * These execute requests and return parsed data, in contrast to the client
 * layer, which returns unexecuted specs for a test to assert on. The split is
 * deliberate: arrangement should read as one line and fail as a setup error,
 * while verification should be visible in the test body.
 *
 * Everything seeded here registers its own cleanup, so a scenario leaves the
 * shared public dataset as it found it even when it fails part way through.
 */

export const authenticate = async (): Promise<string> => {
  const { username, password } = loadEnvironment();
  const body: unknown = await authApi
    .createToken({ username, password })
    .expectStatus(200)
    .returns('.');
  const parsed = authTokenSchema.safeParse(body);

  if (!parsed.success) {
    throw new Error(
      `Could not authenticate against Restful Booker. The service answered: ${JSON.stringify(body)}`,
    );
  }

  return parsed.data.token;
};

/** `toss()` is typed as `any` by pactum, so its result is checked, not asserted. */
const tossedResponseSchema = z.object({ statusCode: z.number().int() });

/** 201 means this call removed the booking, 405 that the scenario already had. */
const TERMINAL_DELETE_STATUSES: readonly number[] = [201, 405];

export type SeededBooking = {
  readonly id: number;
  readonly booking: Booking;
};

/**
 * Creates a booking and schedules its removal when the test finishes, whether
 * it passed or failed. The public deployment is shared, so a scenario that
 * leaves rows behind pollutes everybody's name filters, including its own on
 * the next run.
 */
export const seedBooking = async (
  booking: Booking = aBooking().build(),
): Promise<SeededBooking> => {
  const body: unknown = await bookingApi.create(booking).expectStatus(200).returns('.');
  const parsed = createdBookingSchema.safeParse(body);

  if (!parsed.success) {
    throw new Error(`Could not seed a booking. The service answered: ${JSON.stringify(body)}`);
  }

  const { bookingid } = parsed.data;

  onTestFinished(async () => {
    const token = await authenticate();
    // Cleanup asserts nothing about behaviour, so the request is tossed
    // without expectations. Anything other than a terminal status is reported
    // rather than swallowed, because a cleanup that silently fails leaves rows
    // in a dataset every other run filters over.
    const tossed: unknown = await withTokenCookie(bookingApi.remove(bookingid), token).toss();
    const parsed = tossedResponseSchema.safeParse(tossed);

    if (!parsed.success) {
      console.warn(`Could not clean up booking ${bookingid}: the response had no status`);
      return;
    }

    if (!TERMINAL_DELETE_STATUSES.includes(parsed.data.statusCode)) {
      console.warn(
        `Could not clean up booking ${bookingid}: the service answered ${parsed.data.statusCode}`,
      );
    }
  });

  return { id: bookingid, booking };
};
