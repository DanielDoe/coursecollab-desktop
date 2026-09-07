"use client"

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export type DashboardChromeTitlePortalApi = {
  titleEl: HTMLElement | null
  actionEl: HTMLElement | null
  setReplaceTitle: (replace: boolean) => void
}

type DashboardChromeTitlePortalContextValue = DashboardChromeTitlePortalApi & {
  registerTitleSlot: (el: HTMLDivElement | null) => void
  registerActionSlot: (el: HTMLDivElement | null) => void
}

export const DashboardChromeTitlePortalContext =
  createContext<DashboardChromeTitlePortalContextValue | null>(null)

/** Replaces the default chrome page title. */
export function DesktopChromeTitle({ children }: { children: ReactNode }) {
  const ctx = useContext(DashboardChromeTitlePortalContext)
  useLayoutEffect(() => {
    if (!ctx) return
    ctx.setReplaceTitle(true)
    return () => ctx.setReplaceTitle(false)
  }, [ctx])
  if (!ctx?.titleEl) return null
  return createPortal(children, ctx.titleEl)
}

/** Actions on the right side of the chrome title row. */
export function DesktopChromeTitleActions({ children }: { children: ReactNode }) {
  const ctx = useContext(DashboardChromeTitlePortalContext)
  if (!ctx?.actionEl) return null
  return createPortal(children, ctx.actionEl)
}

/** Lets a page put supporting text/actions on the chrome title row. */
export function DesktopChromeTitleExtras({
  meta,
  actionLabel,
  onAction,
  actionFill,
  actionColor,
}: {
  meta?: string
  actionLabel?: string
  onAction?: () => void
  actionFill?: string
  actionColor?: string
}) {
  const ctx = useContext(DashboardChromeTitlePortalContext)
  return (
    <>
      {ctx?.titleEl && meta
        ? createPortal(
            <p className="truncate text-sm text-[var(--cc-text-muted)]">{meta}</p>,
            ctx.titleEl,
          )
        : null}
      {ctx?.actionEl && onAction && actionLabel
        ? createPortal(
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white"
              style={{ backgroundColor: actionFill, color: actionColor }}
              onClick={onAction}
            >
              <Sparkles className="size-4" />
              {actionLabel}
            </button>,
            ctx.actionEl,
          )
        : null}
    </>
  )
}

export function DashboardChromeTitleProvider({ children }: { children: ReactNode }) {
  const [titleSlotEl, setTitleSlotEl] = useState<HTMLDivElement | null>(null)
  const [actionSlotEl, setActionSlotEl] = useState<HTMLDivElement | null>(null)
  const [, setReplaceTitle] = useState(false)
  const api = useMemo(
    () => ({
      titleEl: titleSlotEl,
      actionEl: actionSlotEl,
      setReplaceTitle,
      registerTitleSlot: setTitleSlotEl,
      registerActionSlot: setActionSlotEl,
    }),
    [actionSlotEl, titleSlotEl],
  )

  return (
    <DashboardChromeTitlePortalContext.Provider value={api}>
      {children}
    </DashboardChromeTitlePortalContext.Provider>
  )
}

/** Mount inside main content — pages portal title/actions here. */
export function DashboardChromeTitleSlots({ className }: { className?: string }) {
  const ctx = useContext(DashboardChromeTitlePortalContext)
  if (!ctx) return null

  return (
    <div
      className={cn(
        "mb-3 flex min-w-0 items-center justify-between gap-3 empty:hidden",
        className,
      )}
    >
      <div ref={ctx.registerTitleSlot} className="min-w-0 flex-1" />
      <div ref={ctx.registerActionSlot} className="flex shrink-0 items-center gap-2" />
    </div>
  )
}
