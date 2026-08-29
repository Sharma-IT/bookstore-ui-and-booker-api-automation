/**
 * Test data builder for Restful Booker bookings.
 *
 * Restful Booker is a single shared public deployment holding several thousand
 * bookings created by everyone using it. `GET /booking?firstname=&lastname=`
 * searches that whole dataset, so any scenario asserting on a filter result
 * must own a name nobody else will produce. That is why the surname is
 * generated from the clock and a sequence rather than fixed, and why both
 * sources are injected: it makes the generation deterministic under test.
 */

export type Stay = {
  readonly checkin: string;
  readonly checkout: string;
};

export type Booking = {
  readonly firstname: string;
  readonly lastname: string;
  readonly totalprice: number;
  readonly depositpaid: boolean;
  readonly bookingdates: Stay;
  readonly additionalneeds?: string;
};

export type BookingSources = {
  /** Milliseconds since the epoch. */
  readonly now: () => number;
  /** A value unique within the process, distinguishing same-millisecond calls. */
  readonly nextSequence: () => number;
};

const MILLISECONDS_PER_DAY = 86_400_000;
const NAME_RADIX = 36;

const DEFAULT_FIRST_NAME = 'Ada';
const DEFAULT_SURNAME_PREFIX = 'Booker';
const DEFAULT_TOTAL_PRICE = 150;
const DEFAULT_DEPOSIT_PAID = true;
const DEFAULT_ADDITIONAL_NEEDS = 'Breakfast';
const DEFAULT_CHECKIN_OFFSET_DAYS = 1;
const DEFAULT_NIGHTS = 2;

export const toIsoDate = (epochMilliseconds: number): string =>
  new Date(epochMilliseconds).toISOString().slice(0, 10);

export const addDays = (epochMilliseconds: number, days: number): number =>
  epochMilliseconds + days * MILLISECONDS_PER_DAY;

/**
 * Seeded randomly rather than from zero. The test runner gives each spec file
 * its own worker process, so a counter starting from the same value in every
 * process generates identical surnames whenever two workers also share a
 * millisecond. That is frequent enough to have caused a real failure: one
 * file's name filter returned a booking created by another file. Giving each
 * process its own region of the number space removes the collision without
 * making the sequence any less deterministic under an injected source.
 */
let processSequence = Math.floor(Math.random() * 2 ** 32);

const defaultSources: BookingSources = {
  now: () => Date.now(),
  nextSequence: () => (processSequence += 1),
};

type BookingDraft = {
  readonly firstname: string | undefined;
  readonly lastname: string | undefined;
  readonly totalprice: number | undefined;
  readonly depositpaid: boolean | undefined;
  readonly bookingdates: Stay | undefined;
  readonly additionalneeds: string | undefined;
  readonly includeAdditionalNeeds: boolean;
};

const generateSurname = (sources: BookingSources): string =>
  `${DEFAULT_SURNAME_PREFIX}-${sources.now().toString(NAME_RADIX)}-${sources.nextSequence()}`;

const defaultStay = (sources: BookingSources): Stay => {
  const reference = sources.now();

  return {
    checkin: toIsoDate(addDays(reference, DEFAULT_CHECKIN_OFFSET_DAYS)),
    checkout: toIsoDate(addDays(reference, DEFAULT_CHECKIN_OFFSET_DAYS + DEFAULT_NIGHTS)),
  };
};

class BookingBuilder {
  readonly #draft: BookingDraft;
  readonly #sources: BookingSources;

  constructor(draft: BookingDraft, sources: BookingSources) {
    this.#draft = draft;
    this.#sources = sources;
  }

  #with(changes: Partial<BookingDraft>): BookingBuilder {
    return new BookingBuilder({ ...this.#draft, ...changes }, this.#sources);
  }

  withFirstName(firstname: string): BookingBuilder {
    return this.#with({ firstname });
  }

  withLastName(lastname: string): BookingBuilder {
    return this.#with({ lastname });
  }

  withTotalPrice(totalprice: number): BookingBuilder {
    return this.#with({ totalprice });
  }

  withDepositPaid(depositpaid: boolean): BookingBuilder {
    return this.#with({ depositpaid });
  }

  withStay(bookingdates: Stay): BookingBuilder {
    if (bookingdates.checkout < bookingdates.checkin) {
      throw new Error(
        `Checkout ${bookingdates.checkout} is before checkin ${bookingdates.checkin}`,
      );
    }

    return this.#with({ bookingdates });
  }

  /** A stay expressed relative to the reference instant, in whole nights. */
  withStayInDays({
    startsInDays,
    nights,
  }: {
    startsInDays: number;
    nights: number;
  }): BookingBuilder {
    const reference = this.#sources.now();

    return this.withStay({
      checkin: toIsoDate(addDays(reference, startsInDays)),
      checkout: toIsoDate(addDays(reference, startsInDays + nights)),
    });
  }

  withAdditionalNeeds(additionalneeds: string): BookingBuilder {
    return this.#with({ additionalneeds, includeAdditionalNeeds: true });
  }

  withoutAdditionalNeeds(): BookingBuilder {
    return this.#with({ includeAdditionalNeeds: false });
  }

  build(): Booking {
    const required = {
      firstname: this.#draft.firstname ?? DEFAULT_FIRST_NAME,
      lastname: this.#draft.lastname ?? generateSurname(this.#sources),
      totalprice: this.#draft.totalprice ?? DEFAULT_TOTAL_PRICE,
      depositpaid: this.#draft.depositpaid ?? DEFAULT_DEPOSIT_PAID,
      bookingdates: this.#draft.bookingdates ?? defaultStay(this.#sources),
    };

    return this.#draft.includeAdditionalNeeds
      ? {
          ...required,
          additionalneeds: this.#draft.additionalneeds ?? DEFAULT_ADDITIONAL_NEEDS,
        }
      : required;
  }
}

export const aBooking = (sources: BookingSources = defaultSources): BookingBuilder =>
  new BookingBuilder(
    {
      firstname: undefined,
      lastname: undefined,
      totalprice: undefined,
      depositpaid: undefined,
      bookingdates: undefined,
      additionalneeds: undefined,
      includeAdditionalNeeds: true,
    },
    sources,
  );

export type { BookingBuilder };
