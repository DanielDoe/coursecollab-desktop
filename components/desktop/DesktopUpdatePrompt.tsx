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
  moveDesktopAppToApplications,
  normalizeDesktopUpdateStatus,
  openDesktopUpdateDownloadPage,
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
      normalized.state === "installing" ||
      normalized.state === "ready" ||
      normalized.needsApplicationsFolder ||
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

  const locked = status.state === "downloading" || status.state === "installing"

  const title =
    status.state === "installing"
      ? "Installing update"
      : status.state === "downloading"
        ? "Downloading update"
        : status.state === "error"
          ? status.needsApplicationsFolder
            ? "Move CourseCollab to Applications"
            : "Update failed"
          : status.state === "ready"
            ? "Update ready to install"
            : "Update available"

  const description =
    status.state === "installing"
      ? (status.message ??
        `Installing version ${status.version ?? "the update"}. CourseCollab will restart when it is in place.`)
      : status.state === "downloading"
        ? "Please keep CourseCollab open until the download finishes."
        : status.state === "ready"
          ? (status.message ?? `Version ${status.version ?? ""} will install after you restart.`)
          : status.state === "error"
            ? (status.message ?? "The update could not be installed.")
            : (status.message ??
              `Version ${status.version ?? "a newer build"} is available (you are on ${status.currentVersion}).`)

  const primaryLabel = status.state === "ready" ? "Restart and install" : "Download update"

  const onMoveToApplications = () => {
    if (busy) return
    setBusy(true)
    void moveDesktopAppToApplications()
      .then((result) => {
        if (!result.ok) {
          setStatus((current) =>
            current
              ? {
                  ...current,
                  message: result.message ?? "Could not move CourseCollab into Applications.",
                }
              : current,
          )
        }
      })
      .finally(() => setBusy(false))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && locked) return
        if (!nextOpen && status.state === "error") {
          setOpen(false)
          return
        }
        if (!nextOpen) onRemindLater()
      }}
    >
      <DialogContent
        className={cn(CC_MODAL_SURFACE, "sm:max-w-md")}
        data-desktop-update-dialog=""
        showCloseButton={!locked}
        onEscapeKeyDown={(event) => {
          if (locked) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (locked) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[var(--cc-text-secondary,var(--cc-text))]">
            {description}
          </DialogDescription>
        </DialogHeader>
        {status.releaseNotes && !locked && status.state !== "error" ? (
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
        {status.state === "installing" ? (
          <div className="space-y-2" aria-live="polite" aria-busy="true">
            <span className="text-sm font-medium text-[var(--cc-text)]">Installing</span>
            <Progress value={100} className="h-2 animate-pulse" />
            <p className="text-sm text-[var(--cc-text-secondary,var(--cc-text))]">
              Leave CourseCollab open. It restarts on its own when the update is in place.
            </p>
          </div>
        ) : null}
        {locked ? null : (
        <DialogFooter className="gap-3 sm:gap-3">
          {status.state === "available" ? (
            <Button type="button" variant="ghost" onClick={onRemindLater} disabled={busy}>
              Remind me later
            </Button>
          ) : null}
          {status.state === "error" ? (
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Close
            </Button>
          ) : null}
          {status.state === "error" && !status.needsApplicationsFolder ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                void openDesktopUpdateDownloadPage()
              }}
              disabled={busy}
            >
              Download installer
            </Button>
          ) : null}
          {status.state === "error" && status.needsApplicationsFolder ? (
            <Button type="button" onClick={onMoveToApplications} disabled={busy}>
              Move to Applications
            </Button>
          ) : null}
          {status.state === "available" || status.state === "ready" ? (
            <Button
              type="button"
              onClick={onPrimary}
              disabled={busy || (status.state === "available" && !status.version)}
            >
              {primaryLabel}
            </Button>
          ) : null}
        </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
