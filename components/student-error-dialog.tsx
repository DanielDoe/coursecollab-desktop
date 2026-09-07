"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AlertCircle, WifiOff, RefreshCw, LogOut, ServerCrash } from "lucide-react"
import { logoutStudent } from "@/lib/auth"

export type StudentErrorType =
  | "session_expired"
  | "network_error"
  | "technical_difficulty"
  | "assessment_expired"
  | "partial_score_submitted"
  | "generic"

interface ErrorConfig {
  title: string
  description: string
  steps: string[]
  icon: React.ReactNode
  primaryAction: string
  onPrimary: () => void
}

const ERROR_CONFIGS: Record<StudentErrorType, Omit<ErrorConfig, "onPrimary">> = {
  session_expired: {
      title: "Session Expired",
      description: "Your login session has expired for security. You have been logged out.",
      steps: [
        "Log out completely (we've cleared your session)",
        "Close any extra tabs with this app",
        "Log back in with your credentials",
      ],
      icon: <LogOut className="h-10 w-10 text-amber-500" />,
      primaryAction: "Go to Login",
    },
    network_error: {
      title: "Connection Problem",
      description: "We couldn't reach the server. This is usually a network or connectivity issue.",
      steps: [
        "Check your internet connection (Wi‑Fi or mobile data)",
        "Try refreshing the page",
        "If on campus, verify you're on the correct network",
      ],
      icon: <WifiOff className="h-10 w-10 text-amber-500" />,
      primaryAction: "Try Again",
    },
    technical_difficulty: {
      title: "Technical Difficulty",
      description: "Something went wrong on our end. Your answers may have been saved.",
      steps: [
        "Refresh the page and try again",
        "If the problem continues, log out and log back in",
        "Contact your instructor if it persists",
      ],
      icon: <ServerCrash className="h-10 w-10 text-amber-500" />,
      primaryAction: "OK",
    },
    assessment_expired: {
      title: "Assessment Expired",
      description: "This assessment is no longer available. The deadline has passed.",
      steps: [
        "Check with your instructor about extensions",
        "If you have Trailblazer, you may be able to apply a rollover from Trade Center",
      ],
      icon: <AlertCircle className="h-10 w-10 text-amber-500" />,
      primaryAction: "Return to Dashboard",
    },
    partial_score_submitted: {
      title: "Partial Score Submitted",
      description: "Your previous attempt was auto-submitted. You've been redirected to view your results.",
      steps: [
        "Your partial answers were saved",
        "Check your results to see your score",
        "Contact your instructor if you need an extension",
      ],
      icon: <RefreshCw className="h-10 w-10 text-amber-500" />,
      primaryAction: "View Results",
    },
    generic: {
      title: "Something Went Wrong",
      description: "An unexpected error occurred.",
      steps: [
        "Try refreshing the page",
        "Log out and log back in if the issue continues",
      ],
      icon: <AlertCircle className="h-10 w-10 text-amber-500" />,
      primaryAction: "OK",
    },
}

function isRawTechnicalMessage(message: string): boolean {
  const trimmed = message.trim()
  if (trimmed.length > 140) return true
  return /webpack|is not a function|TypeError|ReferenceError|SyntaxError|NeonDbError|\.tsx:|\.js:| at /i.test(
    trimmed,
  )
}

function getErrorConfig(type: StudentErrorType, customMessage?: string): ErrorConfig {
  const base = ERROR_CONFIGS[type]
  const rawCustom = customMessage?.trim()
  const useRawAsSummary =
    rawCustom &&
    !isRawTechnicalMessage(rawCustom) &&
    (type === "technical_difficulty" || type === "generic")
  const desc = useRawAsSummary ? rawCustom : base.description
  return {
    ...base,
    description: desc,
    onPrimary: () => {
      if (type === "session_expired") logoutStudent()
    },
  }
}

interface StudentErrorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  errorType: StudentErrorType
  customMessage?: string
  onPrimaryClick?: () => void
  redirectTo?: string
}

export function StudentErrorDialog({
  open,
  onOpenChange,
  errorType,
  customMessage,
  onPrimaryClick,
  redirectTo,
}: StudentErrorDialogProps) {
  const config = getErrorConfig(errorType, customMessage)
  const technicalDetail =
    customMessage?.trim() && isRawTechnicalMessage(customMessage)
      ? customMessage.trim()
      : undefined

  const handlePrimary = () => {
    if (errorType === "session_expired") {
      logoutStudent(true)
      return
    }
    onOpenChange(false)
    onPrimaryClick?.()
    if (redirectTo && typeof window !== "undefined") {
      window.location.href = redirectTo
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[min(90vh,640px)] overflow-y-auto overflow-x-hidden">
        <AlertDialogHeader>
          <div className="flex items-start gap-4 min-w-0">
            <div className="shrink-0 rounded-full bg-amber-50 dark:bg-amber-950/50 p-3">
              {config.icon}
            </div>
            <div className="min-w-0 flex-1 space-y-2 overflow-hidden">
              <AlertDialogTitle className="break-words">{config.title}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <p className="break-words text-sm text-slate-600 dark:text-slate-400">
                  {config.description}
                </p>
              </AlertDialogDescription>
              {technicalDetail ? (
                <div className="max-h-36 overflow-y-auto overflow-x-hidden rounded-md border border-slate-200 bg-slate-100 p-2 dark:border-slate-700 dark:bg-slate-900/80">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Error details
                  </p>
                  <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {technicalDetail}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </AlertDialogHeader>
        {config.steps.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              What to do
            </p>
            <ol className="list-inside list-decimal space-y-1.5 break-words text-sm text-slate-700 dark:text-slate-300">
              {config.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogAction onClick={handlePrimary} className="w-full sm:w-auto">
            {config.primaryAction}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
