import type { QueryClient } from "@tanstack/react-query"
import { invalidateEvent, type InvalidationEvent } from "@/lib/data/invalidation"
import { readClientScope } from "@/lib/data/scope"

const TOOL_TO_EVENT: Record<string, InvalidationEvent> = {
  "personalNotes.create": "cora.personalNotes.create",
  "personalFlashcards.createDeck": "cora.personalFlashcards.createDeck",
  "announcement.publish": "cora.announcement.publish",
  "questionBank.createQuestions": "cora.questionBank.createQuestions",
  "lecture.createShell": "cora.lecture.createShell",
}

const ENTITY_TO_EVENT: Record<string, InvalidationEvent> = {
  note: "cora.personalNotes.create",
  flashcard_deck: "cora.personalFlashcards.createDeck",
  announcement: "cora.announcement.publish",
  question: "cora.questionBank.createQuestions",
  lecture: "cora.lecture.createShell",
}

export function invalidateAfterCoraAction(
  queryClient: QueryClient,
  input: { tool?: string | null; entityType?: string | null },
) {
  const event =
    (input.tool && TOOL_TO_EVENT[input.tool]) ||
    (input.entityType && ENTITY_TO_EVENT[input.entityType]) ||
    null
  if (!event) return
  const scope = readClientScope()
  void invalidateEvent(queryClient, event, scope, {
    studentId: scope.role === "student" || scope.role === "guest" ? scope.userId ?? undefined : undefined,
    instructorId: scope.role === "faculty" ? scope.userId ?? undefined : undefined,
  })
}
