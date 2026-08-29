# Restful Booker defect register

Defects found in the Restful Booker API while building this suite. Every entry
was reproduced against `https://restful-booker.herokuapp.com` and is pinned by a
test that asserts the **correct** behaviour, annotated `it.fails`. Vitest reports
such a test as passing while it fails and fails the build the moment it starts
passing, so the suite stays green, the defect stays documented, and nobody has to
remember to re-check.

Identifiers `A-n` are referenced from the tests and from
`src/data/datasets/invalid-bookings.json`, where a `knownDefect` field records
both the status the service should return and the one it does.

---

## A-1 Bad credentials are answered 200 OK (high)

`POST /auth`

Submitting a wrong password answers **200** with `{"reason":"Bad credentials"}`.
A rejected authentication attempt is reported with the status of a successful
one.

Any client that routes on the status code, which is the normal thing to do,
treats a rejected login as accepted and proceeds with an undefined token. The
correct answer is 401. This is the highest-severity entry here because it makes
the failure silent at exactly the layer most clients check.

Pinned by `answers 401 Unauthorized for bad credentials` in `tests/auth.spec.ts`.

## A-2 Invalid booking payloads are answered 500 (high)

`POST /booking`

An empty body, or one missing any required field, answers **500 Internal Server
Error**. A malformed request from a client is a 400: the server is working
correctly and the request is not. Answering 500 tells the caller to retry, and
tells the operator their service is broken.

Verified for a body that is empty, that carries only a first name, and that omits
each of the stay dates, the total price and the deposit flag in turn.

Pinned by five rows in `invalid-bookings.json`, driven through
`tests/createBooking.spec.ts`.

## A-8 A non-numeric price is accepted and silently discarded (high)

`POST /booking`

Submitting `"totalprice": "one hundred"` answers **200** and creates the booking
with `"totalprice": null`.

Worse than a rejection, because the caller is told the booking was created and
the booking exists with no price attached. Nobody is charged, and no error was
raised at any point. Either the value should be rejected with a 400 or it should
be coerced, and silently dropping it is the one option that loses money without
telling anyone.

Pinned by `never stores a booking whose price was silently discarded` in
`tests/createBooking.spec.ts`, and by a row in `invalid-bookings.json`.

## A-9 A fractional booking id resolves to another booking (high)

`GET /booking/{id}`

`GET /booking/1.5` and `GET /booking/1.9` both answer **200** with booking **1**.

The identifier is truncated rather than rejected. A caller whose arithmetic
produces `1.5` is handed a different guest's name, dates and price, with a
success status and no indication anything went wrong. Compare `GET /booking/-1`,
`/0` and `/not-a-number`, which all correctly answer 404.

Pinned by `answers 404 for a fractional identifier rather than truncating it` in
`tests/readBooking.spec.ts`.

## A-10 PUT merges instead of replacing (medium)

`PUT /booking/{id}`

Replacing a booking with a body that omits `additionalneeds` leaves the previous
value in place. PUT is defined as a full replacement, and the practical
consequence is that **there is no way to remove `additionalneeds` from a booking
through the API at all**: PUT keeps it and PATCH only sets fields it names.

Pinned by `drops an optional field the replacement omits` in
`tests/updateBooking.spec.ts`.

## A-6 A stay ending before it starts is accepted (medium)

`POST /booking`

A booking with `checkin: 2030-01-10` and `checkout: 2030-01-01` is accepted with
**200** and stored. A negative-length stay is not a booking anyone can honour,
and the data is then in the system for every downstream consumer to handle.

Pinned by a row in `invalid-bookings.json`.

## A-7 A negative total price is accepted (medium)

`POST /booking`

`"totalprice": -500` is accepted with **200**. Whether a negative price means a
refund, a credit or a mistake, the service should decide rather than store it
without comment.

Pinned by a row in `invalid-bookings.json`.

## A-3 A successful delete answers 201 Created (low)

`DELETE /booking/{id}`

A successful deletion answers **201 Created**, with the body `Created`. Deleting
a resource is not creating one. 204 No Content is the correct answer. A client
routing on the status would conclude a resource had just been made.

Pinned by `answers 204 No Content rather than 201 Created` in
`tests/deleteBooking.spec.ts`.

## A-5 Deleting an absent booking answers 405 (low)

`DELETE /booking/{id}`

Deleting a booking that has already been deleted answers **405 Method Not
Allowed**, which tells the client that DELETE is not supported on this route.
The client's actual situation is that the booking is gone, which is 404. The same
applies to `PUT` and `PATCH` against an absent identifier.

This matters more than its severity suggests for a client retrying after a
timeout: it cannot distinguish "already deleted, you are done" from "you are
calling this wrong".

Pinned by `answers 404 Not Found when the booking is already gone` in
`tests/deleteBooking.spec.ts`.

## A-4 The health check answers 201 Created (low)

`GET /ping`

The health endpoint answers **201 Created**. A health check creates nothing. 200
is the correct answer, and a load balancer configured to accept only 200 would
mark a healthy service as down.

Pinned by `answers 200 OK rather than 201 Created` in `tests/health.spec.ts`.

---

## Observations that are not defects

- **`POST /booking` answers 200 rather than 201.** Arguably wrong, since a
  resource is created, but it is consistent, documented by the service's own
  examples, and harms nobody. Recorded and not pinned, because a test asserting
  201 would be asserting a preference rather than a requirement.
- **The deployment sleeps.** It is hosted on a free dyno and can take tens of
  seconds to answer the first request. The suite wakes it once in a global setup
  step rather than letting the first scenario absorb the cost and the risk.
- **The dataset is shared and public.** It held over seven thousand bookings when
  this suite was written, all created by other people. Every scenario here
  generates a surname unique to its process, which is what lets the name-filter
  assertions be exact rather than "contains".
- **Malformed JSON is handled correctly.** A body that is not parseable answers 400. This is the one negative case the service gets right, and the suite covers
  it so the register is not only a list of complaints.
