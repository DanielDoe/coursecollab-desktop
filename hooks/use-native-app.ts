"use client"

import { useEffect, useState } from "react"
import { NATIVE_APP_QUERY, NATIVE_APP_UA_TOKEN } from "@/lib/mobile-native-app"

export function detectNativeAppClient(): boolean {
  if (typeof window === "undefined") return false
  const params = new URLSearchParams(window.location.search)
  return (
    params.get(NATIVE_APP_QUERY) === "1" ||
    document.documentElement.dataset.nativeApp === "true" ||
    document.body.classList.contains("cc-native-app") ||
    Boolean((window as Window & { __COURSE_COLLAB_NATIVE__?: boolean }).__COURSE_COLLAB_NATIVE__) ||
    navigator.userAgent.includes(NATIVE_APP_UA_TOKEN)
  )
}

export function useNativeApp(): boolean {
  // Always false on first render so SSR HTML matches the client (avoids hydration errors in WebView).
  const [native, setNative] = useState(false)

  useEffect(() => {
    const isNative = detectNativeAppClient()
    setNative(isNative)
    if (isNative) {
      document.documentElement.dataset.nativeApp = "true"
    }
  }, [])

  return native
}
