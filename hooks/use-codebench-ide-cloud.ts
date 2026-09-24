"use client"

import { useEffect, useRef } from "react"
import { studentApiFetch } from "@/lib/auth"
import type { IdeWorkspace } from "@/lib/codebench-ide-workspace"

/** Uploads the local IDE workspace beside the live snapshot. Does not write the live session. */
export function useCodebenchIdeCloudSave(studentId: string | null, workspace: IdeWorkspace | null, enabled: boolean) {
  const payload = workspace ? JSON.stringify(workspace) : ""
  const lastSent = useRef("")

  useEffect(() => {
    if (!enabled || !studentId || !payload || payload === lastSent.current) return
    const timer = window.setTimeout(() => {
      lastSent.current = payload
      void studentApiFetch("/api/codebench/ide-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, workspace }),
      }).catch(() => {
        lastSent.current = ""
      })
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [enabled, payload, studentId, workspace])
}
