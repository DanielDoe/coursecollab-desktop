import type { CoraWorkspaceActionMessage } from "@/lib/cora/workspace-actions"
import type { CoraSession } from "@/lib/cora/step-engine/types"
import { PHASE_LABELS } from "@/lib/cora/step-engine/phases"

export function buildCoraSessionNoteTitle(session: CoraSession): string {
  const topic =
    session.problem.title?.trim() ||
    session.problem.topic?.trim() ||
    session.steps[0]?.title?.trim() ||
    "Interactive session"
  return `Cora · ${topic}`
}

export function formatCoraSessionAsNoteMarkdown(
  session: CoraSession,
  opts?: {
    reflections?: Record<string, string>
    stepIndex?: number
  },
): string {
  const reflections = opts?.reflections ?? {}
  const lines: string[] = []

  lines.push(`# ${buildCoraSessionNoteTitle(session)}`)
  lines.push("")
  lines.push(`Mode: **${session.mode}** · Source: **${session.dataSource}**`)
  if (session.problem.courseCode) {
    lines.push(`Course: **${session.problem.courseCode}**`)
  }
  lines.push("")

  if (session.problem.questionText?.trim()) {
    lines.push("## Problem")
    lines.push("")
    lines.push(session.problem.questionText.trim())
    lines.push("")
  }

  lines.push("## Walkthrough")
  lines.push("")

  for (const step of session.steps) {
    const phase = PHASE_LABELS[step.phase] ?? step.phase
    lines.push(`### ${step.index + 1}. ${step.title}`)
    lines.push(`*${phase}*`)
    lines.push("")
    if (step.explanation?.trim()) {
      lines.push(step.explanation.trim())
      lines.push("")
    }
    if (step.equations?.length) {
      lines.push("**Equations**")
      for (const eq of step.equations) {
        lines.push(`- ${eq.label ? `${eq.label}: ` : ""}\`${eq.latex}\``)
      }
      lines.push("")
    }
    if (step.concepts?.length) {
      lines.push(`**Concepts:** ${step.concepts.join(", ")}`)
      lines.push("")
    }
    const reflection = reflections[step.id]?.trim()
    if (reflection) {
      lines.push("**My reflection**")
      lines.push(reflection)
      lines.push("")
    }
  }

  if (session.finalAnswer?.trim()) {
    lines.push("## Reference answer")
    lines.push("")
    lines.push(session.finalAnswer.trim())
    lines.push("")
  }

  if (session.summary) {
    lines.push("## Session summary")
    lines.push("")
    if (session.summary.conceptsLearned.length) {
      lines.push("**Concepts learned**")
      for (const c of session.summary.conceptsLearned) lines.push(`- ${c}`)
      lines.push("")
    }
    if (session.summary.skillsPracticed.length) {
      lines.push("**Skills practiced**")
      for (const s of session.summary.skillsPracticed) lines.push(`- ${s}`)
      lines.push("")
    }
    if (session.summary.recommendedNext.length) {
      lines.push("**Try next**")
      for (const n of session.summary.recommendedNext) lines.push(`- ${n}`)
      lines.push("")
    }
  }

  lines.push("---")
  lines.push("_Exported from Cora interactive workspace_")
  return lines.join("\n").trim()
}

export function coraSessionToExportMessages(
  session: CoraSession,
  opts?: { reflections?: Record<string, string> },
): CoraWorkspaceActionMessage[] {
  const title = buildCoraSessionNoteTitle(session)
  const markdown = formatCoraSessionAsNoteMarkdown(session, opts)
  const now = new Date().toISOString()
  return [
    {
      id: `export-req-${Date.now()}`,
      role: "student",
      content: `Save this Cora interactive workspace to my notes: ${title}`,
      timestamp: now,
    },
    {
      id: `export-body-${Date.now()}`,
      role: "ai",
      content: markdown,
      timestamp: now,
    },
  ]
}
