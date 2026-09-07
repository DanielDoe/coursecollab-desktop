"use client"

import { useEffect } from "react"

/**
 * Client component to set up Monaco Editor error handler
 * This suppresses expected cancellation errors that occur during normal operation
 */
export function MonacoErrorHandlerProvider() {
  useEffect(() => {
    // Only set up error handler once
    if ((window as any).__monacoErrorHandlerSetup) {
      return
    }
    (window as any).__monacoErrorHandlerSetup = true

    // Check if we're in production (console override should handle this, but we check here too)
    const isDevelopment = 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      (typeof process !== 'undefined' && process.env.NODE_ENV === 'development')

    // Store original console.error
    const originalConsoleError = console.error

    // Override console.error to filter Monaco Editor cancellation errors
    console.error = (...args: any[]) => {
      // In production, suppress all console errors (console override should handle this, but double-check)
      if (!isDevelopment) {
        return
      }

      const errorString = args
        .map((arg) => (arg instanceof Error ? `${arg.message} ${arg.stack ?? ""}` : String(arg ?? "")))
        .join(" ")

      // React DevTools / Cursor inspector Object.keys() a params Promise on hover.
      if (
        errorString.includes("params are being enumerated") ||
        errorString.includes("searchParams are being enumerated") ||
        errorString.includes("sync-dynamic-apis")
      ) {
        return
      }

      const isMonacoCancelError =
        errorString.includes("Canceled: Canceled") &&
        (errorString.includes("monaco") ||
          errorString.includes("editor.api") ||
          errorString.includes("Ju.cancel") ||
          errorString.includes("HTMLBodyElement") ||
          errorString.includes("intercept-console-error"))

      if (isMonacoCancelError) {
        return
      }

      // Pass through all other errors (only in development)
      originalConsoleError.apply(console, args)
    }

    // Also handle unhandled promise rejections that might be Monaco-related
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      if (reason) {
        const reasonString = String(reason instanceof Error ? reason.message : reason)
        const stack = reason instanceof Error ? reason.stack : ""
        const isMonacoCancelError =
          (reasonString.trim() === "Canceled" ||
            reasonString.includes("Canceled: Canceled")) &&
          (!stack ||
            /monaco-editor|editor\.api|vs\/editor|@monaco-editor/i.test(stack))

        if (isMonacoCancelError) {
          event.preventDefault()
          return
        }
      }
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    // Cleanup
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
    }
  }, [])

  return null
}
