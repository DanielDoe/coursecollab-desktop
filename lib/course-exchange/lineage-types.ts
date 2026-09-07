import type { CourseExchangeModule } from "@/lib/course-exchange/types"

export type ExchangeEntityType =
  | "syllabus"
  | "lecture"
  | "course_note"
  | "question_bank"
  | "flashcard_deck"
  | "quiz"
  | "playground_session"

export type ExchangeLineageItem = {
  /** Stable id: `${entityType}:${sourceId}` */
  key: string
  module: CourseExchangeModule | "syllabus"
  entityType: ExchangeEntityType
  sourceId: number
  destinationId: number
  label: string
  fingerprint: string
}

export type ExchangeLineage = {
  version: number
  syncedAt: string
  modules: CourseExchangeModule[]
  items: ExchangeLineageItem[]
}

export type ExchangeSyncChangeKind = "added" | "modified" | "removed"

export type ExchangeSyncChange = {
  changeId: string
  kind: ExchangeSyncChangeKind
  module: CourseExchangeModule | "syllabus"
  entityType: ExchangeEntityType
  sourceId: number
  destinationId: number | null
  label: string
  summary: string
  yoursLabel?: string | null
  incomingLabel?: string | null
}

export type ExchangeSyncDiff = {
  copyId: number
  sourceCourseCode: string
  destinationCourseCode: string
  sourceVersion: number
  hasUpdates: boolean
  changeCount: number
  changes: ExchangeSyncChange[]
  checkedAt: string
}

export type ExchangeSyncApplyResult = {
  applied: number
  skipped: number
  lineage: ExchangeLineage
  summary: Record<string, number>
}
