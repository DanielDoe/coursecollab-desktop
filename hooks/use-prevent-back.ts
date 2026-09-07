"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"

export function usePreventBack(loginPath: string) {
  const router = useRouter()
  const pathname = usePathname()
  const previousPathRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    // Store the current path
    previousPathRef.current = pathname

    // Handle back button press
    const handlePopState = (event: PopStateEvent) => {
      // Get the destination from browser history
      const destination = window.location.pathname
      
      // Only prevent going back if the destination is the login page
      if (destination === loginPath || destination.endsWith('/login')) {
        // Prevent going back to login
        event.preventDefault()
        window.history.pushState(null, "", previousPathRef.current || pathname)
        router.push(previousPathRef.current || pathname)
      } else {
        // Allow normal back navigation within the app
        previousPathRef.current = destination
      }
    }

    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [router, loginPath, pathname])
}
