"use client"

import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface BrowserAIBlockerBannerProps {
  className?: string
}

/**
 * Banner component to inform users that browser AI tools are not permitted during assessments
 */
export function BrowserAIBlockerBanner({ className = "" }: BrowserAIBlockerBannerProps) {
  return (
    <Alert className={`bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 ${className}`}>
      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
      <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
        Browser AI tools (e.g., Gemini, Copilot) are not permitted during assessments.
      </AlertDescription>
    </Alert>
  )
}
