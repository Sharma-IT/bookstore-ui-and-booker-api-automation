import { z } from 'zod';

/**
 * The shape each dataset row must take.
 *
 * These are declarations rather than behaviour: there are no branches here, and
 * a mutation testing run over them produces variants of a date pattern rather
 * than anything a test could meaningfully constrain. The file is therefore
 * excluded from the mutation scope in stryker.config.json, while the parsing
 * logic that uses them, in datasets.ts, is not.
 */

export const description = z.string().min(1);

export const stay = z
  .object({
    checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();

export const validBookingRow = z
  .object({
    description,
    firstname: z.string().min(1).optional(),
    lastname: z.string().min(1).optional(),
    totalprice: z.number().optional(),
    depositpaid: z.boolean().optional(),
    additionalneeds: z.string().optional(),
    omitAdditionalNeeds: z.boolean().optional(),
    startsInDays: z.number().int().optional(),
    nights: z.number().int().positive().optional(),
  })
  .strict();

export const knownDefect = z
  .object({
    /** Traceable to an entry in API-DEFECTS.md. */
    id: z.string().regex(/^A-\d+$/),
    actualStatus: z.number().int().min(100).max(599),
  })
  .strict();

export const invalidBookingRow = z
  .object({
    description,
    payload: z.record(z.unknown()).optional(),
    /** For bodies that cannot be expressed as an object, such as broken JSON. */
    rawBody: z.string().optional(),
    expectedStatus: z.number().int().min(400).max(599),
    knownDefect: knownDefect.optional(),
  })
  .strict()
  .refine(
    (row) => (row.payload === undefined) !== (row.rawBody === undefined),
    'a row must carry exactly one of payload or rawBody',
  );

export const partialUpdateRow = z
  .object({
    description,
    patch: z
      .object({
        firstname: z.string().optional(),
        lastname: z.string().optional(),
        totalprice: z.number().optional(),
        depositpaid: z.boolean().optional(),
        bookingdates: stay.optional(),
        additionalneeds: z.string().optional(),
      })
      .strict(),
  })
  .strict();
