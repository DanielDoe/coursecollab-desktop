import { parseCircuitWorkspace, workspaceHasContent, type CircuitWorkspace } from "@/lib/circuit-workspace"

const DRAFT_PREFIX = "cc_workspace_draft_v1"

export function workspaceDraftStorageKey(opts: {
  studentDatabaseId?: number | null
  attemptId?: number | null
  questionId?: number | null
}): string | null {
  const studentId = opts.studentDatabaseId
  const questionId = opts.questionId
  if (!studentId || !questionId) return null
  const attempt = opts.attemptId ?? 0
  return `${DRAFT_PREFIX}:${studentId}:${attempt}:${questionId}`
}

export function saveWorkspaceDraft(key: string, workspace: CircuitWorkspace | null | undefined): void {
  if (typeof window === "undefined" || !key) return
  try {
    if (!workspace || !workspaceHasContent(workspace)) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(
      key,
      JSON.stringify({ savedAt: Date.now(), workspace }),
    )
  } catch {
    /* quota / private mode */
  }
}

export function loadWorkspaceDraft(key: string): CircuitWorkspace | null {
  if (typeof window === "undefined" || !key) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { workspace?: unknown }
    const workspace = parseCircuitWorkspace(parsed?.workspace)
    return workspaceHasContent(workspace) ? workspace : null
  } catch {
    return null
  }
}

export function clearWorkspaceDraft(key: string | null): void {
  if (typeof window === "undefined" || !key) return
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
