"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Briefcase, FileText, Loader2, Target, Zap } from "lucide-react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { CoraSidebarMark } from "@/components/cora/CoraLogo"
import { getStudentData } from "@/lib/auth"
import { guestHasCapability } from "@/lib/guest/capabilities"
import { MATCH_BAND_LABELS } from "@/lib/guest/career/match-config"
import type { ApplicationWorkspace, ResumeProfile } from "@/lib/guest/career/types"
import { CareerUnlockBanner } from "@/components/guest/career/CareerUnlockBanner"
import { GuestCareerQuickActions } from "@/components/guest/career/GuestCareerQuickActions"
import { GuestResumeOnboardingBanner } from "@/components/guest/career/GuestResumeOnboardingBanner"
import { useGuestDashboard } from "@/components/guest/dashboard/GuestDashboardContext"
import { CoraChatInput } from "@/components/cora/CoraChatInput"
import {
  GUEST_CAREER_PLUS_MENU_ITEMS,
  GUEST_CAREER_PLUS_MENU_LABEL,
  guestPlusMenuTarget,
} from "@/lib/cora/guest-plus-menu"
import { Button } from "@/components/ui/button"
import {
  EMBED_INNER_PANEL,
  EMBED_MATERIAL_PANEL,
  EmbedModuleCard,
} from "@/components/student/dashboard-v2/embed-module-ui"
import { getGuestPortalTheme } from "@/lib/guest-module-themes"
import { cn } from "@/lib/utils"

const theme = getGuestPortalTheme()

function formatUpdated(iso: string | undefined): string {
  if (!iso) return "Not uploaded yet"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Recently"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function GuestCareerHome() {
  const router = useRouter()
  const { entitlements } = useGuestDashboard()
  const hasCareer = guestHasCapability(entitlements.capabilities, "career.cora")
  const [chatDraft, setChatDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [masterResume, setMasterResume] = useState<ResumeProfile | null>(null)
  const [applications, setApplications] = useState<ApplicationWorkspace[]>([])

  const load = useCallback(async () => {
    const d = getStudentData()
    if (!d?.databaseId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/guest/career/home?studentDatabaseId=${encodeURIComponent(d.databaseId)}`,
      )
      const json = await res.json()
      if (res.ok) {
        setMasterResume(json.masterResume ?? null)
        setApplications(json.applications ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const hasResume = Boolean(masterResume?.parsedText?.trim())
  const latestScored = applications.find((a) => a.matchScore != null)

  if (!hasCareer) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(EMBED_MATERIAL_PANEL, "overflow-hidden")}
        >
          <div className={cn("px-6 py-6 sm:px-8 sm:py-8", theme.page.softBg, "border-b", theme.page.border)}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <span className={cn("inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide", theme.page.badge)}>
                  Cora Career
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--cc-text)] sm:text-3xl">
                  Application copilot
                </h1>
                <p className="max-w-xl text-sm text-[var(--cc-text-muted)] sm:text-base">
                  Free quick scan on any job description. Unlock full keyword evidence and ATS fixes when you are ready.
                </p>
              </div>
              <Button className={cn("rounded-xl gap-2 shrink-0", theme.page.cta)} asChild>
                <Link href="/guest/cora-career/quick-scan">
                  <Zap className="size-4" />
                  Try quick scan
                </Link>
              </Button>
            </div>
          </div>
          {!hasResume && !loading ? (
            <div className="px-4 py-4 sm:px-6">
              <GuestResumeOnboardingBanner />
            </div>
          ) : null}
        </motion.section>

        <CareerUnlockBanner
          title="Free scan · full report with unlock"
          description="Match your résumé to any opportunity now. Missing keywords, evidence, and optimize tools unlock with Cora Career."
        />

        <GuestCareerQuickActions />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(EMBED_MATERIAL_PANEL, "overflow-hidden")}
      >
        <div className={cn("px-6 py-6 sm:px-8 sm:py-8", theme.page.softBg, "border-b", theme.page.border)}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex gap-4">
              <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", theme.page.iconBg, theme.page.iconText)}>
                <CoraSidebarMark className="scale-110" />
              </span>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide", theme.page.badge)}>
                    Cora Career
                  </span>
                  {hasResume ? (
                    <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-[11px] font-medium text-[var(--cc-text-secondary)]">
                      Résumé on file
                    </span>
                  ) : null}
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--cc-text)] sm:text-3xl">
                  Your application workspace
                </h1>
                <p className="max-w-xl text-sm text-[var(--cc-text-muted)]">
                  Upload once — Quick Scan, match, cover letters, and chat all re-read your master résumé every time.
                </p>
              </div>
            </div>
            <Button className={cn("rounded-xl gap-2 shrink-0", theme.page.cta)} asChild>
              <Link href="/guest/cora-career/quick-scan">
                <Zap className="size-4" />
                Quick scan
              </Link>
            </Button>
          </div>
        </div>
        {!loading && !hasResume ? (
          <div className="px-4 py-4 sm:px-6">
            <GuestResumeOnboardingBanner />
          </div>
        ) : null}
      </motion.section>

      <div className={cn(EMBED_MATERIAL_PANEL, "p-3 sm:p-4")}>
        <CoraChatInput
          inputValue={chatDraft}
          onInputChange={setChatDraft}
          placeholder="Paste a job description or ask Cora about your application…"
          plusMenuVariant="attach"
          plusMenuItems={GUEST_CAREER_PLUS_MENU_ITEMS}
          plusMenuItemsLabel={GUEST_CAREER_PLUS_MENU_LABEL}
          onQuickAction={(actionId) => {
            const target = guestPlusMenuTarget(actionId)
            if (target) router.push(target)
          }}
          onSend={() => {
            if (!chatDraft.trim()) return
            router.push(`/guest/cora-career/chat?q=${encodeURIComponent(chatDraft.trim())}`)
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[
          { label: "Applications", value: loading ? "—" : String(applications.length), icon: Briefcase },
          {
            label: "Latest match",
            value: latestScored?.matchScore != null ? `${latestScored.matchScore}%` : "—",
            icon: Target,
          },
          {
            label: "Résumé",
            value: hasResume ? "Ready" : "Missing",
            icon: FileText,
          },
          {
            label: "Updated",
            value: hasResume ? formatUpdated(masterResume?.updatedAt) : "—",
            icon: Zap,
          },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(EMBED_INNER_PANEL, "p-4")}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">{kpi.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[var(--cc-text)]">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      <EmbedModuleCard>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">Tools</h2>
          <Link href="/guest/settings?section=cora" className="text-xs font-medium text-[var(--cc-accent-dark)] hover:underline">
            Manage résumé
          </Link>
        </div>
        <div className="p-4 sm:p-5">
          <GuestCareerQuickActions />
        </div>
      </EmbedModuleCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={cn(EMBED_INNER_PANEL, "p-4 sm:p-5")}>
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-[var(--cc-accent-dark)]" />
            <h2 className="text-sm font-semibold text-[var(--cc-text)]">Master résumé</h2>
          </div>
          {loading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-[var(--cc-text-muted)]">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <p className="mt-3 font-medium text-[var(--cc-text)]">{masterResume?.label ?? "Master résumé"}</p>
              <p className="text-xs text-[var(--cc-text-muted)]">
                Updated {formatUpdated(masterResume?.updatedAt)}
                {masterResume?.originalFileName ? ` · ${masterResume.originalFileName}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button className={cn("rounded-xl", theme.page.cta)} asChild>
                  <Link href="/guest/cora-career/quick-scan">Quick scan</Link>
                </Button>
                <Button variant="outline" className="rounded-xl" asChild>
                  <Link href="/guest/settings?section=cora">Update résumé</Link>
                </Button>
              </div>
            </>
          )}
        </section>

        <section className={cn(EMBED_INNER_PANEL, "p-4 sm:p-5")}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Briefcase className="size-4 text-[var(--cc-accent-dark)]" />
              <h2 className="text-sm font-semibold text-[var(--cc-text)]">Applications</h2>
            </div>
            <Button variant="ghost" size="sm" className="rounded-lg" asChild>
              <Link href="/guest/cora-career/applications">View all</Link>
            </Button>
          </div>
          {loading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-[var(--cc-text-muted)]">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : applications.length === 0 ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-[var(--cc-text-muted)]">
                No applications yet. Paste a job in Quick Scan to create your first workspace.
              </p>
              <Button variant="outline" className="rounded-xl gap-2" asChild>
                <Link href="/guest/cora-career/quick-scan">
                  Start quick scan
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {applications.slice(0, 4).map((app) => (
                <li key={app.id}>
                  <Link
                    href={`/guest/cora-career/applications/${app.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--muted)]/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--cc-text)]">
                        {app.opportunity.organization ?? "Opportunity"}
                      </p>
                      <p className="truncate text-xs text-[var(--cc-text-muted)]">{app.opportunity.title}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {app.matchScore != null ? (
                        <p className="text-sm font-semibold tabular-nums text-[var(--cc-accent-dark)]">
                          {app.matchScore}%
                        </p>
                      ) : null}
                      <p className="text-[10px] capitalize text-[var(--cc-text-muted)]">
                        {app.matchBand ? MATCH_BAND_LABELS[app.matchBand] : app.status.toLowerCase()}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
