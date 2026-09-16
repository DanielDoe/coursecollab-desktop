"use client"

import React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import {
  reportClientError,
  tryAutoReloadOnChunkLoadError,
  isChunkLoadErrorMessage,
  isBrowserExtensionDomNoise,
} from "@/lib/system-log-client"
import { Button } from "@/components/ui/button"

type Props = {
  children: React.ReactNode
  moduleName?: string
  fallbackTitle?: string
  /** When any key changes, clear a caught error (e.g. route pathname on desktop navigation). */
  resetKeys?: readonly unknown[]
}

type State = {
  hasError: boolean
  error: Error | null
}

function isNextRedirectError(error: Error): boolean {
  const digest = (error as Error & { digest?: string }).digest ?? ""
  return (
    error.message.startsWith("NEXT_REDIRECT") ||
    digest.startsWith("NEXT_REDIRECT") ||
    error.message.includes("redirect() is not supported in the Vite desktop shell") ||
    error.message.includes("permanentRedirect() is not supported in the Vite desktop shell")
  )
}

export class SystemErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    const stack = error.stack ?? ""
    // Keep redirect errors in the error state so React does not re-render the
    // throwing page in a loop. resetKeys clear this after navigation.
    if (isNextRedirectError(error)) {
      return { hasError: true, error }
    }
    if (isBrowserExtensionDomNoise(error.message, stack)) {
      return { hasError: false, error: null }
    }
    if (isChunkLoadErrorMessage(error.message, error.name)) {
      return { hasError: false, error: null }
    }
    return { hasError: true, error }
  }

  componentDidUpdate(prevProps: Props) {
    if (!this.state.hasError || !this.props.resetKeys?.length) return

    const prevKeys = prevProps.resetKeys
    const nextKeys = this.props.resetKeys
    const keysChanged =
      !prevKeys ||
      prevKeys.length !== nextKeys.length ||
      prevKeys.some((key, index) => key !== nextKeys[index])

    if (keysChanged) {
      this.setState({ hasError: false, error: null })
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const combinedStack = [error.stack, info.componentStack].filter(Boolean).join("\n")
    if (isNextRedirectError(error)) {
      return
    }
    if (isBrowserExtensionDomNoise(error.message, combinedStack)) {
      return
    }
    if (tryAutoReloadOnChunkLoadError(error.message, error.name)) {
      return
    }
    if (isChunkLoadErrorMessage(error.message, error.name)) {
      return
    }

    const route = typeof window !== "undefined" ? window.location.pathname : undefined
    reportClientError({
      severity: "error",
      category: "frontend",
      title: this.props.fallbackTitle ?? "React component crash",
      errorMessage: error.message,
      stackTrace: [error.stack, info.componentStack].filter(Boolean).join("\n"),
      moduleName: this.props.moduleName,
      featureName: this.props.fallbackTitle ?? undefined,
      route,
      metadata: {
        componentStack: info.componentStack,
        crashType: "react_error_boundary",
      },
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.state.error && isNextRedirectError(this.state.error)) {
        return (
          <div className="flex min-h-[12rem] items-center justify-center text-sm text-slate-500">
            Redirecting…
          </div>
        )
      }

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-red-200/80 bg-red-50/50 p-8 text-center dark:border-red-900/40 dark:bg-red-950/20">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Something went wrong
            </h2>
            <p className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
              This error has been logged for review. Try refreshing the page.
            </p>
            {import.meta.env.DEV && this.state.error ? (
              <pre className="mt-3 max-h-48 max-w-lg overflow-auto rounded-lg bg-black/5 p-3 text-left text-xs text-red-700 dark:bg-black/30 dark:text-red-300">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack?.split("\n").slice(0, 8).join("\n")}
              </pre>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <p className="text-xs text-slate-500 dark:text-slate-500">
            If this appeared after an update, a full refresh reloads the latest code.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
