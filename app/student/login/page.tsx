"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { NativeAppLoginHub } from "@/components/native-app-login-hub"
import { StudentLoginForm } from "@/components/student-login-form"
import { useNativeApp } from "@/hooks/use-native-app"
import { isNativeAppSearchParams } from "@/lib/mobile-native-app"
import { getRememberedStudentLoginPath } from "@/lib/remembered-auth"
import { NativeStudentSessionRedirect } from "@/components/native-student-session-redirect"

/** Web → new university-first auth; native app keeps legacy course login. */
export default function StudentLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const uaNative = useNativeApp()
  const isNativeApp = isNativeAppSearchParams(searchParams) || uaNative
  const loginTab = searchParams.get("tab") === "guest" ? "guest" : "roster"
  const portal = searchParams.get("portal")
  const isGuestPath = loginTab === "guest" || searchParams.get("guest") === "1"

  useEffect(() => {
    if (isNativeApp || isGuestPath) return
    const reason = searchParams.get("reason")
    const base = getRememberedStudentLoginPath()
    const target =
      base === "/auth/student" && reason
        ? `/auth/student?reason=${encodeURIComponent(reason)}`
        : base
    router.replace(target)
  }, [isNativeApp, isGuestPath, router, searchParams])

  if (!isNativeApp && !isGuestPath) {
    return null
  }

  if (isNativeApp) {
    if (!portal && loginTab !== "guest") {
      return (
        <>
          <NativeStudentSessionRedirect searchParams={searchParams} />
          <NativeAppLoginHub />
        </>
      )
    }

    return (
      <>
        <NativeStudentSessionRedirect searchParams={searchParams} />
        <div className="native-app-shell cc-brand-surface cc-brand-auth min-h-[100dvh] w-full">
          <div className="w-full max-w-md mx-auto px-4 py-6 space-y-4">
            <StudentLoginForm defaultTab={loginTab} nativeApp />
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="cc-brand-surface cc-brand-auth min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <StudentLoginForm defaultTab="guest" />
      </div>
    </div>
  )
}
