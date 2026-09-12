"use client"

import { useCallback, useEffect, useState } from "react"
import { DrawerNavIcon } from "@/components/student/dashboard-v2/DrawerNavIcon"
import { useToast } from "@/hooks/use-toast"
import { magnificSidebarNavHoverClass } from "@/lib/appearance/magnific-shell"
import {
  desktopUpdateAriaLabel,
  desktopUpdateButtonLabel,
  desktopUpdateFeedback,
  getDesktopUpdateStatus,
  isDesktopUpdateInstallFailure,
  normalizeDesktopUpdateStatus,
  openDesktopUpdateDownloadPage,
  runDesktopUpdateAction,
  subscribeDesktopUpdateStatus,
  type DesktopUpdateStatus,
} from "@/lib/desktop-updates"
import { cn } from "@/lib/utils"

const INITIAL_STATUS: DesktopUpdateStatus = {
  state: "idle",
  supported: false,
  currentVersion: "",
}

type CheckForUpdatesButtonProps = {
  collapsed: boolean
  variant?: "nav" | "pill"
}

export function CheckForUpdatesButton({ collapsed, variant = "nav" }: CheckForUpdatesButtonProps) {
  const { toast } = useToast()
  const [status, setStatus] = useState<DesktopUpdateStatus>(INITIAL_STATUS)

  useEffect(() => {
    let cancelled = false

    void getDesktopUpdateStatus().then((next) => {
      if (!cancelled) setStatus(normalizeDesktopUpdateStatus(next))
    })

    const unsubscribe = subscribeDesktopUpdateStatus((next) => {
      if (!cancelled) setStatus(normalizeDesktopUpdateStatus(next))
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    // Keep install failures visible — don't silently bounce back to "Update".
    if (status.state === "error" && isDesktopUpdateInstallFailure(status)) return
    if (status.state !== "not-available" && status.state !== "error") return
    const timer = window.setTimeout(() => {
      setStatus((current) =>
        current.state === status.state
          ? { ...current, state: "idle", message: undefined }
          : current,
      )
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [status])

  const onClick = useCallback(() => {
    if (status.state === "checking" || status.state === "downloading") return

    // Install failures: open the manual installer instead of re-entering the Get→Install loop.
    if (status.state === "error" && isDesktopUpdateInstallFailure(status)) {
      void openDesktopUpdateDownloadPage().then((ok) => {
        toast({
          title: ok ? "Opening download page" : "Could not open download page",
          description: ok
            ? "Install the latest CourseCollab build and replace the app in Applications."
            : "Visit GitHub Releases to download the latest installer.",
          variant: ok ? "default" : "destructive",
        })
      })
      return
    }

    // Don't force "checking" over Install — that made the pill flip to Update on failure.
    if (status.state !== "ready") {
      setStatus((current) => ({ ...current, state: "checking", message: undefined }))
    }

    void runDesktopUpdateAction(status)
      .then((next) => {
        const resolved = normalizeDesktopUpdateStatus(next)
        setStatus(resolved)
        const feedback = desktopUpdateFeedback(resolved)
        toast({
          title: feedback.title,
          description: feedback.description,
          variant: feedback.variant,
        })
      })
      .catch(() => {
        toast({
          title: "Update failed",
          description: "Something went wrong while applying the update. Try again, or download the installer manually.",
          variant: "destructive",
        })
      })
  }, [status, toast])

  const label = desktopUpdateButtonLabel(status)
  const feedback = desktopUpdateFeedback(status)
  const busy = status.state === "checking" || status.state === "downloading"
  const highlight = status.state === "available" || status.state === "ready"
  const failed = status.state === "error"
  const current = status.state === "not-available"
  const installFailed = failed && isDesktopUpdateInstallFailure(status)
  const iconName =
    status.state === "ready" || status.state === "available" || status.state === "downloading"
      ? "download-outline"
      : status.state === "not-available"
        ? "checkmark-circle-outline"
        : status.state === "error"
          ? "alert-circle-outline"
          : "refresh-outline"
  const pillLabel =
    status.state === "checking"
      ? "…"
      : status.state === "downloading"
        ? `${status.percent ?? 0}%`
        : status.state === "ready"
          ? "Install"
          : status.state === "available"
            ? "Get"
            : installFailed
              ? "Download"
              : "Update"

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full font-semibold leading-none transition-colors",
          collapsed ? "size-8 text-[11px]" : "h-7 min-w-[3.75rem] px-3 text-[12px]",
          busy && "cursor-wait opacity-80",
          // Mutually exclusive color states — avoid stacking text-* classes that fight in twMerge.
          failed
            ? "bg-[#F3D4D4] text-[#9B2C2C] hover:bg-[#EBC4C4] dark:bg-[#4A2A2A] dark:text-[#F0B4B4] dark:hover:bg-[#5A3434]"
            : current
              ? "bg-[#D8E8DA] text-[#1F6B38] hover:bg-[#C9DCCC] dark:bg-[#2A4A32] dark:text-[#C5E6CC] dark:hover:bg-[#355A3E]"
              : highlight
                ? "bg-[var(--cc-accent)] text-[#FFFFFF] hover:bg-[var(--cc-accent-hover)] dark:bg-[var(--cc-accent)] dark:text-[#FFFFFF] dark:hover:bg-[var(--cc-accent-hover)]"
                : "bg-[#C8CEE3] text-[#1A1A1A] hover:bg-[#B4BBD4] dark:bg-[#8B93B0] dark:text-[#141414] dark:hover:bg-[#9AA2BC]",
        )}
        aria-label={desktopUpdateAriaLabel(status)}
        title={feedback.description}
      >
        {collapsed ? (status.state === "ready" ? "!" : installFailed ? "DL" : "Up") : pillLabel}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "relative flex w-full items-center rounded-lg text-[13px] font-medium text-[#6B6B6B] dark:text-[#9ca3af]",
        magnificSidebarNavHoverClass,
        collapsed ? "justify-center py-2" : "justify-center gap-2 px-2.5 py-2",
        highlight && "text-[var(--cc-accent)]",
        current && "text-[#2f7d4a] dark:text-[#86efac]",
        failed && "text-[var(--cc-danger)]",
        busy && "cursor-wait opacity-80",
      )}
      aria-label={desktopUpdateAriaLabel(status)}
      title={feedback.description}
    >
      <DrawerNavIcon
        name={iconName}
        size={18}
        color="currentColor"
        className={busy ? "animate-spin" : undefined}
      />
      {!collapsed ? (
        <span className="min-w-0 text-center">
          <span className="block truncate">{installFailed ? "Download installer" : label}</span>
          {status.state !== "idle" && !busy ? (
            <span className="mt-0.5 block truncate text-[11px] font-normal opacity-80">
              {feedback.description}
            </span>
          ) : null}
        </span>
      ) : null}
      {collapsed && highlight ? (
        <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[var(--cc-accent)]" aria-hidden />
      ) : null}
    </button>
  )
}
