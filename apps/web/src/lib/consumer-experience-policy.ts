/**
 * Consumer experience eligibility (Stage 05, contracts.md §1).
 *
 * Pure predicate over the `decision_first_experience` flag row. Missing row,
 * query error, malformed cohorts or no session all resolve to disabled.
 */

export interface ConsumerExperienceFlag {
  enabled: boolean;
  cohorts: unknown;
}

export function isConsumerEligible(
  flag: ConsumerExperienceFlag | null | undefined,
  userId: string | null | undefined
): boolean {
  if (!userId) return false;
  if (!flag) return false;
  if (flag.enabled === true) return true;
  return Array.isArray(flag.cohorts) && flag.cohorts.includes(userId);
}
