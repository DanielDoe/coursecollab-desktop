import type { QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/data/query-keys"
import { dispatchCacheMutated } from "@/lib/data/session-events"
import type { ClientScope } from "@/lib/data/types"

export type InvalidationTarget =
  | "student.notes"
  | "student.courseNotes"
  | "student.flashcards"
  | "student.announcements"
  | "student.lectures"
  | "faculty.announcements"
  | "faculty.courseNotes"
  | "faculty.questionBank"

const TARGET_PREFIX: Record<InvalidationTarget, string> = {
  "student.notes": "student.notes",
  "student.courseNotes": "student.courseNotes",
  "student.flashcards": "student.flashcards",
  "student.announcements": "student.announcements",
  "student.lectures": "student.lectures",
  "faculty.announcements": "faculty.announcements",
  "faculty.courseNotes": "faculty.courseNotes",
  "faculty.questionBank": "faculty.questionBank",
}

/** Explicit dependency graph — invalidate only related resources. */
export const INVALIDATION_GRAPH = {
  "student.note.created": ["student.notes"],
  "student.note.updated": ["student.notes"],
  "student.note.deleted": ["student.notes"],
  "student.flashcard.created": ["student.flashcards"],
  "student.flashcard.updated": ["student.flashcards"],
  "student.flashcard.deleted": ["student.flashcards"],
  "student.announcement.read": ["student.announcements"],
  "student.lecture.bookmarked": ["student.lectures"],
  "faculty.announcement.created": ["faculty.announcements", "student.announcements"],
  "faculty.announcement.updated": ["faculty.announcements", "student.announcements"],
  "faculty.announcement.deleted": ["faculty.announcements", "student.announcements"],
  "faculty.courseNote.changed": ["faculty.courseNotes", "student.courseNotes"],
  "faculty.question.created": ["faculty.questionBank"],
  "faculty.question.updated": ["faculty.questionBank"],
  "faculty.question.deleted": ["faculty.questionBank"],
  "cora.personalNotes.create": ["student.notes"],
  "cora.personalFlashcards.createDeck": ["student.flashcards"],
  "cora.announcement.publish": ["faculty.announcements", "student.announcements"],
  "cora.questionBank.createQuestions": ["faculty.questionBank"],
  "cora.lecture.createShell": ["student.lectures"],
} as const satisfies Record<string, readonly InvalidationTarget[]>

export type InvalidationEvent = keyof typeof INVALIDATION_GRAPH

function keysForTarget(scope: ClientScope, target: InvalidationTarget, extra?: { studentId?: string; instructorId?: string }) {
  switch (target) {
    case "student.notes":
      return [queryKeys.student.notes(scope)]
    case "student.courseNotes":
      return [queryKeys.student.courseNotes(scope)]
    case "student.flashcards":
      return [queryKeys.student.flashcards(scope, false), queryKeys.student.flashcards(scope, true)]
    case "student.announcements":
      return extra?.studentId
        ? [queryKeys.student.announcements(scope, extra.studentId)]
        : [[...queryKeys.scope(scope), "student", "announcements"]]
    case "student.lectures":
      return extra?.studentId
        ? [
            queryKeys.student.lectures(scope, extra.studentId),
            queryKeys.student.lectureBookmarks(scope, extra.studentId),
            queryKeys.student.lectureReminders(scope, extra.studentId),
          ]
        : [[...queryKeys.scope(scope), "student", "lectures"]]
    case "faculty.announcements":
      return extra?.instructorId
        ? [queryKeys.faculty.announcements(scope, extra.instructorId)]
        : [[...queryKeys.scope(scope), "faculty", "announcements"]]
    case "faculty.courseNotes":
      return [queryKeys.faculty.courseNotes(scope), queryKeys.faculty.courseNotesDeleted(scope)]
    case "faculty.questionBank":
      return [
        queryKeys.faculty.questionBank(scope),
        queryKeys.faculty.questionBankTopics(scope),
        queryKeys.faculty.questionBankDeleted(scope),
      ]
    default:
      return []
  }
}

export async function invalidateEvent(
  queryClient: QueryClient,
  event: InvalidationEvent,
  scope: ClientScope,
  extra?: { studentId?: string; instructorId?: string },
) {
  const targets = INVALIDATION_GRAPH[event]
  const prefixes: string[][] = []
  await Promise.all(
    targets.flatMap((target) =>
      keysForTarget(scope, target, extra).map((queryKey) => {
        prefixes.push(queryKey.map(String))
        return queryClient.invalidateQueries({ queryKey })
      }),
    ),
  )
  dispatchCacheMutated(prefixes)
  void TARGET_PREFIX
}
