# Review of the generated `PATCH /booking/{id}` tests

Reviewed as I would review a colleague's pull request. Findings are ordered by
severity, with the reasoning, not just the verdict.

**Summary:** a reasonable first draft that would not have survived review.
Eleven findings, four of them defects that leave the tests non-functional or
actively misleading. It got the endpoint's shape right — auth by token cookie,
403 without one, 405 for an absent booking — and every one of those facts is
correct against the live service. What it missed is everything about _how a
test earns trust_.

---

## Blocking

### 1. One test cannot fail

```ts
const newPrice = 250;
// ...
expect(response.data.totalprice).toBe(response.data.totalprice);
```

The assertion compares the response to itself. It passes for any value the
service returns, including `null`, and `newPrice` is declared and never used.
The test reports a passing price update while proving nothing.

This is the most serious finding, and the most instructive one. It is not a
typo a reader notices: it is the right shape, the right length, and the right
vocabulary, and it is worthless. **A generated test that passes tells you
nothing about whether it can fail.** It is also precisely the class of defect
mutation testing exists to surface, which is why the pure modules in this
repository are mutation tested rather than merely covered.

**Corrected to** compare against the value that was sent, taken from a variable
the test controls, and to assert the whole booking rather than the one field.

### 2. It does not compile or run

Two independent reasons:

- `axios` is not a dependency of this project and never has been. The suite
  uses pactum over the service, chosen so requests, assertions and reporting
  share one stack.
- Bare `token` and `bookingId` declarations have implicit `any` types, which
  `tsc` rejects under this project's `strict` configuration.

Worth noting for what it implies: the output is plausible _TypeScript-shaped
JavaScript_ rather than TypeScript, and it assumes a dependency it was never
told about. An unreviewed paste would fail at the first `npm run typecheck`,
which is the cheap outcome. The expensive outcome is when generated code
compiles and is wrong, as in finding 1.

**Corrected to** use the project's client layer over pactum, with types.

### 3. Two tests pass when the request unexpectedly succeeds

```ts
try {
  await axios.patch(/* no token */);
} catch (error) {
  expect(error.response.status).toBe(403);
}
```

If the service ever stopped requiring authentication, the request would resolve,
the `catch` would never run, no assertion would execute, and **the test would
report a pass**. This is a security-relevant test that is silent about the exact
regression it exists to catch.

The same pattern appears in the non-existent-booking test.

**Corrected to** assert the status directly, so an unexpected success fails.

### 4. It leaves data behind on a shared public service

The booking created in `beforeAll` is never deleted. Restful Booker is a single
public deployment holding thousands of bookings; every run of this file would
add one more permanently. This suite's own name-filter assertions are exact, so
accumulated rows would eventually break unrelated tests.

**Corrected to** seed through the helper that registers its own cleanup, so a
scenario removes what it created even when it fails part way through.

---

## Non-blocking, but each costs something

### 5. Every test asserts the field it changed, and nothing else

Seven tests, and not one checks that the fields it did **not** send kept their
values. That is the entire distinction between `PATCH` and `PUT`. A service that
blanked every unnamed field on patch would pass all seven of these tests.

This is the deepest finding after 1. The generated tests assert _what the
endpoint does_ and never _what it must not do_. In this repository the patch
tests assert the complete expected booking, `{ ...original, ...patch }`, so an
unnamed field being lost fails the test that should fail.

### 6. Tests share one booking and depend on execution order

A single `bookingId` from `beforeAll` is mutated by seven tests in sequence. The
"update multiple fields" test only sees `Jane`/`Doe` because two earlier tests
ran first. Reorder them, run one in isolation, or enable parallelism, and the
results change. Order-dependence makes a failure hard to reproduce, which is the
expensive kind of failure.

**Corrected to** one booking per test, created and destroyed by that test.

### 7. Hard-coded dates that have already passed

`2024-01-01` was in the past when this was generated. It does not fail today,
because the service does not validate stay dates, but it encodes an assumption
that will read as a bug to the next person, and it would break the moment the
service gained the date validation it ought to have.

**Corrected to** dates derived from a clock, via the builder.

### 8. Test names describe the mechanism, not the requirement

"should update the firstname" says what the code does. It does not say what must
be true, so a reader cannot tell from a failure whether the requirement or the
implementation is at fault. The suite reads as a list of operations rather than
a specification.

**Corrected to** names stating behaviour, with the requirement, the case class
and the invariant recorded above each test.

### 9. Credentials and base URL hard-coded

`BASE_URL` and the admin credentials are literals. The suite cannot be pointed
at another environment without editing it, which rules it out as a deployment
gate. This repository parses both from the environment at a validated boundary.

### 10. No schema assertion

Every assertion picks at individual fields. Nothing checks the response is
shaped like a booking at all, so a service returning an extra field, a wrong
type, or a `totalprice` of `null` passes. The corrected tests pair a JSON Schema
check with the value assertions: the schema catches shape drift, the values
catch wrong data. Neither substitutes for the other.

### 11. Seven near-identical tests that should be a table

Six of the seven differ only in which field they patch. That is data, not code,
and it belongs in the JSON dataset that drives the rest of this suite. As
written, adding a case means copying twenty lines.

**Corrected to** a single data-driven test over `partial-updates.json`.

---

## What it got right

Worth recording, because the useful conclusion is not "generated tests are bad".

- Correct authentication mechanism, including the `Cookie: token=` form rather
  than a bearer header, which is unusual enough to be a real trap.
- Correct status codes throughout: 200 on success, 403 unauthenticated, 405 for
  an absent booking. All three verified against the live service.
- Correct request shape, including the nested `bookingdates` object.
- Sensible coverage instincts: single field, multiple fields, unauthenticated,
  and absent resource are the right four cases to reach for first.

The factual knowledge was sound. The engineering judgement was not: it produced
tests that look right, and one that cannot fail.

---

## What I took from this

The generated draft was worth roughly the ten minutes it took to read, as a
checklist of cases to consider. It was not worth pasting. The two findings that
matter, the self-referential assertion and the missing "unnamed fields are
preserved" property, are both invisible to a green test run, which is the
argument for reviewing generated tests against what they would catch rather than
against whether they pass.
