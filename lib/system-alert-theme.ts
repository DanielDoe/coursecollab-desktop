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

/** Shared card + text styles. Surfaces and actions follow the active appearance theme. */
export const SYSTEM_ALERT_SHELL =
  "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] shadow-[0_8px_30px_color-mix(in_srgb,black_18%,transparent)]"

export const SYSTEM_ALERT_TITLE = "text-[15px] font-semibold text-[var(--cc-text)]"
export const SYSTEM_ALERT_DESCRIPTION = "text-sm leading-relaxed text-[var(--cc-text-muted)]"
export const SYSTEM_ALERT_CLOSE = "text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]"

export const SYSTEM_ALERT_BUTTON_BASE =
  "inline-flex h-9 items-center rounded-lg px-5 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2"

/** Primary toast actions use the active appearance accent, same as the page buttons. */
const ACCENT_ACTION =
  "bg-[var(--cc-accent)] hover:bg-[var(--cc-accent-hover)] focus:ring-[var(--cc-accent)]/40"

export function systemAlertButtonClass(variant: SystemAlertVariant): string {
  return `${SYSTEM_ALERT_BUTTON_BASE} ${SYSTEM_ALERT_VARIANTS[variant].actionButton}`
}

export const SYSTEM_ALERT_VARIANTS: Record<SystemAlertVariant, SystemAlertTokens> = {
  default: {
    iconWrap: "bg-[var(--cc-accent)]",
    iconColor: "text-white",
    actionButton: ACCENT_ACTION,
  },
  success: {
    iconWrap: "bg-[var(--cc-accent)]",
    iconColor: "text-white",
    actionButton: ACCENT_ACTION,
  },
  warning: {
    iconWrap: "bg-[var(--cc-warning,#f59e0b)]",
    iconColor: "text-white",
    actionButton:
      "bg-[var(--cc-warning,#f59e0b)] hover:brightness-95 focus:ring-[var(--cc-warning,#f59e0b)]/40",
  },
  error: {
    iconWrap: "bg-[var(--cc-danger,var(--destructive))]",
    iconColor: "text-white",
    actionButton:
      "bg-[var(--cc-danger,var(--destructive))] hover:brightness-95 focus:ring-[var(--cc-danger,var(--destructive))]/40",
  },
  info: {
    iconWrap: "bg-[var(--cc-accent)]",
    iconColor: "text-white",
    actionButton: ACCENT_ACTION,
  },
  loading: {
    iconWrap: "bg-[var(--cc-accent)]",
    iconColor: "text-white",
    actionButton: ACCENT_ACTION,
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
