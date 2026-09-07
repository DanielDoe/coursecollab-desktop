import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
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
  iconShape: string
  actionButton: string
}

export const SYSTEM_ALERT_SHELL =
  "border border-[#E8E8E8] bg-white text-[#1E1033] shadow-[0_16px_40px_rgba(30,16,51,0.10)] dark:border-0 dark:bg-[#2A2A2A] dark:text-white dark:shadow-[0_16px_40px_rgba(0,0,0,0.28)]"

export const SYSTEM_ALERT_TITLE =
  "text-[14px] font-semibold leading-5 tracking-tight text-[#1E1033] dark:text-white"
export const SYSTEM_ALERT_DESCRIPTION =
  "break-words text-[13px] leading-5 text-[#6B6570] line-clamp-4 dark:text-[#A3A3A3]"
export const SYSTEM_ALERT_CLOSE =
  "text-[#8A8490] hover:bg-black/[0.06] hover:text-[#1E1033] dark:text-[#9A9A9A] dark:hover:bg-white/10 dark:hover:text-white"
export const SYSTEM_ALERT_SPARKLES = "text-[#7C5CBF] dark:text-white"

export const SYSTEM_ALERT_BUTTON_BASE =
  "inline-flex h-auto items-center bg-transparent p-0 text-[13px] font-medium text-[#1E1033] underline-offset-2 hover:underline focus:outline-none focus-visible:underline dark:text-white"

export function systemAlertButtonClass(_variant?: SystemAlertVariant): string {
  return SYSTEM_ALERT_BUTTON_BASE
}

export const SYSTEM_ALERT_VARIANTS: Record<SystemAlertVariant, SystemAlertTokens> = {
  default: {
    iconWrap: "bg-[#7C5CBF]",
    iconColor: "text-white",
    iconShape: "rounded-full",
    actionButton: SYSTEM_ALERT_BUTTON_BASE,
  },
  success: {
    iconWrap: "bg-[#2E9B4F]",
    iconColor: "text-white",
    iconShape: "rounded-full",
    actionButton: SYSTEM_ALERT_BUTTON_BASE,
  },
  warning: {
    iconWrap: "bg-[#E89A1C] cc-toast-warn-shape",
    iconColor: "text-white",
    iconShape: "",
    actionButton: SYSTEM_ALERT_BUTTON_BASE,
  },
  error: {
    iconWrap: "bg-[#E24B4B]",
    iconColor: "text-white",
    iconShape: "rounded-full",
    actionButton: SYSTEM_ALERT_BUTTON_BASE,
  },
  info: {
    iconWrap: "bg-[#3B82F6]",
    iconColor: "text-white",
    iconShape: "rounded-full",
    actionButton: SYSTEM_ALERT_BUTTON_BASE,
  },
  loading: {
    iconWrap: "bg-[#7C5CBF]",
    iconColor: "text-white",
    iconShape: "rounded-full",
    actionButton: SYSTEM_ALERT_BUTTON_BASE,
  },
}

export const SYSTEM_ALERT_ICONS: Record<SystemAlertVariant, LucideIcon> = {
  default: Sparkles,
  success: Check,
  warning: AlertTriangle,
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
