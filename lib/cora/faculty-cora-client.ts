"use client"

import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import type { FacultyCoraCapabilityId } from "@/lib/cora/faculty-capabilities"
import type { FacultyCoraChatThread } from "@/lib/cora/faculty-cora-thread-types"
import type { CoraProblemContext } from "@/lib/cora/types"
import type { CoraImportableItem } from "@/lib/cora/question-import-types"
import type {
  FacultyImportContainerOption,
  FacultyImportSourceKey,
  FacultyImportSourceOption,
} from "@/lib/cora/faculty-question-import-types"

export type FacultyCoraChatAction = {
  id: string
  label: string
  kind:
    | "generate_questions"
    | "open_quiz_create"
    | "schedule_automation"
    | "open_flashcards"
    | "import_from_course"
    | "submit_github_fix"
    | "open_module"
    | "confirm_expensive_task"
  payload: Record<string, unknown>
}

export type FacultyCoraInsight = {
  id: string
  title: string
  body: string
  severity?: "info" | "warning" | "success"
  capabilityId?: FacultyCoraCapabilityId | string
}

export type FacultyCoraAutomationJob = {
  id: number | string
  job_type?: string
  jobType?: string
  status?: string
  run_at?: string
  runAt?: string
  payload?: Record<string, unknown>
  created_at?: string
}

export type FacultyCoraChatMessage = {
  role: "user" | "assistant"
  content: string
}

export type { FacultyCoraChatThread }

async function facultyCoraFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = buildInstructorApiHeaders({
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  })
  const res = await fetch(path, { ...init, headers, credentials: "include" })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : typeof data?.message === "string"
          ? data.message
          : `Request failed (${res.status})`,
    )
  }
  return data as T
}

export async function fetchFacultyCoraContext() {
  return facultyCoraFetch<{
    context: {
      course: {
        id: number
        courseCode: string | null
        courseTitle: string | null
      }
      dashboard?: Record<string, unknown>
      questionBank?: { topics?: Array<{ name?: string } | string> }
      lectures?: { recentTitles?: string[] }
      assessments?: { quizTitles?: string[]; homeworkTitles?: string[] }
      practice?: Record<string, unknown>
      playbook?: {
        version: number
        courseId: number
        courseCode: string | null
        courseTitle: string | null
        generatedAt: string
        source: "scan" | "llm"
        insights: FacultyCoraInsight[]
        capabilities: Record<string, { prompts?: string[]; relatedModuleIds?: string[] }>
      }
      syncedAt?: string
    }
    promptBlock?: string
  }>("/api/instructor/cora/context")
}

export async function fetchFacultyCoraInsights() {
  return facultyCoraFetch<{ insights: FacultyCoraInsight[] }>("/api/instructor/cora/insights")
}

export async function sendFacultyCoraChat(input: {
  message: string
  capabilityId?: string
  threadId?: string | null
  conversationHistory?: FacultyCoraChatMessage[]
  problemContext?: CoraProblemContext | null
  confirmExpensiveTask?: boolean
  preferences?: import("@/lib/cora/faculty-preferences-storage").FacultyCoraPreferences
}) {
  const headers = buildInstructorApiHeaders({ "Content-Type": "application/json" })
  const res = await instructorApiFetch("/api/instructor/cora/chat", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(input),
  })
  const data = (await res.json().catch(() => ({}))) as {
    reply?: string
    error?: string
    message?: string
    actions?: FacultyCoraChatAction[]
    proposals?: import("@/lib/cora/confirmations/action-proposals").CoraActionProposal[]
    plans?: import("@/lib/cora/confirmations/transaction-plans").CoraTransactionPlan[]
    restricted?: boolean
    needsConfirmation?: boolean
    estimateLow?: number
    estimateHigh?: number
    estimatedCredits?: number
    creditsRemaining?: number
  }

  if (res.status === 409 && data.needsConfirmation) {
    return {
      reply: data.reply || data.message || "Large Cora task — confirm to continue.",
      actions: data.actions,
      proposals: data.proposals,
      plans: data.plans,
      needsConfirmation: true,
      estimateLow: data.estimateLow,
      estimateHigh: data.estimateHigh,
      estimatedCredits: data.estimatedCredits,
      creditsRemaining: data.creditsRemaining,
    }
  }

  if (!res.ok) {
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : typeof data.reply === "string"
          ? data.reply
          : `Request failed (${res.status})`,
    )
  }

  return data as {
    reply: string
    actions?: FacultyCoraChatAction[]
    proposals?: import("@/lib/cora/confirmations/action-proposals").CoraActionProposal[]
    plans?: import("@/lib/cora/confirmations/transaction-plans").CoraTransactionPlan[]
    restricted?: boolean
    needsConfirmation?: boolean
  }
}

export async function fetchFacultyCoraAutomations() {
  return facultyCoraFetch<{ jobs: FacultyCoraAutomationJob[] }>("/api/instructor/cora/automate")
}

export async function scheduleFacultyCoraAutomation(input: {
  jobType: "weekly_announcement" | "post_lecture_flashcards"
  payload?: Record<string, unknown>
  runInHours?: number
  runAt?: string
}) {
  return facultyCoraFetch<{ job: FacultyCoraAutomationJob }>("/api/instructor/cora/automate", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function generateFacultyCoraQuestions(input: {
  prompt: string
  count?: number
  topic?: string
}) {
  return facultyCoraFetch<{ drafts?: unknown[]; questions?: unknown[] }>(
    "/api/instructor/cora/tools/generate-questions",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  )
}

export async function ingestFacultyCoraDocument(input: {
  file: File
  intent?: "extract_questions" | "extract_content" | "analyze_assessment"
  prompt?: string
}) {
  const headers = buildInstructorApiHeaders({ Accept: "application/json" })
  const form = new FormData()
  form.append("file", input.file)
  form.append("intent", input.intent ?? "extract_questions")
  if (input.prompt) form.append("prompt", input.prompt)

  const res = await instructorApiFetch("/api/instructor/cora/tools/ingest-document", {
    method: "POST",
    headers,
    credentials: "include",
    body: form,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `Ingest failed (${res.status})`,
    )
  }
  return data as {
    drafts?: import("@/lib/question-bank-ai-from-pdf-types").DraftQuestionBankItem[]
    extractedText?: string
    message?: string
    meta?: Record<string, unknown>
  }
}

export async function listFacultyCoraThreads() {
  return facultyCoraFetch<{ threads: FacultyCoraChatThread[]; activeThreadId: string | null }>(
    "/api/instructor/cora/threads",
  )
}

export async function upsertFacultyCoraThread(thread: FacultyCoraChatThread, setActive = true) {
  return facultyCoraFetch<{ thread: FacultyCoraChatThread; activeThreadId?: string | null }>(
    `/api/instructor/cora/threads/${encodeURIComponent(thread.id)}`,
    {
      method: "PUT",
      body: JSON.stringify({ thread, setActive }),
    },
  )
}

export async function deleteFacultyCoraThread(threadId: string) {
  return facultyCoraFetch<{ ok: true }>(
    `/api/instructor/cora/threads/${encodeURIComponent(threadId)}`,
    { method: "DELETE" },
  )
}

export async function listFacultyQuestionImportSources() {
  return facultyCoraFetch<{ sources: FacultyImportSourceOption[] }>(
    "/api/instructor/cora/question-import?level=sources",
  )
}

export async function listFacultyQuestionImportContainers(sourceKey: FacultyImportSourceKey) {
  return facultyCoraFetch<{ containers: FacultyImportContainerOption[] }>(
    `/api/instructor/cora/question-import?level=containers&sourceKey=${encodeURIComponent(sourceKey)}`,
  )
}

export async function listFacultyQuestionImportItems(
  sourceKey: FacultyImportSourceKey,
  containerId: string,
) {
  return facultyCoraFetch<{ items: CoraImportableItem[] }>(
    `/api/instructor/cora/question-import?level=questions&sourceKey=${encodeURIComponent(sourceKey)}&containerId=${encodeURIComponent(containerId)}`,
  )
}

export async function resolveFacultyQuestionImport(item: CoraImportableItem) {
  return facultyCoraFetch<{ problem: CoraProblemContext }>("/api/instructor/cora/question-import", {
    method: "POST",
    body: JSON.stringify({
      source: item.source,
      questionId: item.questionId,
      quizId: item.quizId,
      bankQuestionId: item.bankQuestionId,
    }),
  })
}

export async function getFacultyCoraGithubStatus() {
  return facultyCoraFetch<{ enabled: boolean }>("/api/cora/github/status")
}

export async function submitFacultyCoraGithubFix(input: {
  title: string
  description: string
  files: { path: string; content: string }[]
  branchName?: string
  labels?: string[]
  linkedIssue?: number
}) {
  return facultyCoraFetch<{
    success: boolean
    message: string
    pullRequestUrl?: string
    pullRequestNumber?: number
    branchName?: string
  }>("/api/cora/github/submit-fix", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
