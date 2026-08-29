import { describe, expect, it } from 'vitest';
import { aBooking, addDays, toIsoDate } from './bookingBuilder.js';

const fixedSources = {
  now: (): number => 1_700_000_000_000,
  nextSequence: (): number => 0,
};

describe('toIsoDate', () => {
  // Requirement: the service accepts stay dates as YYYY-MM-DD.
  // Case: happy-path
  // Invariant: the calendar date is rendered, with no time component.
  it('renders an instant as a calendar date', () => {
    expect(toIsoDate(1_700_000_000_000)).toBe('2023-11-14');
  });

  // Requirement: dates are compared as strings by the service filters, so the
  // format must be fixed width.
  // Case: boundary
  // Invariant: single-digit months and days are zero padded.
  it('zero pads months and days', () => {
    expect(toIsoDate(Date.UTC(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('addDays', () => {
  // Requirement: a stay is expressed as an offset from a reference instant.
  // Case: happy-path
  // Invariant: whole days are added, in milliseconds.
  it('advances an instant by whole days', () => {
    expect(toIsoDate(addDays(1_700_000_000_000, 3))).toBe('2023-11-17');
  });

  // Requirement: an offset of zero is the reference day itself.
  // Case: boundary
  // Invariant: zero is the identity, and negative offsets go backwards.
  it('treats zero as the identity and accepts negative offsets', () => {
    expect(toIsoDate(addDays(1_700_000_000_000, 0))).toBe('2023-11-14');
    expect(toIsoDate(addDays(1_700_000_000_000, -1))).toBe('2023-11-13');
  });

  // Requirement: a stay may cross a month boundary.
  // Case: boundary
  // Invariant: the calendar rolls over rather than overflowing the day number.
  it('rolls over a month boundary', () => {
    expect(toIsoDate(addDays(Date.UTC(2026, 0, 30), 3))).toBe('2026-02-02');
  });
});

describe('aBooking', () => {
  // Requirement: a scenario that does not care about the payload still needs a
  // complete, service-acceptable booking.
  // Case: happy-path
  // Invariant: every required field is populated from the injected sources.
  it('builds a complete booking from its defaults', () => {
    expect(aBooking(fixedSources).build()).toEqual({
      firstname: 'Ada',
      lastname: 'Booker-loyw3v28-0',
      totalprice: 150,
      depositpaid: true,
      bookingdates: { checkin: '2023-11-15', checkout: '2023-11-17' },
      additionalneeds: 'Breakfast',
    });
  });

  // Requirement: the service filters bookings by name across a shared public
  // dataset, so a generated surname must not collide with another run's.
  // Case: boundary
  // Invariant: the sequence distinguishes bookings built in the same
  // millisecond.
  it('distinguishes bookings built within the same millisecond', () => {
    let sequence = 0;
    const sources = { now: fixedSources.now, nextSequence: (): number => (sequence += 1) };

    expect(aBooking(sources).build().lastname).toBe('Booker-loyw3v28-1');
    expect(aBooking(sources).build().lastname).toBe('Booker-loyw3v28-2');
  });

  // Requirement: a scenario drives specific field values.
  // Case: happy-path
  // Invariant: each setter replaces exactly its own field.
  it('accepts explicit values for every field', () => {
    const booking = aBooking(fixedSources)
      .withFirstName('Grace')
      .withLastName('Hopper')
      .withTotalPrice(500)
      .withDepositPaid(false)
      .withStay({ checkin: '2030-05-01', checkout: '2030-05-10' })
      .withAdditionalNeeds('Late checkout')
      .build();

    expect(booking).toEqual({
      firstname: 'Grace',
      lastname: 'Hopper',
      totalprice: 500,
      depositpaid: false,
      bookingdates: { checkin: '2030-05-01', checkout: '2030-05-10' },
      additionalneeds: 'Late checkout',
    });
  });

  // Requirement: additionalneeds is the one optional field, so a scenario must
  // be able to omit it entirely rather than send an empty string.
  // Case: boundary
  // Invariant: the key is absent, not undefined.
  it('omits additional needs when asked', () => {
    const booking = aBooking(fixedSources).withoutAdditionalNeeds().build();

    expect(booking).not.toHaveProperty('additionalneeds');
    expect(Object.keys(booking)).toEqual([
      'firstname',
      'lastname',
      'totalprice',
      'depositpaid',
      'bookingdates',
    ]);
  });

  // Requirement: a stay of a given length is a common need, expressed from the
  // reference day rather than by writing two dates.
  // Case: happy-path
  // Invariant: checkin is the offset day, checkout is offset plus nights.
  it('builds a stay from an offset and a night count', () => {
    expect(
      aBooking(fixedSources).withStayInDays({ startsInDays: 10, nights: 2 }).build(),
    ).toMatchObject({ bookingdates: { checkin: '2023-11-24', checkout: '2023-11-26' } });
  });

  // Requirement: builders shared between tests must not leak state.
  // Case: boundary
  // Invariant: each with* call returns a new builder.
  it('returns a new builder rather than mutating the receiver', () => {
    const base = aBooking(fixedSources);
    const renamed = base.withFirstName('Changed');

    expect(base.build().firstname).toBe('Ada');
    expect(renamed.build().firstname).toBe('Changed');
    expect(renamed).not.toBe(base);
  });

  // Requirement: a checkout before its checkin is a malformed stay and a
  // programming error in the test, not a scenario worth sending.
  // Case: error
  // Invariant: the ordering is checked when the stay is set explicitly.
  it('rejects a stay that ends before it starts', () => {
    expect(() =>
      aBooking(fixedSources).withStay({ checkin: '2030-05-10', checkout: '2030-05-01' }),
    ).toThrow('Checkout 2030-05-01 is before checkin 2030-05-10');
  });

  // Requirement: with no sources injected the builder must still work, since
  // that is how every scenario calls it.
  // Case: happy-path
  // Invariant: the wired-in clock and sequence are both functional and unique.
  it('produces distinct bookings from its default sources', () => {
    const surnames = Array.from({ length: 50 }, () => aBooking().build().lastname);

    expect(new Set(surnames).size).toBe(surnames.length);
    expect(aBooking().build().bookingdates.checkin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // Requirement: the sequence advances, so successive surnames within a
  // process are ordered as well as distinct. A counter running backwards would
  // still produce distinct names and would still satisfy the seeding test, so
  // the direction is asserted separately.
  // Case: boundary
  // Invariant: each surname's suffix is greater than the one before it.
  it('advances its default sequence rather than merely changing it', () => {
    const suffixOf = (surname: string): number => Number(surname.split('-')[2]);
    const first = suffixOf(aBooking().build().lastname);
    const second = suffixOf(aBooking().build().lastname);

    expect(second).toBeGreaterThan(first);
  });

  // Requirement: the service accepts a stay that checks in and out on the same
  // day, verified against the live deployment, so the builder must not reject
  // one.
  // Case: boundary
  // Invariant: equal dates are a zero-night stay, not a malformed one.
  it('accepts a stay that checks in and out on the same day', () => {
    expect(
      aBooking(fixedSources).withStay({ checkin: '2030-05-01', checkout: '2030-05-01' }).build()
        .bookingdates,
    ).toEqual({ checkin: '2030-05-01', checkout: '2030-05-01' });
  });

  // Requirement: the test runner gives each spec file its own worker process,
  // and the clock only resolves to the millisecond. A counter starting from
  // the same value in every process therefore produces identical surnames
  // across workers whenever two of them share a millisecond, which is frequent
  // enough to have caused a real cross-file failure.
  // Case: boundary
  // Invariant: each process draws its sequence from its own region of the
  // number space, rather than every process starting from one.
  it('seeds its default sequence unpredictably so parallel workers diverge', () => {
    const suffixOf = (surname: string): number => Number(surname.split('-')[2]);

    expect(suffixOf(aBooking().build().lastname)).toBeGreaterThan(1_000_000);
  });
});
