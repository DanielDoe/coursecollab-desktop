"use client"

import { useCallback, useEffect, useState } from "react"
import { studentApiFetch } from "@/lib/auth"
import { LIVE_STUDENT_SESSIONS_POLL_MS } from "@/lib/codebench-live-timing"
import { useImmediateLivePoll } from "@/hooks/use-immediate-live-poll"
import type { OpenPlaygroundLobby } from "@/lib/playground-open-lobby"
import { appendStudentCatalogScopeToUrl } from "@/lib/student-catalog-scope-client"

export function useStudentOpenPlaygroundLobbies(studentId: string | null) {
  const [lobbies, setLobbies] = useState<OpenPlaygroundLobby[]>([])
  const [loading, setLoading] = useState(Boolean(studentId))

  const reload = useCallback(
    async (silent = false) => {
      if (!studentId) {
        setLobbies([])
        setLoading(false)
        return
      }
      if (!silent) setLoading(true)
      try {
        const response = await studentApiFetch(
          appendStudentCatalogScopeToUrl(
            `/api/playground/open-lobbies?studentId=${encodeURIComponent(studentId)}`,
          ),
        )
        if (!response.ok) {
          if (!silent) setLobbies([])
          return
        }
        const data = (await response.json()) as { lobbies?: OpenPlaygroundLobby[] }
        setLobbies(Array.isArray(data.lobbies) ? data.lobbies : [])
      } catch {
        if (!silent) setLobbies([])
      } finally {
        setLoading(false)
      }
    },
    [studentId],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  useImmediateLivePoll(() => void reload(true), LIVE_STUDENT_SESSIONS_POLL_MS, Boolean(studentId))

  return { lobbies, loading, reload }
}
