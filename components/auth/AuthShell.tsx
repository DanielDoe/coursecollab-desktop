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
        "cc-brand-surface cc-brand-auth cc-desktop-welcome relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--cc-background)] text-[var(--cc-text)]",
        brandLocked && "cc-brand-surface cc-brand-auth",
        className,
      )}
    >
      <BrandSurfaceChromeSync />
      <div aria-hidden className="cc-desktop-aurora pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 [scrollbar-gutter:stable]">
      <div
        className={cn(
          "mx-auto flex min-h-full w-full flex-col justify-center py-6 sm:py-8",
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
