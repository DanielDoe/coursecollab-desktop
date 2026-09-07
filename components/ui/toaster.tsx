"use client"

import { useToast } from "@/hooks/use-toast"
import { SYSTEM_ALERT_CLOSE, SystemAlertShell } from "@/components/ui/system-alert-shell"
import { radixVariantToAlert } from "@/lib/system-alert-theme"
import { cn } from "@/lib/utils"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(({ id, title, description, action, variant, duration, ...props }) => {
        const alertVariant = radixVariantToAlert(variant)
        const toastDuration = duration ?? 5000

        return (
          <Toast key={id} variant={variant} duration={toastDuration} {...props}>
            <SystemAlertShell
              variant={alertVariant}
              duration={toastDuration}
              title={title ? <ToastTitle>{title}</ToastTitle> : undefined}
              description={
                description ? <ToastDescription>{description}</ToastDescription> : undefined
              }
              action={action}
              onClose={
                <ToastClose
                  className={cn(
                    "absolute right-3.5 top-3.5 rounded-md p-1 transition-colors",
                    SYSTEM_ALERT_CLOSE,
                  )}
                />
              }
            />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
