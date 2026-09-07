import { sql } from "@/lib/db"

export const ROLLOVER_SOURCE_LABELS: Record<string, string> = {
  quiz: "Quiz",
  homework: "Homework",
  midterm: "Midterm",
  final: "Final",
  attendance: "Attendance",
  project: "Project",
  classroom: "Classroom",
  engagement: "Engagement",
}

export type RolloverMergedDbRow = Record<string, unknown>

export type RolloverTradeRow = {
  id: number
  studentId: number
  studentName: string
  studentNumber: string
  section: string
  membershipTier: string
  quizId: number
  quizTitle: string
  assessmentType: string
  sourceCategory: string | null
  sourceLabel: string
  pointsTraded: number
  hours: number
  appliedAt: string | null
  expiresAt: string | null
  isActive: boolean
}

export async function fetchMergedRolloverRows(courseId: number): Promise<RolloverMergedDbRow[]> {
  const tradesRows = await sql`
    SELECT 
      grt.student_id,
      grt.quiz_id,
      s.full_name,
      s.student_id as student_number,
      s.membership_tier,
      COALESCE(sess.code, s.section, grt.session) as section_code,
      COALESCE(q.title, 'Unknown') as quiz_title,
      q.assessment_type,
      grt.hours,
      grt.source_category,
      grt.points_deducted,
      grt.points_cost,
      sar.applied_at,
      sar.expires_at,
      CASE WHEN sar.expires_at > NOW() THEN true ELSE false END as is_active
    FROM grade_rollover_trades grt
    JOIN students s ON s.id = grt.student_id
    INNER JOIN sessions sess ON sess.id = s.session_id AND sess.course_id = ${courseId}
    LEFT JOIN quizzes q ON q.id = grt.quiz_id
    LEFT JOIN student_assessment_rollovers sar ON sar.student_id = grt.student_id AND sar.quiz_id = grt.quiz_id
    ORDER BY sar.applied_at DESC NULLS LAST, grt.student_id, grt.quiz_id
  `

  const instructorRows = await sql`
    SELECT 
      sar.student_id,
      sar.quiz_id,
      s.full_name,
      s.student_id as student_number,
      s.membership_tier,
      COALESCE(sess.code, s.section) as section_code,
      COALESCE(q.title, 'Unknown') as quiz_title,
      q.assessment_type,
      sar.applied_at,
      sar.expires_at,
      CASE WHEN sar.expires_at > NOW() THEN true ELSE false END as is_active
    FROM student_assessment_rollovers sar
    JOIN students s ON s.id = sar.student_id
    INNER JOIN sessions sess ON sess.id = s.session_id AND sess.course_id = ${courseId}
    LEFT JOIN quizzes q ON q.id = sar.quiz_id
    LEFT JOIN grade_rollover_trades grt ON grt.student_id = sar.student_id AND grt.quiz_id = sar.quiz_id
    WHERE grt.student_id IS NULL
    ORDER BY sar.applied_at DESC NULLS LAST, sar.student_id, sar.quiz_id
  `

  const allRows: RolloverMergedDbRow[] = [
    ...(tradesRows as RolloverMergedDbRow[]).map((r) => ({
      ...r,
      source_category: r.source_category,
      points_deducted: r.points_deducted,
      points_cost: r.points_cost,
      hours: r.hours,
    })),
    ...(instructorRows as RolloverMergedDbRow[]).map((r) => ({
      ...r,
      source_category: null,
      points_deducted: 0,
      points_cost: 0,
      hours: 24,
    })),
  ]

  allRows.sort((a, b) => {
    const da = a.applied_at ? new Date(String(a.applied_at)).getTime() : 0
    const db = b.applied_at ? new Date(String(b.applied_at)).getTime() : 0
    const sid = Number(a.student_id) - Number(b.student_id)
    const qid = Number(a.quiz_id) - Number(b.quiz_id)
    return db - da || sid || qid
  })

  return allRows
}

export function filterRolloverRows(
  rows: RolloverMergedDbRow[],
  sessionFilter: string,
  search: string,
): RolloverMergedDbRow[] {
  const hasSessionFilter = !!sessionFilter
  const q = search.trim().toLowerCase()
  const hasSearchFilter = !!q

  let filtered = rows
  if (hasSessionFilter) {
    filtered = filtered.filter((r) => String(r.section_code || "") === sessionFilter)
  }
  if (hasSearchFilter) {
    filtered = filtered.filter(
      (r) =>
        String(r.full_name || "").toLowerCase().includes(q) ||
        String(r.student_number || "").toLowerCase().includes(q) ||
        String(r.quiz_title || "").toLowerCase().includes(q),
    )
  }
  return filtered
}

export function mapRolloverRowToTrade(r: RolloverMergedDbRow, stableId: number): RolloverTradeRow {
  const cat = r.source_category ? String(r.source_category) : null
  return {
    id: stableId,
    studentId: Number(r.student_id),
    studentName: String(r.full_name ?? ""),
    studentNumber: String(r.student_number ?? ""),
    section: String(r.section_code ?? ""),
    membershipTier: String(r.membership_tier || "Scholar"),
    quizId: Number(r.quiz_id),
    quizTitle: String(r.quiz_title || "Unknown"),
    assessmentType: String(r.assessment_type || "quiz"),
    sourceCategory: cat,
    sourceLabel: cat ? ROLLOVER_SOURCE_LABELS[cat] || cat : "Instructor",
    pointsTraded: Number(r.points_deducted ?? r.points_cost ?? 0),
    hours: Number(r.hours ?? 24),
    appliedAt: r.applied_at ? String(r.applied_at) : null,
    expiresAt: r.expires_at ? String(r.expires_at) : null,
    isActive: Boolean(r.is_active),
  }
}
