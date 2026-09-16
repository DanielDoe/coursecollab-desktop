"use client"

import { BrandSurfaceChromeSync } from "@/components/brand-surface-chrome-sync"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { desktopAuth, desktopAuthLayout } from "@/components/auth/desktop-auth-primitives"
import { cn } from "@/lib/utils"
import type { UniversityRecord } from "@/lib/universities-shared"

type AuthShellProps = {
  children: React.ReactNode
  university?: UniversityRecord | null
  showBack?: boolean
  showHeader?: boolean
  backHref?: string
  className?: string
  contentMaxWidth?: string
  brandLocked?: boolean
  tagline?: string
}

export const authCardClass = desktopAuth.panelCard

export const authGhostBackButtonClass = desktopAuth.backLink

/**
 * Centered auth panel — logo + wordmark above the card.
 * No full-width header bar.
 */
export function AuthShell({
  children,
  university,
  showBack = true,
  showHeader = true,
  backHref = "/",
  className,
  contentMaxWidth,
  brandLocked = true,
  tagline,
}: AuthShellProps) {
  void university
  void showBack
  void backHref

  return (
    <div
      className={cn(
        "cc-brand-surface cc-brand-auth cc-desktop-welcome relative flex min-h-[100dvh] flex-col items-center overflow-y-auto bg-[var(--cc-background)] px-4 py-6 text-[var(--cc-text)] sm:py-8",
        brandLocked && "cc-brand-surface cc-brand-auth",
        className,
      )}
    >
      <BrandSurfaceChromeSync />
      <div aria-hidden className="cc-desktop-aurora pointer-events-none absolute inset-0" />

      <div
        className={cn(
          "relative z-10 my-auto w-full shrink-0",
          contentMaxWidth ?? desktopAuthLayout.contentColumn,
        )}
      >
        {showHeader ? (
          <div className="mb-5 flex flex-col items-center gap-1.5 text-center">
            <CourseCollabLogo
              size="md"
              height={36}
              framed={false}
              withWordmark
              wordmarkClassName="text-[18px] font-semibold tracking-tight text-[var(--cc-text)]"
            />
            {tagline ? (
              <p className="max-w-[26rem] text-[12px] leading-snug text-[var(--cc-text-muted)]">{tagline}</p>
            ) : null}
          </div>
        ) : null}

        {children}
      </div>
    </div>
  )
}

export function AuthGlassCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn(authCardClass, className)}>{children}</div>
}
