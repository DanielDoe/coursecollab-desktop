import { toast as appToast } from "@/lib/app-toast"

type ToastVariant = "default" | "destructive" | "success" | "warning"

type ToastOptions = {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
  className?: string
}

export const universalToast = ({
  title,
  description,
  variant = "default",
  duration = 5000,
}: ToastOptions) => {
  const opts = { description, duration }

  if (variant === "destructive") {
    appToast.error(title, opts)
    return
  }
  if (variant === "success") {
    appToast.success(title, opts)
    return
  }
  if (variant === "warning") {
    appToast.warning(title, opts)
    return
  }
  appToast.info(title, opts)
}

export const toast = {
  success: (title: string, description?: string) =>
    universalToast({ title, description, variant: "success" }),

  error: (title: string, description?: string) =>
    universalToast({ title, description, variant: "destructive" }),

  info: (title: string, description?: string) =>
    universalToast({ title, description, variant: "default" }),

  warning: (title: string, description?: string) =>
    universalToast({ title, description, variant: "warning" }),
}

export default universalToast
