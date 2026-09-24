"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import {
  SYSTEM_ALERT_CLOSE,
  SYSTEM_ALERT_DESCRIPTION,
  SYSTEM_ALERT_ICONS,
  SYSTEM_ALERT_SHELL,
  SYSTEM_ALERT_TITLE,
  SYSTEM_ALERT_VARIANTS,
  defaultAlertActionLabel,
  systemAlertButtonClass,
  type SystemAlertVariant,
} from "@/lib/system-alert-theme"

type Props = {
  variant?: SystemAlertVariant
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  onDismiss?: () => void
  onClose?: ReactNode
  className?: string
  showProgress?: boolean
  duration?: number
}

export function SystemAlertShell({
  variant = "default",
  title,
  description,
  action,
  onDismiss,
  onClose,
  className,
  showProgress = false,
  duration = 5000,
}: Props) {
  const tokens = SYSTEM_ALERT_VARIANTS[variant]
  const Icon = SYSTEM_ALERT_ICONS[variant]
  const spinning = variant === "loading"
  const showTimer = showProgress && Number.isFinite(duration) && duration > 0

  const footerAction =
    action ??
    (onDismiss ? (
      <button type="button" className={systemAlertButtonClass(variant)} onClick={onDismiss}>
        {defaultAlertActionLabel(variant)}
      </button>
    ) : null)

  return (
    <div className={cn("cc-system-alert relative overflow-hidden rounded-xl border", SYSTEM_ALERT_SHELL, className)}>
      <div className="px-4 pb-4 pt-4">
        <div className="flex items-center gap-2.5 pr-7">
          <div
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full",
              tokens.iconWrap,
            )}
          >
            <Icon
              className={cn("size-3", tokens.iconColor, spinning && "animate-spin")}
              strokeWidth={2.75}
            />
          </div>
          {title ? <div className={cn("min-w-0 flex-1", SYSTEM_ALERT_TITLE)}>{title}</div> : null}
        </div>

        {onClose}

        {description ? (
          <div className={cn("mt-2 pl-7", SYSTEM_ALERT_DESCRIPTION)}>{description}</div>
        ) : null}

        {footerAction ? <div className="mt-4 flex justify-end">{footerAction}</div> : null}
      </div>

      {showTimer ? (
        <div className="h-[2px] w-full bg-[var(--muted)]">
          <div
            className="cc-system-alert-progress h-full origin-left rounded-full bg-[var(--cc-accent)]"
            style={{ animationDuration: `${duration}ms` }}
            aria-hidden
          />
        </div>
      ) : null}
    </div>
  )
}

export { SYSTEM_ALERT_CLOSE, systemAlertButtonClass }
