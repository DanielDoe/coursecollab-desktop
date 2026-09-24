"use client"

import { useEffect, useState } from "react"
import { instructorApiFetch, readInstructorApiJson } from "@/lib/instructor-api-headers"

export type InstructorCloudEditorFile = {
  fileName: string
  language: string | null
  code: string
  updatedAt: number | null
}

/** Reads a student's saved IDE file when the live snapshot for this assignment is empty. */
export function useInstructorCloudEditorFile(studentDbId: number | null): InstructorCloudEditorFile | null {
  const [file, setFile] = useState<InstructorCloudEditorFile | null>(null)

  useEffect(() => {
    if (!studentDbId) {
      setFile(null)
      return
    }
    let cancelled = false
    void (async () => {
      const res = await instructorApiFetch(
        `/api/instructor/codebench/ide-workspace?studentDbId=${encodeURIComponent(String(studentDbId))}`,
      )
      const parsed = await readInstructorApiJson<{ file?: InstructorCloudEditorFile | null }>(
        res,
        "Student workspace",
      )
      if (cancelled) return
      setFile(parsed.ok ? parsed.data.file ?? null : null)
    })()
    return () => {
      cancelled = true
    }
  }, [studentDbId])

  return file
}
