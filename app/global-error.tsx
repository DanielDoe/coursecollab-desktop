"use client"

import { useEffect } from "react"
import {
  isChunkLoadErrorMessage,
  reportClientError,
  tryAutoReloadOnChunkLoadError,
} from "@/lib/system-log-client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const chunkStaleDeploy = isChunkLoadErrorMessage(error.message, error.name)

  useEffect(() => {
    if (tryAutoReloadOnChunkLoadError(error.message, error.name)) return
    if (isChunkLoadErrorMessage(error.message, error.name)) return

    reportClientError({
      severity: "critical",
      category: "frontend",
      title: "Global application error",
      errorMessage: error.message,
      stackTrace: error.stack,
      metadata: { digest: error.digest },
    })
  }, [error])

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 p-6 font-sans dark:bg-slate-950">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {chunkStaleDeploy ? "Updating application" : "Application Error"}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {chunkStaleDeploy
              ? "A new version was deployed. Refresh to load the latest code."
              : "A critical error occurred. Our team has been notified."}
          </p>
          <button
            type="button"
            onClick={() => (chunkStaleDeploy ? window.location.reload() : reset())}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            {chunkStaleDeploy ? "Reload page" : "Try again"}
          </button>
        </div>
      </body>
    </html>
  )
}