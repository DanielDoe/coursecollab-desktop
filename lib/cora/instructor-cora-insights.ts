import { sql } from "@/lib/db"
import { ensureCoraWorkspaceThreadsSchema } from "@/lib/cora/workspace-conversations.server"
import { ensureCoraAiAccountingSchema } from "@/lib/cora/ai/schema"

export type CoraInsightTurn = {
  studentId: number
  studentName: string
  studentCode: string
  createdAt: Date
  message: string
  topic: string
  module: string
}

const JUNK_TOPICS = new Set([
  "auto-detect",
  "autodetect",
  "auto detect",
  "general",
  "tutor",
  "variables",
  "loops",
  "pointers",
  "functions",
  "unknown",
  "other",
  "none",
  "n/a",
  "na",
  "untitled",
  "chat",
])

const TOPIC_RULES: Array<{ topic: string; re: RegExp }> = [
  { topic: "First-order RC/RL circuits", re: /\b(first[-\s]?order|rc and rl|\brc\b|\brl circuits?)\b/i },
  { topic: "Operational amplifiers", re: /\b(op[-\s]?amps?|operational amplif)/i },
  { topic: "Resistive circuits", re: /\bresistive circuits?\b/i },
  { topic: "Ohm's Law", re: /\bohm'?s?\s*law\b|\bv\s*=\s*ir\b/i },
  { topic: "Kirchhoff's laws (KCL/KVL)", re: /\b(kcl|kvl|kirchhoff)\b/i },
  { topic: "Nodal analysis", re: /\bnodal\b/i },
  { topic: "Mesh analysis", re: /\bmesh\b/i },
  { topic: "Thévenin & Norton", re: /\b(th[eé]venin|norton)\b/i },
  { topic: "Exam prep", re: /\b(prepare for (my )?next exam|upcoming exam|exam review|midterm|final exam)\b/i },
  { topic: "Homework & grades", re: /\b(homeworks?|what i scored|my grade|grades?)\b/i },
  { topic: "Flashcards", re: /\bflashcards?\b|propose_personal_flashcards/i },
  { topic: "Study notes", re: /\b(study notes?|personal note|study guide|learning resource|propose_personal_note)\b/i },
  { topic: "Introduction to programming", re: /\bintroduction to programming\b/i },
  { topic: "Code walkthrough", re: /\b(walk me through this code|trace the execution|debug this code)\b/i },
]

const MODULE_RULES: Array<{ module: string; re: RegExp }> = [
  { module: "Assessments", re: /\b(source:\s*quiz|circuit_submission|question type:|course question|assessment)\b/i },
  { module: "Flashcards", re: /\bflashcards?\b|propose_personal_flashcards/i },
  { module: "Notes", re: /\b(personal note|study notes|propose_personal_note)\b/i },
  { module: "Study Plan", re: /\b(prepare for (my )?next exam|study plan|exam countdown)\b/i },
  { module: "Grades", re: /\b(homeworks?|what i scored|my grade)\b/i },
  { module: "Lectures", re: /\blectures?\b/i },
  { module: "Practice Hub", re: /\bpractice( hub)?\b/i },
  { module: "Code", re: /\b(walk me through this code|trace the execution|debug)\b/i },
  { module: "Cora Assistant", re: /\b(capabilities|hey cora)\b/i },
]

const USAGE_MODULE_LABEL: Record<string, string> = {
  "cora-agent": "Cora Assistant",
  workspace: "Cora Assistant",
  flashcards: "Flashcards",
  notes: "Notes",
  lectures: "Lectures",
  practice: "Practice Hub",
  quizzes: "Assessments",
  "quiz-history": "Assessments",
  dashboard: "Dashboard",
  announcements: "Announcements",
  search: "Course search",
  calendar: "Study Plan",
  "study-plan": "Study Plan",
  code: "Code",
  codebench: "Code",
}

function isJunkTopic(value: string | null | undefined) {
  const t = String(value ?? "").trim().toLowerCase()
  return !t || JUNK_TOPICS.has(t)
}

function cleanChapterTopic(raw: string) {
  return raw
    .replace(/^chapter\s+\d+:\s*/i, "")
    .replace(/\s+submissions$/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function inferCoraTopic(text: string, storedTopic?: string | null): string {
  const blob = String(text ?? "")
  const explicit = blob.match(/topic:\s*([^\n]+)/i)
  if (explicit?.[1]) {
    const cleaned = cleanChapterTopic(explicit[1])
    if (cleaned && !isJunkTopic(cleaned)) return cleaned
  }
  for (const rule of TOPIC_RULES) {
    if (rule.re.test(blob)) return rule.topic
  }
  if (!isJunkTopic(storedTopic)) return String(storedTopic).trim()
  return "Course help"
}

export function inferCoraModule(text: string, usageModule?: string | null): string {
  if (usageModule && USAGE_MODULE_LABEL[usageModule]) return USAGE_MODULE_LABEL[usageModule]
  const blob = String(text ?? "")
  for (const rule of MODULE_RULES) {
    if (rule.re.test(blob)) return rule.module
  }
  return "Cora Assistant"
}

function parseMessages(raw: unknown): Array<{ role?: string; content?: string; timestamp?: string }> {
  if (Array.isArray(raw)) return raw as Array<{ role?: string; content?: string; timestamp?: string }>
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function turnKey(turn: Pick<CoraInsightTurn, "studentId" | "message" | "createdAt">) {
  const day = turn.createdAt.toISOString().slice(0, 10)
  return `${turn.studentId}|${day}|${turn.message.slice(0, 80).toLowerCase()}`
}

export async function loadCoraInsightTurns(input: {
  instructorId: number
  courseId?: number
}): Promise<CoraInsightTurn[]> {
  await Promise.all([
    ensureCoraWorkspaceThreadsSchema().catch(() => undefined),
    ensureCoraAiAccountingSchema().catch(() => undefined),
  ])

  const courseId = input.courseId && Number.isFinite(input.courseId) ? input.courseId : 0
  const instructorId = input.instructorId

  const legacy = courseId
    ? await sql`
        SELECT aic.student_id, aic.message, aic.topic, aic.created_at,
               s.full_name, s.student_id AS student_code
        FROM ai_tutor_conversations aic
        JOIN students s ON s.id = aic.student_id
        JOIN sessions sess ON sess.id = s.session_id
        WHERE sess.course_id = ${courseId}
        ORDER BY aic.created_at DESC
        LIMIT 400
      `.catch(() => [])
    : await sql`
        SELECT aic.student_id, aic.message, aic.topic, aic.created_at,
               s.full_name, s.student_id AS student_code
        FROM ai_tutor_conversations aic
        JOIN students s ON s.id = aic.student_id
        JOIN sessions sess ON sess.id = s.session_id
        JOIN courses c ON c.id = sess.course_id
        WHERE c.instructor_id = ${instructorId}
        ORDER BY aic.created_at DESC
        LIMIT 400
      `.catch(() => [])

  const workspace = courseId
    ? await sql`
        SELECT t.student_id, t.title, t.messages, t.updated_at,
               s.full_name, s.student_id AS student_code
        FROM cora_workspace_threads t
        JOIN students s ON s.id = t.student_id
        JOIN sessions sess ON sess.id = s.session_id
        WHERE sess.course_id = ${courseId}
          AND t.archived_at IS NULL
        ORDER BY t.updated_at DESC
        LIMIT 80
      `.catch(() => [])
    : []

  const turns: CoraInsightTurn[] = []
  const seen = new Set<string>()

  const push = (turn: CoraInsightTurn) => {
    const key = turnKey(turn)
    if (seen.has(key) || !turn.message.trim()) return
    seen.add(key)
    turns.push(turn)
  }

  for (const row of legacy as Array<Record<string, unknown>>) {
    const message = String(row.message ?? "")
    const createdAt = new Date(String(row.created_at))
    push({
      studentId: Number(row.student_id),
      studentName: String(row.full_name ?? "Student"),
      studentCode: String(row.student_code ?? ""),
      createdAt,
      message,
      topic: inferCoraTopic(message, row.topic as string | null),
      module: inferCoraModule(message),
    })
  }

  for (const row of workspace as Array<Record<string, unknown>>) {
    const messages = parseMessages(row.messages)
    const studentMsgs = messages.filter((m) => m.role === "student" || m.role === "user")
    const fallback = studentMsgs.length ? studentMsgs : [{ content: String(row.title ?? ""), timestamp: String(row.updated_at) }]
    for (const msg of fallback) {
      const message = String(msg.content || row.title || "")
      const createdAt = new Date(String(msg.timestamp || row.updated_at))
      push({
        studentId: Number(row.student_id),
        studentName: String(row.full_name ?? "Student"),
        studentCode: String(row.student_code ?? ""),
        createdAt,
        message,
        topic: inferCoraTopic(message),
        module: inferCoraModule(message),
      })
    }
  }

  return turns.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

export function aggregateCoraModules(turns: CoraInsightTurn[]) {
  const map = new Map<string, { questions: number; students: Set<number> }>()
  for (const turn of turns) {
    const row = map.get(turn.module) ?? { questions: 0, students: new Set<number>() }
    row.questions += 1
    row.students.add(turn.studentId)
    map.set(turn.module, row)
  }
  return [...map.entries()]
    .map(([module, row]) => ({
      module,
      questions: row.questions,
      students: row.students.size,
      icon: moduleIcon(module),
      color: moduleColor(module),
    }))
    .sort((a, b) => b.questions - a.questions)
}

export function aggregateCoraTopics(turns: CoraInsightTurn[], limit = 8) {
  const map = new Map<string, { questions: number; students: Map<number, number> }>()
  for (const turn of turns) {
    if (isJunkTopic(turn.topic) || turn.topic === "Course help") continue
    const row = map.get(turn.topic) ?? { questions: 0, students: new Map<number, number>() }
    row.questions += 1
    row.students.set(turn.studentId, (row.students.get(turn.studentId) ?? 0) + 1)
    map.set(turn.topic, row)
  }
  return [...map.entries()]
    .map(([topic, row]) => {
      const struggling_count = [...row.students.values()].filter((n) => n >= 2).length
      const repeatRate = row.questions === 0 ? 0 : struggling_count / Math.max(row.students.size, 1)
      return {
        topic,
        questions: row.questions,
        students: row.students.size,
        mastery: Math.max(35, Math.min(95, Math.round(88 - repeatRate * 40))),
        struggling_count,
      }
    })
    .sort((a, b) => b.questions - a.questions)
    .slice(0, limit)
}

export function weeklyCoraActivity(turns: CoraInsightTurn[]) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const today = new Date()
  const buckets = new Map<string, { questions: number; students: Set<number> }>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    buckets.set(days[d.getDay()]!, { questions: 0, students: new Set() })
  }
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  for (const turn of turns) {
    if (turn.createdAt.getTime() < weekAgo) continue
    const key = days[turn.createdAt.getDay()]!
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.questions += 1
    bucket.students.add(turn.studentId)
  }
  const ordered: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    ordered.push(days[d.getDay()]!)
  }
  return ordered.map((day) => ({
    day,
    questions: buckets.get(day)?.questions ?? 0,
    students: buckets.get(day)?.students.size ?? 0,
  }))
}

export function coraInsightStats(turns: CoraInsightTurn[]) {
  const now30 = Date.now() - 30 * 24 * 60 * 60 * 1000
  const now7 = Date.now() - 7 * 24 * 60 * 60 * 1000
  const prev14 = Date.now() - 14 * 24 * 60 * 60 * 1000
  const recent = turns.filter((t) => t.createdAt.getTime() >= now30)
  const thisWeek = turns.filter((t) => t.createdAt.getTime() >= now7)
  const lastWeek = turns.filter((t) => t.createdAt.getTime() >= prev14 && t.createdAt.getTime() < now7)
  const topics = aggregateCoraTopics(recent, 20)
  const strugglingStudents = new Set<number>()
  const byStudentTopic = new Map<string, number>()
  for (const turn of thisWeek) {
    const key = `${turn.studentId}|${turn.topic}`
    byStudentTopic.set(key, (byStudentTopic.get(key) ?? 0) + 1)
  }
  for (const [key, count] of byStudentTopic) {
    if (count >= 3) strugglingStudents.add(Number(key.split("|")[0]))
  }
  const weeklyGrowth =
    lastWeek.length > 0 ? Math.round(((thisWeek.length - lastWeek.length) / lastWeek.length) * 100) : 0
  return {
    totalQuestions: recent.length,
    activeStudents: new Set(thisWeek.map((t) => t.studentId)).size,
    averageResponseTime: 0,
    satisfactionScore: 0,
    strugglingStudents: strugglingStudents.size,
    weeklyGrowth,
    topTopic: topics[0]?.topic ?? null,
  }
}

export function coraNarrativeInsights(turns: CoraInsightTurn[]) {
  const stats = coraInsightStats(turns)
  const topics = aggregateCoraTopics(turns, 5)
  const modules = aggregateCoraModules(turns)
  const week = weeklyCoraActivity(turns)
  const peak = [...week].sort((a, b) => b.questions - a.questions)[0]
  const insights: Array<{ type: "peak_time" | "misconception" | "recommendation" | "success"; title: string; description: string }> = []

  if (peak && peak.questions > 0) {
    insights.push({
      type: "peak_time",
      title: "Busiest day this week",
      description: `${peak.questions} Cora turns on ${peak.day} from ${peak.students} student${peak.students === 1 ? "" : "s"}`,
    })
  }
  const hot = topics[0]
  if (hot) {
    insights.push({
      type: "misconception",
      title: "Most asked course topic",
      description: `${hot.questions} questions on ${hot.topic}${hot.struggling_count ? ` · ${hot.struggling_count} students came back to it` : ""}`,
    })
  }
  const topModule = modules[0]
  if (topModule) {
    insights.push({
      type: "recommendation",
      title: "Where Cora is used",
      description: `${topModule.questions} turns in ${topModule.module} across ${topModule.students} students`,
    })
  }
  if (stats.activeStudents > 0) {
    insights.push({
      type: "success",
      title: "Active this week",
      description: `${stats.activeStudents} student${stats.activeStudents === 1 ? "" : "s"} used Cora Assistant in the last 7 days`,
    })
  }
  return insights
}

export function coraStruggleRows(turns: CoraInsightTurn[]) {
  const since = Date.now() - 14 * 24 * 60 * 60 * 1000
  const map = new Map<string, CoraInsightTurn & { question_count: number }>()
  for (const turn of turns) {
    if (turn.createdAt.getTime() < since) continue
    if (isJunkTopic(turn.topic) || turn.topic === "Course help") continue
    const key = `${turn.studentId}|${turn.topic}`
    const existing = map.get(key)
    if (existing) {
      existing.question_count += 1
      if (turn.createdAt > existing.createdAt) existing.createdAt = turn.createdAt
    } else {
      map.set(key, { ...turn, question_count: 1 })
    }
  }
  return [...map.values()]
    .filter((row) => row.question_count >= 2)
    .sort((a, b) => b.question_count - a.question_count)
    .slice(0, 50)
    .map((row) => ({
      id: row.studentId,
      student_name: row.studentName,
      student_id: row.studentCode,
      topic: row.topic,
      question_count: row.question_count,
      last_seen: row.createdAt.toLocaleString(),
      severity: row.question_count >= 5 ? "high" : row.question_count >= 3 ? "medium" : "low",
      status: "new",
    }))
}

function moduleIcon(module: string) {
  const map: Record<string, string> = {
    "Cora Assistant": "MessageSquare",
    Lectures: "Presentation",
    "Practice Hub": "Code",
    Assessments: "FileText",
    Code: "Code",
    Flashcards: "Layers",
    Notes: "BookOpen",
    "Study Plan": "Target",
    Grades: "BarChart3",
    Announcements: "Megaphone",
    Dashboard: "LayoutDashboard",
    "Course search": "Search",
  }
  return map[module] ?? "Sparkles"
}

function moduleColor(module: string) {
  const map: Record<string, string> = {
    "Cora Assistant": "#8b5cf6",
    Lectures: "#06b6d4",
    "Practice Hub": "#10b981",
    Assessments: "#f59e0b",
    Code: "#ef4444",
    Flashcards: "#6366f1",
    Notes: "#0ea5e9",
    "Study Plan": "#d97706",
    Grades: "#059669",
  }
  return map[module] ?? "#8b5cf6"
}

export async function resolveInsightScope(request: { headers: Headers }) {
  const instructorId = Number(request.headers.get("x-instructor-id") || 0)
  const courseId = Number(request.headers.get("x-course-id") || 0)
  return {
    instructorId,
    courseId: Number.isFinite(courseId) && courseId > 0 ? courseId : undefined,
  }
}
