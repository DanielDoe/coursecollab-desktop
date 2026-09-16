"use client"

import { CourseCollabLogo } from "@/components/course-collab-logo"
import { BrandSurfaceChromeSync } from "@/components/brand-surface-chrome-sync"
import { authCardClass } from "@/components/auth/AuthShell"
import { desktopAuthLayout } from "@/components/auth/desktop-auth-primitives"
import { cn } from "@/lib/utils"

export function AccessStatusShell({
  children,
  className,
  cardClassName,
}: {
  children: React.ReactNode
  className?: string
  cardClassName?: string
}) {
  return (
    <div
      className={cn(
        "cc-brand-surface cc-brand-auth access-status-page relative flex min-h-[100dvh] flex-col items-center justify-center px-6 py-10 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        "bg-[var(--cc-background)] text-[var(--cc-text)]",
        className,
      )}
    >
      <BrandSurfaceChromeSync />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_-12%,color-mix(in_srgb,var(--cc-accent)_8%,transparent),transparent),radial-gradient(ellipse_50%_40%_at_88%_110%,color-mix(in_srgb,var(--cc-brand-gold)_5%,transparent),transparent)]"
      />
      <div className={cn("relative z-10 flex w-full flex-col", desktopAuthLayout.contentColumn)}>
        <div className="mb-6 flex justify-center">
          <CourseCollabLogo size="sm" withWordmark />
        </div>
        <div className={cn(authCardClass, cardClassName)}>{children}</div>
        <p className="mt-auto pt-8 pb-6 text-center text-[11px] text-[var(--cc-text-muted)]">
          CourseCollab Desktop
        </p>
      </div>
    </div>
  )
}
