import { sql } from "@/lib/db"
import { minimizeFacultyContextForExternalAi } from "@/lib/cora/privacy/ai-data-minimization"
import {
  buildInstructorOwnedCourseScopeSqlFragment,
  buildLectureInstructorCourseScopeSqlFragment,
} from "@/lib/instructor-default-courses"

export type FacultyCoraContextPayload = {
  course: {
    id: number
    courseCode: string | null
    courseTitle: string | null
  }
  dashboard: {
    totalQuizzes: number
    activeQuizzes: number
    totalStudents: number
    totalAttempts: number
    pendingIssues: number
    upcomingAssessments: number
    recentSubmissions24h: number
  }
  questionBank: {
    totalQuestions: number
    topics: Array<{ name: string; questionCount: number }>
  }
  lectures: {
    totalLectures: number
    recentTitles: string[]
  }
  assessments: {
    quizTitles: string[]
    homeworkTitles: string[]
  }
  practice: {
    totalAttempts: number
    averageScore: number | null
    weakTopics: string[]
  }
  playbook?: FacultyCoraPlaybook
  syncedAt: string
}


function firstRow<T>(rows: unknown): T | undefined {
  return Array.isArray(rows) ? (rows[0] as T | undefined) : undefined
}

export async function fetchFacultyContextForCora(input: {
  courseId: number
  instructorId: number
  courseCode: string | null
  courseTitle: string | null
}): Promise<FacultyCoraContextPayload> {
  const { courseId, instructorId, courseCode, courseTitle } = input

  const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
    "question_bank",
    "course_id",
    courseId,
    instructorId,
    { scopeCourseCode: courseCode },
  )
  const lectureScope = await buildLectureInstructorCourseScopeSqlFragment(
    courseId,
    instructorId,
    courseCode,
  )

  const [
    quizStats,
    studentStats,
    attemptStats,
    issueStats,
    upcomingStats,
    recentStats,
    qbCount,
    qbTopics,
    lectureStats,
    practiceStats,
  ] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int as total_quizzes,
        COUNT(CASE WHEN available_from <= NOW() AND (available_until IS NULL OR available_until >= NOW()) THEN 1 END)::int as active_quizzes
      FROM quizzes q
      WHERE q.deleted_at IS NULL AND (
        q.course_id = ${courseId}
        OR EXISTS (
          SELECT 1 FROM quiz_session_access qsa
          INNER JOIN sessions sess ON sess.id = qsa.session_id
          WHERE qsa.quiz_id = q.id AND sess.course_id = ${courseId}
        )
      )
    `,
    sql`
      SELECT COUNT(*)::int as total_students
      FROM students s
      WHERE s.course_id = ${courseId}
         OR EXISTS (
           SELECT 1 FROM sessions sess
           WHERE sess.id = s.session_id AND sess.course_id = ${courseId}
         )
    `,
    sql`
      SELECT COUNT(*)::int as total_attempts
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE q.deleted_at IS NULL AND (
        q.course_id = ${courseId}
        OR EXISTS (
          SELECT 1 FROM quiz_session_access qsa
          INNER JOIN sessions sess ON sess.id = qsa.session_id
          WHERE qsa.quiz_id = q.id AND sess.course_id = ${courseId}
        )
      )
    `,
    sql`
      SELECT COUNT(*)::int as pending_issues
      FROM quiz_issues qi
      JOIN quizzes q ON qi.quiz_id = q.id
      WHERE qi.status = 'open' AND (
        q.course_id = ${courseId}
        OR EXISTS (
          SELECT 1 FROM quiz_session_access qsa
          INNER JOIN sessions sess ON sess.id = qsa.session_id
          WHERE qsa.quiz_id = q.id AND sess.course_id = ${courseId}
        )
      )
    `,
    sql`
      SELECT COUNT(*)::int as upcoming_assessments
      FROM quizzes q
      WHERE q.deleted_at IS NULL AND q.available_from > NOW() AND (
        q.course_id = ${courseId}
        OR EXISTS (
          SELECT 1 FROM quiz_session_access qsa
          INNER JOIN sessions sess ON sess.id = qsa.session_id
          WHERE qsa.quiz_id = q.id AND sess.course_id = ${courseId}
        )
      )
    `,
    sql`
      SELECT COUNT(*)::int as recent_submissions
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.completed_at >= NOW() - INTERVAL '24 hours' AND (
        q.course_id = ${courseId}
        OR EXISTS (
          SELECT 1 FROM quiz_session_access qsa
          INNER JOIN sessions sess ON sess.id = qsa.session_id
          WHERE qsa.quiz_id = q.id AND sess.course_id = ${courseId}
        )
      )
    `,
    sql`
      SELECT COUNT(*)::int as total
      FROM question_bank
      WHERE deleted_at IS NULL AND (${qbScope})
    `.catch(() => [{ total: 0 }]),
    sql`
      SELECT topic as name, COUNT(*)::int as question_count
      FROM question_bank
      WHERE deleted_at IS NULL AND topic IS NOT NULL AND TRIM(topic) <> '' AND (${qbScope})
      GROUP BY topic
      ORDER BY question_count DESC
      LIMIT 12
    `.catch(() => []),
    sql`
      SELECT COUNT(*)::int as total,
        COALESCE(
          ARRAY(
            SELECT l.title FROM lectures l
            WHERE l.deleted_at IS NULL AND (${lectureScope})
            ORDER BY l.updated_at DESC NULLS LAST
            LIMIT 5
          ),
          ARRAY[]::text[]
        ) as recent_titles
      FROM lectures l
      WHERE l.deleted_at IS NULL AND (${lectureScope})
    `.catch(() => [{ total: 0, recent_titles: [] }]),
    sql`
      SELECT COUNT(pa.id)::int as attempts,
        AVG(CAST(pa.score_percentage AS NUMERIC))::float as avg_score
      FROM practice_attempts pa
      INNER JOIN students s ON s.id = pa.student_id
      INNER JOIN sessions sess ON sess.id = s.session_id
      WHERE pa.completed_at IS NOT NULL AND sess.course_id = ${courseId}
    `.catch(() => [{ attempts: 0, avg_score: null }]),
  ])

  const weakTopicRows = await sql`
    SELECT qb.topic, AVG(CASE WHEN pans.is_correct THEN 100 ELSE 0 END)::float as avg_score
    FROM practice_answers pans
    JOIN question_bank qb ON pans.bank_question_id = qb.id
    JOIN practice_attempts pa ON pans.attempt_id = pa.id
    INNER JOIN students s ON s.id = pa.student_id
    INNER JOIN sessions sess ON sess.id = s.session_id
    WHERE qb.topic IS NOT NULL AND TRIM(qb.topic) <> ''
      AND pa.completed_at IS NOT NULL
      AND sess.course_id = ${courseId}
    GROUP BY qb.topic
    HAVING COUNT(*) >= 3
    ORDER BY avg_score ASC NULLS LAST
    LIMIT 5
  `.catch(() => [])

  const qs = firstRow<{ total_quizzes?: number; active_quizzes?: number }>(quizStats)

  const practiceRow = firstRow<{ attempts?: number; avg_score?: number | null }>(practiceStats)

  const payload: FacultyCoraContextPayload = {
    course: { id: courseId, courseCode, courseTitle },
    dashboard: {
      totalQuizzes: Number(qs?.total_quizzes ?? 0),
      activeQuizzes: Number(qs?.active_quizzes ?? 0),
      totalStudents: Number(firstRow<{ total_students?: number }>(studentStats)?.total_students ?? 0),
      totalAttempts: Number(firstRow<{ total_attempts?: number }>(attemptStats)?.total_attempts ?? 0),
      pendingIssues: Number(firstRow<{ pending_issues?: number }>(issueStats)?.pending_issues ?? 0),
      upcomingAssessments: Number(firstRow<{ upcoming_assessments?: number }>(upcomingStats)?.upcoming_assessments ?? 0),
      recentSubmissions24h: Number(firstRow<{ recent_submissions?: number }>(recentStats)?.recent_submissions ?? 0),
    },
    questionBank: {
      totalQuestions: Number(firstRow<{ total?: number }>(qbCount)?.total ?? 0),
      topics: (qbTopics as Array<{ name: string; question_count: number }>).map((row) => ({
        name: String(row.name),
        questionCount: Number(row.question_count ?? 0),
      })),
    },
    lectures: {
      totalLectures: Number(firstRow<{ total?: number }>(lectureStats)?.total ?? 0),
      recentTitles: (firstRow<{ recent_titles?: string[] }>(lectureStats)?.recent_titles ?? []).map(String),
    },
    assessments: await fetchFacultyAssessmentTitles(courseId),
    practice: {
      totalAttempts: Number(practiceRow?.attempts ?? 0),
      averageScore: practiceRow?.avg_score != null ? Math.round(Number(practiceRow.avg_score)) : null,
      weakTopics: (weakTopicRows as Array<{ topic: string }>).map((r) => String(r.topic)),
    },
    syncedAt: new Date().toISOString(),
  }

  try {
    payload.playbook = await generateFacultyCoraPlaybook({
      instructorId,
      courseId,
      courseCode,
      courseTitle,
      context: payload,
    })
  } catch {
    /* setup continues without a cached playbook */
  }

  return payload
}

async function fetchFacultyAssessmentTitles(courseId: number) {
  const rows = await sql`
    SELECT title, COALESCE(assessment_type, 'quiz') as assessment_type
    FROM quizzes
    WHERE deleted_at IS NULL AND (
      course_id = ${courseId}
      OR EXISTS (
        SELECT 1 FROM quiz_session_access qsa
        INNER JOIN sessions sess ON sess.id = qsa.session_id
        WHERE qsa.quiz_id = quizzes.id AND sess.course_id = ${courseId}
      )
    )
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 12
  `.catch(() => [])
  const quizTitles: string[] = []
  const homeworkTitles: string[] = []
  for (const row of rows as Array<{ title?: string; assessment_type?: string }>) {
    const title = String(row.title ?? "").trim()
    if (!title) continue
    if (String(row.assessment_type) === "homework") homeworkTitles.push(title)
    else if (quizTitles.length < 6) quizTitles.push(title)
  }
  return { quizTitles: quizTitles.slice(0, 6), homeworkTitles: homeworkTitles.slice(0, 6) }
}

export function formatFacultyContextForPrompt(
  ctx: FacultyCoraContextPayload,
  options?: { forExternalAi?: boolean },
): string {
  const payload = options?.forExternalAi !== false ? minimizeFacultyContextForExternalAi(ctx) : ctx
  const lines: string[] = [
    `Course: ${payload.course.courseCode ?? "—"} — ${payload.course.courseTitle ?? ""}`.trim(),
    "",
    "Dashboard:",
    `- Students: ${payload.dashboard.totalStudents}`,
    `- Quizzes: ${payload.dashboard.totalQuizzes} (${payload.dashboard.activeQuizzes} active)`,
    `- Attempts: ${payload.dashboard.totalAttempts} (${payload.dashboard.recentSubmissions24h} in last 24h)`,
    `- Open issues: ${payload.dashboard.pendingIssues}`,
    `- Upcoming assessments: ${payload.dashboard.upcomingAssessments}`,
    "",
    `Question bank: ${payload.questionBank.totalQuestions} questions`,
  ]

  if (payload.questionBank.topics.length) {
    lines.push(
      "Top topics: " +
        payload.questionBank.topics
          .slice(0, 8)
          .map((t) => `${t.name} (${t.questionCount})`)
          .join(", "),
    )
  }

  lines.push("", `Lectures: ${payload.lectures.totalLectures}`)
  if (payload.lectures.recentTitles.length) {
    lines.push("Recent: " + payload.lectures.recentTitles.join("; "))
  }
  const quizTitles = payload.assessments?.quizTitles ?? []
  const homeworkTitles = payload.assessments?.homeworkTitles ?? []
  if (quizTitles.length) {
    lines.push("Quizzes: " + quizTitles.join("; "))
  }
  if (homeworkTitles.length) {
    lines.push("Homework: " + homeworkTitles.join("; "))
  }

  if (payload.practice.totalAttempts > 0) {
    lines.push(
      "",
      `Practice: ${payload.practice.totalAttempts} attempts` +
        (payload.practice.averageScore != null ? `, avg ${payload.practice.averageScore}%` : ""),
    )
    if (payload.practice.weakTopics.length) {
      lines.push("Weaker practice topics: " + payload.practice.weakTopics.join(", "))
    }
  }

  if (options?.forExternalAi !== false) {
    lines.push("", "Privacy: roster names, emails, and student identifiers are not included in this AI context.")
  }

  return lines.join("\n")
}

export const FACULTY_CORA_PLAYBOOK_VERSION = 2
const PLAYBOOK_TTL_MS = 12 * 60 * 60 * 1000

export type FacultyCoraPlaybookCapability = {
  prompts: string[]
  relatedModuleIds: string[]
}

export type FacultyCoraPlaybookInsight = {
  id: string
  title: string
  body: string
  severity?: "info" | "warning" | "success"
  capabilityId?: string
}

export type FacultyCoraPlaybook = {
  version: number
  courseId: number
  courseCode: string | null
  courseTitle: string | null
  generatedAt: string
  source: "scan" | "llm"
  insights: FacultyCoraPlaybookInsight[]
  capabilities: Record<string, FacultyCoraPlaybookCapability>
}

type FacultyCoraScanInventory = {
  announcementTitles: string[]
  flashcardTitles: string[]
  midtermTitles: string[]
  studentChatTopics: string[]
  facultyThreadTitles: string[]
  hasSyllabus: boolean
  peakCoraHour: number | null
  strugglingTopic: string | null
  strugglingCount: number
}

const CAPABILITY_IDS = [
  "create",
  "improve",
  "analyze",
  "explain",
  "automate",
  "review",
  "assistant",
  "insights",
] as const

const CAPABILITY_MODULE_FOCUS: Record<(typeof CAPABILITY_IDS)[number], string[]> = {
  create: ["question-bank", "quizzes", "homework", "mid-semester-exams", "flashcards", "announcements", "lectures"],
  improve: ["question-bank", "quizzes", "homework", "mid-semester-exams"],
  analyze: ["results", "student-progress", "reports", "attendance", "practice"],
  explain: ["results", "student-progress", "office-hours", "lectures"],
  automate: ["announcements", "flashcards", "practice", "office-hours", "lectures"],
  review: ["syllabus", "lectures", "quizzes", "homework", "flashcards"],
  assistant: ["messages", "students", "quizzes", "results"],
  insights: ["dashboard", "results", "student-progress", "reports"],
}

function titlesOf(rows: unknown, key = "title"): string[] {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => String((row as Record<string, unknown>)[key] ?? "").trim())
    .filter(Boolean)
}

function uniquePrompts(values: Array<string | null | undefined>, limit = 4): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const text = value?.replace(/\s+/g, " ").trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    out.push(text)
    if (out.length >= limit) break
  }
  return out
}

async function ensurePlaybookSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS instructor_cora_playbooks (
      instructor_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      playbook JSONB NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (instructor_id, course_id)
    )
  `.catch(() => undefined)
}

async function loadCachedPlaybook(instructorId: number, courseId: number): Promise<FacultyCoraPlaybook | null> {
  await ensurePlaybookSchema()
  const rows = await sql`
    SELECT playbook, generated_at
    FROM instructor_cora_playbooks
    WHERE instructor_id = ${instructorId} AND course_id = ${courseId}
    LIMIT 1
  `.catch(() => [])
  const row = Array.isArray(rows) ? (rows[0] as { playbook?: FacultyCoraPlaybook; generated_at?: string } | undefined) : undefined
  if (!row?.playbook || row.playbook.version !== FACULTY_CORA_PLAYBOOK_VERSION) return null
  const generatedAt = new Date(String(row.playbook.generatedAt || row.generated_at)).getTime()
  if (!Number.isFinite(generatedAt) || Date.now() - generatedAt > PLAYBOOK_TTL_MS) return null
  return row.playbook
}

async function savePlaybook(instructorId: number, courseId: number, playbook: FacultyCoraPlaybook) {
  await ensurePlaybookSchema()
  await sql`
    INSERT INTO instructor_cora_playbooks (instructor_id, course_id, playbook, generated_at)
    VALUES (${instructorId}, ${courseId}, ${JSON.stringify(playbook)}::jsonb, NOW())
    ON CONFLICT (instructor_id, course_id)
    DO UPDATE SET playbook = EXCLUDED.playbook, generated_at = NOW()
  `.catch(() => undefined)
}

async function scanFacultyCoraInventory(courseId: number): Promise<FacultyCoraScanInventory> {
  const [announcements, flashcards, midterms, syllabus, studentTopics, peakTime, struggle] = await Promise.all([
    sql`SELECT title FROM announcements WHERE course_id = ${courseId} ORDER BY created_at DESC NULLS LAST LIMIT 6`.catch(() => []),
    sql`SELECT title FROM flashcard_decks WHERE course_id = ${courseId} ORDER BY updated_at DESC NULLS LAST LIMIT 6`.catch(() => []),
    sql`
      SELECT title FROM quizzes
      WHERE deleted_at IS NULL
        AND COALESCE(assessment_type, 'quiz') IN ('mid_semester', 'mid-semester', 'midterm')
        AND (
          course_id = ${courseId}
          OR EXISTS (
            SELECT 1 FROM quiz_session_access qsa
            INNER JOIN sessions sess ON sess.id = qsa.session_id
            WHERE qsa.quiz_id = quizzes.id AND sess.course_id = ${courseId}
          )
        )
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 4
    `.catch(() => []),
    sql`SELECT id FROM course_syllabi WHERE course_id = ${courseId} LIMIT 1`.catch(() => []),
    sql`
      SELECT topic
      FROM ai_tutor_conversations aitc
      INNER JOIN students s ON s.id = aitc.student_id
      INNER JOIN sessions sess ON sess.id = s.session_id
      WHERE aitc.topic IS NOT NULL
        AND aitc.created_at >= NOW() - INTERVAL '14 days'
        AND sess.course_id = ${courseId}
      GROUP BY topic
      ORDER BY COUNT(*) DESC
      LIMIT 6
    `.catch(() => []),
    sql`
      SELECT EXTRACT(HOUR FROM aitc.created_at)::int as hour
      FROM ai_tutor_conversations aitc
      INNER JOIN students s ON s.id = aitc.student_id
      INNER JOIN sessions sess ON sess.id = s.session_id
      WHERE aitc.created_at >= NOW() - INTERVAL '7 days'
        AND sess.course_id = ${courseId}
      GROUP BY EXTRACT(HOUR FROM aitc.created_at)
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `.catch(() => []),
    sql`
      SELECT topic, COUNT(DISTINCT student_id)::int as struggling_count
      FROM (
        SELECT aitc.student_id, aitc.topic
        FROM ai_tutor_conversations aitc
        INNER JOIN students s ON s.id = aitc.student_id
        INNER JOIN sessions sess ON sess.id = s.session_id
        WHERE aitc.topic IS NOT NULL
          AND aitc.created_at >= NOW() - INTERVAL '7 days'
          AND sess.course_id = ${courseId}
        GROUP BY aitc.student_id, aitc.topic
        HAVING COUNT(*) >= 4
      ) struggles
      GROUP BY topic
      ORDER BY struggling_count DESC
      LIMIT 1
    `.catch(() => []),
  ])

  const peak = firstRow<{ hour?: number }>(peakTime)
  const struggleRow = firstRow<{ topic?: string; struggling_count?: number }>(struggle)

  return {
    announcementTitles: titlesOf(announcements),
    flashcardTitles: titlesOf(flashcards),
    midtermTitles: titlesOf(midterms),
    studentChatTopics: titlesOf(studentTopics, "topic"),
    facultyThreadTitles: [],
    hasSyllabus: Array.isArray(syllabus) && syllabus.length > 0,
    peakCoraHour: peak?.hour != null ? Number(peak.hour) : null,
    strugglingTopic: struggleRow?.topic ? String(struggleRow.topic) : null,
    strugglingCount: Number(struggleRow?.struggling_count ?? 0),
  }
}

function availableModuleIds(ctx: FacultyCoraContextPayload, inventory: FacultyCoraScanInventory): string[] {
  const ids = ["dashboard", "results", "student-progress", "students", "messages"]
  if (ctx.questionBank.totalQuestions > 0) ids.push("question-bank")
  if ((ctx.assessments?.quizTitles?.length ?? 0) > 0 || ctx.dashboard.totalQuizzes > 0) ids.push("quizzes")
  if ((ctx.assessments?.homeworkTitles?.length ?? 0) > 0) ids.push("homework")
  if (inventory.midtermTitles.length > 0) ids.push("mid-semester-exams")
  if (ctx.lectures.totalLectures > 0) ids.push("lectures")
  if (inventory.hasSyllabus) ids.push("syllabus")
  if (inventory.flashcardTitles.length > 0) ids.push("flashcards")
  if (ctx.practice.totalAttempts > 0) ids.push("practice")
  if (inventory.announcementTitles.length > 0) ids.push("announcements")
  if (ctx.dashboard.totalStudents > 0) ids.push("attendance", "office-hours", "reports")
  return [...new Set(ids)]
}

function relatedFor(id: (typeof CAPABILITY_IDS)[number], available: string[]): string[] {
  const picked = CAPABILITY_MODULE_FOCUS[id].filter((moduleId) => available.includes(moduleId))
  for (const moduleId of available) {
    if (picked.length >= 4) break
    if (!picked.includes(moduleId)) picked.push(moduleId)
  }
  return picked.slice(0, 4)
}

function scanPrompts(
  id: (typeof CAPABILITY_IDS)[number],
  ctx: FacultyCoraContextPayload,
  inventory: FacultyCoraScanInventory,
): string[] {
  const course = ctx.course.courseCode || ctx.course.courseTitle || "this course"
  const topics = ctx.questionBank.topics.map((t) => t.name).filter(Boolean)
  const weak = ctx.practice.weakTopics
  const quizzes = ctx.assessments?.quizTitles ?? []
  const homework = ctx.assessments?.homeworkTitles ?? []
  const lectures = ctx.lectures.recentTitles
  const chats = inventory.studentChatTopics
  const threads = inventory.facultyThreadTitles
  const byId: Record<(typeof CAPABILITY_IDS)[number], Array<string | null>> = {
    create: [
      topics[0] ? `Generate question bank items from the live ${topics[0]} coverage in ${course}` : null,
      homework[0] ? `Draft the next announcement around ${homework[0]}` : null,
      lectures[0] ? `Create flashcards from ${lectures[0]}` : null,
      topics[1] ? `Build a playground set on ${topics[1]}` : null,
      chats[0] ? `Create a short review activity for ${chats[0]} from student Cora questions` : null,
      `Scan ${course} and draft the next piece of missing content`,
    ],
    improve: [
      quizzes[0] ? `Improve discrimination and wording on ${quizzes[0]}` : null,
      topics[0] ? `Make ${topics[0]} items more conceptual` : null,
      topics[1] ? `Generate better distractors for ${topics[1]}` : null,
      homework[0] ? `Reduce friction and ambiguity on ${homework[0]}` : null,
      `Review the latest ${course} assessments and propose concrete edits`,
    ],
    analyze: [
      weak[0] ? `Which ${course} items show the weakest mastery on ${weak[0]}?` : null,
      homework[0] && homework[1] ? `Compare difficulty between ${homework[0]} and ${homework[1]}` : null,
      quizzes[0] ? `Summarize item analysis for ${quizzes[0]}` : null,
      chats[0] ? `What student Cora questions reveal about ${chats[0]}?` : null,
      ctx.questionBank.totalQuestions > 0 ? "Find duplicate or overlapping question bank items" : null,
      `Analyze this week's ${course} results and flag what needs attention`,
    ],
    explain: [
      inventory.strugglingTopic
        ? `Why are ${inventory.strugglingCount || "several"} students stuck on ${inventory.strugglingTopic}?`
        : null,
      weak[0] ? `Explain common misconceptions on ${weak[0]}` : null,
      chats[0] ? `Explain the grading or concept gap behind ${chats[0]} questions` : null,
      quizzes[0] ? `Explain the result trend on ${quizzes[0]}` : null,
      `Explain the biggest ${course} learning gap Cora found in this scan`,
    ],
    automate: [
      `Plan this week's ${course} announcements from upcoming work`,
      quizzes[0] ? `Generate practice after ${quizzes[0]}` : null,
      lectures[0] ? `Queue flashcards after ${lectures[0]}` : null,
      inventory.announcementTitles[0]
        ? `Follow ${inventory.announcementTitles[0]} with the next scheduled update`
        : null,
      threads[0] ? `Continue the automation started in "${threads[0]}"` : null,
    ],
    review: [
      inventory.hasSyllabus ? `Review the ${course} syllabus for outcome coverage` : null,
      quizzes[0] ? `Review ${quizzes[0]} for ambiguous wording` : null,
      inventory.flashcardTitles[0] ? `Review ${inventory.flashcardTitles[0]} for accuracy` : null,
      lectures[0] ? `Check ${lectures[0]} against current assessments` : null,
      `Audit ${course} for coverage gaps from this scan`,
    ],
    assistant: [
      quizzes[0] ? `Help me finish ${quizzes[0]} using the live course context` : null,
      chats[0] ? `Help draft a reply to students asking about ${chats[0]}` : null,
      lectures[0] ? `Help reorganize lectures around ${lectures[0]}` : null,
      threads[0] ? `Continue "${threads[0]}" with the latest course data` : null,
      `Help me act on the highest-priority ${course} finding from this scan`,
    ],
    insights: [
      inventory.strugglingTopic
        ? `What should I focus on this week after the ${inventory.strugglingTopic} struggle signal?`
        : `What should I focus on this week in ${course}?`,
      ctx.dashboard.pendingIssues > 0
        ? `Which of the ${ctx.dashboard.pendingIssues} open assessment issues should I handle first?`
        : null,
      inventory.peakCoraHour != null
        ? `How should I use the ${inventory.peakCoraHour}:00 student Cora peak?`
        : null,
      topics[0] ? `What content gaps remain for ${topics[0]}?` : null,
    ],
  }
  return uniquePrompts(byId[id])
}

function scanInsights(ctx: FacultyCoraContextPayload, inventory: FacultyCoraScanInventory): FacultyCoraPlaybookInsight[] {
  const insights: FacultyCoraPlaybookInsight[] = []
  if (inventory.strugglingTopic && inventory.strugglingCount > 0) {
    insights.push({
      id: "struggle-topic",
      title: "Students struggling this week",
      body: `${inventory.strugglingCount} students asked repeated questions about "${inventory.strugglingTopic}".`,
      severity: "warning",
      capabilityId: "explain",
    })
  }
  if (inventory.peakCoraHour != null) {
    insights.push({
      id: "cora-peak",
      title: "Peak Cora usage",
      body: `Most student AI questions happen around ${inventory.peakCoraHour}:00–${inventory.peakCoraHour + 1}:00.`,
      severity: "info",
      capabilityId: "insights",
    })
  }
  if (ctx.dashboard.pendingIssues > 0) {
    insights.push({
      id: "open-issues",
      title: "Assessments need attention",
      body: `${ctx.dashboard.pendingIssues} open quiz issues are waiting in ${ctx.course.courseCode || "this course"}.`,
      severity: "warning",
      capabilityId: "analyze",
    })
  }
  if (ctx.practice.weakTopics[0]) {
    insights.push({
      id: "weak-practice",
      title: "Practice gap",
      body: `Students are weakest on ${ctx.practice.weakTopics[0]} in recent practice.`,
      severity: "info",
      capabilityId: "create",
    })
  }
  return insights.slice(0, 4)
}

function buildScanPlaybook(ctx: FacultyCoraContextPayload, inventory: FacultyCoraScanInventory): FacultyCoraPlaybook {
  const available = availableModuleIds(ctx, inventory)
  const capabilities: Record<string, FacultyCoraPlaybookCapability> = {}
  for (const id of CAPABILITY_IDS) {
    capabilities[id] = {
      prompts: scanPrompts(id, ctx, inventory),
      relatedModuleIds: relatedFor(id, available),
    }
  }
  return {
    version: FACULTY_CORA_PLAYBOOK_VERSION,
    courseId: ctx.course.id,
    courseCode: ctx.course.courseCode,
    courseTitle: ctx.course.courseTitle,
    generatedAt: new Date().toISOString(),
    source: "scan",
    insights: scanInsights(ctx, inventory),
    capabilities,
  }
}

async function enrichPlaybookWithLlm(
  scan: FacultyCoraPlaybook,
  ctx: FacultyCoraContextPayload,
  inventory: FacultyCoraScanInventory,
): Promise<FacultyCoraPlaybook> {
  if (!process.env.OPENAI_API_KEY) return scan
  const OpenAI = (await import("openai")).default
  const { createWithFallback } = await import("@/lib/openai-with-fallback")
  const { sanitizeMessagesForExternalAi, logCoraExternalAiCall } = await import(
    "@/lib/cora/privacy/ai-data-minimization"
  )
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const rawMessages = [
    {
      role: "system",
      content:
        "You are Cora Copilot, a faculty teaching agent. Using only the scanned course inventory, write actionable Try-asking prompts. Never invent assessments, lectures, or topics that are not in the scan. Return JSON only with insights[] and capabilities{id:{prompts,relatedModuleIds}}. Each capability needs 3-4 short prompts and 3-4 relatedModuleIds from the available modules.",
    },
    {
      role: "user",
      content: [
        formatFacultyContextForPrompt(ctx),
        "",
        "Inventory:",
        JSON.stringify(inventory),
        "",
        "Available modules:",
        availableModuleIds(ctx, inventory).join(", "),
        "",
        "Scan draft:",
        JSON.stringify(scan.capabilities),
      ].join("\n"),
    },
  ]
  const messages = sanitizeMessagesForExternalAi(rawMessages)
  logCoraExternalAiCall({
    feature: "faculty-playbook-enrich",
    messageCount: messages.length,
    promptChars: messages.reduce((n, m) => n + m.content.length, 0),
  })
  const { content } = await createWithFallback(openai, {
    model: process.env.OPENAI_DEFAULT_MODEL,
    temperature: 0.3,
    max_tokens: 1800,
    response_format: { type: "json_object" },
    messages,
  })
  const parsed = JSON.parse(String(content ?? "{}")) as {
    insights?: FacultyCoraPlaybookInsight[]
    capabilities?: Record<string, FacultyCoraPlaybookCapability>
  }
  const capabilities: Record<string, FacultyCoraPlaybookCapability> = {}
  for (const id of CAPABILITY_IDS) {
    const generated = parsed.capabilities?.[id]
    capabilities[id] = {
      prompts: uniquePrompts(generated?.prompts ?? scan.capabilities[id]?.prompts ?? []),
      relatedModuleIds:
        generated?.relatedModuleIds?.filter(Boolean).slice(0, 4) ?? scan.capabilities[id]?.relatedModuleIds ?? [],
    }
  }
  return {
    ...scan,
    source: "llm",
    generatedAt: new Date().toISOString(),
    insights: Array.isArray(parsed.insights) && parsed.insights.length ? parsed.insights.slice(0, 4) : scan.insights,
    capabilities,
  }
}

export async function generateFacultyCoraPlaybook(input: {
  instructorId: number
  courseId: number
  courseCode: string | null
  courseTitle: string | null
  refresh?: boolean
  context?: FacultyCoraContextPayload
}): Promise<FacultyCoraPlaybook> {
  if (!input.refresh) {
    const cached = await loadCachedPlaybook(input.instructorId, input.courseId)
    if (cached) return cached
  }

  const [ctx, inventory] = await Promise.all([
    input.context
      ? Promise.resolve(input.context)
      : fetchFacultyContextForCora({
          courseId: input.courseId,
          instructorId: input.instructorId,
          courseCode: input.courseCode,
          courseTitle: input.courseTitle,
        }),
    scanFacultyCoraInventory(input.courseId),
  ])

  try {
    const { listFacultyCoraThreads } = await import("@/lib/cora/faculty-cora-threads")
    const threads = await listFacultyCoraThreads({
      instructorId: input.instructorId,
      courseId: input.courseId,
    })
    inventory.facultyThreadTitles = threads.threads
      .map((thread) => thread.title)
      .filter((title): title is string => Boolean(title))
      .slice(0, 6)
  } catch {
    /* chats optional */
  }

  const scan = buildScanPlaybook(ctx, inventory)
  let playbook = scan
  try {
    playbook = await enrichPlaybookWithLlm(scan, ctx, inventory)
  } catch {
    playbook = scan
  }
  await savePlaybook(input.instructorId, input.courseId, playbook)
  return playbook
}
