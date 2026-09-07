"use client"

import type { ReactNode } from "react"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  SYSTEM_ALERT_CLOSE,
  SYSTEM_ALERT_DESCRIPTION,
  SYSTEM_ALERT_ICONS,
  SYSTEM_ALERT_SHELL,
  SYSTEM_ALERT_SPARKLES,
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
}: Props) {
  const tokens = SYSTEM_ALERT_VARIANTS[variant]
  const Icon = SYSTEM_ALERT_ICONS[variant]
  const spinning = variant === "loading"

  const footerAction =
    action ??
    (onDismiss ? (
      <button type="button" className={systemAlertButtonClass(variant)} onClick={onDismiss}>
        {defaultAlertActionLabel(variant)}
      </button>
    ) : null)

  return (
    <div className={cn("cc-system-alert relative rounded-[20px]", SYSTEM_ALERT_SHELL, className)}>
      <div className="px-5 pb-5 pt-4">
        <div className="flex items-start gap-3 pr-7">
          <div
            className={cn(
              "mt-0.5 flex size-6 shrink-0 items-center justify-center",
              tokens.iconShape,
              tokens.iconWrap,
            )}
          >
            {variant === "warning" ? (
              <span className="translate-y-[3px] text-[11px] font-bold leading-none text-white">!</span>
            ) : (
              <Icon
                className={cn("size-3.5", tokens.iconColor, spinning && "animate-spin")}
                strokeWidth={2.75}
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {title ? (
              <div className="flex items-center gap-1.5">
                <Sparkles className={cn("size-3.5 shrink-0", SYSTEM_ALERT_SPARKLES)} strokeWidth={2} aria-hidden />
                <div className={cn("min-w-0", SYSTEM_ALERT_TITLE)}>{title}</div>
              </div>
            ) : null}

            {description ? (
              <div className={cn(title ? "mt-2" : null, SYSTEM_ALERT_DESCRIPTION)}>{description}</div>
            ) : null}

            {footerAction ? <div className="mt-4 flex flex-wrap items-center gap-5">{footerAction}</div> : null}
          </div>
        </div>

        {onClose}
      </div>
    </div>
  )
}

export { SYSTEM_ALERT_CLOSE, systemAlertButtonClass }
