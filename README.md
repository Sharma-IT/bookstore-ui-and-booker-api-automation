# QA automation: Book Store UI and Restful Booker API

Two test suites in one npm workspaces monorepo.

| Package                                    | Task                                              | Scenarios           |
| ------------------------------------------ | ------------------------------------------------- | ------------------- |
| [`packages/ui-tests`](packages/ui-tests)   | **Task 1** — DemoQA Book Store UI, Playwright     | 35 browser, 72 unit |
| [`packages/api-tests`](packages/api-tests) | **Task 2** — Restful Booker API, pactum on Vitest | 72 API, 49 unit     |

**228 tests. 282 mutants, 281 killed. 15 defects found across the two services**,
each pinned by a test that will fail the build when the service is fixed.

Each package has its own README covering its design, scope and trade-offs, and
its own defect register:

- Task 1: [README](packages/ui-tests/README.md) · [defects](packages/ui-tests/DEFECTS.md)
- Task 2: [README](packages/api-tests/README.md) · [defects](packages/api-tests/API-DEFECTS.md) · [Part B, AI-generated endpoint](packages/api-tests/ai-assisted/)

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

**Thresholds are never relaxed to get green.** When a guard trips, the first
question is whether the regression is real or the measurement is wrong. Two
timeout failures in Task 1 turned out to be a click budget applied to a network
round trip; the fix was a separate, correctly named budget, not a bigger number.

---

## Continuous delivery

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs four jobs.

**verify** covers types, lint, format, both unit suites and both mutation gates,
with no browser and under a minute. **api** runs Task 2, installing no browsers
at all. **e2e** runs Task 1 sharded two ways, Chromium on pull requests and all
three engines nightly. **report** merges the shards' blob reports into one HTML
report and one JUnit file.

`workflow_dispatch` takes a base URL for each service and a browser list, so
both suites run against any deployed environment with no code change. That is
what "tied to CD infrastructure" actually requires: a suite hardcoded to one URL
cannot gate a deployment pipeline.
