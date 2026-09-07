"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getStudentData } from "@/lib/auth"
import { appendNativeAppQuery, isNativeAppSearchParams } from "@/lib/mobile-native-app"
import { useNativeApp } from "@/hooks/use-native-app"

/** Redirect to dashboard when a valid student session already exists (native app resume). */
export function NativeStudentSessionRedirect({
  searchParams,
}: {
  searchParams: { get(name: string): string | null }
}) {
  const router = useRouter()
  const uaNative = useNativeApp()
  const isNative = isNativeAppSearchParams(searchParams) || uaNative

  useEffect(() => {
    if (!isNative) return
    const student = getStudentData()
    if (student) {
      router.replace(appendNativeAppQuery("/student/dashboard-v2"))
    }
  }, [isNative, router])

  return null
}
