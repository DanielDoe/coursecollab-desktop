"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { CC_MODAL_SURFACE } from "@/lib/appearance/modal-ui"
import { cn } from "@/lib/utils"
import {
  dismissDesktopUpdatePrompt,
  downloadDesktopUpdate,
  getDesktopUpdateStatus,
  installDesktopUpdate,
  normalizeDesktopUpdateStatus,
  shouldPromptDesktopUpdate,
  subscribeDesktopUpdateStatus,
  type DesktopUpdateStatus,
} from "@/lib/desktop-updates"

export function DesktopUpdatePrompt() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<DesktopUpdateStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const syncPromptVisibility = useCallback((next: DesktopUpdateStatus) => {
    const normalized = normalizeDesktopUpdateStatus(next)
    setStatus(normalized)
    if (
      normalized.state === "downloading" ||
      normalized.state === "ready" ||
      shouldPromptDesktopUpdate(normalized)
    ) {
      setOpen(true)
      return
    }
    if (normalized.state === "not-available" || normalized.state === "idle") {
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void getDesktopUpdateStatus().then((next) => {
      if (!cancelled) syncPromptVisibility(next)
    })
    const unsubscribe = subscribeDesktopUpdateStatus((next) => {
      if (!cancelled) syncPromptVisibility(next)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [syncPromptVisibility])

  if (!status?.supported) return null

  const onRemindLater = () => {
    if (status.version) dismissDesktopUpdatePrompt(status.version)
    setOpen(false)
  }

  const onPrimary = () => {
    if (!status || busy) return
    setBusy(true)
    void (async () => {
      try {
        if (status.state === "ready") {
          installDesktopUpdate()
          return
        }
        if (status.state === "available") {
          const next = await downloadDesktopUpdate()
          syncPromptVisibility(next)
        }
      } finally {
        setBusy(false)
      }
    })()
  }

  const title =
    status.state === "ready"
      ? "Update ready to install"
      : status.state === "downloading"
        ? "Downloading update"
        : "Update available"

  const description =
    status.state === "ready"
      ? (status.message ?? `Version ${status.version ?? ""} will install after you restart.`)
      : status.state === "downloading"
        ? "Please keep CourseCollab open until the download finishes."
        : (status.message ??
          `Version ${status.version ?? "a newer build"} is available (you are on ${status.currentVersion}).`)

  const primaryLabel =
    status.state === "ready"
      ? "Restart and install"
      : status.state === "downloading"
        ? "Downloading…"
        : "Download update"

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onRemindLater()
      }}
    >
      <DialogContent
        className={cn(CC_MODAL_SURFACE, "sm:max-w-md")}
        data-desktop-update-dialog=""
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[var(--cc-text-secondary,var(--cc-text))]">
            {description}
          </DialogDescription>
        </DialogHeader>
        {status.releaseNotes && status.state !== "downloading" ? (
          <pre
            className={cn(
              "max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border border-[var(--border)] p-3 text-xs",
              "bg-[var(--cc-modal-muted,var(--muted))] text-[var(--cc-text)]",
            )}
          >
            {status.releaseNotes}
          </pre>
        ) : null}
        {status.state === "downloading" ? (
          <div className="space-y-2" aria-live="polite" aria-busy="true">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-[var(--cc-text)]">Download progress</span>
              <span className="text-sm font-semibold tabular-nums text-[var(--cc-text)]">
                {status.percent ?? 0}%
              </span>
            </div>
            <Progress value={status.percent ?? 0} className="h-2" />
          </div>
        ) : null}
        <DialogFooter className="gap-2 sm:gap-0">
          {status.state !== "downloading" && status.state !== "ready" ? (
            <Button type="button" variant="ghost" onClick={onRemindLater} disabled={busy}>
              Remind me later
            </Button>
          ) : null}
          {status.state !== "downloading" ? (
            <Button
              type="button"
              onClick={onPrimary}
              disabled={busy || (status.state === "available" && !status.version)}
            >
              {primaryLabel}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
