import type { StudentKnowledgeGraph } from "@/lib/cora/student-knowledge-graph"

export type CoraChatFlow = "study_plan" | "calendar_assistant" | "weekly_review" | "exam_countdown"

export const STUDY_PLAN_GENERATION_PROMPT = `Create a personalized study plan for me based on my CourseCollab learning profile, upcoming assessments, calendar commitments, and mastery gaps.

Structure your response with:
1. **This week overview** — realistic daily focus (30–90 min blocks)
2. **Priority topics** — tied to my weak areas and upcoming due dates (name specific topics for flashcards + Practice Hub)
3. **Daily schedule** — Mon–Sun with specific tasks including:
   - Lecture review
   - **Practice Hub** sessions (topic + question goal)
   - **Flashcard review** blocks for weak topics
4. **Assessment prep** — what to do before each upcoming quiz/homework/exam
5. **Checkpoints** — how I'll know I'm on track

Cora will automatically create flashcard decks, Practice Hub quizzes, calendar sessions, and save this plan to My Notes — so be specific about topics and timing.

Keep it achievable for a busy student. Use my actual data — do not invent grades or deadlines. Do NOT ask me to paste or upload anything. Output the plan in chat only — I will save resources myself in the app.`

export const CALENDAR_ASSISTANT_PROMPT = `You already have my full CourseCollab profile loaded (calendar, assessments, reminders, alerts, missed deadlines).

Give me a detailed schedule briefing now:
1. **This week** — events and due dates with specific titles and dates
2. **Missed deadlines** — anything past due I should address first
3. **Next major due** — nearest exam, homework, or quiz
4. **Study sessions** — what's on my calendar
5. **Alerts** — unread notifications worth acting on
6. **Priority plan** — top 3 actions for the next 48 hours

Use ONLY my CourseCollab data. Do NOT ask me to paste or upload anything. If a section is empty in my data, say "None on record" and suggest where to check in CourseCollab.`

export const WEEKLY_REVIEW_PROMPT = `Run a weekly review using my CourseCollab data already loaded in your context.

Summarize:
- What I completed this week (assessments, lectures, practice)
- Topics that still need work
- What to prioritize next week
- One concrete 30-minute action for tomorrow`

export const EXAM_COUNTDOWN_PROMPT = `Help me prepare for my next major assessment using my CourseCollab timeline.

Identify the nearest exam or high-stakes quiz, then build a countdown plan (days remaining → daily tasks). Include recovery steps if I'm behind.`

export function buildFlowSystemPromptAppendix(
  flow: CoraChatFlow | undefined,
  _knowledgeGraph?: StudentKnowledgeGraph | null,
): string {
  if (!flow) return ""

  switch (flow) {
    case "study_plan":
      return `
CORa WORKFLOW: Study Plan Generation
- You are generating a structured, personalized study plan (not a casual chat).
- You ALREADY have the student's full CourseCollab profile in the system prompt (calendar, assessments, mastery, notifications).
- Use ONLY that data — never invent grades or deadlines.
- Name concrete weak topics — suggest flashcard decks and Practice Hub sessions the student can create in the app.
- Include flashcard review blocks and Practice Hub sessions in the daily schedule.
- NEVER ask the student to paste calendar data, upload screenshots, or manually provide deadlines.
- NEVER claim you created notes, calendar events, or decks — output the plan only.
- After the plan, end with a short "**Next steps**" section listing what to do in the app (My Notes, Calendar, Flashcards, Practice Hub).
- Do NOT ask them to pick modes or personalities.`

    case "calendar_assistant":
      return `
CORa WORKFLOW: Calendar Assistant
- You ALREADY have live read access to the student's CourseCollab calendar events, assessment due dates, notifications, and missed deadlines in the system prompt.
- On the FIRST message, deliver a complete schedule briefing immediately — do not ask what to look up first.
- NEVER ask the student to paste events, upload screenshots, or provide calendar exports.
- Answer with specific dates, titles, and actionable reminders from the loaded data.
- Proactively flag missed deadlines and unread alerts.
- If a data section is empty, state that clearly (e.g. "No calendar events on record") — do not claim you lack database access.
- If asked to add events, describe what you would schedule and ask them to confirm — do not claim events were created unless the platform confirmed it.`

    case "weekly_review":
      return `
CORa WORKFLOW: Weekly Review
- Summarize progress from the CourseCollab data already in the system prompt; be honest about gaps.
- NEVER ask the student to provide data manually.
- End with 3 prioritized actions for next week.`

    case "exam_countdown":
      return `
CORa WORKFLOW: Exam Countdown
- Find the nearest high-stakes assessment from the timeline in the system prompt.
- Build a day-by-day countdown with recovery options if behind.
- NEVER ask the student to paste due dates or assessment lists.`

    default:
      return ""
  }
}

export const SCHEDULE_STUDY_PLAN_FOLLOWUP_PROMPT = `Based on the study plan above, propose specific calendar study sessions for the next 2 weeks.

For each session list:
- Date and start time (respect my existing calendar commitments)
- Duration (45–90 min)
- Topic and activities

Format as a numbered list. Ask me to confirm before anything is added to my calendar.`
