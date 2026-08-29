import { z } from 'zod';

/**
 * Response shapes, used two ways.
 *
 * As zod schemas they give the suite static types and a parse that fails
 * naming the offending field. As JSON Schema, via `toJsonSchema`, the same
 * definitions feed pactum's `expectJsonSchema`, so one description of the
 * contract serves both the type system and the assertions rather than the two
 * drifting apart.
 */

export const staySchema = z.object({
  checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const bookingSchema = z.object({
  firstname: z.string(),
  lastname: z.string(),
  totalprice: z.number().nullable(),
  depositpaid: z.boolean(),
  bookingdates: staySchema,
  additionalneeds: z.string().optional(),
});

export const createdBookingSchema = z.object({
  bookingid: z.number().int().positive(),
  booking: bookingSchema,
});

export const bookingIdListSchema = z.array(z.object({ bookingid: z.number().int().positive() }));

export const authTokenSchema = z.object({ token: z.string().min(1) });

export const authFailureSchema = z.object({ reason: z.string().min(1) });

export type Stay = z.infer<typeof staySchema>;
export type BookingResponse = z.infer<typeof bookingSchema>;
export type CreatedBooking = z.infer<typeof createdBookingSchema>;

/**
 * The JSON Schema pactum asserts against. Kept deliberately structural: it
 * checks that required fields are present and correctly typed, while the value
 * assertions in each test check that the right data came back. A schema alone
 * would pass on a booking containing somebody else's details.
 */
export const CREATED_BOOKING_JSON_SCHEMA = {
  type: 'object',
  required: ['bookingid', 'booking'],
  properties: {
    bookingid: { type: 'integer', minimum: 1 },
    booking: {
      type: 'object',
      required: ['firstname', 'lastname', 'totalprice', 'depositpaid', 'bookingdates'],
      properties: {
        firstname: { type: 'string' },
        lastname: { type: 'string' },
        totalprice: { type: ['number', 'null'] },
        depositpaid: { type: 'boolean' },
        bookingdates: {
          type: 'object',
          required: ['checkin', 'checkout'],
          properties: {
            checkin: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            checkout: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          },
        },
        additionalneeds: { type: 'string' },
      },
    },
  },
} as const;

export const BOOKING_JSON_SCHEMA = CREATED_BOOKING_JSON_SCHEMA.properties.booking;

export const BOOKING_ID_LIST_JSON_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    required: ['bookingid'],
    properties: { bookingid: { type: 'integer', minimum: 1 } },
  },
} as const;
