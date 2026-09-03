/**
 * Comparison of an accessibility scan against the gaps already known to exist.
 *
 * The application under test is a third-party deployment with real
 * accessibility gaps, recorded in DEFECTS.md. Asserting zero violations would
 * fail on the first run and stay failing, which is a gate nobody can act on and
 * everybody learns to ignore. Asserting nothing at all would let a regression
 * through unnoticed.
 *
 * So the suite pins the measured state and reports drift in both directions.
 * A rule that starts breaking fails the build, because that is a regression
 * someone introduced. A recorded rule that stops breaking also fails the build,
 * because the register is now stale and the entry needs removing. The second
 * direction is what stops the baseline growing into a list of things nobody
 * checks, and it matches how DEFECTS.md already treats behavioural defects:
 * green while the defect stands, red the moment it is fixed.
 *
 * The comparison is on rule ids rather than on node counts. A count is the
 * sharper signal, but it moves with the page's content on a deployment nobody
 * here controls, and a gate that cries wolf is worse than a coarser one.
 */

export type ViolationDrift = {
  /** Rules broken now that the register does not record. A regression. */
  readonly unexpected: readonly string[];
  /** Rules the register records that no longer break. The register is stale. */
  readonly resolved: readonly string[];
};

export type BaselineComparison = {
  readonly measured: readonly string[];
  readonly baseline: readonly string[];
};

/** Sorted so a failure message reads the same however the scanner ordered its findings. */
const sortedDifference = (from: readonly string[], without: readonly string[]): readonly string[] =>
  [...new Set(from)].filter((id) => !without.includes(id)).sort();

/** The distinct rules a scan broke, whatever the number of elements behind each. */
export const ruleIdsOf = (violations: readonly { readonly id: string }[]): readonly string[] =>
  [...new Set(violations.map((violation) => violation.id))].sort();

export const compareToBaseline = ({ measured, baseline }: BaselineComparison): ViolationDrift => ({
  unexpected: sortedDifference(measured, baseline),
  resolved: sortedDifference(baseline, measured),
});
