import { sql } from "@/lib/db"

export type PlaygroundQuestionSnapshot = {
  bankQuestionId: number
  questionText: string | null
  questionType: string | null
  difficulty: string | null
  topic: string | null
  options: unknown[] | null
  correctAnswer: string | null
  explanation: string | null
}

let snapshotColumnsReady: Promise<void> | null = null

export async function ensurePlaygroundQuestionSnapshotColumns(): Promise<void> {
  if (!snapshotColumnsReady) {
    snapshotColumnsReady = (async () => {
      await sql`ALTER TABLE playground_questions ADD COLUMN IF NOT EXISTS snapshot_question_text TEXT`
      await sql`ALTER TABLE playground_questions ADD COLUMN IF NOT EXISTS snapshot_question_type VARCHAR(32)`
      await sql`ALTER TABLE playground_questions ADD COLUMN IF NOT EXISTS snapshot_difficulty VARCHAR(32)`
      await sql`ALTER TABLE playground_questions ADD COLUMN IF NOT EXISTS snapshot_topic TEXT`
      await sql`ALTER TABLE playground_questions ADD COLUMN IF NOT EXISTS snapshot_options JSONB`
      await sql`ALTER TABLE playground_questions ADD COLUMN IF NOT EXISTS snapshot_correct_answer TEXT`
      await sql`ALTER TABLE playground_questions ADD COLUMN IF NOT EXISTS snapshot_explanation TEXT`
    })().catch((error) => {
      snapshotColumnsReady = null
      throw error
    })
  }
  await snapshotColumnsReady
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (value == null) continue
    const text = typeof value === "string" ? value.trim() : String(value).trim()
    if (text) return text
  }
  return ""
}

export function formatPlaygroundOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (typeof item === "string") return item
    if (item && typeof item === "object" && "text" in item) {
      return String((item as { text: unknown }).text ?? "")
    }
    return String(item ?? "")
  })
}

export function parsePlaygroundQuestionSnapshot(raw: unknown): PlaygroundQuestionSnapshot | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const bankQuestionId = Number(row.bankQuestionId ?? row.bank_question_id)
  if (!Number.isFinite(bankQuestionId) || bankQuestionId <= 0) return null
  const options = Array.isArray(row.options) ? formatPlaygroundOptions(row.options) : null
  const questionText = firstText(row.questionText, row.question_text) || null
  if (!questionText && !options) return null
  return {
    bankQuestionId,
    questionText,
    questionType: firstText(row.questionType, row.question_type) || null,
    difficulty: firstText(row.difficulty) || null,
    topic: firstText(row.topic) || null,
    options,
    correctAnswer: firstText(row.correctAnswer, row.correct_answer) || null,
    explanation: firstText(row.explanation) || null,
  }
}

export function indexPlaygroundSnapshotsByBankId(raw: unknown): Map<number, PlaygroundQuestionSnapshot> {
  const map = new Map<number, PlaygroundQuestionSnapshot>()
  if (!Array.isArray(raw)) return map
  for (const item of raw) {
    const snapshot = parsePlaygroundQuestionSnapshot(item)
    if (snapshot) map.set(snapshot.bankQuestionId, snapshot)
  }
  return map
}

export function mergePlaygroundQuestionSnapshot(
  incoming: PlaygroundQuestionSnapshot | undefined,
  existing: PlaygroundQuestionSnapshot | undefined,
): PlaygroundQuestionSnapshot | null {
  return incoming ?? existing ?? null
}

export function displayPlaygroundSessionQuestion(row: Record<string, unknown>): {
  questionText: string
  questionType: string
  difficulty: string
  topic: string
  options: string[]
  correctAnswer: string
  explanation: string | null
} {
  const snapshotOptions = row.snapshot_options
  const bankOptions = row.options
  return {
    questionText: firstText(row.snapshot_question_text, row.question_text),
    questionType: firstText(row.snapshot_question_type, row.question_type) || "mcq",
    difficulty: firstText(row.snapshot_difficulty, row.difficulty),
    topic: firstText(row.snapshot_topic, row.topic),
    options: formatPlaygroundOptions(snapshotOptions ?? bankOptions),
    correctAnswer: firstText(row.snapshot_correct_answer, row.correct_answer),
    explanation: firstText(row.snapshot_explanation, row.explanation) || null,
  }
}

export function snapshotFromStoredRow(row: Record<string, unknown>): PlaygroundQuestionSnapshot | null {
  const bankQuestionId = Number(row.bank_question_id)
  if (!Number.isFinite(bankQuestionId) || bankQuestionId <= 0) return null
  const hasSnapshot =
    firstText(row.snapshot_question_text) ||
    (Array.isArray(row.snapshot_options) && row.snapshot_options.length > 0) ||
    firstText(row.snapshot_correct_answer)
  if (!hasSnapshot) return null
  return {
    bankQuestionId,
    questionText: firstText(row.snapshot_question_text) || null,
    questionType: firstText(row.snapshot_question_type) || null,
    difficulty: firstText(row.snapshot_difficulty) || null,
    topic: firstText(row.snapshot_topic) || null,
    options: Array.isArray(row.snapshot_options) ? formatPlaygroundOptions(row.snapshot_options) : null,
    correctAnswer: firstText(row.snapshot_correct_answer) || null,
    explanation: firstText(row.snapshot_explanation) || null,
  }
}
