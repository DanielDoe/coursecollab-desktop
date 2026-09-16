import type { LucideIcon } from "lucide-react"
import {
  AlertCircle,
  Check,
  Info,
  Loader2,
  Sparkles,
  X,
} from "lucide-react"

export type SystemAlertVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "loading"

export type SystemAlertTokens = {
  iconWrap: string
  iconColor: string
  actionButton: string
}

/** Shared card + text styles (variant only affects the status icon). */
export const SYSTEM_ALERT_SHELL =
  "border-zinc-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-[#181b21] dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)]"

export const SYSTEM_ALERT_TITLE = "text-[15px] font-semibold text-zinc-900 dark:text-zinc-50"
export const SYSTEM_ALERT_DESCRIPTION = "text-sm leading-relaxed text-zinc-500 dark:text-zinc-400"
export const SYSTEM_ALERT_CLOSE =
  "text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"

export const SYSTEM_ALERT_BUTTON_BASE =
  "inline-flex h-9 items-center rounded-lg px-5 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2"

export function systemAlertButtonClass(variant: SystemAlertVariant): string {
  return `${SYSTEM_ALERT_BUTTON_BASE} ${SYSTEM_ALERT_VARIANTS[variant].actionButton}`
}

export const SYSTEM_ALERT_VARIANTS: Record<SystemAlertVariant, SystemAlertTokens> = {
  default: {
    iconWrap: "bg-[var(--cc-accent)]",
    iconColor: "text-white",
    actionButton:
      "bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-dark)] focus:ring-[var(--cc-accent)]/40",
  },
  success: {
    iconWrap: "bg-emerald-500",
    iconColor: "text-white",
    actionButton:
      "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/40 dark:bg-emerald-500 dark:hover:bg-emerald-400",
  },
  warning: {
    iconWrap: "bg-amber-400",
    iconColor: "text-white",
    actionButton:
      "bg-amber-500 hover:bg-amber-600 focus:ring-amber-400/40 dark:bg-amber-500 dark:hover:bg-amber-400",
  },
  error: {
    iconWrap: "bg-red-500",
    iconColor: "text-white",
    actionButton:
      "bg-red-500 hover:bg-red-600 focus:ring-red-500/40 dark:bg-red-500 dark:hover:bg-red-400",
  },
  info: {
    iconWrap: "bg-indigo-500",
    iconColor: "text-white",
    actionButton:
      "bg-indigo-500 hover:bg-indigo-600 focus:ring-indigo-500/40 dark:bg-indigo-500 dark:hover:bg-indigo-400",
  },
  loading: {
    iconWrap: "bg-[var(--cc-accent)]",
    iconColor: "text-white",
    actionButton:
      "bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-dark)] focus:ring-[var(--cc-accent)]/40",
  },
}

export const SYSTEM_ALERT_ICONS: Record<SystemAlertVariant, LucideIcon> = {
  default: Sparkles,
  success: Check,
  warning: AlertCircle,
  error: X,
  info: Info,
  loading: Loader2,
}

export function defaultAlertActionLabel(variant: SystemAlertVariant): string {
  if (variant === "error") return "Try again"
  return "Okay"
}

export function radixVariantToAlert(
  variant?: "default" | "destructive" | "success" | "warning" | null,
): SystemAlertVariant {
  if (variant === "destructive") return "error"
  if (variant === "success") return "success"
  if (variant === "warning") return "warning"
  return "default"
}

export function sonnerTypeToAlert(type?: string | null): SystemAlertVariant {
  if (type === "success") return "success"
  if (type === "error") return "error"
  if (type === "warning") return "warning"
  if (type === "info") return "info"
  if (type === "loading") return "loading"
  return "default"
}
