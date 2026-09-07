import { getPlaygroundPolicyForCourse } from "@/lib/playground-policy-settings.server"

/** Whether student-facing playground leaderboards should hide peer identity/scores (FERPA default). */
export async function getPlaygroundLeaderboardBlurPeerNames(courseId: number | null): Promise<boolean> {
  const policy = await getPlaygroundPolicyForCourse(courseId)
  return policy.blur_leaderboard_peer_names
}
