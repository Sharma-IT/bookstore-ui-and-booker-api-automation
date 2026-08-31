# Task 1: DemoQA Book Store UI automation

UI automation for the Book Store application at <https://demoqa.com/books>,
built to run on every commit and to be read by whoever inherits it.

- **35 end-to-end scenarios** across the catalogue, search, authentication and
  collection management, plus **72 unit tests** over the pure support modules.
- **Playwright with TypeScript**, strict mode, no `any`.
- **Page Object Model** for the interface, **fixtures as dependency injection**
  for wiring, and **test data builders** for data, with state seeded through the
  service so scenarios stay independent and parallel.
- **Mutation tested** at 100% on every behavioural module, with the gate wired
  into the pipeline.
- Five defects found and recorded in [DEFECTS.md](DEFECTS.md), two of them pinned
  by tests that will fail the build when the application is fixed.

---

## Contents

- [Task 1: DemoQA Book Store UI automation](#task-1-demoqa-book-store-ui-automation)
  - [Contents](#contents)
  - [Running it](#running-it)
  - [Critical user flows](#critical-user-flows)
  - [Why Playwright](#why-playwright)
  - [Scope, and how it was chosen](#scope-and-how-it-was-chosen)
  - [Design](#design)
    - [Page Object Model, with assertions kept out](#page-object-model-with-assertions-kept-out)
    - [Fixtures as dependency injection](#fixtures-as-dependency-injection)
    - [Test data builders](#test-data-builders)
    - [Assertion oracles, not hard-coded data](#assertion-oracles-not-hard-coded-data)
    - [Reliability](#reliability)
  - [Test-driven, and mutation tested](#test-driven-and-mutation-tested)
  - [Continuous delivery](#continuous-delivery)
  - [What I would do next](#what-i-would-do-next)

---

## Running it

Run from the repository root:

```bash
npm ci
npm run install:browsers
npm run verify     # types, lint, format, unit tests, both mutation gates
npm run test:e2e   # the browser suite
```

Or from this directory with `npm run <script>`, since the package owns its own
scripts. The table below names them.

`npm run verify` needs no browser and finishes in under a minute. Run it first.

| Command           | What it does                               |
| ----------------- | ------------------------------------------ |
| `test:e2e`        | The whole browser suite                    |
| `test:smoke`      | The eight scenarios tagged `@smoke`        |
| `test:e2e:ui`     | Playwright's interactive runner            |
| `test:e2e:headed` | A visible browser, for watching a scenario |
| `test:unit`       | Unit tests over the pure modules           |
| `test:mutation`   | The mutation gate                          |
| `typecheck`       | Type check this package                    |

Configuration comes from the environment, documented in
[`.env.example`](.env.example). Copy it to `.env` to change anything; every
setting has a working default, so nothing is required to run against the public
deployment.

```bash
E2E_BASE_URL=https://staging.example.com E2E_BROWSERS=chromium,firefox npm run test:e2e
```

The keys carry an `E2E_` prefix deliberately. Vite, which underpins the unit test
runner, reserves the bare name `BASE_URL` and populates it with its own base path
inside worker processes, so an unprefixed key is silently overwritten.

---

## Critical user flows

The Book Store has four flows that carry the product's value. Everything in the
suite exists to protect one of them, and each is covered end to end by a
scenario tagged `@smoke`, so `npm run test:e2e:smoke` exercises every one in
about thirty seconds.

**1. Browse the catalogue.** A visitor opens the store, sees every book with its
author and publisher, and opens one to read its details. This is the only flow
available without an account, so it is the whole product for an anonymous
visitor and the entry point for everyone else. If it breaks, nothing else can be
reached.
`lists every book the service holds` · `opens the details of a selected book`

**2. Find a book.** A visitor narrows the grid by title, author or publisher.
The catalogue is small today, but search is the mechanism a reader uses to get
anywhere, and it is the richest piece of logic in the application.
`narrows the grid on a title fragment`

**3. Sign in and reach your collection.** A registered reader signs in and lands
on a profile showing what they hold. This flow gates every remaining piece of
functionality, and it is where the security-relevant behaviour lives: refusing
bad credentials without disclosing which accounts exist, and refusing an expired
session.
`admits a registered user` · `ends the session on sign out`

**4. Build and manage a collection.** A reader adds a book from its detail page,
finds it in their profile, and removes it again. This is the only flow that
writes anything the reader owns, so it is where data loss would happen, and it
is where both behavioural defects in [DEFECTS.md](DEFECTS.md) were found.
`adds a book to the collection` · `removes a single confirmed book` ·
`deletes the account`

The flows are also the ordering principle for the suite. The four spec areas map
onto them, the `@smoke` tag marks the shortest path through each, and a scenario
that could not be traced back to one of the four was not written.

---

## Why Playwright

Weighed against Cypress, Selenium with Java, and WebdriverIO, on the axes that
matter for this application and for running in a pipeline.

|                          | Playwright                                     | Cypress                               | Selenium                                | WebdriverIO            |
| ------------------------ | ---------------------------------------------- | ------------------------------------- | --------------------------------------- | ---------------------- |
| Flake resistance         | Auto-waiting and web-first assertions built in | Auto-waiting built in                 | Waiting is the author's problem         | Auto-waiting built in  |
| Parallelism              | Worker processes and shards, free              | Parallelisation behind a paid service | Needs a Grid to operate                 | Workers, free          |
| API access for seeding   | `APIRequestContext` in the same runner         | `cy.request`, same origin constraints | A separate HTTP client and its own auth | A separate HTTP client |
| Cross-origin and dialogs | Native                                         | Restricted by its architecture        | Native                                  | Native                 |
| Session injection        | `context.addCookies`, `storageState`           | Supported                             | Manual                                  | Supported              |
| Triage in CI             | Trace viewer, video, blob report merge         | Dashboard, largely paid               | Screenshots and logs                    | Screenshots and logs   |
| Language fit             | TypeScript first                               | JavaScript first                      | Java or bindings                        | TypeScript supported   |
| Cost                     | Open source, no service                        | Open source, paid dashboard           | Open source, Grid to host               | Open source            |

Two axes decided it. First, this application keeps its state behind a REST
service, and the ability to seed and tear that state down from inside the same
runner, using the same types, is worth more here than anything else on the list.
Second, the application is a single-page app whose grid re-renders as you type;
web-first assertions remove an entire category of flake without a single wait
being written.

Selenium was the closest alternative and was rejected on cost of ownership: a
Grid to host, a separate assertion library, a separate HTTP client, and waiting
strategies written by hand. WebdriverIO is a reasonable substitute for Playwright
but buys nothing extra here. Cypress was rejected on parallelisation cost and on
its handling of the native `alert` the add-to-collection flow depends on.

---

## Scope, and how it was chosen

Registration is out of scope, as briefed. That decision has a consequence worth
stating: without registering through the interface, tests still need accounts.
Sharing one pre-made account across the suite would serialise everything and make
scenarios interfere. So **every scenario registers its own account through the
service, uses it, and deletes it afterwards.** Registration is therefore excluded
from the automated interface coverage without the suite becoming dependent on
shared state.

Coverage was chosen by asking what a reader can actually do, and what it would
cost the business to have broken.

**Covered, in depth.**

- _Catalogue_ (7 scenarios) — the grid matches what the service serves, columns
  are labelled, each row carries the right author and publisher, a title opens
  its detail page with every field correct, and paging state is right at the
  single-page boundary.
- _Search_ (7) — filtering on title, author and publisher, case insensitivity,
  the no-match case, that clearing restores the catalogue, and that fields the
  grid never renders are not searched.
- _Authentication_ (9) — a valid sign-in, a wrong password, an unknown account,
  each field's empty-value validation, the route to registration, the profile
  refusing an anonymous visitor, sign-out, and an expired session being refused.
- _Collections_ (12) — adding a book and being told so, the duplicate case, the
  add control being withheld from an anonymous visitor, removing one book both
  confirmed and cancelled, emptying the collection, searching within it,
  navigating back to the store, and deleting the account.

**Deliberately not covered, and why.**

- _Registration_ — out of scope as briefed. It is also protected by a CAPTCHA,
  which automation should not attempt.
- _Paging beyond one page_ — the service holds eight books and the grid pages at
  ten, so there is no second page to reach and no page-size control to change.
  Recorded as an observation in [DEFECTS.md](DEFECTS.md) rather than faked with a
  test that cannot fail.
- _The rest of demoqa.com_ — the forms, widgets and interaction demos share a
  domain with the Book Store but are unrelated to it.
- _Visual regression_ — worth adding, but it needs a stable environment. The
  public deployment carries live advertising slots that change on every load.

**Assumptions made.** Each of these would need confirming with a product owner on
a real engagement, and each is stated where it is relied upon.

1. The search requirement is a case-insensitive substring match across the three
   text columns the grid renders. Derived from observed behaviour; no written
   specification was available.
2. The service is the source of truth for catalogue content, so the grid is
   asserted against it rather than against titles hard coded in a spec.
3. Deleting an account is expected to end the session. This is the assumption
   behind D-2 and the one most worth confirming, since without it D-2 is a design
   decision rather than a defect.
4. The public deployment is shared and may be slow or briefly unavailable. The
   suite is built to tolerate latency, not to tolerate wrong answers.

---

## Design

```
src/
  config/environment.ts     Environment parsed and validated once, at the boundary
  api/                      Typed service client used to seed and tear down state
    serviceGateway.ts         Timeout policy, status checks, schema validation
    accountApi.ts             Register, read, delete an account
    bookStoreApi.ts           Catalogue, add to and empty a collection
    schemas.ts                Response shapes, validated with zod
  data/                     Pure modules. Unit tested and mutation tested
    passwordPolicy.ts         The application's password rule, and a generator
    testAccount.ts            Test data builder for accounts
    catalogue.ts              Catalogue queries used as the assertion oracle
    alphabet.ts               Bounded character selection
  pages/                    Page objects. Locators and actions, never assertions
    BookStorePage.ts BookDetailPage.ts LoginPage.ts ProfilePage.ts
    components/ConfirmationModal.ts
  fixtures/test.ts          The composition root: construction, seeding, teardown
tests/
  catalogue/ authentication/ collection/
```

### Page Object Model, with assertions kept out

Page objects expose locators and intent-revealing actions. They never assert.
Assertions live in the spec, beside the requirement they encode, and use
Playwright's web-first `expect` so waiting is implicit.

This mattered more than usual here, because the application reuses element ids
across unrelated controls (D-3). The profile has four different buttons under
`id="submit"`; the detail page has eight field values under
`id="userName-value"`. Every workaround for that lives inside a page object, so
when the application is fixed, one file changes and no spec moves.

### Fixtures as dependency injection

Playwright's fixtures are the injection mechanism. A spec declares what it needs
and gets it constructed, seeded and torn down:

```ts
test('removes a single confirmed book', async ({ profilePage, accountApi, catalogue, signedIn }) => {
```

`signedIn` registers an account through the service, writes the four session
cookies the application uses, and deletes the account when the test finishes.
Nothing about signing in through a form is paid for by a test that is not about
signing in — and the tests that _are_ about it drive the real form.

Worker-scoped fixtures hold what is genuinely shared: the catalogue is fetched
once per worker because it is read-only.

### Test data builders

```ts
anAccount().withPrefix('checkout').build();
```

Immutable and fluent: every `with*` returns a new builder, so a builder shared
between parallel tests cannot leak state. Time and randomness are injected rather
than reached for, which is what lets the unit tests assert on exact values
instead of shapes, and is what makes the module mutation-testable at all.

Generated user names carry the scenario's own name, so an account left behind by
a crashed run says which test created it.

### Assertion oracles, not hard-coded data

The catalogue is asserted against what the service serves, through
`booksMatchingSearchTerm`, a pure function unit tested against its own fixtures.
The specification lives in one place, is verified independently of the
application, and the suite survives the catalogue changing.

The trap in that design is a scenario passing vacuously: if the catalogue stopped
containing a term, an empty grid would agree with an empty expectation. The
search specs guard against it by failing when the oracle returns nothing, with a
message saying why.

### Reliability

No fixed waits anywhere, enforced by lint (`playwright/no-wait-for-timeout`).
Every wait is tied to an observable condition. Every scenario creates its own
data and removes it, so the suite is order-independent and parallel-safe.

Retries default to zero locally, so flakiness is visible to whoever wrote it. The
pipeline allows one, because the environment is shared and occasionally drops a
request, and the flaky count in the report keeps that honest.

---

## Test-driven, and mutation tested

The pure modules were written test-first: a failing test, the smallest change
that passes it, then mutation testing to check the tests would actually catch a
defect.

That last step is the one that earns its keep. Mutation testing changes the
production code, a condition negated, a boundary shifted, a statement removed,
and asks whether any test notices. A surviving mutant is a line of code no test
constrains. Coverage says a line ran; a mutation score says a defect in it would
be caught.

```
File                | % score | # killed | # survived
--------------------|---------|----------|-----------
alphabet.ts         |  100.00 |        7 |          0
catalogue.ts        |  100.00 |       20 |          0
environment.ts      |  100.00 |       46 |          0
passwordPolicy.ts   |  100.00 |       49 |          0
testAccount.ts      |  100.00 |       33 |          0
All files           |  100.00 |      155 |          0
```

155 mutants, none surviving, and no suppressions. The build fails below 90%.

It paid for itself three times while this was written. It found a config parser
that never exercised its own multi-fault message; it found a `.replace(/\/+$/)`
that no test distinguished from `.replace(/\/$/)`; and it found an unreachable
`?? ''` fallback that would have silently emitted a malformed password, which was
removed in favour of a guard that fails loudly.

Mutation is scoped to the pure modules on purpose. Page objects and specs are
drivers with no behaviour of their own to constrain, and mutating them would
produce noise while costing a full browser run per mutant. That scope is
configured positively in `stryker.config.json` rather than by suppressing what it
produces.

---

## Continuous delivery

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs three jobs.

1. **verify** — types, lint, format, unit tests and the mutation gate. No browser,
   under a minute. A typo or a weakened test fails here rather than after the
   full run.
2. **e2e** — the browser suite, sharded two ways. Pull requests pay for Chromium;
   the nightly run widens to Firefox and WebKit.
3. **report** — merges the shards' blob reports into one HTML report and one JUnit
   file, published to the run's checks.

`workflow_dispatch` takes a base URL and a browser list, so the same suite runs
against any deployed environment without a code change. That is the point of
parsing configuration at a boundary rather than hard coding it.

**All three engines pass, and the constraint is the service rather than the
browsers.** The first nightly run failed on Chromium, Firefox and WebKit alike.
None of it was a rendering difference. Six jobs starting at once put roughly
eighteen concurrent sessions through a single free deployment, which pushed
authentication from under two seconds to nearly thirteen and some page loads
past forty-five, so the suite was failing on load it generated itself. Run one
engine at a time, the whole suite passes on each: Chromium 35 of 35, Firefox 35
of 35, WebKit clean. The nightly matrix is therefore capped at two concurrent
jobs, which is four sessions on GitHub's four-core runners, and `signIn` waits
for the authentication response rather than letting an assertion race it.

The general point is worth keeping: a suite pointed at a shared environment has
a load profile, and that profile is a property only the real fan-out exhibits.
Every command in this pipeline had been run locally, and the aggregate
concurrency of the matrix had not.

Diagnostics are captured on the failing attempt only: trace, video and
screenshot. A green run stays cheap; a red one arrives with everything needed to
triage it, and `npx playwright show-trace` replays the failure step by step.

A [`Dockerfile`](Dockerfile) pinned to the matching Playwright release runs the
same suite anywhere, for a pipeline that is not GitHub Actions.

---

## What I would do next

- **Confirm assumption 3 with a product owner.** D-2 is either a high-severity
  defect or an intentional design decision, and which one it is changes what
  should happen next.
- **Accessibility checks.** `@axe-core/playwright` over each page. The duplicate
  ids in D-3 suggest there is more to find.
- **Cross-browser coverage.** `E2E_BROWSERS` drives the browser matrix, so the
  suite can run on `chromium` in pull requests and widen to `firefox` and
  `webkit` in nightly or environment-specific runs without a code change.
- **Visual regression**, once there is an environment without live ad slots.
- **A contract test against the service**, so a change in a response shape is
  caught before it surfaces as a puzzling interface failure. The schemas in
  `src/api/schemas.ts` are already most of the work.
- **Publish the mutation and test reports** to somewhere durable, so the trend is
  visible rather than only the current run.
