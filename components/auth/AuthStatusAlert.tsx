"use client"

import type { ReactNode } from "react"
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { desktopAuth } from "@/components/auth/desktop-auth-primitives"

export type AuthStatusTone = "error" | "warning" | "info" | "success"

const TONE: Record<
  AuthStatusTone,
  {
    surface: string
    icon: typeof CircleAlert
    role: "alert" | "status"
  }
> = {
  error: {
    surface: desktopAuth.alertError,
    icon: CircleAlert,
    role: "alert",
  },
  warning: {
    surface: desktopAuth.alertWarning,
    icon: TriangleAlert,
    role: "status",
  },
  info: {
    surface: desktopAuth.alertInfo,
    icon: Info,
    role: "status",
  },
  success: {
    surface: desktopAuth.alertSuccess,
    icon: CircleCheck,
    role: "status",
  },
}

export function AuthStatusAlert({
  tone,
  title,
  children,
  className,
  compact = false,
}: {
  tone: AuthStatusTone
  title?: string
  children: ReactNode
  className?: string
  compact?: boolean
}) {
  const spec = TONE[tone]
  const Icon = spec.icon

  return (
    <div
      role={spec.role}
      className={cn(
        "cc-auth-notice flex items-start gap-2 border",
        tone === "info" && "cc-auth-notice-hint",
        compact ? "rounded-md px-2.5 py-2 text-[13px]" : "rounded-xl px-3 py-2.5 text-sm",
        spec.surface,
        className,
      )}
    >
      <Icon
        className={cn("mt-0.5 shrink-0 opacity-80", compact ? "h-3.5 w-3.5" : "h-4 w-4")}
        aria-hidden
      />
      <div className="min-w-0 flex-1 leading-snug">
        {title ? (
          <strong className="font-medium">
            {title}
            {/[.!?]$/.test(title) ? " " : ". "}
          </strong>
        ) : null}
        <span className="whitespace-pre-line">{children}</span>
      </div>
    </div>
  )
}
