import { describe, expect, it } from 'vitest';
import {
  invalidBookings,
  parseInvalidBookings,
  parsePartialUpdates,
  parseValidBookings,
  partialUpdates,
  validBookings,
} from './datasets.js';

describe('parseValidBookings', () => {
  // Requirement: a dataset row must describe itself, so a failure names the
  // scenario rather than an array index.
  // Case: happy-path
  // Invariant: a well-formed row survives parsing unchanged.
  it('accepts a well-formed row', () => {
    expect(
      parseValidBookings([
        { description: 'a paid stay', firstname: 'Ada', totalprice: 10, depositpaid: true },
      ]),
    ).toEqual([
      { description: 'a paid stay', firstname: 'Ada', totalprice: 10, depositpaid: true },
    ]);
  });

  // Requirement: every field of a valid row is an override on the builder's
  // defaults, so omitting one is legitimate. Supplying one at the wrong type
  // is a fixture defect and must fail at load, not produce a confusing
  // assertion failure against the service ten tests later.
  // Case: error
  // Invariant: the offending row index and field are both named.
  it('names the row and field when a field has the wrong type', () => {
    expect(() =>
      parseValidBookings([
        { description: 'a mistyped price', firstname: 'Ada', totalprice: 'free' },
      ]),
    ).toThrow(/valid-bookings\.json.*0\.totalprice/s);
  });

  // Requirement: a row may override any subset of the builder's defaults.
  // Case: boundary
  // Invariant: a row carrying only a description is valid.
  it('accepts a row that overrides nothing', () => {
    expect(parseValidBookings([{ description: 'whatever the builder defaults to' }])).toHaveLength(
      1,
    );
  });

  // Requirement: a misspelled field would silently fail to override anything.
  // Case: error
  // Invariant: unknown keys are rejected rather than ignored.
  it('rejects a row carrying an unknown field', () => {
    expect(() => parseValidBookings([{ description: 'a typo', totalpr1ce: 10 }])).toThrow(
      /valid-bookings\.json/,
    );
  });

  // Requirement: an unnamed row cannot be reported usefully.
  // Case: error
  // Invariant: the description is mandatory and non-empty.
  it('rejects a row with no description', () => {
    expect(() =>
      parseValidBookings([{ description: '', firstname: 'Ada', totalprice: 1, depositpaid: true }]),
    ).toThrow(/valid-bookings\.json/);
  });

  // Requirement: descriptions become test names, so duplicates would produce
  // two indistinguishable results in the report.
  // Case: error
  // Invariant: descriptions are unique within a dataset.
  it('rejects duplicate descriptions', () => {
    const row = { description: 'same', firstname: 'Ada', totalprice: 1, depositpaid: true };

    expect(() => parseValidBookings([row, { ...row }])).toThrow(
      'valid-bookings.json has duplicate descriptions: same',
    );
  });

  // Requirement: a dataset with several duplicated names reports all of them,
  // so the fixture is fixed in one pass.
  // Case: error, boundary
  // Invariant: each duplicated name is listed once, separately readable.
  it('lists every duplicated description exactly once', () => {
    const row = (name: string): Record<string, unknown> => ({ description: name, totalprice: 1 });

    expect(() =>
      parseValidBookings([row('first'), row('first'), row('second'), row('second'), row('first')]),
    ).toThrow('valid-bookings.json has duplicate descriptions: first, second');
  });

  // Requirement: a dataset broken in several places reports every fault at
  // once, so it is not repaired one red run at a time.
  // Case: error
  // Invariant: faults are listed together and remain separately readable.
  it('reports every fault in one message', () => {
    expect(() =>
      parseValidBookings([{ description: 'bad', totalprice: 'free', depositpaid: 'yes' }]),
    ).toThrow(/0\.totalprice: .+; 0\.depositpaid: /);
  });

  // Requirement: an empty dataset would silently produce a suite that asserts
  // nothing at all.
  // Case: boundary
  // Invariant: a dataset carries at least one row.
  it('rejects an empty dataset', () => {
    expect(() => parseValidBookings([])).toThrow(/valid-bookings\.json/);
  });
});

describe('parseInvalidBookings', () => {
  // Requirement: a negative row states the status the service ought to return.
  // Case: happy-path
  // Invariant: a row without a known defect parses to exactly its inputs.
  it('accepts a row expecting a rejection', () => {
    expect(
      parseInvalidBookings([{ description: 'an empty body', payload: {}, expectedStatus: 400 }]),
    ).toEqual([{ description: 'an empty body', payload: {}, expectedStatus: 400 }]);
  });

  // Requirement: where the service is known to answer wrongly, the row records
  // both what should happen and what currently does.
  // Case: happy-path
  // Invariant: a known defect carries an identifier traceable to the register.
  it('accepts a row carrying a known defect', () => {
    const [row] = parseInvalidBookings([
      {
        description: 'an empty body',
        payload: {},
        expectedStatus: 400,
        knownDefect: { id: 'A-2', actualStatus: 500 },
      },
    ]);

    expect(row?.knownDefect).toEqual({ id: 'A-2', actualStatus: 500 });
  });

  // Requirement: a defect reference must be traceable to the register.
  // Case: error
  // Invariant: identifiers follow the A-<number> form used in API-DEFECTS.md.
  it('rejects a defect identifier that does not match the register format', () => {
    expect(() =>
      parseInvalidBookings([
        {
          description: 'an empty body',
          payload: {},
          expectedStatus: 400,
          knownDefect: { id: 'oops', actualStatus: 500 },
        },
      ]),
    ).toThrow(/invalid-bookings\.json/);
  });

  // Requirement: a negative row must expect a failure, or it is a positive row
  // in the wrong file.
  // Case: boundary
  // Invariant: the expected status is a client or server error.
  it('rejects an expected status that is not an error', () => {
    expect(() =>
      parseInvalidBookings([{ description: 'a success', payload: {}, expectedStatus: 200 }]),
    ).toThrow(/invalid-bookings\.json/);
  });

  // Requirement: a row sends either a structured payload or a raw body, since
  // a malformed body cannot be expressed as an object.
  // Case: error, boundary
  // Invariant: exactly one of the two is supplied.
  it('requires exactly one of payload or rawBody', () => {
    expect(() => parseInvalidBookings([{ description: 'neither', expectedStatus: 400 }])).toThrow(
      /invalid-bookings\.json/,
    );
    expect(() =>
      parseInvalidBookings([
        { description: 'both', payload: {}, rawBody: '{', expectedStatus: 400 },
      ]),
    ).toThrow(/invalid-bookings\.json/);
  });
});

describe('parsePartialUpdates', () => {
  // Requirement: a patch row supplies the fields to change.
  // Case: happy-path, boundary
  // Invariant: an empty patch is legitimate and means change nothing.
  it('accepts a patch, including an empty one', () => {
    expect(
      parsePartialUpdates([
        { description: 'a rename', patch: { firstname: 'New' } },
        { description: 'nothing at all', patch: {} },
      ]),
    ).toHaveLength(2);
  });

  // Requirement: a patch may only carry fields the booking model defines.
  // Case: error
  // Invariant: an unknown field is a fixture mistake, caught at load.
  it('rejects a patch carrying an unknown field', () => {
    expect(() =>
      parsePartialUpdates([{ description: 'a typo', patch: { firstnam: 'Typo' } }]),
    ).toThrow(/partial-updates\.json/);
  });
});

describe('the shipped datasets', () => {
  // Requirement: the files committed to this repository are themselves valid.
  // Case: happy-path
  // Invariant: every shipped dataset parses and carries rows.
  it('all parse and are non-empty', () => {
    expect(validBookings().length).toBeGreaterThan(0);
    expect(invalidBookings().length).toBeGreaterThan(0);
    expect(partialUpdates().length).toBeGreaterThan(0);
  });

  // Requirement: the negative dataset must cover both payloads the service
  // rejects correctly and payloads it mishandles, or it only documents bugs.
  // Case: boundary
  // Invariant: both kinds of row are present, and every row expects an error.
  it('covers both correctly and incorrectly rejected payloads', () => {
    expect(invalidBookings().some((row) => row.knownDefect === undefined)).toBe(true);
    expect(invalidBookings().some((row) => row.knownDefect !== undefined)).toBe(true);
    expect(invalidBookings().every((row) => row.expectedStatus >= 400)).toBe(true);
  });
});
