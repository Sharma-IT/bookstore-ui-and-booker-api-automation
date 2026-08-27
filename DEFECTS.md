# Defect register

Defects found in the DemoQA Book Store application while building this suite.
Every entry was reproduced against `https://demoqa.com` and, where it is a
behavioural defect, is pinned by a test in this repository.

Two kinds of entry appear here:

- **Behavioural defects** have a test asserting the correct behaviour, annotated
  `test.fail()`. Playwright reports such a test as passing while it fails, and
  fails the build the moment it starts passing. The suite therefore stays green,
  the defect stays documented, and nobody has to remember to check.
- **Testability defects** have no failing test. They are properties of the markup
  that force the suite into workarounds, and they are recorded because they cost
  maintenance effort on every future change.

---

## D-1 Emptying a collection leaves the page stale (behavioural, medium)

**Where** `/profile`, the "Delete All Books" control.

**Steps**

1. Sign in with an account holding at least one book.
2. Select **Delete All Books** and confirm with **OK**.

**Expected** The confirmation dialog closes and the grid shows no books.

**Actual** The dialog stays open over the grid, and the grid keeps rendering
every book. Reloading the page shows the collection is in fact empty, so the
request reached the service and only the client is stale.

**Impact** A reader is shown data that no longer exists and has no signal that
their action succeeded. The natural response is to press **OK** again.

**Pinned by** `refreshes the view after emptying the collection`, in
`tests/collection/bookCollection.spec.ts`.

**Note** The single-book delete on the same page updates correctly, so the
inconsistency is within one screen.

---

## D-2 Deleting an account leaves the session alive (behavioural, high)

**Where** `/profile`, the "Delete Account" control.

**Steps**

1. Sign in with an account holding at least one book.
2. Select **Delete Account** and confirm with **OK**.

**Expected** The session ends, the session cookies are cleared, and the reader is
returned to the sign-in page.

**Actual** The account is genuinely deleted, confirmed by
`GET /Account/v1/User/{id}` answering `401 User not found!`. The browser is left
on `/profile` with the confirmation dialog open, all four session cookies still
set, and the collection of the deleted account still rendered.

**Impact** More serious than D-1. The reader is looking at a signed-in view of an
account that no longer exists. Any action they take from that screen carries a
token for a deleted user, and the failures they meet will be unexplained. It also
leaves a valid-looking token in the browser after the identity behind it is gone.

**Pinned by** `ends the session when the account is deleted`, in
`tests/collection/bookCollection.spec.ts`.

---

## D-3 Element ids are reused across distinct controls (testability, medium)

**Where** `/profile` and the book detail page.

**Detail** Duplicate ids in a single document, which HTML forbids:

| Page                   | id               | Occurrences | Distinct controls behind it                                                               |
| ---------------------- | ---------------- | ----------- | ----------------------------------------------------------------------------------------- |
| `/profile`             | `submit`         | 4           | Logout, Delete Account, Delete All Books (rendered twice for the responsive layout)       |
| `/books?search=<isbn>` | `userName-value` | 8           | every field value: ISBN, title, sub title, author, publisher, pages, description, website |

**Impact** Beyond the standards breach, `document.getElementById` and every
`#id` selector silently resolve to whichever element comes first. Any automation
written against these ids is wrong rather than merely fragile. Assistive
technology is affected for the same reason.

**Worked around by** addressing profile controls by accessible role and name
narrowed to what is on screen (`src/pages/ProfilePage.ts`), and detail fields
through their labelled wrapper (`src/pages/BookDetailPage.ts`). Both workarounds
are contained in the page objects so a fix touches one file.

---

## D-4 `userName-value` names a field it does not hold (testability, low)

**Where** The book detail page.

**Detail** The id `userName-value` is applied to the ISBN, title, author,
publisher, page count, description and website values. It holds a user name on
exactly one page and something unrelated on this one.

**Impact** The name misleads a reader of the markup about what the element is,
which is how the wrong selector gets written in the first place. Distinct
per-field ids would resolve both this and D-3 on that page.

---

## D-5 The account identifier changes spelling between endpoints (contract, low)

**Where** The Account API.

**Detail** `POST /Account/v1/User` returns the identifier as `userID`;
`GET /Account/v1/User/{id}` returns the same value as `userId`.

**Impact** A consumer must special-case one endpoint. It is the sort of
inconsistency that produces an `undefined` two calls later rather than an error
at the point of the mistake.

**Handled by** `src/api/schemas.ts`, which validates each response against its
own schema and normalises the difference at the boundary.

---

## Observations that are not defects

Recorded so nobody re-investigates them.

- **The service is slow.** Account creation runs three to four seconds and token
  generation five to eight against the public deployment, measured over serial
  and concurrent runs. This is environmental, not a defect, but it drove the
  decision to give service calls their own timeout budget (`E2E_API_TIMEOUT_MS`,
  default 30s) rather than let them inherit the interface action timeout.
- **Paging is inert.** The catalogue holds eight books and the grid pages at ten,
  so **Previous** and **Next** are correctly disabled and no page-size control is
  offered. Paging behaviour beyond the single-page case cannot be exercised
  through the interface without more data than the service holds.
- **The search does not cover ISBN.** The store search reads title, author and
  publisher only. This matches the rendered columns and appears intentional. A
  book is still reachable by ISBN through `/books?search=<isbn>`, which opens
  that book's detail page rather than filtering the grid.
