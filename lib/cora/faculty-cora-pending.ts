"use client"

import type { DraftQuestionBankItem } from "@/lib/question-bank-ai-from-pdf-types"

export type FacultyCoraPendingKind =
  | "question_bank_drafts"
  | "quiz_create"
  | "announcement_draft"
  | "flashcard_topic"
  | "playground_topic"

export type FacultyCoraPendingPayload =
  | { kind: "question_bank_drafts"; drafts: DraftQuestionBankItem[]; createdAt: string }
  | {
      kind: "quiz_create"
      title?: string
      description?: string
      assessmentType?: string
      createdAt: string
    }
  | { kind: "announcement_draft"; title: string; content: string; createdAt: string }
  | { kind: "flashcard_topic"; topicName: string; createdAt: string }
  | {
      kind: "playground_topic"
      topic: string
      questionCount?: number
      openQuestionsTab?: boolean
      createdAt: string
    }

function storageKey(instructorId: number, courseId: number) {
  return `faculty_cora_pending_${instructorId}_${courseId}`
}

function readScope(): { instructorId: number; courseId: number } | null {
  if (typeof localStorage === "undefined") return null
  const instructorId = Number(localStorage.getItem("instructorId"))
  let courseId = 0
  try {
    const raw = localStorage.getItem("instructorSession")
    if (raw) {
      const s = JSON.parse(raw) as { selectedCourseId?: number }
      courseId = Number(s.selectedCourseId ?? 0)
    }
  } catch {
    /* ignore */
  }
  if (!courseId) courseId = Number(localStorage.getItem("selectedCourseId") ?? 0)
  if (!Number.isFinite(instructorId) || instructorId <= 0) return null
  if (!Number.isFinite(courseId) || courseId <= 0) return null
  return { instructorId, courseId }
}

export function setFacultyCoraPending(payload: FacultyCoraPendingPayload): void {
  const scope = readScope()
  if (!scope) return
  localStorage.setItem(storageKey(scope.instructorId, scope.courseId), JSON.stringify(payload))
}

export function peekFacultyCoraPending(
  expectedKind?: FacultyCoraPendingKind,
): FacultyCoraPendingPayload | null {
  const scope = readScope()
  if (!scope) return null
  try {
    const raw = localStorage.getItem(storageKey(scope.instructorId, scope.courseId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as FacultyCoraPendingPayload
    if (expectedKind && parsed.kind !== expectedKind) return null
    return parsed
  } catch {
    return null
  }
}

export function consumeFacultyCoraPending(
  expectedKind?: FacultyCoraPendingKind,
): FacultyCoraPendingPayload | null {
  const scope = readScope()
  if (!scope) return null
  const pending = peekFacultyCoraPending(expectedKind)
  if (!pending) return null
  localStorage.removeItem(storageKey(scope.instructorId, scope.courseId))
  return pending
}

export function facultyModuleHrefForPending(kind: FacultyCoraPendingKind): string {
  switch (kind) {
    case "question_bank_drafts":
      return "/faculty/dashboard/assessments/quizzes/question-bank"
    case "quiz_create":
      return "/faculty/dashboard/assessments/quizzes"
    case "announcement_draft":
      return "/faculty/dashboard/communication/announcements"
    case "flashcard_topic":
      return "/faculty/dashboard/content/flashcards"
    case "playground_topic":
      return "/faculty/dashboard/course/playground"
  }
}
