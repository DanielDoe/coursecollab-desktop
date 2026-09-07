"use client"

import { useEffect, useState } from "react"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"

export type FlashcardSessionOption = {
  id: number
  code: string
  studentCount: number
}

function dedupeSessionsByCode(
  rows: { id?: number; code: string; student_count?: number }[],
): FlashcardSessionOption[] {
  const map = new Map<string, FlashcardSessionOption>()
  for (const row of rows) {
    const code = String(row.code).trim()
    if (!code) continue
    const count = Number(row.student_count) || 0
    const existing = map.get(code)
    if (existing) {
      existing.studentCount += count
    } else {
      map.set(code, {
        id: Number(row.id) || 0,
        code,
        studentCount: count,
      })
    }
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
}

export function useInstructorFlashcardSessions() {
  const [sessions, setSessions] = useState<FlashcardSessionOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const res = await instructorApiFetch("/api/instructor/sessions", {
          headers: buildInstructorAuthorizedApiHeaders(),
        })
        const data = await res.json()
        if (res.ok) {
          setSessions(dedupeSessionsByCode(data.sessions || []))
        }
      } catch {
        /* optional */
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return { sessions, loading }
}
