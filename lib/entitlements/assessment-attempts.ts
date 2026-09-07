/**
 * Graded assessment attempts vs practice / playground.
 * Commercial membership and institutional access never override instructor_only policy.
 */

export type AttemptLane =
  | "graded_assessment"
  | "practice"
  | "mock_assessment"
  | "cora_practice"
  | "playground"

export function isGradedAssessmentLane(lane: AttemptLane): boolean {
  return lane === "graded_assessment"
}

export function membershipMayEnhanceAttempts(
  lane: AttemptLane,
  courseAllowsMembershipPerks: boolean,
): boolean {
  if (lane === "practice" || lane === "mock_assessment" || lane === "cora_practice" || lane === "playground") {
    return true
  }
  return courseAllowsMembershipPerks
}
