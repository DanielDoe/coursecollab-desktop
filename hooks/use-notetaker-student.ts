"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useNativeApp } from "@/hooks/use-native-app"
import { notetakerNativePath, resolveNotetakerStudentDbId } from "@/lib/notetaker-client"

export function useNotetakerStudent() {
  const router = useRouter()
  const isNativeApp = useNativeApp()
  const [studentDbId, setStudentDbId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const id = resolveNotetakerStudentDbId()
    if (!id) {
      router.push(notetakerNativePath("/student/login", isNativeApp))
      return
    }
    setStudentDbId(id)
    setReady(true)
  }, [router, isNativeApp])

  const navPath = useCallback(
    (path: string) => notetakerNativePath(path, isNativeApp),
    [isNativeApp],
  )

  const goTo = useCallback(
    (path: string) => router.push(navPath(path)),
    [router, navPath],
  )

  const replaceTo = useCallback(
    (path: string) => router.replace(navPath(path)),
    [router, navPath],
  )

  return { studentDbId, isNativeApp, ready, navPath, goTo, replaceTo }
}
