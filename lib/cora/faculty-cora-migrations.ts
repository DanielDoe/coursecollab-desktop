"use client"

import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import {
  facultyModuleHrefForPending,
  setFacultyCoraPending,
} from "@/lib/cora/faculty-cora-pending"
import type { DraftQuestionBankItem } from "@/lib/question-bank-ai-from-pdf-types"

export type FacultyMigrationKind =
  | "question_bank_bulk"
  | "quiz_from_bank"
  | "homework_from_bank"
  | "announcement"
  | "flashcard_deck_from_bank"
  | "open_module"

export type FacultyMigrationResult = {
  success: boolean
  message: string
  href?: string
}

async function postJson(path: string, body: Record<string, unknown>) {
  const res = await fetch(path, {
    method: "POST",
    headers: buildInstructorApiHeaders({ "Content-Type": "application/json" }),
    credentials: "include",
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `Request failed (${res.status})`)
  }
  return data
}

export async function runFacultyMigration(
  kind: FacultyMigrationKind,
  payload: Record<string, unknown>,
): Promise<FacultyMigrationResult> {
  switch (kind) {
    case "question_bank_bulk": {
      const drafts = (payload.drafts ?? []) as DraftQuestionBankItem[]
      await postJson("/api/instructor/question-bank/bulk-create", { questions: drafts })
      setFacultyCoraPending({
        kind: "question_bank_drafts",
        drafts,
        createdAt: new Date().toISOString(),
      })
      return {
        success: true,
        message: `Saved ${drafts.length} questions to Question Bank.`,
        href: facultyModuleHrefForPending("question_bank_drafts"),
      }
    }
    case "quiz_from_bank":
    case "homework_from_bank": {
      const assessmentType = kind === "homework_from_bank" ? "homework" : "quiz"
      setFacultyCoraPending({
        kind: "quiz_create",
        title: String(payload.title ?? ""),
        description: String(payload.description ?? ""),
        assessmentType,
        createdAt: new Date().toISOString(),
      })
      return {
        success: true,
        message: `Opening ${assessmentType} editor with Cora context.`,
        href: facultyModuleHrefForPending("quiz_create"),
      }
    }
    case "announcement": {
      const title = String(payload.title ?? "Course update")
      const content = String(payload.content ?? "")
      setFacultyCoraPending({
        kind: "announcement_draft",
        title,
        content,
        createdAt: new Date().toISOString(),
      })
      return {
        success: true,
        message: "Announcement draft ready in Announcements.",
        href: facultyModuleHrefForPending("announcement_draft"),
      }
    }
    case "flashcard_deck_from_bank": {
      const topicName = String(payload.topicName ?? payload.topic ?? "Cora deck")
      setFacultyCoraPending({
        kind: "flashcard_topic",
        topicName,
        createdAt: new Date().toISOString(),
      })
      return {
        success: true,
        message: `Flashcard topic "${topicName}" ready in Flashcards.`,
        href: facultyModuleHrefForPending("flashcard_topic"),
      }
    }
    case "open_module": {
      const moduleKind = String(payload.moduleKind ?? "question_bank_drafts") as
        | "question_bank_drafts"
        | "quiz_create"
        | "announcement_draft"
        | "flashcard_topic"
        | "playground_topic"
      if (moduleKind === "playground_topic") {
        setFacultyCoraPending({
          kind: "playground_topic",
          topic: String(payload.topic ?? ""),
          questionCount: Number(payload.questionCount ?? 5),
          createdAt: new Date().toISOString(),
        })
      }
      return {
        success: true,
        message: "Opening module.",
        href: facultyModuleHrefForPending(moduleKind),
      }
    }
  }
}
