# Restful Booker API automation

Task 2. An API test suite covering every endpoint the
[Restful Booker docs](https://restful-booker.herokuapp.com/apidoc/index.html)
list, built with **pactum** on **Vitest** in TypeScript.

- **72 API scenarios** across all eight endpoints, plus **52 unit tests** over
  the pure support modules.
- **Data driven** from validated JSON datasets, with each row's description
  becoming the test name.
- **Positive and negative** throughout, including eight malformed payloads.
- **A data flow scenario** threading values from authentication to deletion,
  with nothing hard coded between the steps.
- **Ten defects** found and recorded in [API-DEFECTS.md](API-DEFECTS.md), every
  one pinned by a test that will fail the build when the service is fixed.
- Task 2 Part B, the AI-generated endpoint and its review, is in
  [`ai-assisted/`](ai-assisted/).

Run from the repository root:

```bash
npm run test:api            # the whole suite
npm run test:api:smoke      # the eight scenarios tagged @smoke
npm run test:api:unit       # the pure module tests
npm run test:api:mutation   # the mutation gate
npm run test:api:watch      # the interactive runner
```

Or from this directory as `npm run test`, `test:smoke`, `test:unit`,
`test:mutation` and `test:watch`, since the package owns its own scripts.

---

## Contents

- [Critical user flows](#critical-user-flows)
- [Endpoint coverage](#endpoint-coverage)
- [Why pactum](#why-pactum)
- [Design](#design)
- [Data driven, and what that means here](#data-driven-and-what-that-means-here)
- [Test-driven, and mutation tested](#test-driven-and-mutation-tested)
- [Configuration](#configuration)

---

## Critical user flows

Restful Booker exists to let a system hold and manage hotel bookings. Four flows
carry that value, and every scenario in the suite protects one of them. Each has
an end-to-end scenario tagged `@smoke`, so `npm run test:api:smoke` exercises
all four in a few seconds.

**1. Confirm the service is reachable.** A caller, or a load balancer, checks
`GET /ping` before doing anything else. It is the only unauthenticated,
side-effect-free endpoint, and it is what a deployment pipeline gates on.
`reports that the service is available`

**2. Obtain authority to write.** A client exchanges credentials at `POST /auth`
for a token, and that token is what every subsequent write depends on. This flow
is where the security-relevant behaviour lives, and it holds the
highest-severity defect found: bad credentials are answered `200 OK` (A-1), so a
client checking the status alone proceeds as though it were authenticated.
`issues a token for valid credentials` ·
`issues a token that authorises a protected request`

**3. Record a booking and find it again.** A booking is created, given an
identifier, and retrieved either by that identifier or by searching on the
guest's name. This is the core of the product: everything else operates on a
booking that this flow produced. It is also where the data-integrity defects
cluster, including a price silently stored as `null` (A-8) and a fractional
identifier resolving to somebody else's booking (A-9).
`returns an identifier that resolves to the created booking` ·
`lists booking identifiers` · `returns the whole booking`

**4. Amend or cancel a booking.** A held booking is replaced in full, amended in
part, or removed. This is the only flow that destroys data, so it is where the
cost of a defect is highest, and it carries the merge defect that makes
`additionalneeds` impossible to remove through the API at all (A-10).
`replaces the whole booking` · `updates $description` · `removes a booking`

**The flows joined up.** `bookingLifecycle.spec.ts` runs all four in sequence as
one scenario, threading each step's output into the next: the token from step 2
authorises every write, the identifier from step 3 addresses every later call,
and the generated surname is what step 3's search filters on. Nothing is hard
coded between the steps. The other files exercise one endpoint each with state
arranged by the shortest route, which means they would all still pass if the
handover between endpoints were broken. This scenario is the one that would not.
`threads values from authentication through to deletion`

---

## Endpoint coverage

| Endpoint               | Positive                                             | Negative                                                             |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| `GET /ping`            | available, responds in time                          | status is 201 rather than 200 (A-4)                                  |
| `POST /auth`           | issues a token; the token authorises a write         | four bad credential combinations; status should be 401 (A-1)         |
| `GET /booking`         | lists ids; filters by name, surname and date window  | filter matching nothing; excludes deleted                            |
| `GET /booking/{id}`    | returns the whole booking                            | absent, non-numeric, negative, zero, encoded space, fractional (A-9) |
| `POST /booking`        | eight dataset rows; id resolves; duplicates distinct | nine malformed payloads (A-2, A-6, A-7, A-8)                         |
| `PUT /booking/{id}`    | replaces every field                                 | partial body; absent booking; unauthenticated; merge defect (A-10)   |
| `PATCH /booking/{id}`  | eight dataset rows; leaves other bookings untouched  | absent booking; unauthenticated                                      |
| `DELETE /booking/{id}` | removes; Basic auth; leaves others intact            | absent; repeated; unauthenticated; status defects (A-3, A-5)         |

Authorisation is covered once, across all three mutating verbs, rather than
repeated per endpoint: an unauthenticated `PUT`, `PATCH` and `DELETE`, a
fabricated token, and a confirmation that reads stay public.

---

## Why pactum

The tool choice was made against this brief's five requirements rather than in
the abstract.

**Failure output.** The largest share of an API suite's value is what it tells
you when it goes red. pactum prints the request, the response and a structured
diff. A bare status mismatch sends the reader back to the terminal with `curl`,
which is where the time goes.

**Assertion vocabulary.** `expectJsonSchema`, `expectJsonLike`, `expectJson` and
`expectResponseTime` distinguish shape, subset, exact match and timing. Every
scenario here asserts shape _and_ value, because a schema alone passes on a
booking containing somebody else's details, and a value assertion alone passes
on a response that has quietly grown or lost a field.

**Runner independence.** pactum brings no runner, so Vitest supplies the
structure. That matters for two reasons specific to this repository: `it.each`
gives every dataset row its own named result in the report, and `it.fails` is
what lets a known defect be pinned by a test asserting the correct behaviour.
pactum's own data templates were not used, because they are untyped and produce
one test rather than one per row.

**What was rejected.** Playwright's `APIRequestContext`, used by the UI package,
would have been the consistent choice, and it is the weaker one here: its
assertions are generic and it has no vocabulary for schema or response time.
`supertest` is designed to bind to an in-process server. `axios` with hand-rolled
assertions is what the generated code in `ai-assisted/` does, and the review
there is the argument against it.

---

## Design

```
src/
  config/environment.ts      Configuration parsed and validated at the boundary
  clients/bookerApi.ts       Every request shape, returning unexecuted specs
  schemas/booking.ts         Response contracts, as zod types and JSON Schema
  data/
    bookingBuilder.ts        Test data builder, immutable, injected sources
    datasets.ts              Dataset loading and validation
    datasetSchemas.ts        The row shapes, declarative
    datasets/*.json          The data driving the suite
  support/seed.ts            Arrangement helpers, each registering its cleanup
tests/
  health, auth, createBooking, readBooking, updateBooking, deleteBooking
  bookingLifecycle          The data flow scenario
```

**The client returns unexecuted specs.** `bookingApi.create(booking)` builds a
request and hands it back; the test chains its own expectations and awaits it.
This is the same rule the UI package applies to page objects: the client knows
how to reach the service, the test states what must be true. Assertions stay
beside the requirement they encode, and a scenario needing an unusual
expectation is not blocked by a client that already asserted for it.

**Arrangement is separated from verification.** `support/seed.ts` executes and
returns parsed data, so setting up state reads as one line and fails as a setup
error rather than a failed assertion. Everything it seeds registers its own
cleanup through `onTestFinished`, which runs whether the test passed or failed.

**The builder generates unique names.** Restful Booker is one shared public
deployment. `GET /booking?lastname=` searches all of it, so a scenario asserting
on a filter result must own a name nobody else produces. That is what lets the
filter tests assert an exact list rather than a weaker "contains", and the
uniqueness is the reason those assertions mean anything.

This bit us in a way worth recording. The first version derived the surname from
the clock and a counter starting at zero. Vitest gives each spec file its own
worker process, so every process started that counter at the same value, and two
workers sharing a millisecond generated identical surnames. One file's filter
then returned a booking created by another, failing about one run in three.
The counter is now seeded randomly per process, and there is a unit test pinning
that property.

**Datasets are validated at load.** A mistyped fixture would otherwise surface
as a puzzling assertion failure against the service rather than as the fixture
error it is. Each dataset is parsed against a schema naming the file, the row and
the field, and duplicate descriptions are rejected because descriptions become
test names.

---

## Data driven, and what that means here

Three JSON datasets under `src/data/datasets/`:

- **`valid-bookings.json`** — eight positive rows. Each states only what makes
  it distinctive, with everything else coming from the builder's defaults, so a
  row stays readable and a change to the default shape is made once.
- **`invalid-bookings.json`** — nine negative rows, each carrying the status the
  service **should** return and, where the service gets it wrong, a
  `knownDefect` naming the register entry and the status actually observed.
- **`partial-updates.json`** — eight patches, including an empty one, which must
  change nothing.

The negative dataset drives a pattern worth calling out. Rows the service
handles correctly and rows it mishandles run through the _same_ assertion,
against the status the service ought to return. The only difference is that a
row with a `knownDefect` runs under `it.fails`. So the suite documents ten
defects, stays green, and turns red the day any of them is fixed.

---

## Test-driven, and mutation tested

The pure modules were written test first, then mutation tested with Stryker: 128
mutants, **100%**, no survivors and no suppressions, against a 90% break
threshold.

Mutation testing earned its place three times here. It found a builder whose
sequence could run backwards without any test noticing; a duplicate-description
check that never reported more than one name; and a dataset loader whose
multi-fault message was never exercised.

It also caught something more interesting. Several mutants in `datasets.ts` were
reported as surviving when applying them by hand showed they broke every spec
that imports the file. The cause was module-level parsing: a mutant that made
the parser throw broke module _load_, which the runner could not attribute to
any test. The datasets are now parsed on demand rather than at import, which
fixed the misclassification and is the better design anyway, for the same reason
the configuration module is a function and not a constant.

One mutant survives, on the path separator in a configuration error message. It
is a proven equivalent: every key in that schema is a flat scalar, so an issue
path is always one segment and the separator never appears. Stryker's disable
directive is not honoured for that construct, verified independently of
`disableTypeChecks`, so the equivalence is recorded in a comment at the line
rather than suppressed. The UI package's equivalent line _is_ killed, because its
schema carries an array and produces a nested path.

Mutation is scoped to the pure modules. `datasetSchemas.ts` is excluded by name:
it is declarations with no branches, and mutating it produces twenty variants of
a date pattern rather than anything a test could meaningfully constrain. The
exclusion is documented at the point of configuration and in the file itself.

---

## Configuration

| Variable            | Default                                | Purpose                               |
| ------------------- | -------------------------------------- | ------------------------------------- |
| `BOOKER_BASE_URL`   | `https://restful-booker.herokuapp.com` | Service under test                    |
| `BOOKER_TIMEOUT_MS` | `30000`                                | Per-request budget                    |
| `BOOKER_USERNAME`   | `admin`                                | Credentials, published by the service |
| `BOOKER_PASSWORD`   | `password123`                          | Credentials, published by the service |
| `BOOKER_RETRIES`    | `0`                                    | Retries, kept at zero locally         |

Keys carry a `BOOKER_` prefix so they cannot collide with the UI package's `E2E_`
keys, with Vite's reserved `BASE_URL`, or with anything a CI runner exports. The
credentials are defaults rather than secrets: the service documents them
publicly, and they are overridable for a private instance.
