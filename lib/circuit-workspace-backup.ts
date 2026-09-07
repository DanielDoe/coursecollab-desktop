/**
 * Client-side circuit workspace backup: download JSON and restore from file.
 */

import { parseCircuitWorkspace, type CircuitWorkspace } from "@/lib/circuit-workspace"

export type CircuitWorkspaceBackupFile = {
  version: 1
  kind: "coursecollab_circuit_workspace"
  exportedAt: string
  title?: string
  workspace: CircuitWorkspace
}

export function buildWorkspaceBackupPayload(
  workspace: CircuitWorkspace,
  title?: string,
): CircuitWorkspaceBackupFile {
  return {
    version: 1,
    kind: "coursecollab_circuit_workspace",
    exportedAt: new Date().toISOString(),
    title,
    workspace,
  }
}

export function downloadWorkspaceBackup(
  workspace: CircuitWorkspace,
  filenameBase = "workspace-backup",
): void {
  const payload = buildWorkspaceBackupPayload(workspace)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${filenameBase.replace(/[^\w.-]+/g, "-")}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function parseWorkspaceBackupFile(file: File): Promise<CircuitWorkspace> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("Invalid backup file — expected JSON")
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid backup file format")
  }

  const record = parsed as Record<string, unknown>
  const rawWorkspace =
    record.kind === "coursecollab_circuit_workspace" ? record.workspace : record

  const workspace = parseCircuitWorkspace(rawWorkspace)
  if (!workspace) {
    throw new Error("Backup file does not contain a valid workspace")
  }
  return workspace
}
