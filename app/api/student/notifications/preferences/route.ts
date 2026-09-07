
import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

async function ensureNotificationPreferenceColumns() {
  await sql`
    ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS announcement_alerts BOOLEAN NOT NULL DEFAULT true
  `
}

function normalizePreferencesPayload(preferences: Record<string, unknown>) {
  return {
    quiz_reminders: preferences.quiz_reminders ?? true,
    practice_updates: preferences.practice_updates ?? true,
    ai_tutor_alerts: preferences.ai_tutor_alerts ?? true,
    codebench_results: preferences.codebench_results ?? true,
    deadline_alerts: preferences.deadline_alerts ?? true,
    group_messages: preferences.group_messages ?? true,
    project_updates: preferences.project_updates ?? true,
    homework_alerts: preferences.homework_alerts ?? true,
    exam_alerts: preferences.exam_alerts ?? true,
    lecture_updates: preferences.lecture_updates ?? true,
    announcement_alerts: preferences.announcement_alerts ?? true,
    forum_replies: preferences.forum_replies ?? true,
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const internalStudentId = auth.studentDbId

    await ensureNotificationPreferenceColumns()

    let preferences = await sql`
      SELECT * FROM notification_preferences WHERE student_id = ${internalStudentId}
    `

    if (preferences.length === 0) {
      preferences = await sql`
        INSERT INTO notification_preferences (student_id)
        VALUES (${internalStudentId})
        RETURNING *
      `
    }

    return NextResponse.json(preferences[0])
  } catch (error) {
    console.error("[v0] Failed to fetch notification preferences:", error)
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response
    const internalStudentId = auth.studentDbId
    const preferences = normalizePreferencesPayload(
      (await request.json()) as Record<string, unknown>,
    )

    await ensureNotificationPreferenceColumns()

    const updated = await sql`
      INSERT INTO notification_preferences (
        student_id,
        quiz_reminders,
        practice_updates,
        ai_tutor_alerts,
        codebench_results,
        deadline_alerts,
        group_messages,
        project_updates,
        homework_alerts,
        exam_alerts,
        lecture_updates,
        announcement_alerts,
        forum_replies,
        updated_at
      )
      VALUES (
        ${internalStudentId},
        ${preferences.quiz_reminders},
        ${preferences.practice_updates},
        ${preferences.ai_tutor_alerts},
        ${preferences.codebench_results},
        ${preferences.deadline_alerts},
        ${preferences.group_messages},
        ${preferences.project_updates},
        ${preferences.homework_alerts},
        ${preferences.exam_alerts},
        ${preferences.lecture_updates},
        ${preferences.announcement_alerts},
        ${preferences.forum_replies},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (student_id) DO UPDATE SET
        quiz_reminders = EXCLUDED.quiz_reminders,
        practice_updates = EXCLUDED.practice_updates,
        ai_tutor_alerts = EXCLUDED.ai_tutor_alerts,
        codebench_results = EXCLUDED.codebench_results,
        deadline_alerts = EXCLUDED.deadline_alerts,
        group_messages = EXCLUDED.group_messages,
        project_updates = EXCLUDED.project_updates,
        homework_alerts = EXCLUDED.homework_alerts,
        exam_alerts = EXCLUDED.exam_alerts,
        lecture_updates = EXCLUDED.lecture_updates,
        announcement_alerts = EXCLUDED.announcement_alerts,
        forum_replies = EXCLUDED.forum_replies,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `

    return NextResponse.json(updated[0])
  } catch (error) {
    console.error("[v0] Failed to update notification preferences:", error)
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 })
  }
}
