import { sql } from "@/lib/db"
import { buildInstructorOwnedCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import {
  ensureFlashcardSchema,
  fetchFlashcardDeckById,
  normalizeFlashcardDifficulty,
  refreshFlashcardDeckCount,
} from "@/lib/flashcards"
import {
  normalizeStructuredOptions,
  resolveMcqCorrectLetterFromOptions,
} from "@/lib/question-type-schema"

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function formatAnswerBack(correctAnswer: unknown, options: unknown): string {
  const structured = normalizeStructuredOptions(options)
  const optionTexts = structured.map((o) => o.text)

  if (correctAnswer == null) return "See course materials"
  if (typeof correctAnswer === "string") {
    const letter = resolveMcqCorrectLetterFromOptions(structured, correctAnswer)
    if (letter) {
      const match = structured.find((o) => o.id.toUpperCase() === letter)
      if (match) return stripHtml(match.text)
    }
    return stripHtml(correctAnswer)
  }
  if (typeof correctAnswer === "boolean") return correctAnswer ? "True" : "False"
  if (Array.isArray(correctAnswer)) {
    const parts = correctAnswer.map((entry) => {
      if (typeof entry === "number" && optionTexts[entry] != null) {
        return stripHtml(optionTexts[entry])
      }
      if (typeof entry === "string") {
        const letter = resolveMcqCorrectLetterFromOptions(structured, entry)
        if (letter) {
          const match = structured.find((o) => o.id.toUpperCase() === letter)
          if (match) return stripHtml(match.text)
        }
        const normalizedEntry = entry.trim().toLowerCase()
        const byText = structured.find((o) => o.text.trim().toLowerCase() === normalizedEntry)
        if (byText) return stripHtml(byText.text)
        return entry
      }
      return String(entry)
    })
    return parts.filter(Boolean).join("; ") || "See course materials"
  }
  if (typeof correctAnswer === "object") {
    try {
      return JSON.stringify(correctAnswer)
    } catch {
      return "See course materials"
    }
  }
  return String(correctAnswer)
}

export async function generateFlashcardsFromQuestionBank(params: {
  courseId: number
  instructorId: number
  courseCode: string
  topicName: string
  session?: string | null
  deckId?: number | null
  maxCards?: number
}): Promise<{ deckId: number; cardsAdded: number; skipped: number }> {
  const { courseId, instructorId, courseCode, topicName } = params
  const maxCards = Math.min(Math.max(params.maxCards ?? 40, 1), 100)
  const sessionRaw = params.session?.trim()
  const session = sessionRaw && sessionRaw !== "ALL" ? sessionRaw : null

  await ensureFlashcardSchema()

  const qbScope = buildInstructorOwnedCourseScopeSqlFragment(
    "question_bank",
    "course_id",
    courseId,
    instructorId,
    { scopeCourseCode: courseCode },
  )

  const questions = await sql`
    SELECT id, question_text, question_type, options, correct_answer, difficulty
    FROM question_bank
    WHERE deleted_at IS NULL
      AND topic = ${topicName}
      AND question_type IN ('mcq', 'true_false', 'multiple_choice')
      AND (${qbScope})
    ORDER BY id ASC
    LIMIT ${maxCards}
  `

  if (questions.length === 0) {
    throw new Error(`No MCQ or True/False questions found for topic "${topicName}"`)
  }

  let deckId = params.deckId ?? null
  if (deckId != null) {
    const deck = await fetchFlashcardDeckById(deckId)
    if (!deck || deck.deck_kind !== "course" || Number(deck.course_id) !== courseId) {
      throw new Error("Deck not found in this course")
    }
  } else {
    const existing = await sql`
      SELECT id FROM flashcard_decks
      WHERE deck_kind = 'course'
        AND course_id = ${courseId}
        AND topic = ${topicName}
        AND title = ${`${topicName} — Question Bank`}
      LIMIT 1
    `
    if (existing.length > 0) {
      deckId = Number(existing[0].id)
    } else {
      const inserted = await sql`
        INSERT INTO flashcard_decks (
          title, description, deck_kind, course_id, session, instructor_id, topic,
          show_in_practice_hub, is_published
        )
        VALUES (
          ${`${topicName} — Question Bank`},
          ${`Auto-generated from question bank for ${topicName}`},
          'course',
          ${courseId},
          ${session},
          ${instructorId},
          ${topicName},
          false,
          false
        )
        RETURNING id
      `
      deckId = Number(inserted[0].id)
    }
  }

  const existingCards = await sql`
    SELECT front_text FROM flashcard_cards WHERE deck_id = ${deckId}
  `
  const existingFronts = new Set(
    (existingCards as { front_text: string }[]).map((c) => c.front_text.trim()),
  )

  let cardsAdded = 0
  let skipped = 0
  let sortOrder = existingCards.length

  for (const q of questions) {
    const front = stripHtml(String(q.question_text ?? "")).slice(0, 2000)
    if (!front) {
      skipped += 1
      continue
    }
    if (existingFronts.has(front)) {
      skipped += 1
      continue
    }
    const back = formatAnswerBack(q.correct_answer, q.options).slice(0, 2000)
    const difficulty = normalizeFlashcardDifficulty(
      typeof q.difficulty === "string" ? q.difficulty : "medium",
    )
    await sql`
      INSERT INTO flashcard_cards (deck_id, front_text, back_text, sort_order, difficulty)
      VALUES (${deckId}, ${front}, ${back}, ${sortOrder}, ${difficulty})
    `
    existingFronts.add(front)
    sortOrder += 1
    cardsAdded += 1
  }

  await refreshFlashcardDeckCount(deckId)

  return { deckId, cardsAdded, skipped }
}
