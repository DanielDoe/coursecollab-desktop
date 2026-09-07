/**
 * Export circuit workspace pages to uploaded solution files.
 */

import type { SolutionUploadsMap } from "@/lib/solution-upload"
import {
  WORKSPACE_UPLOAD_TIMEOUT_MS,
  getWorkspacePaperDimensions,
  workspaceExportPartKey,
  workspacePagesWithContent,
  type CircuitWorkspace,
} from "@/lib/circuit-workspace"
import { workspacePageToBlob } from "@/lib/circuit-workspace-render"

async function uploadWorkspaceFile(params: {
  file: File
  attemptId: number
  questionId: number
  studentDatabaseId: number
  partKey: string
  signal: AbortSignal
  uploadEndpoint?: string
  uploadExtraFields?: Record<string, string>
}): Promise<{ url: string; name: string; mime: string; uploaded_at: string }> {
  const fd = new FormData()
  fd.append("file", params.file)
  fd.append("attemptId", String(params.attemptId))
  fd.append("questionId", String(params.questionId))
  fd.append("partId", params.partKey)
  fd.append("studentId", String(params.studentDatabaseId))
  fd.append("uploadKind", "circuit_submission")
  if (params.uploadExtraFields) {
    for (const [key, value] of Object.entries(params.uploadExtraFields)) {
      fd.append(key, value)
    }
  }

  const res = await fetch(params.uploadEndpoint ?? "/api/student/quiz-solution-upload", {
    method: "POST",
    body: fd,
    signal: params.signal,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Workspace export failed")
  return {
    url: data.url,
    name: data.name || params.file.name,
    mime: data.mime || params.file.type,
    uploaded_at: data.uploaded_at || new Date().toISOString(),
  }
}

export async function exportCircuitWorkspaceUploads(params: {
  workspace: CircuitWorkspace
  attemptId: number
  questionId: number
  studentDatabaseId: number
  title?: string
  uploadEndpoint?: string
  uploadExtraFields?: Record<string, string>
}): Promise<SolutionUploadsMap> {
  const pages = workspacePagesWithContent(params.workspace)
  if (pages.length === 0) return {}
  const paper = getWorkspacePaperDimensions(params.workspace)

  const uploads: SolutionUploadsMap = {}
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), WORKSPACE_UPLOAD_TIMEOUT_MS)

  try {
    const rendered = await Promise.all(
      pages.map(async (page, i) => {
        const blob = await workspacePageToBlob(page, {
          pageIndex: i,
          totalPages: pages.length,
          title: params.title,
          mime: "image/jpeg",
          paperPattern: params.workspace.paperPattern ?? "ruled",
          width: paper.width,
          height: paper.height,
        })
        if (!blob) throw new Error("Could not render workspace page")
        return {
          partKey: workspaceExportPartKey(i),
          file: new File([blob], `workspace-page-${i + 1}.jpg`, { type: "image/jpeg" }),
        }
      }),
    )
    for (const page of rendered) {
      uploads[page.partKey] = await uploadWorkspaceFile({
        file: page.file,
        attemptId: params.attemptId,
        questionId: params.questionId,
        studentDatabaseId: params.studentDatabaseId,
        partKey: page.partKey,
        signal: controller.signal,
        uploadEndpoint: params.uploadEndpoint,
        uploadExtraFields: params.uploadExtraFields,
      })
    }
    return uploads
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Save timed out. Check your connection and try again.")
    }
    throw e
  } finally {
    window.clearTimeout(timer)
  }
}
