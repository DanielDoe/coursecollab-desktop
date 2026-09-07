import { sql } from "@/lib/db"
import { clampFlashcardBatchSize, DEFAULT_FLASHCARD_BATCH_SIZE } from "@/lib/flashcard-batch-study"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { fetchDisabledModuleTopicsForStudent } from "@/lib/module-topic-availability"
export type {
  FlashcardCard,
  FlashcardDeck,
  FlashcardDeckKind,
  FlashcardDifficulty,
} from "@/lib/flashcards-types"
export {
  FLASHCARD_DIFFICULTY_LABELS,
  FLASHCARD_DIFFICULTY_VALUES,
  normalizeFlashcardDifficulty,
} from "@/lib/flashcards-types"
import type {
  FlashcardCard,
  FlashcardDeck,
  FlashcardDeckKind,
  FlashcardDifficulty,
} from "@/lib/flashcards-types"
import { normalizeFlashcardDifficulty } from "@/lib/flashcards-types"

export type FlashcardDeckRow = {
  id: number
  title: string
  description: string
  deck_kind: FlashcardDeckKind
  course_id: number | null
  session: string | null
  student_id: number | null
  instructor_id: number | null
  topic: string | null
  show_in_practice_hub: boolean
  is_published: boolean
  require_mcq_validation?: boolean
  cards_before_quiz?: number
  card_count: number
  created_at: string
  updated_at: string
}

export type FlashcardCardRow = {
  id: number
  deck_id: number
  front_text: string
  back_text: string
  sort_order: number
  difficulty?: string
  custom_distractors?: unknown
  created_at: string
  updated_at: string
}

export function parseFlashcardCustomDistractors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .slice(0, 3)
}

export function mapFlashcardDeck(row: FlashcardDeckRow, canEdit = false): FlashcardDeck {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    deckKind: row.deck_kind,
    courseId: row.course_id,
    session: row.session,
    studentId: row.student_id,
    instructorId: row.instructor_id,
    topic: row.topic,
    showInPracticeHub: Boolean(row.show_in_practice_hub),
    isPublished: Boolean(row.is_published),
    requireMcqValidation: row.require_mcq_validation !== false,
    cardsBeforeQuiz: clampFlashcardBatchSize(
      row.cards_before_quiz ?? DEFAULT_FLASHCARD_BATCH_SIZE,
    ),
    cardCount: Number(row.card_count) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canEdit,
  }
}

export function mapFlashcardCard(row: FlashcardCardRow): FlashcardCard {
  return {
    id: row.id,
    deckId: row.deck_id,
    frontText: row.front_text,
    backText: row.back_text,
    sortOrder: Number(row.sort_order) || 0,
    difficulty: normalizeFlashcardDifficulty(row.difficulty),
    customDistractors: parseFlashcardCustomDistractors(row.custom_distractors),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

let flashcardSchemaPromise: Promise<void> | null = null

export async function ensureFlashcardSchema(): Promise<void> {
  if (!flashcardSchemaPromise) {
    flashcardSchemaPromise = applyFlashcardSchema().catch((error) => {
      flashcardSchemaPromise = null
      throw error
    })
  }
  await flashcardSchemaPromise
}

async function applyFlashcardSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS flashcard_decks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      deck_kind TEXT NOT NULL DEFAULT 'student',
      course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
      session VARCHAR(64),
      student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
      instructor_id INTEGER REFERENCES instructors(id) ON DELETE SET NULL,
      topic TEXT,
      show_in_practice_hub BOOLEAN NOT NULL DEFAULT false,
      is_published BOOLEAN NOT NULL DEFAULT true,
      card_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS flashcard_cards (
      id SERIAL PRIMARY KEY,
      deck_id INTEGER NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
      front_text TEXT NOT NULL,
      back_text TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE flashcard_decks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`
  await sql`ALTER TABLE flashcard_cards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`
  await sql`
    ALTER TABLE flashcard_decks
    ADD COLUMN IF NOT EXISTS require_mcq_validation BOOLEAN NOT NULL DEFAULT true
  `
  await sql`
    ALTER TABLE flashcard_decks
    ADD COLUMN IF NOT EXISTS cards_before_quiz INTEGER NOT NULL DEFAULT 10
  `
  await sql`
    ALTER TABLE flashcard_cards
    ADD COLUMN IF NOT EXISTS custom_distractors JSONB NOT NULL DEFAULT '[]'::jsonb
  `
  await sql`
    ALTER TABLE flashcard_cards
    ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'medium'
  `
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'flashcard_cards_difficulty_chk'
      ) THEN
        ALTER TABLE flashcard_cards
          ADD CONSTRAINT flashcard_cards_difficulty_chk
          CHECK (difficulty IN ('easy', 'medium', 'hard', 'very_hard'));
      END IF;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$
  `
  await sql`
    UPDATE flashcard_cards
    SET difficulty = 'medium'
    WHERE difficulty IS NULL
       OR TRIM(difficulty) = ''
       OR difficulty NOT IN ('easy', 'medium', 'hard', 'very_hard')
  `
}

export async function refreshFlashcardDeckCount(deckId: number): Promise<number> {
  const rows = await sql`
    UPDATE flashcard_decks d
    SET
      card_count = sub.c,
      updated_at = NOW()
    FROM (
      SELECT COUNT(*)::int AS c
      FROM flashcard_cards
      WHERE deck_id = ${deckId} AND deleted_at IS NULL
    ) sub
    WHERE d.id = ${deckId}
    RETURNING d.card_count
  `
  return Number(rows[0]?.card_count) || 0
}

export async function fetchFlashcardDeckById(
  deckId: number,
  options?: { includeDeleted?: boolean },
): Promise<FlashcardDeckRow | null> {
  const rows = options?.includeDeleted
    ? await sql`
        SELECT *
        FROM flashcard_decks
        WHERE id = ${deckId}
        LIMIT 1
      `
    : await sql`
        SELECT *
        FROM flashcard_decks
        WHERE id = ${deckId} AND deleted_at IS NULL
        LIMIT 1
      `
  return rows.length > 0 ? (rows[0] as FlashcardDeckRow) : null
}

export async function fetchFlashcardCardsForDeck(
  deckId: number,
  options?: { includeDeleted?: boolean },
): Promise<FlashcardCardRow[]> {
  const rows = options?.includeDeleted
    ? await sql`
        SELECT *
        FROM flashcard_cards
        WHERE deck_id = ${deckId}
        ORDER BY sort_order ASC, id ASC
      `
    : await sql`
        SELECT *
        FROM flashcard_cards
        WHERE deck_id = ${deckId} AND deleted_at IS NULL
        ORDER BY sort_order ASC, id ASC
      `
  return rows as FlashcardCardRow[]
}

/** Course decks visible to a student (published, session/course scoped). */
export async function fetchCourseFlashcardDecksForStudent(options: {
  courseId: number | null
  session: string | null
  practiceHubOnly?: boolean
}): Promise<FlashcardDeckRow[]> {
  const { courseId, session, practiceHubOnly } = options
  if (courseId == null) return []

  const sessionTrim = (session ?? "").trim()
  const sessionVariants =
    sessionTrim.length > 0 ? normalizedSectionVariantsForSql(sessionTrim) : []

  if (practiceHubOnly) {
    if (sessionVariants.length > 0) {
      const rows = await sql`
        SELECT *
        FROM flashcard_decks
        WHERE deck_kind = 'course'
          AND is_published = true
          AND show_in_practice_hub = true
          AND course_id = ${courseId}
          AND deleted_at IS NULL
          AND (session IS NULL OR session = ANY(${sessionVariants}))
        ORDER BY updated_at DESC
      `
      return filterDecksByTopicAvailability(rows as FlashcardDeckRow[], session)
    }
    const rows = await sql`
      SELECT *
      FROM flashcard_decks
      WHERE deck_kind = 'course'
        AND is_published = true
        AND show_in_practice_hub = true
        AND course_id = ${courseId}
        AND deleted_at IS NULL
        AND session IS NULL
      ORDER BY updated_at DESC
    `
    return filterDecksByTopicAvailability(rows as FlashcardDeckRow[], session)
  }

  if (sessionVariants.length > 0) {
    const rows = await sql`
      SELECT *
      FROM flashcard_decks
      WHERE deck_kind = 'course'
        AND is_published = true
        AND course_id = ${courseId}
        AND deleted_at IS NULL
        AND (session IS NULL OR session = ANY(${sessionVariants}))
      ORDER BY updated_at DESC
    `
    return filterDecksByTopicAvailability(rows as FlashcardDeckRow[], session)
  }

  const rows = await sql`
    SELECT *
    FROM flashcard_decks
    WHERE deck_kind = 'course'
      AND is_published = true
      AND course_id = ${courseId}
      AND deleted_at IS NULL
      AND session IS NULL
    ORDER BY updated_at DESC
  `
  return filterDecksByTopicAvailability(rows as FlashcardDeckRow[], session)
}

async function filterDecksByTopicAvailability(
  rows: FlashcardDeckRow[],
  session: string | null,
): Promise<FlashcardDeckRow[]> {
  const disabled = await fetchDisabledModuleTopicsForStudent("flashcards", session)
  if (disabled.size === 0) return rows
  return rows.filter((deck) => {
    const topic = deck.topic?.trim()
    if (!topic) return true
    return !disabled.has(topic)
  })
}

export async function fetchStudentFlashcardDecks(studentDbId: number): Promise<FlashcardDeckRow[]> {
  const rows = await sql`
    SELECT *
    FROM flashcard_decks
    WHERE deck_kind = 'student' AND student_id = ${studentDbId} AND deleted_at IS NULL
    ORDER BY updated_at DESC
  `
  return rows as FlashcardDeckRow[]
}

export function studentCanEditDeck(deck: FlashcardDeckRow, studentDbId: number): boolean {
  return deck.deck_kind === "student" && Number(deck.student_id) === studentDbId
}

export function studentCanStudyDeck(
  deck: FlashcardDeckRow,
  studentDbId: number,
  courseId: number | null,
  session: string | null,
): boolean {
  if (studentCanEditDeck(deck, studentDbId)) return true
  if (deck.deck_kind !== "course" || !deck.is_published) return false
  if (courseId == null || Number(deck.course_id) !== courseId) return false
  const deckSession = (deck.session ?? "").trim()
  const studentSession = (session ?? "").trim()
  if (!deckSession) return true
  if (!studentSession) return true
  const variants = normalizedSectionVariantsForSql(studentSession)
  return variants.includes(deckSession) || deckSession === studentSession
}
