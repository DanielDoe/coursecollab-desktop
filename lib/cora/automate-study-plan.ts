import OpenAI from "openai"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import { createNotification } from "@/lib/create-notification"
import {
  exportChatToDigitalNote,
  createFlashcardsFromTopic,
  createPracticeQuiz,
} from "@/lib/cora/run-workspace-action"
import type { CoraWorkspaceActionMessage } from "@/lib/cora/workspace-actions"

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export type StudyPlanSessionDraft = {
  date: string
  startTime: string
  durationMinutes: number
  topic: string
  activities?: string
  activityType?: "study" | "flashcards" | "practice_hub"
}

export type StudyPlanResourceDraft = {
  deckId?: number
  deckTitle?: string
  cardCount?: number
  attemptId?: number
  topic?: string
  questionCount?: number
  href?: string
}

export type AutomateStudyPlanResult = {
  noteId: number
  noteTitle: string
  planId: number | null
  eventsCreated: number
  sessionsScheduled: number
  reminderMinutes: number
  flashcardDecks: StudyPlanResourceDraft[]
  practiceQuizzes: StudyPlanResourceDraft[]
  focusTopics: string[]
  href: string
  message: string
}

function normalizeMessages(
  messages: Array<Partial<CoraWorkspaceActionMessage> & { role?: string; content: string }>,
): CoraWorkspaceActionMessage[] {
  return messages.map((m, index) => ({
    id: m.id ?? `msg-${index}`,
    content: m.content,
    timestamp: m.timestamp ?? new Date().toISOString(),
    role: m.role === "user" || m.role === "student" ? "student" : "ai",
  }))
}

function studyPlanContentFromMessages(messages: CoraWorkspaceActionMessage[]): string {
  const assistant = [...messages]
    .reverse()
    .find((m) => m.role === "ai" || (m as { role?: string }).role === "assistant")
  return assistant?.content?.trim() ?? messages.map((m) => m.content).join("\n\n")
}

async function loadStudentFocusTopics(studentDbId: number): Promise<string[]> {
  const topics = new Set<string>()

  try {
    const profileRows = (await sql`
      SELECT
        overall_weaknesses,
        assessment_struggling_topics,
        practice_struggling_topics,
        codebench_struggling_concepts
      FROM student_learning_profile
      WHERE student_id = ${studentDbId}
      LIMIT 1
    `) as Array<{
      overall_weaknesses?: string[] | null
      assessment_struggling_topics?: string[] | null
      practice_struggling_topics?: string[] | null
      codebench_struggling_concepts?: string[] | null
    }>

    const profile = profileRows[0]
    for (const list of [
      profile?.overall_weaknesses,
      profile?.assessment_struggling_topics,
      profile?.practice_struggling_topics,
      profile?.codebench_struggling_concepts,
    ]) {
      for (const topic of list ?? []) {
        if (topic?.trim()) topics.add(topic.trim())
      }
    }
  } catch {
    /* profile optional */
  }

  try {
    const masteryRows = (await sql`
      SELECT topic FROM ai_tutor_topic_mastery
      WHERE student_id = ${studentDbId} AND mastery_percentage < 70
      ORDER BY mastery_percentage ASC
      LIMIT 8
    `) as { topic: string }[]
    for (const row of masteryRows) {
      if (row.topic?.trim()) topics.add(row.topic.trim())
    }
  } catch {
    /* mastery table optional */
  }

  return [...topics].slice(0, 6)
}

type ParsedStudyPlan = {
  sessions: StudyPlanSessionDraft[]
  focusTopics: string[]
}

async function parseStudyPlanWithAi(
  planText: string,
  existingEventCount: number,
  profileTopics: string[],
): Promise<ParsedStudyPlan> {
  if (!openai) {
    return {
      sessions: buildFallbackSessions(planText),
      focusTopics: profileTopics.slice(0, 3),
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const topicHint =
    profileTopics.length > 0 ? `Student weak topics: ${profileTopics.join(", ")}` : "Infer topics from the plan."

  const { content } = await createForFeature(openai, "summary", {
    messages: [
      {
        role: "system",
        content: `Extract a study plan automation payload from Cora's study plan. Return JSON only:
{
  "focusTopics": ["topic1", "topic2"],
  "sessions": [
    {
      "date": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "durationMinutes": 60,
      "topic": "Topic name",
      "activities": "Brief activity list",
      "activityType": "study" | "flashcards" | "practice_hub"
    }
  ]
}
Rules:
- Today is ${today}. Sessions within the next 14 days only.
- ${topicHint}
- Include 2–4 focusTopics max (prioritize weak areas).
- Mix session types: at least 1 flashcards and 1 practice_hub session if topics exist.
- activityType flashcards = review Cora flashcard deck; practice_hub = Practice Hub quiz.
- Max 14 sessions. Use 24h HH:MM times.
- Existing calendar commitments: ${existingEventCount}.`,
      },
      {
        role: "user",
        content: planText.slice(0, 12000),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 2800,
  })

  try {
    const parsed = JSON.parse(content || "{}") as {
      sessions?: StudyPlanSessionDraft[]
      focusTopics?: string[]
    }
    const sessions = (parsed.sessions ?? []).filter(
      (s) => s.date && s.startTime && s.topic && Number(s.durationMinutes) > 0,
    )
    const focusTopics = [...new Set([...(parsed.focusTopics ?? []), ...profileTopics])]
      .filter(Boolean)
      .slice(0, 4)

    if (sessions.length > 0) {
      return { sessions: sessions.slice(0, 14), focusTopics }
    }
  } catch {
    /* fall through */
  }

  return {
    sessions: buildFallbackSessions(planText),
    focusTopics: profileTopics.slice(0, 3),
  }
}

async function parseStudySessionsWithAi(
  planText: string,
  existingEventCount: number,
  profileTopics: string[] = [],
): Promise<ParsedStudyPlan> {
  return parseStudyPlanWithAi(planText, existingEventCount, profileTopics)
}

function buildFallbackSessions(planText: string): StudyPlanSessionDraft[] {
  const sessions: StudyPlanSessionDraft[] = []
  const now = new Date()

  for (let day = 0; day < 7; day += 1) {
    const d = new Date(now)
    d.setDate(d.getDate() + day + 1)
    if (d.getDay() === 0 || d.getDay() === 6) continue

    sessions.push({
      date: d.toISOString().slice(0, 10),
      startTime: "17:00",
      durationMinutes: 60,
      topic: `Study block · Day ${day + 1}`,
      activities: planText.slice(0, 200).replace(/\n+/g, " "),
    })
  }

  return sessions.slice(0, 5)
}

async function createStudyPlanLearningResources(
  studentDbId: number,
  focusTopics: string[],
  messages: CoraWorkspaceActionMessage[],
): Promise<{ flashcardDecks: StudyPlanResourceDraft[]; practiceQuizzes: StudyPlanResourceDraft[] }> {
  const flashcardDecks: StudyPlanResourceDraft[] = []
  const practiceQuizzes: StudyPlanResourceDraft[] = []

  const topics = focusTopics.filter(Boolean).slice(0, 3)
  if (topics.length === 0) return { flashcardDecks, practiceQuizzes }

  for (const topic of topics.slice(0, 2)) {
    try {
      const deck = await createFlashcardsFromTopic(studentDbId, topic, messages)
      flashcardDecks.push({
        deckId: deck.deckId,
        deckTitle: deck.title,
        cardCount: deck.cardCount,
        topic,
        href: deck.href,
      })
    } catch (err) {
      console.warn("[automate-study-plan] flashcards skipped:", topic, err)
    }
  }

  for (const topic of topics.slice(0, 2)) {
    try {
      const quiz = await createPracticeQuiz(studentDbId, topic, { count: 10, difficulty: "mixed" })
      practiceQuizzes.push({
        attemptId: quiz.attemptId,
        topic: quiz.topic,
        questionCount: quiz.questionCount,
        href: quiz.href,
      })
    } catch (err) {
      console.warn("[automate-study-plan] practice quiz skipped:", topic, err)
    }
  }

  return { flashcardDecks, practiceQuizzes }
}

function sessionCalendarTitle(session: StudyPlanSessionDraft): string {
  if (session.activityType === "flashcards") return `Flashcards: ${session.topic}`
  if (session.activityType === "practice_hub") return `Practice Hub: ${session.topic}`
  return `Study: ${session.topic}`
}

function sessionCalendarDescription(
  session: StudyPlanSessionDraft,
  resources: { flashcardDecks: StudyPlanResourceDraft[]; practiceQuizzes: StudyPlanResourceDraft[] },
): string {
  const base = session.activities?.trim() ?? ""
  if (session.activityType === "flashcards") {
    const deck = resources.flashcardDecks.find((d) => d.topic === session.topic)
    return [base, deck ? `Deck: ${deck.deckTitle} (${deck.cardCount} cards)` : "Review your Cora flashcard deck"]
      .filter(Boolean)
      .join(" · ")
  }
  if (session.activityType === "practice_hub") {
    const quiz = resources.practiceQuizzes.find((q) => q.topic === session.topic)
    return [
      base,
      quiz ? `Practice quiz ready: ${quiz.questionCount} questions on ${quiz.topic}` : "Open Practice Hub",
    ]
      .filter(Boolean)
      .join(" · ")
  }
  return base
}

async function ensureStudyPlanSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS ai_study_plans (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL,
      plan_type TEXT NOT NULL DEFAULT 'cora_generated',
      target_date TIMESTAMPTZ,
      plan_data JSONB,
      is_active BOOLEAN DEFAULT true,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS calendar_reminder_dispatches (
      id SERIAL PRIMARY KEY,
      calendar_event_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (calendar_event_id)
    )
  `
}

export async function automateStudyPlanFromChat(
  studentDbId: number,
  messages: CoraWorkspaceActionMessage[],
  options?: {
    title?: string
    reminderMinutes?: number
    skipNote?: boolean
  },
): Promise<AutomateStudyPlanResult> {
  await ensureStudyPlanSchema()

  const normalized = normalizeMessages(messages)
  const planText = studyPlanContentFromMessages(normalized)
  if (!planText.trim()) {
    throw new Error("No study plan content to automate")
  }

  const reminderMinutes = options?.reminderMinutes ?? 30

  const existingEvents = (await sql`
    SELECT id FROM calendar_events
    WHERE student_id = ${studentDbId}
      AND start_time >= NOW()
      AND start_time <= NOW() + INTERVAL '14 days'
  `) as { id: number }[]

  const profileTopics = await loadStudentFocusTopics(studentDbId)
  const parsed = await parseStudySessionsWithAi(planText, existingEvents.length, profileTopics)
  const { sessions, focusTopics } = parsed

  let noteId = 0
  let noteTitle = options?.title?.trim() || "My Study Plan"

  if (!options?.skipNote) {
    const noteResult = await exportChatToDigitalNote(studentDbId, normalized, noteTitle)
    noteId = noteResult.noteId
    noteTitle = noteResult.title
  }

  const { flashcardDecks, practiceQuizzes } = await createStudyPlanLearningResources(
    studentDbId,
    focusTopics,
    normalized,
  )

  let planId: number | null = null
  try {
    const planRows = await sql`
      INSERT INTO ai_study_plans (
        student_id,
        plan_type,
        target_date,
        plan_data,
        is_active,
        expires_at
      ) VALUES (
        ${studentDbId},
        'cora_generated',
        ${sessions.length > 0 ? `${sessions[sessions.length - 1].date}T23:59:59` : null},
        ${JSON.stringify({
          sessions,
          focusTopics,
          flashcardDecks,
          practiceQuizzes,
          source: "cora_automate",
        })},
        true,
        NOW() + INTERVAL '21 days'
      )
      RETURNING id
    `
    planId = Number((planRows[0] as { id: number }).id) || null
  } catch (err) {
    console.warn("[automate-study-plan] ai_study_plans insert skipped:", err)
  }

  let eventsCreated = 0

  for (const session of sessions) {
    const startTimeStr = `${session.date} ${session.startTime}`
    const durationMinutes = Math.max(30, Math.min(120, Math.round(Number(session.durationMinutes) || 60)))
    const title = sessionCalendarTitle(session)
    const description = sessionCalendarDescription(session, { flashcardDecks, practiceQuizzes })
    const eventType =
      session.activityType === "flashcards"
        ? "ai_reminder"
        : session.activityType === "practice_hub"
          ? "study_session"
          : "study_session"
    const color =
      session.activityType === "flashcards"
        ? "#f59e0b"
        : session.activityType === "practice_hub"
          ? "#10b981"
          : "#8b5cf6"

    try {
      await sql`
        INSERT INTO calendar_events (
          student_id,
          title,
          description,
          event_type,
          start_time,
          end_time,
          color,
          reminder_minutes,
          related_id,
          related_type
        ) VALUES (
          ${studentDbId},
          ${title},
          ${description},
          ${eventType},
          ${startTimeStr}::timestamp,
          ${startTimeStr}::timestamp + (${durationMinutes} * INTERVAL '1 minute'),
          ${color},
          ${reminderMinutes},
          ${planId},
          'study_plan'
        )
      `
      eventsCreated += 1
    } catch (err) {
      console.warn("[automate-study-plan] calendar insert failed:", err)
    }
  }

  const resourceParts: string[] = []
  if (flashcardDecks.length > 0) {
    resourceParts.push(
      `${flashcardDecks.length} flashcard deck${flashcardDecks.length === 1 ? "" : "s"} (${flashcardDecks.reduce((n, d) => n + (d.cardCount ?? 0), 0)} cards)`,
    )
  }
  if (practiceQuizzes.length > 0) {
    resourceParts.push(
      `${practiceQuizzes.length} Practice Hub quiz${practiceQuizzes.length === 1 ? "" : "zes"}`,
    )
  }

  const summaryMessage =
    eventsCreated > 0 || resourceParts.length > 0
      ? [
          "Your study plan is ready.",
          eventsCreated > 0
            ? `${eventsCreated} calendar session${eventsCreated === 1 ? "" : "s"} with ${reminderMinutes}-min reminders`
            : null,
          resourceParts.length > 0 ? resourceParts.join(" and ") : null,
          "Saved to My Notes.",
        ]
          .filter(Boolean)
          .join(" ")
      : "Your study plan was saved to My Notes."

  await createNotification({
    studentId: studentDbId,
    type: "calendar",
    title: "Study plan ready",
    message: summaryMessage,
    link: "/module/calendar",
  })

  if (flashcardDecks.length > 0) {
    await createNotification({
      studentId: studentDbId,
      type: "practice",
      title: "Flashcards created for your plan",
      message: `Cora created ${flashcardDecks.length} deck${flashcardDecks.length === 1 ? "" : "s"} for: ${flashcardDecks.map((d) => d.topic).filter(Boolean).join(", ")}.`,
      link: "/module/flashcards",
    })
  }

  if (practiceQuizzes.length > 0) {
    await createNotification({
      studentId: studentDbId,
      type: "practice",
      title: "Practice Hub quizzes ready",
      message: `Cora queued ${practiceQuizzes.length} practice quiz${practiceQuizzes.length === 1 ? "" : "zes"} for your weak topics.`,
      link: "/module/practice",
    })
  }

  return {
    noteId,
    noteTitle,
    planId,
    eventsCreated,
    sessionsScheduled: sessions.length,
    reminderMinutes,
    flashcardDecks,
    practiceQuizzes,
    focusTopics,
    href: "/module/calendar",
    message: summaryMessage,
  }
}

export async function dispatchDueCalendarReminders(): Promise<{ sent: number; scanned: number }> {
  await ensureStudyPlanSchema()

  const dueRows = (await sql`
    SELECT
      ce.id,
      ce.student_id,
      ce.title,
      ce.start_time,
      ce.reminder_minutes,
      ce.event_type
    FROM calendar_events ce
    WHERE ce.reminder_minutes IS NOT NULL
      AND ce.reminder_minutes > 0
      AND ce.start_time > NOW()
      AND ce.start_time - (ce.reminder_minutes * INTERVAL '1 minute') <= NOW() + INTERVAL '20 minutes'
      AND ce.start_time - (ce.reminder_minutes * INTERVAL '1 minute') > NOW() - INTERVAL '20 minutes'
      AND NOT EXISTS (
        SELECT 1 FROM calendar_reminder_dispatches crd
        WHERE crd.calendar_event_id = ce.id
      )
    LIMIT 100
  `) as Array<{
    id: number
    student_id: number
    title: string
    start_time: string
    reminder_minutes: number
    event_type: string
  }>

  let sent = 0

  for (const row of dueRows) {
    const startLabel = new Date(row.start_time).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })

    await createNotification({
      studentId: row.student_id,
      type: "calendar",
      title: row.event_type === "study_session" ? "Study session soon" : "Calendar reminder",
      message: `${row.title} starts at ${startLabel}.`,
      link: `/module/calendar?event=${row.id}`,
    })

    await sql`
      INSERT INTO calendar_reminder_dispatches (calendar_event_id, student_id)
      VALUES (${row.id}, ${row.student_id})
      ON CONFLICT (calendar_event_id) DO NOTHING
    `

    sent += 1
  }

  return { sent, scanned: dueRows.length }
}
