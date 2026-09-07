import { type NextRequest } from "next/server"
import { withCamperAuth } from "@/lib/summer-camp/camper-api-handler"
import { hubLeaderboard } from "@/lib/summer-camp/camper-hub"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  return withCamperAuth(
    request,
    async (studentDbId) => {
      const board = await hubLeaderboard(studentDbId)
      return {
        total_xp: board.total_xp,
        modules_completed: board.current_user?.modules_completed ?? 0,
        rank: board.current_user?.rank ?? null,
        cohort_size: board.leaderboard.length,
      }
    },
    "camper-xp",
  )
}
