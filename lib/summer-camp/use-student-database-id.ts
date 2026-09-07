"use client"

import { useEffect, useState } from "react"
import { resolveStudentDbIdForCamp } from "@/lib/summer-camp/enroll-client"

/** Reactive student DB id — re-reads after mount for dashboard hydration timing. */
export function useStudentDatabaseId(): string | null {
  const [dbId, setDbId] = useState<string | null>(null)

  useEffect(() => {
    const sync = () => setDbId(resolveStudentDbIdForCamp())
    sync()
    window.addEventListener("focus", sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener("focus", sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return dbId ?? resolveStudentDbIdForCamp()
}
