"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Clock,
  Coins,
  Crown,
  FilePenLine,
  FileText,
  GraduationCap,
  Mail,
  PlusCircle,
  Sparkles,
  Target,
  TrendingUp,
  User,
  Zap,
} from "lucide-react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import {
  EMBED_INNER_PANEL,
  EMBED_LIST_TILE,
  EMBED_MATERIAL_PANEL,
  EmbedModuleCard,
} from "@/components/student/dashboard-v2/embed-module-ui"
import { CoraSidebarMark } from "@/components/cora/CoraLogo"
import { Button } from "@/components/ui/button"
import { getStudentData } from "@/lib/auth"
import { guestHasCapability } from "@/lib/guest/capabilities"
import { guestOnboardingPurposeLabel, normalizeGuestOnboardingPurpose } from "@/lib/guest/onboarding"
import { formatGuestAccessPrice, GUEST_CORA_CAREER_LIFETIME_CREDITS } from "@/lib/guest/membership-config"
import { CAREER_MEMBER_ACCOUNT, CAREER_MEMBER_LABEL_PLURAL, CAREER_MEMBER_WORKSPACE } from "@/lib/guest/display"
import { getGuestPortalTheme } from "@/lib/guest-module-themes"
import { cn } from "@/lib/utils"
import { useGuestDashboard } from "@/components/guest/dashboard/GuestDashboardContext"
import { GuestCareerQuickActions } from "@/components/guest/career/GuestCareerQuickActions"
import { GuestResumeOnboardingBanner } from "@/components/guest/career/GuestResumeOnboardingBanner"

type HomeData = {
  greeting: string
  fullName: string
  organization: string
  onboardingPurpose: string
  onboardingLabel: string
  plan: string
  recommendations: {
    total: number
    activeCount: number
    latest: {
      id: number
      status: string
      purpose: string
      instructorName: string
    } | null
  }
  upcoming: {
    kind: string
    label: string
    date: string
    requestId: number
  } | null
  recentRequests: Array<{
    id: number
    status: string
    purpose: string
    instructorName: string
    deadline: string | null
  }>
  career: {
    hasMasterResume: boolean
    resumeUpdatedAt: string | null
    resumeFileName: string | null
    applicationCount: number
    latestMatchScore: number | null
    latestMatchBand: string | null
    latestApplicationId: string | null
  }
}

const theme = getGuestPortalTheme()

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    requested: "Submitted",
    approved: "Approved",
    info_requested: "Info requested",
    student_form_pending: "Form pending",
    instructor_review_pending: "In review",
    finalized: "Finalized",
    downloaded: "Completed",
    rejected: "Declined",
  }
  return map[status] ?? status.replace(/_/g, " ")
}

function statusTone(status: string): string {
  if (["downloaded", "finalized", "approved"].includes(status)) {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
  }
  if (status === "rejected") return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
  if (["info_requested", "student_form_pending"].includes(status)) {
    return "bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/20"
  }
  return "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)] border-[var(--cc-accent-border)]"
}

/** Time-of-day greeting from the visitor's local clock (the API greeting uses the server's UTC clock). */
function localGreeting(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] || "there"
  const h = new Date().getHours()
  const prefix = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
  return `${prefix}, ${first}`
}

function daysUntil(iso: string): number | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const diff = d.getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function purposeIcon(purpose: string) {
  const p = purpose.toLowerCase()
  if (p.includes("graduate") || p.includes("school")) return GraduationCap
  if (p.includes("scholar")) return Crown
  return FilePenLine
}

function nextStepCopy(
  purpose: string,
  hasActive: boolean,
  hasCareer: boolean,
  hasResume: boolean,
): string {
  const p = normalizeGuestOnboardingPurpose(purpose)
  if (hasActive) return "Track your active request and respond to any instructor questions."
  if (!hasResume) {
    return "Upload your master résumé once — Cora reuses it for quick scans, cover letters, and chat."
  }
  switch (p) {
    case "career_application":
      return hasCareer
        ? "Paste a job description in Quick Scan for an instant match score against your résumé."
        : `Run a free quick scan or start a recommendation request — both included with your ${CAREER_MEMBER_ACCOUNT}.`
    case "graduate_school":
      return "Request a letter and use Cora to tailor materials for each program."
    case "scholarship":
      return "Submit a recommendation request and scan scholarship requirements with Quick Scan."
    default:
      return `Quick Scan matches any job to your résumé. Recommendation letters stay free for all ${CAREER_MEMBER_LABEL_PLURAL}.`
  }
}

function formatResumeDate(iso: string | null): string {
  if (!iso) return "Not uploaded"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Recently"
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  delay,
}: {
  label: string
  value: string
  hint?: string
  icon: typeof FilePenLine
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={cn(EMBED_MATERIAL_PANEL, "p-4 sm:p-5")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--cc-text)]">{value}</p>
          {hint ? <p className="mt-1 text-xs text-[var(--cc-text-muted)]">{hint}</p> : null}
        </div>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", theme.page.iconBg, theme.page.iconText)}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
    </motion.div>
  )
}

function ModuleLauncher({
  href,
  title,
  description,
  meta,
  icon,
  accentClass,
  delay,
}: {
  href: string
  title: string
  description: string
  meta?: string
  icon: ReactNode
  accentClass?: string
  delay: number
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}>
      <Link
        href={href}
        className={cn(
          EMBED_MATERIAL_PANEL,
          "group flex h-full flex-col p-5 sm:p-6 transition-all duration-300",
          "hover:shadow-[0_12px_32px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_12px_36px_rgba(0,0,0,0.45)]",
          "hover:-translate-y-0.5",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span className={cn("flex size-12 items-center justify-center rounded-2xl", accentClass ?? cn(theme.page.iconBg, theme.page.iconText))}>
            {icon}
          </span>
          <ChevronRight className="size-5 shrink-0 text-[var(--cc-text-muted)] transition-transform group-hover:translate-x-0.5" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[var(--cc-text)]">{title}</h3>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--cc-text-muted)]">{description}</p>
        {meta ? <p className="mt-3 text-xs font-medium text-[var(--cc-accent-dark)]">{meta}</p> : null}
      </Link>
    </motion.div>
  )
}

export function GuestHomeDashboard() {
  const { entitlements } = useGuestDashboard()
  const [data, setData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const d = getStudentData()
    if (!d?.databaseId) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/guest/home?studentDatabaseId=${encodeURIComponent(d.databaseId)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to load")
      setData(json as HomeData)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const hasCareer = entitlements.plan === "cora_career" || data?.plan === "cora_career"
  const canMessages = guestHasCapability(entitlements.capabilities, "messages.use")
  const credits = entitlements.credits

  if (loading) {
    return <ModulePageSkeleton className="min-h-[560px]" />
  }

  if (error || !data) {
    return (
      <EmbedModuleCard>
        <div className="p-6 sm:p-8 text-center text-sm text-red-600 dark:text-red-400">
          {error || "Could not load workspace"}
        </div>
      </EmbedModuleCard>
    )
  }

  const latest = data.recommendations.latest
  const upcomingDays = data.upcoming ? daysUntil(data.upcoming.date) : null
  const career = data.career ?? {
    hasMasterResume: false,
    resumeUpdatedAt: null,
    resumeFileName: null,
    applicationCount: 0,
    latestMatchScore: null,
    latestMatchBand: null,
    latestApplicationId: null,
  }
  const nextStep = nextStepCopy(
    data.onboardingPurpose,
    data.recommendations.activeCount > 0,
    hasCareer,
    career.hasMasterResume,
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(EMBED_MATERIAL_PANEL, "overflow-hidden")}
      >
        <div className={cn("border-b px-6 py-5 sm:px-8 sm:py-6", theme.page.border, theme.page.softBg)}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide", theme.page.badge)}>
                  {CAREER_MEMBER_WORKSPACE}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-[11px] font-medium text-[var(--cc-text-secondary)]">
                  {data.onboardingLabel}
                </span>
                {hasCareer ? (
                  <span className={cn("rounded-full px-3 py-1 text-[11px] font-semibold", theme.page.badge)}>
                    Cora Career unlocked
                  </span>
                ) : null}
                {career.hasMasterResume ? (
                  <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-[11px] font-medium text-[var(--cc-text-secondary)]">
                    Résumé on file
                  </span>
                ) : null}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--cc-text)] sm:text-3xl lg:text-4xl">
                {localGreeting(data.fullName)}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-[var(--cc-text-muted)] sm:text-base">
                {nextStep}
                {data.organization ? (
                  <span className="text-[var(--cc-text-secondary)]"> · {data.organization}</span>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button className={cn("rounded-xl gap-2", theme.page.cta)} asChild>
                <Link href="/guest/cora-career/quick-scan">
                  <Zap className="size-4" />
                  Quick scan
                </Link>
              </Button>
              <Button variant="outline" className={cn("rounded-xl gap-2", theme.page.border)} asChild>
                <Link href="/guest/recommendations/request">
                  <PlusCircle className="size-4" />
                  New request
                </Link>
              </Button>
            </div>
          </div>
        </div>
        {!career.hasMasterResume ? (
          <div className="px-4 py-4 sm:px-6">
            <GuestResumeOnboardingBanner />
          </div>
        ) : null}
      </motion.section>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiTile
          label="Applications"
          value={String(career.applicationCount)}
          hint={career.latestMatchScore != null ? `Latest match ${career.latestMatchScore}%` : "Run a quick scan"}
          icon={Briefcase}
          delay={0.05}
        />
        <KpiTile
          label="Master résumé"
          value={career.hasMasterResume ? "Ready" : "Missing"}
          hint={
            career.hasMasterResume
              ? `Updated ${formatResumeDate(career.resumeUpdatedAt)}`
              : "Upload in Settings → Cora"
          }
          icon={FileText}
          delay={0.1}
        />
        <KpiTile
          label="Active requests"
          value={String(data.recommendations.activeCount)}
          hint={data.recommendations.total > 0 ? `${data.recommendations.total} total · free` : "Letters included free"}
          icon={FilePenLine}
          delay={0.15}
        />
        <KpiTile
          label="Cora credits"
          value={hasCareer && credits != null ? credits.toLocaleString() : "Free scan"}
          hint={hasCareer ? "Lifetime balance" : "Unlock for full reports"}
          icon={hasCareer ? Coins : Sparkles}
          delay={0.2}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        {/* Cora Career + recommendations */}
        <div className="space-y-4 lg:col-span-8">
          <EmbedModuleCard>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <span className={cn("flex size-10 items-center justify-center rounded-xl", theme.page.iconBg, theme.page.iconText)}>
                  <CoraSidebarMark className="scale-110" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-[var(--cc-text)]">Cora Career</h2>
                  <p className="text-xs text-[var(--cc-text-muted)]">
                    Quick scan, match, cover letters — powered by your master résumé
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="rounded-xl text-[var(--cc-accent-dark)]" asChild>
                <Link href="/guest/cora-career">
                  Open workspace
                  <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </Button>
            </div>
            <div className="p-4 sm:p-5">
              <GuestCareerQuickActions />
            </div>
          </EmbedModuleCard>

          <div className="flex items-center justify-between gap-3 px-0.5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
              Recommendations
            </h2>
            <Link
              href="/guest/recommendations"
              className="text-xs font-medium text-[var(--cc-accent-dark)] hover:underline"
            >
              View all requests
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ModuleLauncher
              href="/guest/recommendations"
              title="Recommendation letters"
              description="Ask a faculty member. They accept (or decline) each request before writing."
              meta={
                latest
                  ? `${statusLabel(latest.status)} · ${latest.instructorName}`
                  : "Start your first request — always free"
              }
              icon={<FilePenLine className="size-6" />}
              delay={0.12}
            />
            {canMessages ? (
              <ModuleLauncher
                href="/guest/messages"
                title="Messages"
                description="Coordinate with instructors about your requests and application materials."
                meta="Direct messaging"
                icon={<Mail className="size-6" />}
                delay={0.18}
              />
            ) : (
              <ModuleLauncher
                href="/guest/settings"
                title="Profile & résumé"
                description="Update your profile and master résumé for Cora scans and recommendations."
                meta={data.fullName}
                icon={<User className="size-6" />}
                delay={0.18}
              />
            )}
          </div>

          {/* Recent activity */}
          <EmbedModuleCard className="mt-2">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
              <div>
                <h2 className="text-base font-semibold text-[var(--cc-text)]">Recent requests</h2>
                <p className="text-xs text-[var(--cc-text-muted)]">Your latest recommendation activity</p>
              </div>
              <Button variant="ghost" size="sm" className="rounded-xl text-[var(--cc-accent-dark)]" asChild>
                <Link href="/guest/recommendations/request">
                  New
                  <PlusCircle className="ml-1 size-3.5" />
                </Link>
              </Button>
            </div>
            {data.recentRequests.length > 0 ? (
              <ul className="divide-y divide-[var(--border)]">
                {data.recentRequests.map((r) => {
                  const Icon = purposeIcon(r.purpose)
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/guest/recommendations/${r.id}`}
                        className={cn(EMBED_LIST_TILE, "flex items-center gap-4 mx-2 my-1 sm:mx-3")}
                      >
                        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", theme.page.iconBg, theme.page.iconText)}>
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-[var(--cc-text)]">{r.purpose}</p>
                          <p className="text-xs text-[var(--cc-text-muted)]">{r.instructorName}</p>
                        </div>
                        <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold", statusTone(r.status))}>
                          {statusLabel(r.status)}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-[var(--cc-text-muted)]" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className={cn(EMBED_INNER_PANEL, "mx-4 my-4 sm:mx-5 sm:my-5 p-8 text-center sm:p-10")}>
                <div className={cn("mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl", theme.page.iconBg, theme.page.iconText)}>
                  <FilePenLine className="size-7" />
                </div>
                <p className="font-medium text-[var(--cc-text)]">No requests yet</p>
                <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
                  Faculty recommendation letters are included free with your {CAREER_MEMBER_ACCOUNT}.
                </p>
                <Button className={cn("mt-5 rounded-xl gap-2", theme.page.cta)} asChild>
                  <Link href="/guest/recommendations/request">
                    Start a recommendation
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            )}
          </EmbedModuleCard>
        </div>

        <aside className="space-y-4 lg:col-span-4">
          <EmbedModuleCard>
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", theme.page.iconBg, theme.page.iconText)}>
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                    Master résumé
                  </p>
                  <p className="mt-1 font-semibold text-[var(--cc-text)]">
                    {career.hasMasterResume ? career.resumeFileName ?? "Saved résumé" : "Not uploaded yet"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
                    {career.hasMasterResume
                      ? `Updated ${formatResumeDate(career.resumeUpdatedAt)} · reused for every scan`
                      : "Upload once — Cora reads the file fresh each time, not just memory."}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <Button className={cn("w-full rounded-xl gap-2", theme.page.cta)} asChild>
                  <Link href={career.hasMasterResume ? "/guest/cora-career/quick-scan" : "/guest/settings?section=cora"}>
                    {career.hasMasterResume ? (
                      <>
                        <Zap className="size-4" />
                        Run quick scan
                      </>
                    ) : (
                      "Upload résumé"
                    )}
                  </Link>
                </Button>
                {career.hasMasterResume ? (
                  <Button variant="outline" className="w-full rounded-xl" asChild>
                    <Link href="/guest/settings?section=cora">Update résumé</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </EmbedModuleCard>

          {career.latestMatchScore != null && career.latestApplicationId ? (
            <EmbedModuleCard>
              <div className="p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", theme.page.iconBg, theme.page.iconText)}>
                    <Target className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                      Latest match
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--cc-accent-dark)]">
                      {career.latestMatchScore}%
                    </p>
                    {career.latestMatchBand ? (
                      <p className="mt-1 text-sm capitalize text-[var(--cc-text-muted)]">
                        {career.latestMatchBand.replace(/_/g, " ").toLowerCase()}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Button variant="outline" className="mt-4 w-full rounded-xl" asChild>
                  <Link href={`/guest/cora-career/applications/${career.latestApplicationId}`}>
                    View application
                  </Link>
                </Button>
              </div>
            </EmbedModuleCard>
          ) : null}
          {data.upcoming ? (
            <EmbedModuleCard>
              <div className="p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", theme.page.iconBg, theme.page.iconText)}>
                    <CalendarDays className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                      Upcoming deadline
                    </p>
                    <p className="mt-1 font-semibold text-[var(--cc-text)]">{data.upcoming.label}</p>
                    <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
                      {new Date(data.upcoming.date).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    {upcomingDays != null ? (
                      <p
                        className={cn(
                          "mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          upcomingDays <= 7
                            ? "bg-amber-500/15 text-amber-800 dark:text-amber-400"
                            : "bg-[var(--muted)] text-[var(--cc-text-secondary)]",
                        )}
                      >
                        {upcomingDays < 0
                          ? "Past due"
                          : upcomingDays === 0
                            ? "Due today"
                            : `${upcomingDays} day${upcomingDays === 1 ? "" : "s"} left`}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Button variant="outline" className="mt-4 w-full rounded-xl" asChild>
                  <Link href={`/guest/recommendations/${data.upcoming.requestId}`}>Open request</Link>
                </Button>
              </div>
            </EmbedModuleCard>
          ) : null}

          <EmbedModuleCard>
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-[var(--cc-accent-dark)]" />
                <h3 className="text-sm font-semibold text-[var(--cc-text)]">Suggested next step</h3>
              </div>
              <p className="text-sm leading-relaxed text-[var(--cc-text-muted)]">{nextStep}</p>
              <div className="space-y-2">
                {!latest && (
                  <Link
                    href="/guest/recommendations/request"
                    className={cn(EMBED_INNER_PANEL, "flex items-center gap-3 p-3 text-sm font-medium transition-colors hover:bg-[var(--muted)]/50")}
                  >
                    <PlusCircle className="size-4 text-[var(--cc-accent-dark)]" />
                    Request a recommendation
                    <ChevronRight className="ml-auto size-4 text-[var(--cc-text-muted)]" />
                  </Link>
                )}
                {!hasCareer && (
                  <Link
                    href="/guest/cora-career/access"
                    className={cn(EMBED_INNER_PANEL, "flex items-center gap-3 p-3 text-sm font-medium transition-colors hover:bg-[var(--muted)]/50")}
                  >
                    <Sparkles className="size-4 text-[var(--cc-accent-dark)]" />
                    Unlock full match reports
                    <ChevronRight className="ml-auto size-4 text-[var(--cc-text-muted)]" />
                  </Link>
                )}
                {!career.hasMasterResume && (
                  <Link
                    href="/guest/settings?section=cora"
                    className={cn(EMBED_INNER_PANEL, "flex items-center gap-3 p-3 text-sm font-medium transition-colors hover:bg-[var(--muted)]/50")}
                  >
                    <FileText className="size-4 text-[var(--cc-accent-dark)]" />
                    Upload master résumé
                    <ChevronRight className="ml-auto size-4 text-[var(--cc-text-muted)]" />
                  </Link>
                )}
                <Link
                  href="/guest/cora-career/quick-scan"
                  className={cn(EMBED_INNER_PANEL, "flex items-center gap-3 p-3 text-sm font-medium transition-colors hover:bg-[var(--muted)]/50")}
                >
                  <Zap className="size-4 text-[var(--cc-accent-dark)]" />
                  Quick scan a job
                  <ChevronRight className="ml-auto size-4 text-[var(--cc-text-muted)]" />
                </Link>
                <Link
                  href="/guest/settings"
                  className={cn(EMBED_INNER_PANEL, "flex items-center gap-3 p-3 text-sm font-medium transition-colors hover:bg-[var(--muted)]/50")}
                >
                  <Clock className="size-4 text-[var(--cc-accent-dark)]" />
                  Account & security
                  <ChevronRight className="ml-auto size-4 text-[var(--cc-text-muted)]" />
                </Link>
              </div>
            </div>
          </EmbedModuleCard>

          {!hasCareer ? (
            <div className={cn(EMBED_MATERIAL_PANEL, "overflow-hidden")}>
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-2 text-[var(--cc-accent-dark)]">
                  <Crown className="size-5" />
                  <p className="font-semibold text-[var(--cc-text)]">Unlock Cora Career</p>
                </div>
                <p className="mt-2 text-sm text-[var(--cc-text-muted)]">
                  Full keyword evidence, ATS fixes, and {GUEST_CORA_CAREER_LIFETIME_CREDITS.toLocaleString()} included Cora Credits — one-time lifetime unlock.
                </p>
                <Button className={cn("mt-4 w-full rounded-xl", theme.page.cta)} asChild>
                  <Link href="/guest/cora-career/access">Get lifetime access</Link>
                </Button>
              </div>
            </div>
          ) : credits != null ? (
            <EmbedModuleCard>
              <div className="p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
                  Cora balance
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--cc-text)]">
                  {credits.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-[var(--cc-text-muted)]">Credits never expire</p>
                <Button variant="outline" className="mt-4 w-full rounded-xl" asChild>
                  <Link href="/guest/cora-credits">Add credit packs</Link>
                </Button>
              </div>
            </EmbedModuleCard>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
