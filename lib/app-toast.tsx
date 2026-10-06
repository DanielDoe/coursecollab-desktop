"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"
import { toast as sonnerToast, type ExternalToast } from "sonner"
import {
  SYSTEM_ALERT_CLOSE,
  SystemAlertShell,
  systemAlertButtonClass,
} from "@/components/ui/system-alert-shell"
import {
  defaultAlertActionLabel,
  type SystemAlertVariant,
} from "@/lib/system-alert-theme"
import { cn } from "@/lib/utils"

type ToastContent = ReactNode | string
type ToastOptions = ExternalToast & { description?: ToastContent }

type ToastAction = {
  label: ReactNode
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}

function isToastAction(action: ExternalToast["action"]): action is ToastAction {
  return (
    typeof action === "object" &&
    action !== null &&
    "label" in action &&
    "onClick" in action
  )
}

const DEFAULT_DURATION = 5000

function isToastOptions(value: ToastContent | ToastOptions): value is ToastOptions {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false
  return (
    "description" in value ||
    "duration" in value ||
    "action" in value ||
    "id" in value ||
    "variant" in value
  )
}

function normalizeOptions(
  descriptionOrOptions?: ToastContent | ToastOptions,
): ToastOptions | undefined {
  if (descriptionOrOptions == null) return undefined
  if (isToastOptions(descriptionOrOptions)) return descriptionOrOptions
  return { description: descriptionOrOptions as ToastContent }
}

function alertVariant(opts?: ToastOptions): SystemAlertVariant {
  const raw = (opts as { variant?: string } | undefined)?.variant
  if (raw === "destructive" || raw === "error") return "error"
  if (raw === "success" || raw === "warning" || raw === "info" || raw === "loading") return raw
  return "default"
}

function renderAction(
  variant: SystemAlertVariant,
  dismiss: () => void,
  toastAction: ToastAction | null,
  fallbackAction?: ExternalToast["action"],
) {
  if (toastAction) {
    return (
      <button
        type="button"
        className={systemAlertButtonClass(variant)}
        onClick={(event) => {
          toastAction.onClick(event)
          dismiss()
        }}
      >
        {toastAction.label}
      </button>
    )
  }

  if (fallbackAction && !isToastAction(fallbackAction)) {
    return fallbackAction as ReactNode
  }

  return (
    <button type="button" className={systemAlertButtonClass(variant)} onClick={dismiss}>
      {defaultAlertActionLabel(variant)}
    </button>
  )
}

function showAlert(variant: SystemAlertVariant, title: ToastContent, opts?: ToastOptions) {
  const duration = opts?.duration ?? DEFAULT_DURATION

  return sonnerToast.custom(
    (toastId) => {
      const toastAction = isToastAction(opts?.action) ? opts.action : null
      const dismiss = () => sonnerToast.dismiss(toastId)

      return (
        <SystemAlertShell
          variant={variant}
          title={title}
          description={opts?.description}
          duration={duration}
          action={renderAction(variant, dismiss, toastAction, opts?.action)}
          onClose={
            <button
              type="button"
              aria-label="Dismiss notification"
              className={cn(
                "absolute right-3 top-3.5 rounded-md p-0.5 transition-colors",
                SYSTEM_ALERT_CLOSE,
              )}
              onClick={dismiss}
            >
              <X className="size-4" />
            </button>
          }
        />
      )
    },
    {
      ...opts,
      action: undefined,
      cancel: undefined,
      duration,
      unstyled: true,
      className: "cc-system-alert-sonner-wrap",
    },
  )
}

function showToast(title: ToastContent, descriptionOrOptions?: ToastContent | ToastOptions) {
  const opts = normalizeOptions(descriptionOrOptions)
  const variant = alertVariant(opts)
  if (variant === "loading") {
    return showAlert("loading", title, { ...opts, duration: Infinity })
  }
  return showAlert(variant, title, opts)
}

export const toast = Object.assign(showToast, {
  success: (title: ToastContent, descriptionOrOptions?: ToastContent | ToastOptions) =>
    showAlert("success", title, normalizeOptions(descriptionOrOptions)),

  error: (title: ToastContent, descriptionOrOptions?: ToastContent | ToastOptions) =>
    showAlert("error", title, normalizeOptions(descriptionOrOptions)),

  warning: (title: ToastContent, descriptionOrOptions?: ToastContent | ToastOptions) =>
    showAlert("warning", title, normalizeOptions(descriptionOrOptions)),

  info: (title: ToastContent, descriptionOrOptions?: ToastContent | ToastOptions) =>
    showAlert("info", title, normalizeOptions(descriptionOrOptions)),

  message: (title: ToastContent, descriptionOrOptions?: ToastContent | ToastOptions) =>
    showAlert("default", title, normalizeOptions(descriptionOrOptions)),

  loading: (title: ToastContent, descriptionOrOptions?: ToastContent | ToastOptions) =>
    showAlert("loading", title, { ...normalizeOptions(descriptionOrOptions), duration: Infinity }),

  dismiss: sonnerToast.dismiss,
  promise: sonnerToast.promise,
  custom: sonnerToast.custom,
})

export default toast
