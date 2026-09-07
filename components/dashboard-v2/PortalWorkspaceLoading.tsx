"use client"

import { CcBookLoader } from "@/components/ui/cc-book-loader"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type PortalWorkspaceLoadingProps = {
  title: string
  subtitle?: string
  detail?: string
  detailMono?: string
  fullScreen?: boolean
  className?: string
}

export function PortalWorkspaceLoading({
  title,
  subtitle,
  detail,
  detailMono,
  fullScreen = false,
  className,
}: PortalWorkspaceLoadingProps) {
  const panel = (
    <div
      className={cn("flex w-full max-w-sm flex-col items-center text-center", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <CcBookLoader size="lg" label={title} />
      <div className="mt-6 min-w-0">
        {subtitle ? (
          <p className={cn("text-[11px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
            {subtitle}
          </p>
        ) : null}
        <p className={cn("text-base font-semibold leading-snug", PORTAL_TEXT, subtitle && "mt-1")}>
          {title}
        </p>
        {detailMono ? (
          <p className={cn("mt-1 truncate font-mono text-xs", PORTAL_TEXT_MUTED)}>{detailMono}</p>
        ) : null}
        {detail ? <p className={cn("mt-2 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{detail}</p> : null}
      </div>
    </div>
  )

  const backdrop = (
    <>
      <div className="absolute inset-0 bg-[var(--cc-background)]" aria-hidden />
      <div
        className="absolute inset-0 pointer-events-none opacity-100 dark:opacity-80"
        style={{
          background:
            "radial-gradient(circle at 18% 20%, rgba(79,45,127,0.08), transparent 46%), radial-gradient(circle at 82% 80%, rgba(255,184,28,0.08), transparent 46%)",
        }}
        aria-hidden
      />
    </>
  )

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-8 text-[var(--cc-text)]"
        aria-label={subtitle ?? title}
      >
        {backdrop}
        <div className="absolute inset-0 bg-[var(--cc-background)]/75 backdrop-blur-sm" aria-hidden />
        <div className="relative z-10 w-full max-w-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-reduce:animate-none">
          {panel}
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex min-h-screen flex-col items-center justify-center px-4 py-12 text-[var(--cc-text)]"
      aria-label={subtitle ?? title}
    >
      {backdrop}
      <div className="relative z-10 w-full max-w-sm">{panel}</div>
    </div>
  )
}
