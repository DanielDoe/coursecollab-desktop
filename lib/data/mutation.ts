import type { QueryClient, QueryKey } from "@tanstack/react-query"
import { restoreQuery, snapshotQuery } from "@/lib/data/optimistic"
import type { MutationMode } from "@/lib/data/types"

export const MUTATION_MODE = {
  OPTIMISTIC: "OPTIMISTIC",
  PENDING: "PENDING",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
} as const satisfies Record<MutationMode, MutationMode>

export const MODULE_MUTATION_MODES = {
  "student.notes.create": MUTATION_MODE.OPTIMISTIC,
  "student.notes.edit": MUTATION_MODE.OPTIMISTIC,
  "student.notes.delete": MUTATION_MODE.OPTIMISTIC,
  "student.flashcards.create": MUTATION_MODE.PENDING,
  "student.flashcards.edit": MUTATION_MODE.OPTIMISTIC,
  "student.flashcards.delete": MUTATION_MODE.OPTIMISTIC,
  "student.announcements.read": MUTATION_MODE.OPTIMISTIC,
  "student.lectures.bookmark": MUTATION_MODE.OPTIMISTIC,
  "student.lectures.reminder": MUTATION_MODE.PENDING,
  "faculty.announcements.create": MUTATION_MODE.PENDING,
  "faculty.announcements.editDraft": MUTATION_MODE.OPTIMISTIC,
  "faculty.announcements.pin": MUTATION_MODE.OPTIMISTIC,
  "faculty.announcements.delete": MUTATION_MODE.CONFIRMATION_REQUIRED,
  "faculty.courseNotes.create": MUTATION_MODE.OPTIMISTIC,
  "faculty.courseNotes.edit": MUTATION_MODE.OPTIMISTIC,
  "faculty.courseNotes.delete": MUTATION_MODE.OPTIMISTIC,
  "faculty.questionBank.createDraft": MUTATION_MODE.OPTIMISTIC,
  "faculty.questionBank.editDraft": MUTATION_MODE.OPTIMISTIC,
  "faculty.questionBank.delete": MUTATION_MODE.CONFIRMATION_REQUIRED,
  "assessment.submit": MUTATION_MODE.PENDING,
  "assessment.publish": MUTATION_MODE.CONFIRMATION_REQUIRED,
  "grades.change": MUTATION_MODE.CONFIRMATION_REQUIRED,
  "enrollment.change": MUTATION_MODE.CONFIRMATION_REQUIRED,
  "role.change": MUTATION_MODE.CONFIRMATION_REQUIRED,
  "cora.sendCommunication": MUTATION_MODE.CONFIRMATION_REQUIRED,
} as const

export type ModuleMutation = keyof typeof MODULE_MUTATION_MODES

export function modeFor(action: ModuleMutation): MutationMode {
  return MODULE_MUTATION_MODES[action]
}

export type OptimisticContext<T> = {
  previous: T | undefined
  queryKey: QueryKey
}

export function beginOptimistic<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updater: (current: T | undefined) => T,
): OptimisticContext<T> {
  const previous = snapshotQuery<T>(queryClient, queryKey)
  queryClient.setQueryData<T>(queryKey, updater(previous))
  return { previous, queryKey }
}

export function rollbackOptimistic<T>(queryClient: QueryClient, ctx: OptimisticContext<T>) {
  restoreQuery(queryClient, ctx.queryKey, ctx.previous)
}
