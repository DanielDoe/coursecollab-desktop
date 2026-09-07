"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { DesktopAuthLoading } from "@/components/auth/DesktopAuthLoading"
import { persistLastDesktopPortal, resumeDesktopSession } from "@/lib/desktop-session-resume"
import { DesktopAuthShell } from "@/components/auth/DesktopAuthShell"
import { DesktopWelcomeHeadline } from "@/components/auth/desktop-welcome-headline"
import {
  DesktopAuthPanel,
  DesktopAuthPanelBody,
  DesktopAuthPanelCard,
} from "@/components/auth/desktop-auth-primitives"
import { DesktopAuthStagger } from "@/components/auth/desktop-auth-motion"
import { DESKTOP_VISIBLE_PORTALS, LOGIN_PORTAL_OPTIONS } from "@/lib/login-portals"
import { cn } from "@/lib/utils"

export default function AuthWelcomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [ready, setReady] = useState(false)
  const primaryPortal = LOGIN_PORTAL_OPTIONS.find((option) => option.primary) ?? LOGIN_PORTAL_OPTIONS[0]
  const signedOut = searchParams.get("signed_out") === "1" || searchParams.get("change") === "1"

  useEffect(() => {
    if (signedOut) {
      setReady(true)
      return
    }
    let cancelled = false
    void resumeDesktopSession().then((path) => {
      if (cancelled) return
      if (path) {
        router.replace(path)
        return
      }
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [router, signedOut])

  if (!ready) {
    return (
      <DesktopAuthShell>
        <DesktopAuthLoading label="Signing you back in" />
      </DesktopAuthShell>
    )
  }

  return (
    <DesktopAuthShell wide hero={<DesktopWelcomeHeadline />}>
      <DesktopAuthPanel>
        <DesktopAuthPanelBody>
          <DesktopAuthPanelCard className="p-5">
            <DesktopAuthStagger className="space-y-5">
              <div className="space-y-1.5">
                <h2 className="text-[18px] font-semibold tracking-tight text-[var(--cc-text)]">
                  Sign in
                </h2>
                <p className="text-[15px] leading-snug text-[var(--cc-text-secondary)]">
                  Choose how you access CourseCollab.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  persistLastDesktopPortal("student")
                  router.push(primaryPortal.href)
                }}
                className="cc-desktop-welcome-primary flex h-11 w-full items-center justify-between rounded-lg bg-[var(--cc-accent)] px-4 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--cc-accent-hover)] active:scale-[0.995]"
              >
                <span>{primaryPortal.label}</span>
                <ChevronRight className="h-4 w-4 opacity-90" aria-hidden />
              </button>

              <div className="space-y-2.5">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--cc-text-muted)]">
                  Other portals
                </p>

                <div
                  className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--cc-background)]"
                  role="list"
                >
                  {DESKTOP_VISIBLE_PORTALS.map((portal, index) => {
                    const Icon = portal.icon
                    const isLast = index === DESKTOP_VISIBLE_PORTALS.length - 1
                    return (
                      <button
                        key={portal.id}
                        type="button"
                        role="listitem"
                        onClick={() => {
                          persistLastDesktopPortal(portal.id === "faculty" ? "faculty" : "student")
                          router.push(portal.href)
                        }}
                        className={cn(
                          "cc-desktop-welcome-row flex w-full items-center gap-3.5 px-3.5 py-3 text-left transition-colors",
                          "hover:bg-[var(--cc-accent-soft)] active:bg-[color-mix(in_srgb,var(--cc-accent-soft)_70%,var(--cc-surface))]",
                          !isLast && "border-b border-[var(--border)]",
                        )}
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: portal.iconBg, color: portal.accent }}
                        >
                          <Icon className="h-[18px] w-[18px]" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-medium text-[var(--cc-text)]">
                            {portal.label}
                          </span>
                          <span className="mt-0.5 block text-[13px] leading-snug text-[var(--cc-text-secondary)]">
                            {portal.description}
                          </span>
                        </span>
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)]"
                          aria-hidden
                        />
                      </button>
                    )
                  })}
                </div>
              </div>
            </DesktopAuthStagger>
          </DesktopAuthPanelCard>
        </DesktopAuthPanelBody>
      </DesktopAuthPanel>
    </DesktopAuthShell>
  )
}
