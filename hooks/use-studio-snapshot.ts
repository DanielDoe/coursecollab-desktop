"use client"

import { useEffect, useState } from "react"
import {
  getStudioSnapshot,
  pullRemoteStudioEvents,
  type StudioSnapshot,
} from "@/lib/codebench-studio-analytics"

export function useStudioSnapshot(studentId: string | null) {
  const [snapshot, setSnapshot] = useState<StudioSnapshot | null>(null)

  useEffect(() => {
    if (!studentId) {
      setSnapshot(null)
      return
    }
    let cancelled = false
    const refresh = () => {
      if (!cancelled) setSnapshot(getStudioSnapshot(studentId))
    }
    refresh()
    void pullRemoteStudioEvents(studentId).finally(refresh)
    window.addEventListener("codebench-studio-analytics", refresh)
    return () => {
      cancelled = true
      window.removeEventListener("codebench-studio-analytics", refresh)
    }
  }, [studentId])

  return snapshot
}
