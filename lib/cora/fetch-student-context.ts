import { sql } from "@/lib/db"
import { buildStudentKnowledgeGraph } from "@/lib/cora/student-knowledge-graph"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import { getEffectiveMembershipTier, getAITutorCredits } from "@/lib/membership"
import type { MembershipTier } from "@/lib/membership-constants"

export type CoraStudentContextPayload = {
  profile: Record<string, unknown>
  account?: {
    studentDbId: number
    studentCode?: string | null
    fullName?: string | null
    section?: string | null
    courseCode?: string | null
    courseTitle?: string | null
  }
  membership?: {
    tier: MembershipTier
    aiTutorCredits: number
    trialDaysRemaining?: number | null
  }
  grades?: {
    session?: string | null
    totalScore?: number | null
    quizScore?: number | null
    homeworkScore?: number | null
    midtermScore?: number | null
    finalScore?: number | null
    attendanceScore?: number | null
    engagementCredits?: number | null
  }[]
  announcements?: { id: string; title: string; createdAt?: string | null }[]
  flashcardDecks?: { id: string; title: string; cardCount?: number }[]
  digitalNotes?: { id: string; title: string; updatedAt?: string | null }[]
  practiceAttempts: unknown[]
  playgroundResults: unknown[]
  quizAttempts: unknown[]
  codebenchSubmissions: unknown[]
  lectureProgress: unknown[]
  topicMastery: { topic: string; mastery: number; status?: string }[]
  calendarEvents: {
    id: string
    title: string
    start: string
    end: string | null
    eventType: string | null
    isCompleted: boolean
  }[]
  upcomingAssessments: {
    id: string
    title: string
    type: string
    dueDate: string | null
    opensAt: string | null
    status: "open"
  }[]
  missedDeadlines: {
    id: string
    title: string
    type: string
    dueDate: string | null
    status: "past_due"
  }[]
  notifications: unknown[]
  knowledgeGraph: ReturnType<typeof buildStudentKnowledgeGraph>
  strugglingTopics: string[]
  strengths: string[]
  summary: Record<string, number>
  syncedAt: string
}

type RawStudentContextLecture = {
  lecture_id: number
  title: string
  status?: string
  last_accessed?: string
  week?: number
}

/** Loads full CourseCollab student context from the database for Cora prompts. */
export async function getStudentContextForCora(studentIdNum: number): Promise<CoraStudentContextPayload> {
  const profileResult = await sql`
    SELECT * FROM student_learning_profile
    WHERE student_id = ${studentIdNum}
  `

  let profile = profileResult[0]

  try {
    await sql`SELECT update_student_learning_profile(${studentIdNum})`
    const updatedProfile = await sql`
      SELECT * FROM student_learning_profile
      WHERE student_id = ${studentIdNum}
    `
    if (updatedProfile[0]) profile = updatedProfile[0]
  } catch (profileError) {
    console.warn("[cora/student-context] update_student_learning_profile skipped:", profileError)
  }

  const practiceAttempts = await sql`
    SELECT 
      pa.id,
      pa.topics,
      pa.difficulty,
      pa.score_percentage,
      pa.completed_at,
      paa.bank_question_id,
      paa.is_correct,
      qb.topic
    FROM practice_attempts pa
    LEFT JOIN practice_answers paa ON pa.id = paa.attempt_id
    LEFT JOIN question_bank qb ON paa.bank_question_id = qb.id
    WHERE pa.student_id = ${studentIdNum}
      AND pa.completed_at IS NOT NULL
    ORDER BY pa.completed_at DESC
    LIMIT 10
  `

  let playgroundResults: unknown[] = []
  try {
    playgroundResults = await sql`
      SELECT 
        pr.id,
        pr.score,
        pr.questions_answered,
        pr.correct_answers,
        pr.completed_at,
        pa.playground_question_id,
        pa.is_correct,
        qb.topic
      FROM playground_results pr
      JOIN playground_sessions ps ON pr.session_id = ps.id
      LEFT JOIN playground_answers pa ON pr.id = pa.result_id
      LEFT JOIN playground_questions pq ON COALESCE(pa.playground_question_id, pa.question_id) = pq.id
      LEFT JOIN question_bank qb ON pq.bank_question_id = qb.id
      WHERE pr.student_id::INTEGER = ${studentIdNum}
        AND pr.completed_at IS NOT NULL
      ORDER BY pr.completed_at DESC
      LIMIT 10
    `
  } catch (playgroundError) {
    console.warn("[cora/student-context] playground query skipped:", playgroundError)
  }

  const quizAttempts = await sql`
    SELECT 
      qa.id,
      qa.quiz_id,
      q.title,
      q.assessment_type,
      qa.score,
      qa.total_questions,
      qa.completed_at,
      qans.question_id,
      qans.is_correct,
      qq.topic
    FROM quiz_attempts qa
    JOIN quizzes q ON qa.quiz_id = q.id
    LEFT JOIN quiz_answers qans ON qa.id = qans.attempt_id
    LEFT JOIN quiz_questions qq ON qans.question_id = qq.id
    WHERE qa.student_id = ${studentIdNum}
      AND qa.completed_at IS NOT NULL
      AND q.assessment_type IN ('quiz', 'homework', 'mid_semester', 'final')
    ORDER BY qa.completed_at DESC
    LIMIT 20
  `

  const codebenchSubmissions = await sql`
    SELECT 
      id,
      assignment_id,
      score,
      points_awarded,
      status,
      authenticity_score,
      ai_suspicion,
      submitted_at,
      feedback
    FROM codebench_submissions
    WHERE student_id = ${studentIdNum}
      AND submitted_at IS NOT NULL
    ORDER BY submitted_at DESC
    LIMIT 10
  `

  const lectureProgress = await sql`
    SELECT 
      lsp.lecture_id,
      l.title,
      lsp.status,
      lsp.last_accessed,
      l.week
    FROM lecture_student_progress lsp
    JOIN lectures l ON lsp.lecture_id = l.id
    WHERE lsp.student_id = ${studentIdNum}
    ORDER BY lsp.last_accessed DESC
    LIMIT 10
  `

  const courseCtx = await resolveStudentCourseContextByDbId(studentIdNum)
  const courseId = courseCtx?.courseId ?? null

  let topicMastery: { topic: string; mastery: number; status?: string }[] = []
  try {
    topicMastery = (await sql`
      SELECT topic, mastery_percentage as mastery
      FROM ai_tutor_topic_mastery
      WHERE student_id = ${studentIdNum}
      ORDER BY mastery_percentage ASC
      LIMIT 20
    `) as { topic: string; mastery: number; status?: string }[]
  } catch {
    /* table may not exist */
  }

  let calendarEvents: unknown[] = []
  try {
    calendarEvents = await sql`
      SELECT
        id,
        title,
        start_time as start,
        end_time as end,
        event_type,
        is_completed,
        reminder_minutes
      FROM calendar_events
      WHERE student_id = ${studentIdNum}
        AND start_time >= NOW() - INTERVAL '30 days'
        AND start_time <= NOW() + INTERVAL '90 days'
      ORDER BY start_time ASC
      LIMIT 40
    `
  } catch (calendarError) {
    console.warn("[cora/student-context] calendar query skipped:", calendarError)
  }

  let upcomingAssessments: unknown[] = []
  let missedDeadlines: unknown[] = []
  if (courseId) {
    try {
      upcomingAssessments = await sql`
        SELECT
          q.id,
          q.title,
          q.assessment_type as type,
          q.available_from as opens_at,
          q.available_until as due_date
        FROM quizzes q
        WHERE q.course_id = ${courseId}
          AND q.deleted_at IS NULL
          AND (q.available_until IS NULL OR q.available_until >= NOW())
        ORDER BY q.available_until ASC NULLS LAST
        LIMIT 20
      `
    } catch (assessmentError) {
      console.warn("[cora/student-context] upcoming assessments skipped:", assessmentError)
    }

    try {
      missedDeadlines = await sql`
        SELECT
          q.id,
          q.title,
          q.assessment_type as type,
          q.available_until as due_date
        FROM quizzes q
        WHERE q.course_id = ${courseId}
          AND q.deleted_at IS NULL
          AND q.available_until IS NOT NULL
          AND q.available_until < NOW()
          AND NOT EXISTS (
            SELECT 1 FROM quiz_attempts qa
            WHERE qa.quiz_id = q.id
              AND qa.student_id = ${studentIdNum}
              AND qa.completed_at IS NOT NULL
          )
        ORDER BY q.available_until DESC
        LIMIT 15
      `
    } catch (missedError) {
      console.warn("[cora/student-context] missed deadlines skipped:", missedError)
    }
  }

  let notifications: unknown[] = []
  try {
    notifications = await sql`
      SELECT id, type, title, message, is_read, created_at
      FROM notifications
      WHERE student_id = ${studentIdNum}
      ORDER BY created_at DESC
      LIMIT 20
    `
  } catch (notificationError) {
    console.warn("[cora/student-context] notifications skipped:", notificationError)
  }

  const strugglingTopics = new Set<string>()
  const strengths = new Set<string>()

  practiceAttempts.forEach((attempt: Record<string, unknown>) => {
    const score = Number(attempt.score_percentage) || 0
    const topic = attempt.topic as string | undefined
    const topics = attempt.topics as string[] | undefined
    if (score < 70) {
      if (topic) strugglingTopics.add(topic)
      topics?.forEach((t) => {
        if (score < 70) strugglingTopics.add(t)
        else strengths.add(t)
      })
    } else if (score >= 80) {
      if (topic) strengths.add(topic)
      topics?.forEach((t) => strengths.add(t))
    }
  })

  quizAttempts.forEach((attempt: Record<string, unknown>) => {
    const score = Number(attempt.score) || 0
    const total = Number(attempt.total_questions) || 1
    const scorePercent = (score / total) * 100
    const topic = attempt.topic as string | undefined
    if (scorePercent < 70 && topic) strugglingTopics.add(topic)
    else if (scorePercent >= 80 && topic) strengths.add(topic)
  })

  const upcomingAssessmentsNormalized = (upcomingAssessments as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? "Assessment"),
    type: String(row.type ?? "quiz"),
    dueDate: row.due_date ? String(row.due_date) : null,
    opensAt: row.opens_at ? String(row.opens_at) : null,
    status: "open" as const,
  }))

  const missedDeadlinesNormalized = (missedDeadlines as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? "Assessment"),
    type: String(row.type ?? "quiz"),
    dueDate: row.due_date ? String(row.due_date) : null,
    status: "past_due" as const,
  }))

  const calendarEventsNormalized = (calendarEvents as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? "Event"),
    start: String(row.start ?? ""),
    end: row.end ? String(row.end) : null,
    eventType: row.event_type ? String(row.event_type) : null,
    isCompleted: row.is_completed === true,
  }))

  const knowledgeGraph = buildStudentKnowledgeGraph({
    strugglingTopics: Array.from(strugglingTopics),
    strengths: Array.from(strengths),
    topicMastery,
    upcomingAssessments: upcomingAssessmentsNormalized,
    missedDeadlines: missedDeadlinesNormalized,
    calendarEvents: calendarEventsNormalized,
    lectureProgress: lectureProgress as RawStudentContextLecture[],
    notifications: notifications as {
      id: number
      title: string
      type?: string
      is_read?: boolean
      created_at?: string
    }[],
  })

  const summaryRecord = profile as Record<string, unknown> | undefined

  let account: CoraStudentContextPayload["account"]
  let membership: CoraStudentContextPayload["membership"]
  let grades: CoraStudentContextPayload["grades"] = []
  let announcements: CoraStudentContextPayload["announcements"] = []
  let flashcardDecks: CoraStudentContextPayload["flashcardDecks"] = []
  let digitalNotes: CoraStudentContextPayload["digitalNotes"] = []

  try {
    const studentRows = await sql`
      SELECT s.id, s.student_id, s.full_name, s.section, s.trial_start_date,
             c.course_code, c.course_title
      FROM students s
      LEFT JOIN courses c ON c.id = s.course_id
      WHERE s.id = ${studentIdNum}
      LIMIT 1
    `
    const row = studentRows[0] as Record<string, unknown> | undefined
    if (row) {
      account = {
        studentDbId: studentIdNum,
        studentCode: row.student_id ? String(row.student_id) : null,
        fullName: row.full_name ? String(row.full_name) : null,
        section: row.section ? String(row.section) : null,
        courseCode: row.course_code ? String(row.course_code) : null,
        courseTitle: row.course_title ? String(row.course_title) : null,
      }
      let trialDaysRemaining: number | null = null
      if (row.trial_start_date) {
        const trialStart = new Date(String(row.trial_start_date))
        const days = Math.floor((Date.now() - trialStart.getTime()) / (1000 * 60 * 60 * 24))
        trialDaysRemaining = Math.max(0, 7 - days)
      }
      const tier = await getEffectiveMembershipTier(studentIdNum)
      const aiTutorCredits = await getAITutorCredits(studentIdNum)
      membership = { tier, aiTutorCredits, trialDaysRemaining }
    }
  } catch (accountError) {
    console.warn("[cora/student-context] account/membership skipped:", accountError)
  }

  try {
    const gradeRows = await sql`
      SELECT session, total_score, quiz_score, homework_score, midterm_score,
             final_score, attendance_score, engagement_credits
      FROM student_grades
      WHERE student_id = ${studentIdNum}
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 3
    `
    grades = (gradeRows as Record<string, unknown>[]).map((g) => ({
      session: g.session ? String(g.session) : null,
      totalScore: g.total_score != null ? Number(g.total_score) : null,
      quizScore: g.quiz_score != null ? Number(g.quiz_score) : null,
      homeworkScore: g.homework_score != null ? Number(g.homework_score) : null,
      midtermScore: g.midterm_score != null ? Number(g.midterm_score) : null,
      finalScore: g.final_score != null ? Number(g.final_score) : null,
      attendanceScore: g.attendance_score != null ? Number(g.attendance_score) : null,
      engagementCredits: g.engagement_credits != null ? Number(g.engagement_credits) : null,
    }))
  } catch (gradeError) {
    console.warn("[cora/student-context] grades skipped:", gradeError)
  }

  if (courseId) {
    try {
      const announcementRows = await sql`
        SELECT id, title, created_at
        FROM announcements
        WHERE course_id = ${courseId}
        ORDER BY created_at DESC
        LIMIT 8
      `
      announcements = (announcementRows as Record<string, unknown>[]).map((a) => ({
        id: String(a.id),
        title: String(a.title ?? "Announcement"),
        createdAt: a.created_at ? String(a.created_at) : null,
      }))
    } catch {
      /* optional */
    }
  }

  try {
    const deckRows = await sql`
      SELECT d.id, d.title, COUNT(c.id)::int AS card_count
      FROM flashcard_decks d
      LEFT JOIN flashcard_cards c ON c.deck_id = d.id AND c.deleted_at IS NULL
      WHERE d.student_id = ${studentIdNum}
        AND d.deleted_at IS NULL
      GROUP BY d.id, d.title
      ORDER BY d.updated_at DESC NULLS LAST
      LIMIT 12
    `
    flashcardDecks = (deckRows as Record<string, unknown>[]).map((d) => ({
      id: String(d.id),
      title: String(d.title ?? "Deck"),
      cardCount: Number(d.card_count) || 0,
    }))
  } catch {
    /* table naming may vary */
  }

  try {
    const noteRows = await sql`
      SELECT id, title, updated_at
      FROM student_digital_notes
      WHERE student_id = ${studentIdNum}
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 12
    `
    digitalNotes = (noteRows as Record<string, unknown>[]).map((n) => ({
      id: String(n.id),
      title: String(n.title ?? "Note"),
      updatedAt:
        n.updated_at instanceof Date
          ? n.updated_at.toISOString()
          : n.updated_at
            ? String(n.updated_at)
            : null,
    }))
  } catch {
    /* optional */
  }

  return {
    profile: profile || {},
    account,
    membership,
    grades,
    announcements,
    flashcardDecks,
    digitalNotes,
    practiceAttempts,
    playgroundResults,
    quizAttempts,
    codebenchSubmissions,
    lectureProgress,
    topicMastery,
    calendarEvents: calendarEventsNormalized,
    upcomingAssessments: upcomingAssessmentsNormalized,
    missedDeadlines: missedDeadlinesNormalized,
    notifications,
    knowledgeGraph,
    strugglingTopics: Array.from(strugglingTopics),
    strengths: Array.from(strengths),
    summary: {
      totalPracticeAttempts: Number(summaryRecord?.practice_attempts_count) || 0,
      avgPracticeScore: Number(summaryRecord?.practice_avg_score) || 0,
      totalPlaygroundGames: Number(summaryRecord?.playground_games_count) || 0,
      avgPlaygroundScore: Number(summaryRecord?.playground_avg_score) || 0,
      lecturesViewed: Number(summaryRecord?.lectures_viewed_count) || 0,
      lecturesCompleted: Number(summaryRecord?.lectures_completed_count) || 0,
      totalQuizAttempts: Number(summaryRecord?.quiz_attempts_count) || 0,
      avgQuizScore: Number(summaryRecord?.quiz_avg_score) || 0,
      totalHomeworkAttempts: Number(summaryRecord?.homework_attempts_count) || 0,
      avgHomeworkScore: Number(summaryRecord?.homework_avg_score) || 0,
      totalMidSemesterAttempts: Number(summaryRecord?.mid_semester_attempts_count) || 0,
      avgMidSemesterScore: Number(summaryRecord?.mid_semester_avg_score) || 0,
      totalFinalExamAttempts: Number(summaryRecord?.final_exam_attempts_count) || 0,
      avgFinalExamScore: Number(summaryRecord?.final_exam_avg_score) || 0,
      totalCodebenchSubmissions: Number(summaryRecord?.codebench_submissions_count) || 0,
      avgCodebenchScore: Number(summaryRecord?.codebench_avg_score) || 0,
    },
    syncedAt: new Date().toISOString(),
  }
}
