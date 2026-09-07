"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { BrandSurfaceChromeSync } from "@/components/brand-surface-chrome-sync"
import { CourseCollabLogo } from "@/components/course-collab-logo"
import { desktopAuthLayout } from "@/components/auth/desktop-auth-primitives"
import { cn } from "@/lib/utils"

type DesktopAuthShellProps = {
  children: ReactNode
  /** Hero block between logo and card (welcome headline). */
  hero?: ReactNode
  /** Static line under the logo on non-welcome auth screens. */
  sidebarTagline?: string
  footerLink?: { href: string; label: string }
  /** Slightly wider column for the welcome portal picker. */
  wide?: boolean
  className?: string
}

/**
 * Centered auth panel — logo + wordmark above the card.
 * No full-width header bar.
 */
export function DesktopAuthShell({
  children,
  hero,
  sidebarTagline,
  footerLink,
  wide = false,
  className,
}: DesktopAuthShellProps) {
  const router = useRouter()

  return (
    <div
      className={cn(
        "cc-brand-surface cc-brand-auth cc-desktop-welcome relative flex h-[100dvh] min-h-[100dvh] items-center justify-center overflow-y-auto bg-[var(--cc-background)] px-4 py-8 text-[var(--cc-text)]",
        className,
      )}
    >
      <BrandSurfaceChromeSync />
      <div aria-hidden className="cc-desktop-aurora pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex w-full flex-col items-center">
        <div
          className={cn(
            "w-full",
            wide ? "mx-auto max-w-[420px]" : desktopAuthLayout.contentColumn,
          )}
        >
          <div className={cn("flex flex-col items-center text-center", hero ? "mb-3" : "mb-5")}>
            <CourseCollabLogo
              size="lg"
              height={48}
              framed={false}
              withWordmark
              wordmarkClassName="text-[24px] font-bold tracking-tight text-[var(--cc-text)]"
            />
            {sidebarTagline ? (
              <p className="mt-2 max-w-[22rem] text-[15px] leading-snug text-[var(--cc-text-secondary)]">
                {sidebarTagline}
              </p>
            ) : null}
          </div>
        </div>

        {hero ? (
          <div className="mb-4 w-full max-w-[min(100vw,42rem)] px-4">{hero}</div>
        ) : null}

        <div
          className={cn(
            "w-full",
            wide ? "mx-auto max-w-[420px]" : desktopAuthLayout.contentColumn,
          )}
        >
          {children}

          {footerLink ? (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => router.push(footerLink.href)}
                className="text-[13px] font-medium text-[var(--cc-text-muted)] transition-colors hover:text-[var(--cc-text-secondary)]"
              >
                {footerLink.label}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
