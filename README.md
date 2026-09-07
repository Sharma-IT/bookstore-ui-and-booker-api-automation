# Book Store UI and Restful Booker API automation

Two test suites in one npm workspaces monorepo.

| Package                                    | Task                                              | Scenarios           |
| ------------------------------------------ | ------------------------------------------------- | ------------------- |
| [`packages/ui-tests`](packages/ui-tests)   | **Task 1** — DemoQA Book Store UI, Playwright     | 35 browser, 72 unit |
| [`packages/api-tests`](packages/api-tests) | **Task 2** — Restful Booker API, pactum on Vitest | 72 API, 52 unit     |

**231 tests. 284 mutants, all killed. 15 defects found across the two services**,
each pinned by a test that will fail the build when the service is fixed.

Each package has its own README covering its design, scope and trade-offs, and
its own defect register:

- Task 1: [README](packages/ui-tests/README.md) · [defects](packages/ui-tests/DEFECTS.md)
- Task 2: [README](packages/api-tests/README.md) · [defects](packages/api-tests/API-DEFECTS.md) · [Part B, AI-generated endpoint](packages/api-tests/ai-assisted/)

---

## Contents

- [Running everything](#running-everything)
- [Why a monorepo](#why-a-monorepo)
- [Shared engineering approach](#shared-engineering-approach)
- [Continuous delivery](#continuous-delivery)
- [Use of AI assistance](#use-of-ai-assistance)
  - [What the automated gates caught](#what-the-automated-gates-caught)
  - [What my review caught](#what-my-review-caught)
  - [The bar it had to meet](#the-bar-it-had-to-meet)

---

## Running everything

```bash
npm ci
npm run verify          # types, lint, format, unit tests, both mutation gates
npm run test:api        # Task 2, no browser needed
npm run install:browsers
npm run test:e2e        # Task 1
```

`npm run verify` needs no browser and finishes in about a minute. Run it first.
`npm test` runs both suites, API first, since it is the faster of the two.

Every script is available from the repository root, named for the task it
belongs to, so neither suite has to be run by changing directory.

| Task 2, Restful Booker | Task 1, Book Store  | What it runs                  |
| ---------------------- | ------------------- | ----------------------------- |
| `test:api`             | `test:e2e`          | The whole suite               |
| `test:api:smoke`       | `test:e2e:smoke`    | The scenarios tagged `@smoke` |
| `test:api:unit`        | `test:e2e:unit`     | That package's unit tests     |
| `test:api:mutation`    | `test:e2e:mutation` | That package's mutation gate  |
| `test:api:watch`       | `test:e2e:ui`       | The interactive runner        |
| —                      | `test:e2e:headed`   | A visible browser             |

The cross-cutting scripts, `verify`, `typecheck`, `lint`, `format`,
`test:unit` and `test:mutation`, run across both packages.

---

## Why a monorepo

The two suites share a language, a formatter, a linter and a compiler
configuration, and share nothing else. Keeping them as workspace packages buys
three things that a single package would not.

**The API suite installs and runs without browsers.** Its CI job never calls
`playwright install`, which is the difference between a job that starts in
seconds and one that downloads several hundred megabytes first. That is the
concrete saving, and it is the strongest of the three.

**Configuration cannot collide.** Each suite needs its own runner config, its
own mutation config and its own environment keys. At the repository root those
would sit beside each other with no owner, and `vitest.config.ts` would have to
serve two different jobs.

**A reviewer can assess one task without reading the other.** Two briefs, two
packages, two READMEs, two defect registers.

The cost is real and small: one more `package.json`, and a root config layer
(`tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`) that both extend.

---

## Shared engineering approach

Both suites are built the same way, and the reasoning transfers.

**State is arranged through the service and verified through the interface
under test.** A test named "removes a single confirmed book" should go red if
and only if book removal is broken. Arranging its state through the UI would
make a login defect turn it red too, and one bug would produce a dozen failures
that do not name the thing that broke. Setup is arrangement, not verification.

**Every scenario owns its data and destroys it.** Both target shared public
deployments. Nothing is reused between tests, so the suites are order
independent and parallel safe, and a failed run leaves nothing behind.

**Page objects and API clients expose locators and requests, never assertions.**
Assertions stay in the spec beside the requirement they encode. In the UI
package this is more than a style preference: a page object returning resolved
values instead of locators would reintroduce the races that auto-retrying
assertions exist to remove.

**Pure logic is separated, unit tested and mutation tested.** Builders, dataset
loaders, catalogue queries and configuration parsers hold the only real branches
in either suite. They are tested with Vitest and mutated with Stryker at a 90%
break threshold. Coverage says a line ran; a mutation score says a defect in it
would be caught.

**Known defects are pinned rather than worked around.** A defect gets a test
asserting the _correct_ behaviour, marked `test.fail()` or `it.fails()`. The
runner reports it as passing while it fails and fails the build the moment it
starts passing. The suite stays green, the defect stays documented, and nobody
has to remember to re-check. The alternative, asserting the buggy behaviour,
would encode the bug as the requirement and make fixing the service break the
suite.

The pipeline caches Stryker's incremental file between runs, keyed on the
lockfile and both Stryker configs. Incremental mode watches source and test
files and knows nothing about dependencies, so a runner whose behaviour changed
under a new version would otherwise carry old verdicts forward and report a
passing score for a suite that had stopped killing anything. Hashing the
lockfile into the key forces a cold run whenever a dependency moves, which is
the one case incremental mode cannot reason about.

**Thresholds are never relaxed to get green.** When a guard trips, the first
question is whether the regression is real or the measurement is wrong. Two
timeout failures in Task 1 turned out to be a click budget applied to a network
round trip; the fix was a separate, correctly named budget, not a bigger number.
The same shape recurred in navigation, which had been handed the whole test
budget. A page that never loaded therefore exhausted the test at the same
moment, and the failure arrived as a bare test timeout rather than as a page
that did not load. Navigation now carries its own budget, which the parser
holds below the test's.

**TypeScript stays on 5, and the reason is measured rather than assumed.**
TypeScript 7 is the native port, and its npm package no longer exports the
JavaScript compiler API: the package entry point exports `version` and
`versionMajorMinor` and nothing else, with the compiler reachable only through
`unstable/*` subpaths over a Go binary. Every tool here that reads TypeScript through that API
therefore stops working. Linting fails outright, because typescript-eslint
refuses to load against TS 7 and its support depends on asynchronous parser
support that ESLint does not yet have. Both mutation gates fail too, on the
same root cause, when Stryker reaches for `parseConfigFileTextToJson`. What the
upgrade buys, measured on this repository, is a typecheck of roughly 3.3
seconds against 8.6. Five seconds a run does not pay for the lint gate and both
mutation gates, and the documented workaround, a beta TypeScript 6 installed
side by side for the tools to read, puts a prerelease compiler underneath the
checks that are supposed to catch prerelease behaviour. It moves when
typescript-eslint and Stryker support the native port.

---

## Continuous delivery

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs four jobs.

**verify** covers types, lint, format, both unit suites and both mutation gates,
with no browser and under a minute. **api** runs Task 2, installing no browsers
at all. **e2e** runs Task 1 sharded two ways, Chromium on pull requests and all
three engines on the weekly scheduled run. **report** merges the shards' blob
reports into one HTML report and one JUnit file.

`workflow_dispatch` takes a base URL for each service and a browser list, so
both suites run against any deployed environment with no code change. That is
what "tied to CD infrastructure" actually requires: a suite hardcoded to one URL
cannot gate a deployment pipeline.

---

## Use of AI assistance

**This suite was written with the support of AI assistance.** Claude, via Claude
Code, produced some of the code, configuration and documentation here
under my direction and review.

### What the automated gates caught

These are the checks that run on every commit, and each of them caught something
real while this suite was being built.

**Live verification before code.** Nothing about the application was taken from
the model's recollection. DemoQA has been rewritten since almost everything
published about it: the session moved from `localStorage` to cookies, the
ReactTable markup is gone, and the rows-per-page control no longer exists. The
real contract was recovered by inspecting the live DOM and reading the shipped
JavaScript bundle. A suite written from a model's memory of this site would not
have run at all, which is the cheap failure. The expensive one is code that
looks right, and the rest of these checks exist for that.

**Mutation testing.** It found an unreachable `?? ''` fallback that would have
silently emitted a malformed password, and a `replace(/\/+$/)` that no test
distinguished from the weaker `replace(/\/$/)`. The first was removed in favour
of a guard that throws, rather than suppressed.

**Repeated runs, not a single green one.** Two intermittent failures turned out
to be a click budget applied to a network round trip. Measuring the service, at
three to eight seconds per call, showed the timeout was measuring the wrong
thing, so the fix was a separate `E2E_API_TIMEOUT_MS`, not a larger number.

**Strict static analysis.** `tsc` with `noUncheckedIndexedAccess` forced the
`undefined` case that surfaced the dead fallback above. It also caught a config
error that would otherwise have been silent: Vite reserves `BASE_URL` and
populates it as `"/"` inside Vitest workers, so the original unprefixed
environment key was being overwritten by the tooling. Every key now carries an
`E2E_` prefix.

### What my review caught

Worth stating plainly, because it is the honest limit of the automated bar. Two of many
findings in this package came from me reading the code, and no gate here
would ever have produced them.

**A type whose name claimed something false.** `HttpClient` implemented no HTTP:
it delegated every request to Playwright's `APIRequestContext` and added a
timeout, a status check and schema validation. Challenged in review, it was
renamed `ServiceGateway`, and two pieces of documentation describing it as
"transport" were corrected with it. Every gate passed both before and after. A
name that overclaims is invisible to a compiler and expensive to a reader.

**Dead configuration nobody used.** `baseUrl` and `paths` were written into the
TypeScript config at scaffold time, mirrored into the Vitest config, and then
never used: `grep` found zero alias imports across 58 import statements. They
surfaced only when a reviewer hit a deprecation warning about `baseUrl` and
asked about it. Both were deleted rather than the warning being silenced, since
a warning about unused configuration is answered by removing the configuration.

I also corrected the AI on facts it had asserted too confidently. It claimed path
aliases would require keeping three configuration surfaces in sync; measuring it
showed two, because Playwright reads tsconfig `paths` natively. The claim was
wrong in a direction that supported the AI's recommendation, which is exactly the
kind of thing a second reader is for.

### The bar it had to meet

The same bar as hand-written code, applied by machine wherever a machine could
apply it, because inspection is what plausible-looking generated code is best at
defeating.

- Every line of production logic traces to a test that failed before it existed.
- The mutation gate passes at 100%, 155 mutants, no suppressions.
- `tsc`, ESLint and Prettier pass clean, with no `any`.
- No fixed waits anywhere, enforced by `playwright/no-wait-for-timeout` as an
  error rather than by convention.
- Every defect claim in [DEFECTS.md](DEFECTS.md) is reproduced against the live
  application.
- The suite runs green repeatedly, not once.
