"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { isDesktopLoginOnlyShell, openWebAppPath } from "@/lib/desktop-auth-policy"

/** Redirects signup routes to the web app when running in the desktop shell. */
export function useDesktopSignupRedirect(webPath: string, fallbackRoute = "/auth/welcome") {
  const router = useRouter()

  useEffect(() => {
    if (!isDesktopLoginOnlyShell()) return
    openWebAppPath(webPath)
    router.replace(fallbackRoute)
  }, [webPath, fallbackRoute, router])
}
