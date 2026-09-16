import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"
import { formatKnowledgeGraphForPrompt } from "@/lib/cora/student-knowledge-graph"
import { formatMembershipAccessForPrompt } from "@/lib/cora/read-only-agent"
import {
  minimizeStudentContextForExternalAi,
  type ExternalAiContextOptions,
} from "@/lib/cora/privacy/ai-data-minimization"

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export type FormatStudentContextOptions = ExternalAiContextOptions & {
  /** When true (default), apply external-AI minimization before formatting. */
  forExternalAi?: boolean
}

/** Formats a student snapshot for Cora system prompts / tool results sent to external models. */
export function formatStudentContextForPrompt(
  ctx: CoraStudentContextPayload,
  options?: FormatStudentContextOptions,
): string {
  const forExternalAi = options?.forExternalAi !== false
  const payload = forExternalAi ? minimizeStudentContextForExternalAi(ctx, options) : ctx

  const lines: string[] = [
    "**STUDENT LEARNING PROFILE (CourseCollab — read-only snapshot):**",
  ]

  const account = payload.account
  if (account?.courseCode || account?.courseTitle || account?.section) {
    lines.push(
      `- Course: ${account.courseCode ?? "—"}${account.courseTitle ? ` — ${account.courseTitle}` : ""}`,
      `- Section: ${account.section ?? "—"}`,
    )
  }

  if (payload.membership) {
    lines.push(formatMembershipAccessForPrompt(payload.membership.tier, payload.membership.aiTutorCredits))
    if (payload.membership.trialDaysRemaining != null && payload.membership.trialDaysRemaining > 0) {
      lines.push(`- Trial: ${payload.membership.trialDaysRemaining} day(s) remaining`)
    }
  }

  if (payload.strugglingTopics?.length) {
    lines.push(`- Struggling topics: ${payload.strugglingTopics.slice(0, 8).join(", ")}`)
  }
  if (payload.strengths?.length) {
    lines.push(`- Strengths: ${payload.strengths.slice(0, 8).join(", ")}`)
  }

  const summary = payload.summary ?? {}
  if (num(summary.avgQuizScore) > 0) {
    lines.push(`- Quizzes: ${num(summary.avgQuizScore).toFixed(1)}% avg (${summary.totalQuizAttempts ?? 0} attempts)`)
  }
  if (num(summary.avgHomeworkScore) > 0) {
    lines.push(`- Homework: ${num(summary.avgHomeworkScore).toFixed(1)}% avg (${summary.totalHomeworkAttempts ?? 0} attempts)`)
  }
  if (num(summary.avgPracticeScore) > 0) {
    lines.push(`- Practice Hub: ${num(summary.avgPracticeScore).toFixed(1)}% avg (${summary.totalPracticeAttempts ?? 0} attempts)`)
  }
  if (num(summary.lecturesViewed) > 0) {
    lines.push(`- Lectures: ${summary.lecturesCompleted ?? 0}/${summary.lecturesViewed} completed`)
  }

  if (payload.grades?.length) {
    lines.push("- **Gradebook (read-only aggregates):**")
    for (const g of payload.grades.slice(0, 2)) {
      lines.push(
        `  • Session ${g.session ?? "—"}: total ${g.totalScore ?? "—"}% | quiz ${g.quizScore ?? "—"} | hw ${g.homeworkScore ?? "—"} | midterm ${g.midtermScore ?? "—"} | final ${g.finalScore ?? "—"} | attendance ${g.attendanceScore ?? "—"} | engagement ${g.engagementCredits ?? "—"}`,
      )
    }
  }

  if (payload.announcements?.length) {
    lines.push("- **Recent announcements:**")
    payload.announcements.slice(0, 5).forEach((a) => {
      lines.push(`  • ${a.title}${a.createdAt ? ` (${a.createdAt.slice(0, 10)})` : ""}`)
    })
  }

  if (payload.flashcardDecks?.length) {
    lines.push(`- Flashcard decks (${payload.flashcardDecks.length}): ${payload.flashcardDecks.slice(0, 5).map((d) => d.title).join(", ")}`)
  }

  if (payload.digitalNotes?.length) {
    lines.push(`- My Notes (${payload.digitalNotes.length}): ${payload.digitalNotes.slice(0, 5).map((n) => n.title).join(", ")}`)
  }

  if (payload.knowledgeGraph) {
    lines.push("", formatKnowledgeGraphForPrompt(payload.knowledgeGraph))
  }

  lines.push(
    "",
    "**DATA ACCESS:** Live read-only CourseCollab data above. NEVER ask for uploads. NEVER claim you modified records.",
    forExternalAi
      ? "**PRIVACY:** This snapshot excludes student name, email, student ID, and internal account identifiers."
      : "",
    `Synced: ${payload.syncedAt}`,
  )

  return lines.filter(Boolean).join("\n")
}
