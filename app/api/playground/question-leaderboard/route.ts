import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getPlaygroundLeaderboardBlurPeerNames } from "@/lib/playground-leaderboard-privacy"
import { playgroundScoringFromPolicy } from "@/lib/playground-policy-settings"
import { getPlaygroundPolicyForCourse } from "@/lib/playground-policy-settings.server"
import { computePlaygroundAnswerPoints } from "@/lib/playground-scoring"
import { resolvePlaygroundDisplayName } from "@/lib/playground-display-name"
import { sanitizePlaygroundEntryForStudent } from "@/lib/student-privacy"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get("sessionId")
    const questionId = searchParams.get("questionId")
    const studentId = searchParams.get("studentId")

    if (!sessionId || !questionId) {
      return NextResponse.json({ error: "Missing sessionId or questionId" }, { status: 400 })
    }

    const sessionMeta = await sql`
      SELECT course_id FROM playground_sessions WHERE id = ${Number.parseInt(sessionId, 10)} LIMIT 1
    `
    const courseId =
      sessionMeta[0]?.course_id != null ? Number(sessionMeta[0].course_id) : null
    const policy = await getPlaygroundPolicyForCourse(courseId)
    const scoring = playgroundScoringFromPolicy(policy)
    const blurPeerNames = studentId
      ? await getPlaygroundLeaderboardBlurPeerNames(courseId)
      : false

    const results = await sql`
      SELECT 
        pr.display_name,
        pr.nickname,
        pr.student_name,
        pr.student_id,
        pa.response_time_ms,
        pa.time_taken_sec,
        pa.is_correct,
        pa.answered_at
      FROM playground_answers pa
      JOIN playground_results pr ON pa.result_id = pr.id
      WHERE pr.session_id = ${Number.parseInt(sessionId)}
        AND pa.playground_question_id = ${Number.parseInt(questionId)}
      ORDER BY pa.answered_at ASC
      LIMIT 50
    `

    const leaderboard = results
      .map((entry, index) => {
        const responseMs =
          entry.response_time_ms != null
            ? Number(entry.response_time_ms)
            : Number(entry.time_taken_sec || 0) * 1000
        const points = entry.is_correct
          ? computePlaygroundAnswerPoints(true, responseMs, scoring)
          : 0
        return {
          rank: index + 1,
          displayName: resolvePlaygroundDisplayName(entry),
          nickname: entry.nickname,
          studentName: entry.student_name,
          studentId: entry.student_id,
          timeTaken: entry.time_taken_sec,
          responseTimeMs: entry.response_time_ms,
          points,
          isCorrect: entry.is_correct,
        }
      })
      .sort((a, b) => b.points - a.points || (a.responseTimeMs ?? 0) - (b.responseTimeMs ?? 0))
      .map((entry, index) => ({ ...entry, rank: index + 1 }))

    const sanitizedLeaderboard = studentId
      ? leaderboard.map((entry) =>
          sanitizePlaygroundEntryForStudent(entry, studentId, { blurPeerNames }),
        )
      : leaderboard

    return NextResponse.json({
      leaderboard: sanitizedLeaderboard,
      privacyMode: Boolean(studentId && blurPeerNames),
      leaderboardPrivacy: {
        blurPeerNames: Boolean(studentId && blurPeerNames),
      },
    })
  } catch (error) {
    console.error("Error fetching question leaderboard:", error)
    return NextResponse.json({ error: "Failed to fetch question leaderboard" }, { status: 500 })
  }
}
