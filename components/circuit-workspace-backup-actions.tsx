"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Download, Upload } from "lucide-react"
import { toast } from "@/lib/app-toast"
import {
  downloadWorkspaceBackup,
  parseWorkspaceBackupFile,
} from "@/lib/circuit-workspace-backup"
import type { CircuitWorkspace } from "@/lib/circuit-workspace"

type Props = {
  workspace: CircuitWorkspace
  onImport: (workspace: CircuitWorkspace) => void
  disabled?: boolean
  filenameBase?: string
  compact?: boolean
}

export function CircuitWorkspaceBackupActions({
  workspace,
  onImport,
  disabled,
  filenameBase = "workspace-backup",
  compact,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownload = () => {
    try {
      downloadWorkspaceBackup(workspace, filenameBase)
      toast.success("Workspace downloaded", {
        description: "Save this file to resume or edit later.",
      })
    } catch (err: unknown) {
      toast.error("Download failed", {
        description: err instanceof Error ? err.message : "Could not export workspace",
      })
    }
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    try {
      const imported = await parseWorkspaceBackupFile(file)
      onImport(imported)
      toast.success("Workspace imported", {
        description: "Your saved workspace was loaded into the editor.",
      })
    } catch (err: unknown) {
      toast.error("Import failed", {
        description: err instanceof Error ? err.message : "Invalid workspace file",
      })
    }
  }

  return (
    <div className={compact ? "flex items-center gap-1.5" : "flex flex-wrap items-center gap-2"}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        disabled={disabled}
        onClick={handleDownload}
        className="gap-1.5"
      >
        <Download className="h-4 w-4" />
        {compact ? "Download" : "Download workspace"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        disabled={disabled}
        onClick={handleImportClick}
        className="gap-1.5"
      >
        <Upload className="h-4 w-4" />
        {compact ? "Import" : "Import workspace"}
      </Button>
    </div>
  )
}
