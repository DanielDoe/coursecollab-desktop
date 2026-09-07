import { getPracticeHubPolicyForCourse } from "@/lib/practice-hub-policy-settings.server"

/** Load whether Practice Hub student leaderboard should hide peer names/points. Default: visible. */
export async function getPracticeHubLeaderboardBlurPeerNames(courseId: number | null): Promise<boolean> {
  const policy = await getPracticeHubPolicyForCourse(courseId)
  return policy.blur_leaderboard_peer_names
}

export async function getPracticeHubLeaderboardScholarAccess(courseId: number | null): Promise<boolean> {
  const policy = await getPracticeHubPolicyForCourse(courseId)
  return policy.scholar_leaderboard_access
}
