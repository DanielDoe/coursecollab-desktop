/**
 * Course-governance × membership retake gate (no database).
 * Instructor-only courses never require a paid tier; quiz retake settings apply instead.
 */
export function retakeBlockedForMissingMembership(
  membershipPerksAllowed: boolean,
  hasMembershipOrDonationRetake: boolean,
): boolean {
  return membershipPerksAllowed && !hasMembershipOrDonationRetake
}
