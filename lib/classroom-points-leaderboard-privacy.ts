import { sql } from "@/lib/db"
import { parseRewardsPolicy } from "@/lib/course-policy-settings"

/** Load whether student-facing leaderboard should hide peer names/points (FERPA default). */
export async function getClassroomLeaderboardBlurPeerNames(courseId: number | null): Promise<boolean> {
  if (courseId == null || !Number.isFinite(courseId)) return true

  const rows = await sql`
    SELECT rewards_policy
    FROM course_policies
    WHERE course_id = ${courseId}
    LIMIT 1
  `

  return parseRewardsPolicy(rows[0]?.rewards_policy).blur_leaderboard_peer_names
}
