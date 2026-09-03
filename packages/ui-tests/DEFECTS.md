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
- **Contract defects** are properties of the service's responses rather than of
  the interface. Each is pinned by a test in `tests/contract/`, which asserts the
  shape as it stands today, so the entry and the assertion move together.
- **Accessibility defects** are pinned the same way, by a recorded baseline that
  the scans compare against and that fails the build when it drifts in either
  direction.

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

## D-6 A refused sign-in is reported as a successful request (contract, high)

**Where** `POST /Account/v1/GenerateToken`.

**Steps**

1. Register an account.
2. Request a token with the correct user name and a wrong password.

**Expected** A status code that distinguishes refusal from success, conventionally 401.

**Actual** HTTP 200, with the refusal carried in the body alone:

```json
{
  "token": null,
  "expires": null,
  "status": "Failed",
  "result": "User authorization failed."
}
```

The accepted and refused cases share an endpoint, a status code and a body shape,
differing only in `status` and in two fields being null.

**Impact** The default way to check an HTTP call is to test the status code, and
here that check passes for a refused password. A consumer written that way then
stores `null` as its token and fails later, at the first authenticated request,
with an error naming neither the cause nor the credentials that caused it. The
severity is not the null itself but where it surfaces: one call away from the
mistake, in code that looks correct.

**Pinned by** `reports a refused sign-in at 200 with a null token`, which asserts
the current behaviour. It fails when the service starts signalling refusal by
status code, which is the change every consumer of this endpoint needs to hear
about.

---

## D-7 The site banner is unreachable by assistive technology (accessibility, high)

**Where** Every page. Reproduced on `/books`, `/books?search=<isbn>`, `/login`
and `/profile`.

**Detail** Scanned with axe-core against WCAG 2.1 AA, with third-party
advertising blocked so every finding below is the application's own markup:

| Page                   | Rules failed                                              |
| ---------------------- | --------------------------------------------------------- |
| `/books`               | `button-name`, `color-contrast`, `image-alt`, `link-name` |
| `/books?search=<isbn>` | `color-contrast`, `image-alt`, `link-name`                |
| `/login`               | `image-alt`, `link-name`                                  |
| `/profile`             | `button-name`, `image-alt`, `link-name`                   |

`image-alt` and `link-name` appear on all four. Both are the site banner: the
image carries no alternative text, and the link wrapping it has no discernible
text either. It is the first thing in the tab order on every page, and it
announces nothing.

`button-name` is the collapsed-navigation toggle, which has no accessible name.
`color-contrast` is the book title links in the grid, which fall below 4.5:1.

**Impact** A screen reader user meets an unlabelled link before any content, on
every page. The two rules that appear everywhere are also the cheapest to fix:
an `alt` attribute and link text.

**Pinned by** `tests/accessibility/accessibility.spec.ts`, which records these
per page in `src/accessibility/knownViolations.ts` and fails on drift in either
direction. A new failure fails the build as a regression; a recorded failure
that stops occurring also fails the build, so the register cannot outlive the
defects.

**Not covered** These scans do not detect D-3. axe-core retired `duplicate-id`
and `duplicate-id-active` as obsolete in 4.x, and the surviving
`duplicate-id-aria` fires only on ids referenced by ARIA or a label, which these
are not.

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
