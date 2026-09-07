/**
 * Merge two `students` rows (same human): keep `keeperId`, reassign all FKs from `dropId`, delete drop.
 * Use when duplicate rows exist (e.g. old row used SIS User ID as `student_id`, new row has Canvas ID).
 */
import { sql } from "@/lib/db"

type FkRef = { tbl: string; col: string }

function quoteIdent(ident: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ident)) {
    throw new Error(`Refusing unsafe identifier: ${ident}`)
  }
  return `"${ident}"`
}

async function loadFkRefs(): Promise<FkRef[]> {
  return (await sql`
    SELECT c.conrelid::regclass::text AS tbl,
           a.attname::text AS col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.confrelid = 'public.students'::regclass
      AND c.contype = 'f'
    ORDER BY 1, 2
  `) as FkRef[]
}

async function mergeStudentGradesSameSession(keeperId: number, dropId: number): Promise<void> {
  const conflicts = (await sql`
    SELECT gk.id AS keep_gid, gd.id AS drop_gid, gk.session::text AS session
    FROM student_grades gk
    JOIN student_grades gd ON gk.session = gd.session
      AND gk.student_id = ${keeperId}
      AND gd.student_id = ${dropId}
  `) as { keep_gid: number; drop_gid: number; session: string }[]

  for (const c of conflicts) {
    await sql`${sql.unsafe(`
UPDATE student_grades gk SET
  quiz_score = COALESCE(gk.quiz_score, gd.quiz_score),
  homework_score = COALESCE(gk.homework_score, gd.homework_score),
  midterm_score = COALESCE(gk.midterm_score, gd.midterm_score),
  final_score = COALESCE(gk.final_score, gd.final_score),
  attendance_score = COALESCE(gk.attendance_score, gd.attendance_score),
  project_score = COALESCE(gk.project_score, gd.project_score),
  classroom_score = COALESCE(gk.classroom_score, gd.classroom_score),
  engagement_credits = COALESCE(gk.engagement_credits, gd.engagement_credits),
  quiz_contribution = COALESCE(gk.quiz_contribution, gd.quiz_contribution),
  homework_contribution = COALESCE(gk.homework_contribution, gd.homework_contribution),
  midterm_contribution = COALESCE(gk.midterm_contribution, gd.midterm_contribution),
  final_contribution = COALESCE(gk.final_contribution, gd.final_contribution),
  attendance_contribution = COALESCE(gk.attendance_contribution, gd.attendance_contribution),
  project_contribution = COALESCE(gk.project_contribution, gd.project_contribution),
  classroom_contribution = COALESCE(gk.classroom_contribution, gd.classroom_contribution),
  engagement_contribution = COALESCE(gk.engagement_contribution, gd.engagement_contribution),
  total_score = COALESCE(gk.total_score, gd.total_score),
  letter_grade = COALESCE(gk.letter_grade, gd.letter_grade),
  notes = COALESCE(gk.notes, gd.notes),
  is_locked = gk.is_locked OR COALESCE(gd.is_locked, false),
  last_calculated_at = COALESCE(gk.last_calculated_at, gd.last_calculated_at),
  updated_at = CURRENT_TIMESTAMP
FROM student_grades gd
WHERE gk.id = ${c.keep_gid} AND gd.id = ${c.drop_gid}`)}`
    await sql`${sql.unsafe(`DELETE FROM student_grades WHERE id = ${c.drop_gid}`)}`
  }
}

async function deleteConflictingRowsOnDrop(keeperId: number, dropId: number): Promise<void> {
  const stmts: string[] = [
    `DELETE FROM engagement_credits dup USING engagement_credits keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.session = keep.session`,
    `DELETE FROM student_activity_points dup USING student_activity_points keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId}
         AND dup.session = keep.session AND dup.week_start_date IS NOT DISTINCT FROM keep.week_start_date`,
    `DELETE FROM attempt_overrides dup USING attempt_overrides keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.quiz_id = keep.quiz_id`,
    `DELETE FROM announcement_views dup USING announcement_views keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.announcement_id = keep.announcement_id`,
    `DELETE FROM announcement_reactions dup USING announcement_reactions keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.announcement_id = keep.announcement_id`,
    `DELETE FROM attendance_records dup USING attendance_records keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.session_id IS NOT DISTINCT FROM keep.session_id`,
    `DELETE FROM ai_tutor_topic_mastery dup USING ai_tutor_topic_mastery keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.topic = keep.topic`,
    `DELETE FROM daily_challenge_assignments dup USING daily_challenge_assignments keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId}
         AND dup.assigned_date IS NOT DISTINCT FROM keep.assigned_date`,
    `DELETE FROM lecture_bookmarks dup USING lecture_bookmarks keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.lecture_id = keep.lecture_id`,
    `DELETE FROM lecture_reminders dup USING lecture_reminders keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.lecture_id = keep.lecture_id`,
    `DELETE FROM lecture_student_progress dup USING lecture_student_progress keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.lecture_id = keep.lecture_id`,
    `DELETE FROM practice_daily_usage dup USING practice_daily_usage keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId}
         AND dup.practice_date IS NOT DISTINCT FROM keep.practice_date`,
    `DELETE FROM practice_submissions dup USING practice_submissions keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId}
         AND dup.problem = keep.problem AND dup.submitted_at IS NOT DISTINCT FROM keep.submitted_at`,
    `DELETE FROM slide_views dup USING slide_views keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.slide_id = keep.slide_id`,
    `DELETE FROM student_achievements dup USING student_achievements keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.badge_type = keep.badge_type`,
    `DELETE FROM student_assessment_rollovers dup USING student_assessment_rollovers keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.quiz_id = keep.quiz_id`,
    `DELETE FROM student_module_preferences dup USING student_module_preferences keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.module_name = keep.module_name`,
    `DELETE FROM student_topic_progress dup USING student_topic_progress keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.topic = keep.topic`,
    `DELETE FROM codebench_submissions dup USING codebench_submissions keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.assignment_id = keep.assignment_id`,
    `DELETE FROM feature_request_votes dup USING feature_request_votes keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.request_id = keep.request_id`,
    `DELETE FROM forum_votes dup USING forum_votes keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId}
         AND dup.thread_id = keep.thread_id AND dup.reply_id IS NOT DISTINCT FROM keep.reply_id`,
    `DELETE FROM group_members dup USING group_members keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId} AND dup.group_id = keep.group_id`,
    `DELETE FROM missed_deadline_reminders_sent dup USING missed_deadline_reminders_sent keep
       WHERE dup.student_id = ${dropId} AND keep.student_id = ${keeperId}
         AND dup.assessment_id = keep.assessment_id AND dup.assessment_type = keep.assessment_type`,
  ]

  const singleStudentIdTables = [
    "ai_tutor_credits",
    "attendance_streaks",
    "memberships",
    "notification_preferences",
    "playground_credits",
    "practice_leaderboard",
    "student_learning_profile",
    "student_reputation",
  ]

  for (const stmt of stmts) {
    try {
      await sql`${sql.unsafe(stmt)}`
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("does not exist") || msg.includes("Undefined table")) continue
      throw e
    }
  }

  for (const tbl of singleStudentIdTables) {
    const stmt = `DELETE FROM ${quoteIdent(tbl)} WHERE student_id = ${dropId}
      AND EXISTS (SELECT 1 FROM ${quoteIdent(tbl)} k WHERE k.student_id = ${keeperId})`
    try {
      await sql`${sql.unsafe(stmt)}`
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("does not exist") || msg.includes("Undefined table")) continue
      throw e
    }
  }
}

async function reassignAllFks(refs: FkRef[], fromId: number, toId: number): Promise<void> {
  for (const { tbl, col } of refs) {
    if (tbl === "students") continue
    const t = quoteIdent(tbl)
    const c = quoteIdent(col)
    await sql`${sql.unsafe(`UPDATE ${t} SET ${c} = ${toId} WHERE ${c} = ${fromId}`)}`
  }
}

async function attemptCount(studentPk: number): Promise<number> {
  const r = (await sql`
    SELECT COUNT(*)::int AS c FROM quiz_attempts WHERE student_id = ${studentPk}
  `) as { c: number }[]
  return r[0]?.c ?? 0
}

/**
 * @param keeperId Row to keep (should have correct Canvas `student_id` / `sis_login_id`).
 * @param dropId Row to remove (e.g. mistaken `student_id` = SIS User ID only).
 */
export async function mergeStudentRecordsByInternalId(keeperId: number, dropId: number): Promise<void> {
  if (keeperId === dropId) return

  const dropAttempts = await attemptCount(dropId)
  const keeperAttempts = await attemptCount(keeperId)

  if (dropAttempts > 0 && keeperAttempts > 0) {
    throw new Error(
      `Both students have quiz attempts (keeper ${keeperId}: ${keeperAttempts}, drop ${dropId}: ${dropAttempts}); merge manually`,
    )
  }

  await mergeStudentGradesSameSession(keeperId, dropId)

  if (dropAttempts > 0) {
    const rows = (await sql`
      SELECT password_hash, has_changed_password, email, trial_start_date
      FROM students WHERE id = ${dropId} LIMIT 1
    `) as {
      password_hash: string
      has_changed_password: boolean
      email: string | null
      trial_start_date: Date | null
    }[]
    const d = rows[0]
    if (d) {
      const dropEmail = d.email?.trim() || null
      await sql`
        UPDATE students SET
          password_hash = ${d.password_hash},
          has_changed_password = ${d.has_changed_password},
          email = COALESCE(NULLIF(TRIM(COALESCE(email, '')), ''), ${dropEmail}),
          trial_start_date = COALESCE(trial_start_date, ${d.trial_start_date})
        WHERE id = ${keeperId}
      `
    }
  }

  const fkRefs = await loadFkRefs()
  await deleteConflictingRowsOnDrop(keeperId, dropId)
  await reassignAllFks(fkRefs, dropId, keeperId)
  await sql`DELETE FROM students WHERE id = ${dropId}`
}
