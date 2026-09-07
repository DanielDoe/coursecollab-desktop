"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { appendNativeAppQuery, isNativeAppSearchParams } from "@/lib/mobile-native-app"
import { useNativeApp } from "@/hooks/use-native-app"

/** Legacy route — course selection lives in the faculty login wizard. */
export default function FacultySelectCoursePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const uaNative = useNativeApp()
  const isNativeApp = isNativeAppSearchParams(searchParams) || uaNative

  useEffect(() => {
    const target = isNativeApp
      ? appendNativeAppQuery("/faculty/login?step=course")
      : "/faculty/login?step=course"
    router.replace(target)
  }, [isNativeApp, router])

  return null
}
