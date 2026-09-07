"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "@/components/student/dashboard-v2/light-motion"
import { X, Sparkles, Compass, LayoutDashboard, PanelLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDashboardV2 } from "./DashboardV2Context"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { portalAccentIconClass, portalIconBadgeClass } from "@/lib/portal-module-themes"
import {
  dismissWelcomeBannerPermanently,
  fetchDashboardBannerPrefs,
  getStudentDatabaseIdFromClient,
  readClientWelcomeDismissed,
  writeClientWelcomeDismissed,
} from "@/lib/student-dashboard-banner-prefs"

export function WelcomeTourCard() {
  const theme = getStudentModuleTheme("dashboard")
  const { setTourOpen, setWelcomeCardDismissed } = useDashboardV2()
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    const studentDbId = getStudentDatabaseIdFromClient()
    if (!studentDbId) {
      setDismissed(true)
      setWelcomeCardDismissed(true)
      return
    }

    const localDismissed = readClientWelcomeDismissed(studentDbId)
    if (localDismissed) {
      setDismissed(true)
      setWelcomeCardDismissed(true)
      return
    }

    let cancelled = false
    void fetchDashboardBannerPrefs(studentDbId).then((prefs) => {
      if (cancelled) return
      const serverDismissed = prefs?.welcomeDismissed === true
      if (serverDismissed) {
        writeClientWelcomeDismissed(studentDbId)
      }
      setDismissed(serverDismissed)
      setWelcomeCardDismissed(serverDismissed)
    })

    return () => {
      cancelled = true
    }
  }, [setWelcomeCardDismissed])

  const handleDismiss = () => {
    const studentDbId = getStudentDatabaseIdFromClient()
    setDismissed(true)
    setWelcomeCardDismissed(true)
    void dismissWelcomeBannerPermanently(studentDbId)
  }

  const handleTakeTour = () => {
    setTourOpen(true)
  }

  if (dismissed !== false) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4 }}
        className="relative"
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl bg-[var(--card)]",
            "shadow-[0_1px_2px_rgba(15,23,42,0.05),0_16px_40px_-24px_color-mix(in_srgb,var(--cc-accent)_50%,transparent)]",
            "dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_16px_40px_rgba(0,0,0,0.45)]",
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full blur-3xl"
            style={{ background: "color-mix(in srgb, var(--cc-accent) 16%, transparent)" }}
          />
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-3 right-3 z-10 rounded-full p-2 text-[var(--cc-text-muted)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--cc-text)]"
            aria-label="Dismiss welcome banner"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative p-5 pr-12 sm:p-6 sm:pr-14">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2.5">
                  <div className={portalIconBadgeClass(theme)}>
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h2 className="text-base font-semibold tracking-tight text-[var(--cc-text)] sm:text-lg">
                    Welcome to CourseCollab
                  </h2>
                </div>
                <p className="max-w-xl text-sm text-[var(--cc-text-muted)]">
                  Your command center — navigation, performance, and Cora in one place.
                </p>
                <ul className="mt-3 hidden space-y-1.5 text-sm text-[var(--cc-text-secondary)] sm:block">
                  <li className="flex items-center gap-2">
                    <Compass className={cn("h-3.5 w-3.5 shrink-0", portalAccentIconClass(theme))} />
                    <span>Sidebar groups for Learning, Assessments, and Support</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <LayoutDashboard className={cn("h-3.5 w-3.5 shrink-0", portalAccentIconClass(theme))} />
                    <span>Live grades, deadlines, and engagement</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <PanelLeft className={cn("h-3.5 w-3.5 shrink-0", portalAccentIconClass(theme))} />
                    <span>Breadcrumbs so you always know where you are</span>
                  </li>
                </ul>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  onClick={handleTakeTour}
                  className={cn("h-10 rounded-full px-5 font-semibold", theme.page.cta)}
                >
                  Take tour
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleDismiss}
                  className="h-10 rounded-full text-[var(--cc-text-muted)]"
                >
                  Later
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
