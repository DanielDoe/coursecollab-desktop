import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import {
  computeDailyStreak,
  resolveFlashcardLevel,
  type FlashcardDeckMastery,
  type FlashcardGamificationProfile,
  type FlashcardLeaderboardEntry,
} from "@/lib/flashcard-gamification"
import { fetchFlashcardCourseSettings, defaultFlashcardCourseSettings } from "@/lib/flashcard-course-settings"
import { ensureFlashcardStudySchema } from "@/lib/flashcard-study-engagement"
import {
  DEFAULT_TRADE_CENTER_CONFIG,
  getWeekEndExclusiveDateString,
  getWeekStartDateString,
} from "@/lib/trade-center-shared"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    await ensureFlashcardStudySchema()

    const topic = request.nextUrl.searchParams.get("topic")?.trim() || null

    const studentRows = await sql`
      SELECT section, course_id FROM students WHERE id = ${auth.studentDbId} AND deleted_at IS NULL LIMIT 1
    `
    const section = (studentRows[0] as { section?: string } | undefined)?.section ?? null
    const courseId = (studentRows[0] as { course_id?: number } | undefined)?.course_id
    const courseSettings =
      courseId != null ? await fetchFlashcardCourseSettings(Number(courseId)) : defaultFlashcardCourseSettings()
    const dailyGoal = courseSettings.dailyGoal

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [totalRow, dailyRow, weekDates, deckRows, streakDates] = await Promise.all([
      sql`
        SELECT COUNT(DISTINCT card_id)::int AS c
        FROM flashcard_study_events
        WHERE student_id = ${auth.studentDbId}
          AND outcome = 'known'
          AND card_id IS NOT NULL
      `,
      sql`
        SELECT COUNT(*)::int AS c
        FROM flashcard_study_events
        WHERE student_id = ${auth.studentDbId}
          AND outcome = 'known'
          AND completed_at >= ${todayStart.toISOString()}::timestamptz
      `,
      sql`
        SELECT COUNT(DISTINCT card_id)::int AS c
        FROM flashcard_study_events
        WHERE student_id = ${auth.studentDbId}
          AND outcome = 'known'
          AND card_id IS NOT NULL
          AND completed_at >= date_trunc('week', NOW())
      `,
      sql`
        SELECT
          e.deck_id,
          COUNT(DISTINCT e.card_id)::int AS mastered,
          d.card_count::int AS total
        FROM flashcard_study_events e
        JOIN flashcard_decks d ON d.id = e.deck_id
        WHERE e.student_id = ${auth.studentDbId}
          AND e.outcome = 'known'
          AND e.card_id IS NOT NULL
        GROUP BY e.deck_id, d.card_count
      `,
      sql`
        SELECT DISTINCT DATE(completed_at) AS d
        FROM flashcard_study_events
        WHERE student_id = ${auth.studentDbId}
          AND outcome = 'known'
        ORDER BY d DESC
        LIMIT 90
      `,
    ])

    const totalMastered = Number(totalRow[0]?.c) || 0
    const dailyProgress = Number(dailyRow[0]?.c) || 0
    const weeklyMastered = Number(weekDates[0]?.c) || 0
    const level = resolveFlashcardLevel(totalMastered)

    const profile: FlashcardGamificationProfile = {
      totalMastered,
      level,
      dailyGoal,
      dailyProgress,
      dailyGoalMet: dailyProgress >= dailyGoal,
      dailyStreakDays: computeDailyStreak(
        (streakDates as { d: string }[]).map((r) => new Date(r.d).toISOString()),
      ),
      weeklyMastered,
    }

    const deckMastery: Record<string, FlashcardDeckMastery> = {}
    for (const row of deckRows as { deck_id: number; mastered: number; total: number }[]) {
      const total = Math.max(0, Number(row.total) || 0)
      const mastered = Math.max(0, Number(row.mastered) || 0)
      deckMastery[String(row.deck_id)] = {
        deckId: row.deck_id,
        mastered,
        total,
        pct: total > 0 ? Math.round((mastered / total) * 100) : 0,
      }
    }

    let leaderboard: FlashcardLeaderboardEntry[] = []
    if (section) {
      const weekStart = getWeekStartDateString(new Date(), DEFAULT_TRADE_CENTER_CONFIG.weekly_reset_day)
      const weekEnd = getWeekEndExclusiveDateString(weekStart)

      const lbRows = topic
        ? await sql`
            SELECT s.id AS student_id, s.full_name, COUNT(DISTINCT e.card_id)::int AS cards
            FROM students s
            JOIN flashcard_study_events e ON e.student_id = s.id
            JOIN flashcard_decks d ON d.id = e.deck_id
            WHERE s.section = ${section} AND s.deleted_at IS NULL
              AND e.outcome = 'known' AND e.card_id IS NOT NULL
              AND e.completed_at >= ${weekStart}::date AND e.completed_at < ${weekEnd}::date
              AND d.topic = ${topic}
            GROUP BY s.id, s.full_name
            ORDER BY cards DESC, s.full_name ASC LIMIT 10
          `
        : await sql`
            SELECT s.id AS student_id, s.full_name, COUNT(DISTINCT e.card_id)::int AS cards
            FROM students s
            JOIN flashcard_study_events e ON e.student_id = s.id
            WHERE s.section = ${section} AND s.deleted_at IS NULL
              AND e.outcome = 'known' AND e.card_id IS NOT NULL
              AND e.completed_at >= ${weekStart}::date AND e.completed_at < ${weekEnd}::date
            GROUP BY s.id, s.full_name
            ORDER BY cards DESC, s.full_name ASC LIMIT 10
          `

      leaderboard = (lbRows as { student_id: number; full_name: string; cards: number }[]).map(
        (row, i) => ({
          rank: i + 1,
          studentId: row.student_id,
          displayName: row.full_name?.split(" ")[0] ?? "Student",
          cardsMastered: Number(row.cards) || 0,
          isCurrentUser: row.student_id === auth.studentDbId,
        }),
      )
    }

    return NextResponse.json({ profile, deckMastery, leaderboard })
  } catch (error) {
    console.error("[student/flashcards/gamification GET]", error)
    return NextResponse.json({ error: "Failed to load gamification" }, { status: 500 })
  }
}
