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

export class SystemErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    const stack = error.stack ?? ""
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
