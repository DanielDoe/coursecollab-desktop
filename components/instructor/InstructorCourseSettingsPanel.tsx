"use client"

import { useEffect, useMemo, useState } from "react"
import {
  BookOpen,
  Bot,
  Code2,
  Library,
  Loader2,
  Megaphone,
  Save,
  Search,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import {
  InstructorPolicyDividedList,
  InstructorPolicySurfaceCard,
} from "@/components/instructor/InstructorPolicySurfaceCard"
import { portalListStripe } from "@/lib/portal-module-themes"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import type { CourseModuleSettings } from "@/lib/course-module-settings"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { CalendarFeedSettingsCard } from "@/components/calendar/CalendarFeedSettingsCard"
import { CourseExchangeProvenanceBanner } from "@/components/instructor/course-exchange/CourseExchangeProvenanceBanner"
import {
  parseExchangeProvenance,
  type ExchangeProvenance,
} from "@/lib/course-exchange/provenance-shared"

const MODULE_LABELS: {
  key: keyof CourseModuleSettings
  label: string
  description: string
  icon: LucideIcon
}[] = [
  { key: "lectures", label: "Lectures", description: "Lecture content and materials", icon: BookOpen },
  { key: "attendance", label: "Attendance", description: "Attendance tracking for this course", icon: UserCheck },
  { key: "practiceHub", label: "Practice Hub", description: "Practice questions and drills", icon: Sparkles },
  { key: "codeBench", label: "Code Bench", description: "Coding exercises and submissions", icon: Code2 },
  { key: "aiTutor", label: "Cora Assistant", description: "Student Cora Assistant for this course", icon: Bot },
  { key: "questionBank", label: "Question Bank", description: "Reusable assessment questions", icon: Library },
  { key: "announcements", label: "Announcements", description: "Course announcements", icon: Megaphone },
]

const SEARCH_FIELD = cn(
  "h-10 rounded-lg border pl-9 pr-9 shadow-none",
  CC_FIELD.base,
  CC_FIELD.focus,
)

export function InstructorCourseSettingsPanel() {
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const chrome = facultyEmbedChrome("course-settings")
  const spinner = facultyModuleSpinnerClass("course-settings")
  const switchClass = chrome.switchChecked

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [courseLabel, setCourseLabel] = useState("")
  const [exchangeProvenance, setExchangeProvenance] = useState<ExchangeProvenance | null>(null)
  const [search, setSearch] = useState("")
  const [modules, setModules] = useState<CourseModuleSettings | null>(null)

  useEffect(() => {
    setLoading(true)
    void instructorApiFetch("/api/instructor/courses", { headers: buildInstructorApiHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        let selectedId: number | null = null
        try {
          const s = JSON.parse(localStorage.getItem("instructorSession") || "{}")
          if (s?.selectedCourseId != null) selectedId = Number(s.selectedCourseId)
        } catch {
          /* ignore */
        }
        const list = (data?.offerings ?? data?.courses ?? []) as Array<{
          id?: number
          course_id?: number
          course_code: string
          course_title: string
          module_settings?: CourseModuleSettings
          owner_name?: string | null
          exchange_provenance?: {
            sourceInstructorName: string
            sourceCourseCode: string
            sourceCourseTitle: string
            destinationInstructorName?: string | null
          } | null
        }>
        const course =
          selectedId != null
            ? list.find((c) => Number(c.id ?? c.course_id) === selectedId)
            : list[0]
        if (course) {
          setCourseLabel(`${course.course_code} — ${course.course_title}`)
          setModules(course.module_settings ?? null)
          const prov = parseExchangeProvenance(course.exchange_provenance)
          setExchangeProvenance(prov)
        }
      })
      .catch(() => setModules(null))
      .finally(() => setLoading(false))
  }, [courseScopeVersion])

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return MODULE_LABELS
    return MODULE_LABELS.filter(
      ({ label, description }) =>
        label.toLowerCase().includes(q) || description.toLowerCase().includes(q),
    )
  }, [search])

  const enabledCount = useMemo(() => {
    if (!modules) return 0
    return MODULE_LABELS.filter(({ key }) => modules[key]).length
  }, [modules])

  const onToggle = (key: keyof CourseModuleSettings, value: boolean) => {
    if (!modules) return
    setModules({ ...modules, [key]: value })
  }

  const save = async () => {
    if (!modules) return
    setSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/courses/module-settings", {
        method: "PATCH",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ module_settings: modules }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      toast({ title: "Course settings saved", description: "Module availability updated for this course." })
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <InstructorPolicyLoadingState moduleId="course-settings" label="Loading course settings…" />
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      {exchangeProvenance ? (
        <CourseExchangeProvenanceBanner
          provenance={exchangeProvenance}
          moduleId="course-settings"
        />
      ) : null}
      <InstructorPolicySurfaceCard
        className="w-full"
        title="Module availability"
        description={`Enable or disable features for ${courseLabel || "your selected course"}. Changes apply only to this offering.`}
      >
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter modules…"
            className={SEARCH_FIELD}
            aria-label="Filter modules"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--cc-text-muted)] hover:bg-[var(--cc-accent-soft)]/45 hover:text-[var(--cc-text)]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {modules && filteredModules.length > 0 ? (
          <InstructorPolicyDividedList>
            {filteredModules.map(({ key, label, description, icon: Icon }, index) => {
              const stripe = portalListStripe(index, chrome.theme.family)
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 px-3 py-2.5 transition-colors hover:bg-[var(--cc-accent-soft)]/45 sm:px-3.5 sm:py-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                        stripe.iconBg,
                        stripe.iconText,
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <Label className={cn("text-sm font-medium", PORTAL_TEXT)}>{label}</Label>
                      <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={modules[key]}
                    onCheckedChange={(v) => onToggle(key, v)}
                    className={cn("shrink-0", switchClass)}
                  />
                </div>
              )
            })}
          </InstructorPolicyDividedList>
        ) : null}

        {modules && filteredModules.length === 0 ? (
          <p className={cn("rounded-xl border border-[var(--border)] bg-[var(--muted)]/25 px-3.5 py-4 text-sm", PORTAL_TEXT_MUTED)}>
            No modules match &ldquo;{search}&rdquo;. Try a different filter.
          </p>
        ) : null}
      </InstructorPolicySurfaceCard>

      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          {enabledCount} enabled · {MODULE_LABELS.length - enabledCount} hidden
        </p>
        <Button
          type="button"
          size="sm"
          disabled={saving || !modules}
          className={cn("h-9 gap-2 rounded-lg", chrome.cta)}
          onClick={() => void save()}
        >
          {saving ? (
            <Loader2 className={cn("h-4 w-4 animate-spin", spinner)} />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save course settings
        </Button>
      </div>

      <CalendarFeedSettingsCard
        portal="faculty"
        description="Applies to every section you teach, not only the selected course. Saved here so it stays after a schedule change is finalized."
        switchClass={switchClass}
        ctaClass={cn(chrome.cta, "!text-white")}
        quietClass={chrome.outline}
      />
    </div>
  )
}
