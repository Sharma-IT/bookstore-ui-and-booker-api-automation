# Task 2, Part B: an endpoint automated with an AI tool

**Brief:** use an AI tool to automate one endpoint, include the output in the
repository, and annotate it with the corrections and improvements made.

**Endpoint chosen:** `PATCH /booking/{id}` — partial update. Picked because it
is the endpoint with the most ways to be subtly wrong: it needs authentication,
it must change only the fields it names, and its correctness depends on what it
_leaves alone_, which is exactly the kind of thing a plausible-looking generated
test skips.

**Tool:** Claude (Anthropic), via Claude Code, which is the same assistant used
throughout this repository. That is worth stating plainly rather than reaching
for a second tool to make the exercise look tidier: the honest artefact is the
first-pass output of the assistant actually in use.

**Method:** a single prompt, given the endpoint documentation and told the stack
in use, with no access to this repository's conventions, page objects, builders
or datasets. That isolation is the point. The exercise measures what a generated
test looks like before a reviewer touches it, so a version informed by the
existing codebase would have answered a different question.

## Files

| File                                                                 | What it is                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`generated-patch-booking.spec.ts`](generated-patch-booking.spec.ts) | The raw output, committed **unmodified**. It does not run.      |
| [`REVIEW.md`](REVIEW.md)                                             | Every defect found, why it matters, and what was done about it. |

The corrected version is not a third file here. It was folded into
[`../tests/updateBooking.spec.ts`](../tests/updateBooking.spec.ts), which is
where a `PATCH` test belongs, and is where the improvements can be seen working.

## The short version

The generated file was a reasonable first draft and would not have survived
review. Eleven findings, of which four are defects that make the tests either
non-functional or actively misleading:

- It **does not compile or run** — the import path and the assertion library
  are both wrong for this project.
- One test **cannot fail**, because it asserts a value it computed from the
  response it is checking.
- One test **leaves data behind** on every run, in a shared public dataset.
- The suite **omits the property that makes PATCH what it is**: that fields not
  named in the patch keep their previous values. Every generated test asserts
  only the field it changed.

The full analysis, finding by finding, is in [`REVIEW.md`](REVIEW.md).
