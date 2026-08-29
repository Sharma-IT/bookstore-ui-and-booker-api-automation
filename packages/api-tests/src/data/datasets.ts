import { z } from 'zod';
import invalidBookingsJson from './datasets/invalid-bookings.json' with { type: 'json' };
import partialUpdatesJson from './datasets/partial-updates.json' with { type: 'json' };
import validBookingsJson from './datasets/valid-bookings.json' with { type: 'json' };
import { invalidBookingRow, partialUpdateRow, validBookingRow } from './datasetSchemas.js';

/**
 * The suite is driven by JSON datasets, and those datasets are themselves a
 * trust boundary: a mistyped fixture would otherwise surface as a puzzling
 * assertion failure against the service rather than as the fixture error it is.
 * Each dataset is parsed at load, naming the file, the row and the field.
 *
 * Every row carries a `description`, which becomes the test name. That is what
 * turns a table of data into a readable report.
 */

export type ValidBookingRow = z.infer<typeof validBookingRow>;
export type InvalidBookingRow = z.infer<typeof invalidBookingRow>;
export type PartialUpdateRow = z.infer<typeof partialUpdateRow>;

const parseDataset = <T extends { description: string }>(
  fileName: string,
  rowSchema: z.ZodType<T>,
  rows: unknown,
): readonly T[] => {
  const result = z.array(rowSchema).nonempty().safeParse(rows);

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    throw new Error(`${fileName} is not a valid dataset. ${detail}`);
  }

  const seen = result.data.map((row) => row.description);
  const duplicates = [...new Set(seen.filter((name, index) => seen.indexOf(name) !== index))];

  if (duplicates.length > 0) {
    throw new Error(`${fileName} has duplicate descriptions: ${duplicates.join(', ')}`);
  }

  return result.data;
};

export const parseValidBookings = (rows: unknown): readonly ValidBookingRow[] =>
  parseDataset('valid-bookings.json', validBookingRow, rows);

export const parseInvalidBookings = (rows: unknown): readonly InvalidBookingRow[] =>
  parseDataset('invalid-bookings.json', invalidBookingRow, rows);

export const parsePartialUpdates = (rows: unknown): readonly PartialUpdateRow[] =>
  parseDataset('partial-updates.json', partialUpdateRow, rows);

/**
 * The shipped datasets, parsed on demand rather than at import.
 *
 * Deliberately functions and not constants. Parsing at module scope means
 * importing this file can throw, which makes the module untestable in
 * isolation and turns any fault in the parser into a module-load error rather
 * than a test failure. It also defeated the mutation runner, which reported
 * mutants as surviving when they had in fact broken every spec that imports
 * this file. Parsing is pure and cheap, so each call simply does the work.
 */
export const validBookings = (): readonly ValidBookingRow[] =>
  parseValidBookings(validBookingsJson);

export const invalidBookings = (): readonly InvalidBookingRow[] =>
  parseInvalidBookings(invalidBookingsJson);

export const partialUpdates = (): readonly PartialUpdateRow[] =>
  parsePartialUpdates(partialUpdatesJson);
