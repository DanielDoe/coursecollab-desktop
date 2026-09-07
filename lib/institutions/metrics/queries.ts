import { sql } from "@/lib/db"
import { WORKFLOW_MINUTES_SAVED } from "@/lib/institutions/metrics/constants"
import { formatWeekLabel, parsePgDateOnly } from "@/lib/institutions/metrics/scope"
import type { InstitutionScope } from "@/lib/institutions/metrics/types"

export function workflowMinutesSaved(workflowType: string | null | undefined): number {
  const key = String(workflowType ?? "")
    .trim()
    .toLowerCase()
  for (const [pattern, minutes] of Object.entries(WORKFLOW_MINUTES_SAVED)) {
    if (pattern !== "default" && key.includes(pattern)) return minutes
  }
  return WORKFLOW_MINUTES_SAVED.default
}

export async function countActiveStudentsInPeriod(scope: InstitutionScope): Promise<number> {
  if (scope.courseIds.length === 0) return 0
  const rows = await sql`
    WITH covered AS (
      SELECT st.id, LOWER(TRIM(COALESCE(st.email, ''))) AS email_key
      FROM students st
      WHERE st.course_id = ANY(${scope.courseIds})
        AND st.deleted_at IS NULL
        AND NOT (
          LOWER(TRIM(COALESCE(st.email, ''))) LIKE 'demo-%'
          OR LOWER(TRIM(COALESCE(st.email, ''))) LIKE '%+demo@%'
          OR LOWER(TRIM(COALESCE(st.email, ''))) LIKE '%@coursecollab.test'
        )
    ),
    active AS (
      SELECT c.id FROM covered c
      JOIN quiz_attempts qa ON qa.student_id = c.id
      WHERE qa.deleted_at IS NULL
        AND COALESCE(qa.started_at, qa.completed_at)::date >= ${scope.from}::date
        AND COALESCE(qa.started_at, qa.completed_at)::date <= ${scope.to}::date
      UNION
      SELECT c.id FROM covered c
      JOIN practice_attempts pa ON pa.student_id = c.id
      WHERE COALESCE(pa.started_at, pa.completed_at)::date >= ${scope.from}::date
        AND COALESCE(pa.started_at, pa.completed_at)::date <= ${scope.to}::date
      UNION
      SELECT c.id FROM covered c
      JOIN institution_cora_usage u ON u.user_type = 'student' AND u.user_id = c.id
      WHERE u.institution_id = ${scope.institutionId}
        AND u.created_at::date >= ${scope.from}::date
        AND u.created_at::date <= ${scope.to}::date
      UNION
      SELECT c.id FROM covered c
      JOIN codebench_submissions cs ON cs.student_id = c.id
      WHERE cs.submitted_at::date >= ${scope.from}::date
        AND cs.submitted_at::date <= ${scope.to}::date
    )
    SELECT COUNT(*)::int AS n
    FROM (
      SELECT DISTINCT COALESCE(NULLIF(c.email_key, ''), 'student:' || c.id::text) AS identity
      FROM covered c JOIN active a ON a.id = c.id
    ) uniq
  `
  return Number(rows[0]?.n ?? 0)
}

export async function countActiveInstructorsInPeriod(scope: InstitutionScope): Promise<number> {
  if (scope.courseIds.length === 0) return 0
  const rows = await sql`
    WITH faculty AS (
      SELECT DISTINCT i.id
      FROM instructors i
      LEFT JOIN courses c ON c.instructor_id = i.id AND c.id = ANY(${scope.courseIds})
      LEFT JOIN course_staff cs ON cs.instructor_id = i.id AND cs.course_id = ANY(${scope.courseIds}) AND cs.is_active = true
      WHERE c.id IS NOT NULL OR cs.instructor_id IS NOT NULL
    ),
    active AS (
      SELECT f.id FROM faculty f
      JOIN institution_cora_usage u ON u.user_type = 'instructor' AND u.user_id = f.id
      WHERE u.institution_id = ${scope.institutionId}
        AND u.created_at::date >= ${scope.from}::date
        AND u.created_at::date <= ${scope.to}::date
      UNION
      SELECT DISTINCT c.instructor_id FROM courses c
      JOIN quiz_attempts qa ON qa.quiz_id IN (SELECT q.id FROM quizzes q WHERE q.course_id = c.id)
      JOIN quiz_answers qans ON qans.attempt_id = qa.id
      WHERE c.id = ANY(${scope.courseIds})
        AND qans.reviewed_at::date >= ${scope.from}::date
        AND qans.reviewed_at::date <= ${scope.to}::date
    )
    SELECT COUNT(DISTINCT id)::int AS n FROM active WHERE id IS NOT NULL
  `
  return Number(rows[0]?.n ?? 0)
}

export async function countInstructorsUsingCora(scope: InstitutionScope): Promise<number> {
  if (scope.courseIds.length === 0) return 0
  const rows = await sql`
    SELECT COUNT(DISTINCT user_id)::int AS n
    FROM institution_cora_usage
    WHERE institution_id = ${scope.institutionId}
      AND user_type = 'instructor'
      AND created_at::date >= ${scope.from}::date
      AND created_at::date <= ${scope.to}::date
  `
  return Number(rows[0]?.n ?? 0)
}

export async function countActiveCourses(scope: InstitutionScope): Promise<number> {
  if (scope.courseIds.length === 0) return 0
  const rows = await sql`
    SELECT COUNT(DISTINCT c.id)::int AS n
    FROM courses c
    WHERE c.id = ANY(${scope.courseIds})
      AND (
        EXISTS (
          SELECT 1 FROM quiz_attempts qa
          JOIN quizzes q ON q.id = qa.quiz_id
          WHERE q.course_id = c.id AND qa.deleted_at IS NULL
            AND COALESCE(qa.started_at, qa.completed_at)::date >= ${scope.from}::date
            AND COALESCE(qa.started_at, qa.completed_at)::date <= ${scope.to}::date
        )
        OR EXISTS (
          SELECT 1 FROM practice_attempts pa
          JOIN students st ON st.id = pa.student_id
          WHERE st.course_id = c.id
            AND COALESCE(pa.started_at, pa.completed_at)::date >= ${scope.from}::date
            AND COALESCE(pa.started_at, pa.completed_at)::date <= ${scope.to}::date
        )
        OR EXISTS (
          SELECT 1 FROM institution_cora_usage u
          WHERE u.course_id = c.id AND u.institution_id = ${scope.institutionId}
            AND u.created_at::date >= ${scope.from}::date
            AND u.created_at::date <= ${scope.to}::date
        )
      )
  `
  return Number(rows[0]?.n ?? 0)
}

export async function countActiveSections(scope: InstitutionScope): Promise<number> {
  if (scope.courseIds.length === 0) return 0
  const rows = await sql`
    SELECT COUNT(DISTINCT st.session_id)::int AS n
    FROM students st
    WHERE st.course_id = ANY(${scope.courseIds})
      AND st.session_id IS NOT NULL
      AND st.deleted_at IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM quiz_attempts qa
          WHERE qa.student_id = st.id AND qa.deleted_at IS NULL
            AND COALESCE(qa.started_at, qa.completed_at)::date >= ${scope.from}::date
            AND COALESCE(qa.started_at, qa.completed_at)::date <= ${scope.to}::date
        )
        OR EXISTS (
          SELECT 1 FROM practice_attempts pa
          WHERE pa.student_id = st.id
            AND COALESCE(pa.started_at, pa.completed_at)::date >= ${scope.from}::date
            AND COALESCE(pa.started_at, pa.completed_at)::date <= ${scope.to}::date
        )
      )
  `
  return Number(rows[0]?.n ?? 0)
}

export async function getGradingAutomationMetrics(scope: InstitutionScope) {
  if (scope.courseIds.length === 0) {
    return {
      eligible: 0,
      autoGraded: 0,
      instructorReviewed: 0,
      overrides: 0,
      medianLatencySec: null as number | null,
    }
  }
  const rows = await sql`
    SELECT
      COUNT(*)::int AS eligible,
      COUNT(*) FILTER (
        WHERE qans.ai_feedback IS NOT NULL
          AND (qans.ai_feedback->>'aiGraded')::boolean IS TRUE
      )::int AS auto_graded,
      COUNT(*) FILTER (WHERE qans.requires_review IS TRUE)::int AS instructor_reviewed,
      COUNT(*) FILTER (
        WHERE qans.override_points IS NOT NULL
          OR (qans.ai_feedback IS NOT NULL AND (qans.ai_feedback->>'instructorAdjusted')::boolean IS TRUE)
      )::int AS overrides,
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (qans.reviewed_at - qans.answered_at))
      ) FILTER (
        WHERE qans.reviewed_at IS NOT NULL AND qans.answered_at IS NOT NULL
          AND qans.reviewed_at > qans.answered_at
      ) AS median_latency_sec
    FROM quiz_answers qans
    JOIN quiz_attempts qa ON qa.id = qans.attempt_id
    JOIN quizzes q ON q.id = qa.quiz_id
    WHERE q.course_id = ANY(${scope.courseIds})
      AND qa.deleted_at IS NULL
      AND qans.points_earned IS NOT NULL
      AND COALESCE(qans.reviewed_at, qans.answered_at, qa.completed_at)::date >= ${scope.from}::date
      AND COALESCE(qans.reviewed_at, qans.answered_at, qa.completed_at)::date <= ${scope.to}::date
  `
  const row = rows[0]
  return {
    eligible: Number(row?.eligible ?? 0),
    autoGraded: Number(row?.auto_graded ?? 0),
    instructorReviewed: Number(row?.instructor_reviewed ?? 0),
    overrides: Number(row?.overrides ?? 0),
    medianLatencySec: row?.median_latency_sec != null ? Math.round(Number(row.median_latency_sec)) : null,
  }
}

export async function estimateHoursSaved(scope: InstitutionScope): Promise<{ totalHours: number; byCategory: Array<{ key: string; name: string; value: number }> }> {
  const grading = await getGradingAutomationMetrics(scope)
  const gradingMinutes = grading.autoGraded * WORKFLOW_MINUTES_SAVED.grading

  const workflowRows = await sql`
    SELECT COALESCE(NULLIF(TRIM(workflow_type), ''), 'other') AS key, COUNT(*)::int AS n
    FROM institution_cora_usage
    WHERE institution_id = ${scope.institutionId}
      AND created_at::date >= ${scope.from}::date
      AND created_at::date <= ${scope.to}::date
    GROUP BY 1
  `

  const categoryMap = new Map<string, number>()
  for (const row of workflowRows) {
    const key = String(row.key)
    const minutes = Number(row.n) * workflowMinutesSaved(key)
    let cat = "course_administration"
    if (key.includes("grad")) cat = "grading"
    else if (key.includes("quiz") || key.includes("homework") || key.includes("assessment")) cat = "assessment_creation"
    else if (key.includes("report")) cat = "progress_reporting"
    else if (key.includes("announce")) cat = "communications"
    else if (key.includes("analysis") || key.includes("tutor") || key.includes("chat")) cat = "student_analysis"
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + minutes)
  }
  categoryMap.set("grading", (categoryMap.get("grading") ?? 0) + gradingMinutes)

  const labels: Record<string, string> = {
    grading: "Grading",
    assessment_creation: "Assessment creation",
    progress_reporting: "Progress reporting",
    student_analysis: "Student analysis",
    communications: "Communications",
    course_administration: "Course administration",
  }

  const byCategory = [...categoryMap.entries()]
    .map(([key, minutes]) => ({
      key,
      name: labels[key] ?? key,
      value: Math.round((minutes / 60) * 10) / 10,
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)

  const totalHours = Math.round(byCategory.reduce((s, r) => s + r.value, 0))
  return { totalHours, byCategory }
}

export async function getWeeklyStudentEngagement(scope: InstitutionScope) {
  if (scope.courseIds.length === 0) return []
  const rows = await sql`
    SELECT
      gs::date AS week,
      COALESCE(active.n, 0)::int AS active_users
    FROM generate_series(
      date_trunc('week', ${scope.from}::date),
      date_trunc('week', ${scope.to}::date),
      INTERVAL '1 week'
    ) AS gs
    LEFT JOIN (
      SELECT date_trunc('week', d)::date AS week, COUNT(DISTINCT identity)::int AS n
      FROM (
        SELECT COALESCE(qa.started_at, qa.completed_at)::date AS d,
          COALESCE(NULLIF(LOWER(TRIM(COALESCE(st.email, ''))), ''), 'student:' || st.id::text) AS identity
        FROM quiz_attempts qa
        JOIN students st ON st.id = qa.student_id
        WHERE st.course_id = ANY(${scope.courseIds}) AND qa.deleted_at IS NULL
          AND COALESCE(qa.started_at, qa.completed_at)::date >= ${scope.from}::date
          AND COALESCE(qa.started_at, qa.completed_at)::date <= ${scope.to}::date
        UNION ALL
        SELECT COALESCE(pa.started_at, pa.completed_at)::date AS d,
          COALESCE(NULLIF(LOWER(TRIM(COALESCE(st.email, ''))), ''), 'student:' || st.id::text) AS identity
        FROM practice_attempts pa
        JOIN students st ON st.id = pa.student_id
        WHERE st.course_id = ANY(${scope.courseIds})
          AND COALESCE(pa.started_at, pa.completed_at)::date >= ${scope.from}::date
          AND COALESCE(pa.started_at, pa.completed_at)::date <= ${scope.to}::date
      ) u
      GROUP BY 1
    ) active ON active.week = gs::date
    ORDER BY 1
  `
  return rows.map((row) => {
    const week = parsePgDateOnly(row.week)
    return {
      week,
      label: formatWeekLabel(week),
      credits: 0,
      workflows: 0,
      activeUsers: Number(row.active_users ?? 0),
    }
  })
}

export async function getWeeklyAcademicActivity(scope: InstitutionScope) {
  if (scope.courseIds.length === 0) return []
  const rows = await sql`
    SELECT
      gs::date AS week,
      COALESCE(a.assessments, 0)::int AS assessments,
      COALESCE(a.practice, 0)::int AS practice,
      COALESCE(a.coding, 0)::int AS coding,
      COALESCE(a.cora_learning, 0)::int AS cora_learning
    FROM generate_series(
      date_trunc('week', ${scope.from}::date),
      date_trunc('week', ${scope.to}::date),
      INTERVAL '1 week'
    ) AS gs
    LEFT JOIN (
      SELECT week, SUM(assessments)::int AS assessments, SUM(practice)::int AS practice,
        SUM(coding)::int AS coding, SUM(cora_learning)::int AS cora_learning
      FROM (
        SELECT date_trunc('week', COALESCE(qa.completed_at, qa.started_at))::date AS week,
          COUNT(*)::int AS assessments, 0 AS practice, 0 AS coding, 0 AS cora_learning
        FROM quiz_attempts qa
        JOIN quizzes q ON q.id = qa.quiz_id
        WHERE q.course_id = ANY(${scope.courseIds}) AND qa.deleted_at IS NULL
          AND COALESCE(qa.completed_at, qa.started_at)::date >= ${scope.from}::date
          AND COALESCE(qa.completed_at, qa.started_at)::date <= ${scope.to}::date
        GROUP BY 1
        UNION ALL
        SELECT date_trunc('week', COALESCE(pa.completed_at, pa.started_at))::date,
          0, COUNT(*)::int, 0, 0
        FROM practice_attempts pa
        JOIN students st ON st.id = pa.student_id
        WHERE st.course_id = ANY(${scope.courseIds})
          AND COALESCE(pa.completed_at, pa.started_at)::date >= ${scope.from}::date
          AND COALESCE(pa.completed_at, pa.started_at)::date <= ${scope.to}::date
        GROUP BY 1
        UNION ALL
        SELECT date_trunc('week', cs.submitted_at)::date, 0, 0, COUNT(*)::int, 0
        FROM codebench_submissions cs
        JOIN students st ON st.id = cs.student_id
        WHERE st.course_id = ANY(${scope.courseIds})
          AND cs.submitted_at::date >= ${scope.from}::date AND cs.submitted_at::date <= ${scope.to}::date
        GROUP BY 1
        UNION ALL
        SELECT date_trunc('week', u.created_at)::date, 0, 0, 0, COUNT(*)::int
        FROM institution_cora_usage u
        WHERE u.institution_id = ${scope.institutionId}
          AND u.user_type = 'student'
          AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
        GROUP BY 1
      ) x GROUP BY week
    ) a ON a.week = gs::date
    ORDER BY 1
  `
  return rows.map((row) => {
    const week = parsePgDateOnly(row.week)
    return {
      week,
      label: formatWeekLabel(week),
      credits: 0,
      workflows: 0,
      activeUsers: 0,
      assessments: Number(row.assessments ?? 0),
      practice: Number(row.practice ?? 0),
      coding: Number(row.coding ?? 0),
      coraLearning: Number(row.cora_learning ?? 0),
    }
  })
}

export async function getLearningSnapshot(scope: InstitutionScope) {
  if (scope.courseIds.length === 0) {
    return { practiceAccuracy: null, improvingRate: null, sampleSize: 0 }
  }
  const rows = await sql`
    WITH attempts AS (
      SELECT pa.student_id, pa.score_percentage::float AS score, pa.completed_at
      FROM practice_attempts pa
      JOIN students st ON st.id = pa.student_id
      WHERE st.course_id = ANY(${scope.courseIds})
        AND pa.completed_at IS NOT NULL
        AND pa.completed_at::date >= ${scope.from}::date
        AND pa.completed_at::date <= ${scope.to}::date
    ),
    student_trend AS (
      SELECT student_id,
        AVG(score) FILTER (WHERE completed_at >= (${scope.from}::date + (${scope.to}::date - ${scope.from}::date) / 2)) AS recent,
        AVG(score) FILTER (WHERE completed_at < (${scope.from}::date + (${scope.to}::date - ${scope.from}::date) / 2)) AS prior
      FROM attempts
      GROUP BY student_id
      HAVING COUNT(*) >= 2
    )
    SELECT
      AVG(a.score)::float AS avg_accuracy,
      COUNT(DISTINCT a.student_id)::int AS sample_size,
      COUNT(*) FILTER (WHERE t.recent > t.prior + 2)::float / NULLIF(COUNT(t.student_id), 0) * 100 AS improving_rate
    FROM attempts a
    LEFT JOIN student_trend t ON t.student_id = a.student_id
  `
  const row = rows[0]
  return {
    practiceAccuracy: row?.avg_accuracy != null ? Math.round(Number(row.avg_accuracy) * 10) / 10 : null,
    improvingRate: row?.improving_rate != null ? Math.round(Number(row.improving_rate) * 10) / 10 : null,
    sampleSize: Number(row?.sample_size ?? 0),
  }
}

export async function getStudentsNeedingAttention(scope: InstitutionScope, limit = 8) {
  if (scope.courseIds.length === 0) return []
  const rows = await sql`
    WITH covered AS (
      SELECT st.id, st.full_name, st.course_id, c.course_code, c.course_title,
        activity.last_active,
        (
          SELECT AVG(qa.score::float) FROM quiz_attempts qa
          JOIN quizzes q ON q.id = qa.quiz_id
          WHERE qa.student_id = st.id AND qa.completed_at IS NOT NULL AND qa.deleted_at IS NULL
            AND qa.completed_at >= NOW() - INTERVAL '30 days'
        ) AS recent_score,
        (
          SELECT AVG(qa.score::float) FROM quiz_attempts qa
          JOIN quizzes q ON q.id = qa.quiz_id
          WHERE qa.student_id = st.id AND qa.completed_at IS NOT NULL AND qa.deleted_at IS NULL
            AND qa.completed_at >= NOW() - INTERVAL '60 days'
            AND qa.completed_at < NOW() - INTERVAL '30 days'
        ) AS prior_score,
        (
          SELECT COUNT(*)::int FROM quiz_attempts qa
          JOIN quizzes q ON q.id = qa.quiz_id
          WHERE qa.student_id = st.id AND qa.deleted_at IS NULL AND qa.completed_at IS NULL
            AND q.available_until IS NOT NULL AND q.available_until < NOW()
        ) AS missing_assessments
      FROM students st
      JOIN courses c ON c.id = st.course_id
      LEFT JOIN LATERAL (
        SELECT MAX(ts) AS last_active
        FROM (
          SELECT COALESCE(qa.started_at, qa.completed_at) AS ts
          FROM quiz_attempts qa
          WHERE qa.student_id = st.id AND qa.deleted_at IS NULL
          UNION ALL
          SELECT pa.completed_at AS ts
          FROM practice_attempts pa
          WHERE pa.student_id = st.id AND pa.completed_at IS NOT NULL
        ) events
      ) activity ON TRUE
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
    )
    SELECT *, CASE
      WHEN last_active IS NULL OR last_active < NOW() - INTERVAL '14 days' THEN 'inactive'
      WHEN missing_assessments >= 2 THEN 'multiple_missing_assessments'
      WHEN recent_score IS NOT NULL AND prior_score IS NOT NULL AND recent_score < prior_score - 8 THEN 'declining_performance'
      WHEN recent_score IS NOT NULL AND recent_score < 55 THEN 'low_assessment_performance'
      ELSE NULL
    END AS reason
    FROM covered
    WHERE (
      last_active IS NULL OR last_active < NOW() - INTERVAL '14 days'
      OR missing_assessments >= 2
      OR (recent_score IS NOT NULL AND prior_score IS NOT NULL AND recent_score < prior_score - 8)
      OR (recent_score IS NOT NULL AND recent_score < 55)
    )
    ORDER BY missing_assessments DESC, last_active ASC NULLS FIRST
    LIMIT ${limit}
  `
  return rows.map((row) => ({
    studentId: Number(row.id),
    studentName: String(row.full_name ?? "Student"),
    courseId: Number(row.course_id),
    courseName: `${row.course_code ?? ""} ${row.course_title ?? ""}`.trim(),
    reason: String(row.reason ?? "needs_attention"),
    recentEngagement:
      row.last_active != null
        ? `Last activity ${String(row.last_active).slice(0, 10)}`
        : "No recent activity",
    recentPerformance: row.recent_score != null ? `${Math.round(Number(row.recent_score))}% avg` : null,
    lastActivity: row.last_active ? String(row.last_active) : null,
    recommendedAction:
      row.reason === "inactive"
        ? "Send engagement reminder"
        : row.reason === "multiple_missing_assessments"
          ? "Review missing submissions"
          : "Review performance trend",
  }))
}

export async function getCourseHealthRows(scope: InstitutionScope): Promise<
  Array<{
    courseId: number
    courseCode: string
    courseName: string
    activeStudents: number
    completionRate: number | null
    avgScore: number | null
    coraAdoptionRate: number | null
    attentionCount: number
  }>
> {
  if (scope.courseIds.length === 0) return []
  const rows = await sql`
    SELECT
      c.id AS course_id,
      c.course_code,
      c.course_title,
      (
        SELECT COUNT(DISTINCT st.id)::int FROM students st
        WHERE st.course_id = c.id AND st.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM quiz_attempts qa WHERE qa.student_id = st.id AND qa.deleted_at IS NULL
              AND COALESCE(qa.started_at, qa.completed_at)::date >= ${scope.from}::date
          )
      ) AS active_students,
      (
        SELECT CASE WHEN COUNT(*) = 0 THEN NULL
          ELSE ROUND(COUNT(*) FILTER (WHERE qa.completed_at IS NOT NULL)::numeric / COUNT(*) * 100, 1)
        END
        FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
        WHERE q.course_id = c.id AND qa.deleted_at IS NULL
          AND COALESCE(qa.started_at, qa.completed_at)::date >= ${scope.from}::date
      ) AS completion_rate,
      (
        SELECT ROUND(AVG(qa.score)::numeric, 1) FROM quiz_attempts qa
        JOIN quizzes q ON q.id = qa.quiz_id
        WHERE q.course_id = c.id AND qa.completed_at IS NOT NULL AND qa.deleted_at IS NULL
          AND qa.completed_at::date >= ${scope.from}::date
      ) AS avg_score,
      (
        SELECT CASE WHEN COUNT(DISTINCT st.id) = 0 THEN NULL
          ELSE ROUND(COUNT(DISTINCT u.user_id)::numeric / COUNT(DISTINCT st.id) * 100, 1)
        END
        FROM students st
        LEFT JOIN institution_cora_usage u ON u.user_type = 'student' AND u.user_id = st.id
          AND u.course_id = c.id AND u.created_at::date >= ${scope.from}::date
        WHERE st.course_id = c.id AND st.deleted_at IS NULL
      ) AS cora_adoption,
      (
        SELECT COUNT(*)::int FROM students st
        WHERE st.course_id = c.id AND st.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM quiz_attempts qa
            WHERE qa.student_id = st.id AND qa.deleted_at IS NULL
              AND COALESCE(qa.started_at, qa.completed_at) >= NOW() - INTERVAL '14 days'
          )
      ) AS attention_count
    FROM courses c
    WHERE c.id = ANY(${scope.courseIds})
    ORDER BY active_students DESC, c.course_code ASC
  `
  return rows.map((row) => ({
    courseId: Number(row.course_id),
    courseCode: String(row.course_code ?? ""),
    courseName: String(row.course_title ?? ""),
    activeStudents: Number(row.active_students ?? 0),
    completionRate: row.completion_rate != null ? Number(row.completion_rate) : null,
    avgScore: row.avg_score != null ? Number(row.avg_score) : null,
    coraAdoptionRate: row.cora_adoption != null ? Number(row.cora_adoption) : null,
    attentionCount: Number(row.attention_count ?? 0),
  }))
}

export async function getFeatureAdoption(scope: InstitutionScope) {
  if (scope.courseIds.length === 0) {
    return { student: [] as Array<{ key: string; name: string; value: number }>, instructor: [] as Array<{ key: string; name: string; value: number }> }
  }

  const eligibleStudents = await sql`
    SELECT COUNT(DISTINCT st.id)::int AS n FROM students st
    WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM quiz_attempts qa WHERE qa.student_id = st.id AND qa.deleted_at IS NULL)
  `
  const eligibleInstructors = await sql`
    SELECT COUNT(DISTINCT i.id)::int AS n
    FROM instructors i
    LEFT JOIN courses c ON c.instructor_id = i.id AND c.id = ANY(${scope.courseIds})
    LEFT JOIN course_staff cs ON cs.instructor_id = i.id AND cs.course_id = ANY(${scope.courseIds})
    WHERE c.id IS NOT NULL OR cs.instructor_id IS NOT NULL
  `
  const studentEligible = Math.max(1, Number(eligibleStudents[0]?.n ?? 0))
  const instructorEligible = Math.max(1, Number(eligibleInstructors[0]?.n ?? 0))

  const [coraStu, practiceStu, codeStu, playgroundStu, coraFac, gradingFac] = await Promise.all([
    sql`SELECT COUNT(DISTINCT user_id)::int AS n FROM institution_cora_usage WHERE institution_id = ${scope.institutionId} AND user_type = 'student' AND created_at::date >= ${scope.from}::date AND created_at::date <= ${scope.to}::date`,
    sql`SELECT COUNT(DISTINCT pa.student_id)::int AS n FROM practice_attempts pa JOIN students st ON st.id = pa.student_id WHERE st.course_id = ANY(${scope.courseIds}) AND COALESCE(pa.started_at, pa.completed_at)::date >= ${scope.from}::date`,
    sql`SELECT COUNT(DISTINCT cs.student_id)::int AS n FROM codebench_submissions cs JOIN students st ON st.id = cs.student_id WHERE st.course_id = ANY(${scope.courseIds}) AND cs.submitted_at::date >= ${scope.from}::date`,
    sql`SELECT COUNT(DISTINCT pr.student_id)::int AS n FROM playground_results pr JOIN students st ON st.id::text = pr.student_id::text WHERE st.course_id = ANY(${scope.courseIds}) AND pr.completed_at::date >= ${scope.from}::date`.catch(() => [{ n: 0 }]),
    sql`SELECT COUNT(DISTINCT user_id)::int AS n FROM institution_cora_usage WHERE institution_id = ${scope.institutionId} AND user_type = 'instructor' AND created_at::date >= ${scope.from}::date`,
    sql`SELECT COUNT(DISTINCT q.instructor_id)::int AS n FROM quiz_answers qans JOIN quiz_attempts qa ON qa.id = qans.attempt_id JOIN quizzes q ON q.id = qa.quiz_id WHERE q.course_id = ANY(${scope.courseIds}) AND (qans.ai_feedback->>'aiGraded')::boolean IS TRUE AND COALESCE(qans.reviewed_at, qans.answered_at)::date >= ${scope.from}::date`.catch(() => [{ n: 0 }]),
  ])

  const pct = (n: number, eligible: number) => Math.round((n / eligible) * 1000) / 10

  return {
    student: [
      { key: "cora", name: "Cora", value: pct(Number(coraStu[0]?.n ?? 0), studentEligible) },
      { key: "practice", name: "Practice Hub", value: pct(Number(practiceStu[0]?.n ?? 0), studentEligible) },
      { key: "codebench", name: "CodeBench", value: pct(Number(codeStu[0]?.n ?? 0), studentEligible) },
      { key: "playground", name: "Playground", value: pct(Number(playgroundStu[0]?.n ?? 0), studentEligible) },
    ].sort((a, b) => b.value - a.value),
    instructor: [
      { key: "cora", name: "Cora", value: pct(Number(coraFac[0]?.n ?? 0), instructorEligible) },
      { key: "auto_grading", name: "Automated grading", value: pct(Number(gradingFac[0]?.n ?? 0), instructorEligible) },
    ].sort((a, b) => b.value - a.value),
  }
}

export async function getCoraPeriodMetrics(scope: InstitutionScope) {
  const rows = await sql`
    SELECT
      COUNT(*)::int AS workflows,
      COUNT(DISTINCT user_id)::int AS unique_users,
      COALESCE(SUM(credits), 0)::int AS credits
    FROM institution_cora_usage
    WHERE institution_id = ${scope.institutionId}
      AND created_at::date >= ${scope.from}::date
      AND created_at::date <= ${scope.to}::date
  `
  return {
    workflows: Number(rows[0]?.workflows ?? 0),
    uniqueUsers: Number(rows[0]?.unique_users ?? 0),
    credits: Number(rows[0]?.credits ?? 0),
    successRate: null as number | null,
  }
}

export async function getRecentAuditActivity(institutionId: number, limit = 8) {
  const rows = await sql`
    SELECT id, action, entity_type, created_at, new_value
    FROM institution_audit_logs
    WHERE institution_id = ${institutionId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return rows.map((row) => ({
    id: Number(row.id),
    action: String(row.action),
    entityType: String(row.entity_type),
    createdAt: String(row.created_at),
    summary: `${String(row.action).replace(/_/g, " ")} · ${String(row.entity_type).replace(/_/g, " ")}`,
  }))
}

export async function countCoveredInstructorsForLicense(licenseId: number): Promise<number> {
  const rows = await sql`
    SELECT COUNT(DISTINCT instructor_id)::int AS n
    FROM (
      SELECT c.instructor_id
      FROM institution_license_scopes s
      JOIN courses c ON c.id = s.course_id
      WHERE s.license_id = ${licenseId} AND c.instructor_id IS NOT NULL
      UNION
      SELECT cs.instructor_id
      FROM institution_license_scopes s
      JOIN course_staff cs ON cs.course_id = s.course_id AND cs.is_active = true
      WHERE s.license_id = ${licenseId}
    ) faculty
  `
  return Number(rows[0]?.n ?? 0)
}
