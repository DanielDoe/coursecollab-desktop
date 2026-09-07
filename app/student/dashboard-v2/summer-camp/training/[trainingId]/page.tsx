"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Lock,
  ChevronRight,
  Mail,
  User,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { campRoute } from "@/lib/summer-camp/camper-nav"
import { camperCta } from "@/lib/summer-camp/camper-ui-theme"
import {
  applyLocalEnrollmentToTrainingPayload,
  fetchCampTrainingAfterEnroll,
  fetchCampTrainingPage,
  markCampTrainingEnrolledLocally,
  postCampTrainingEnroll,
} from "@/lib/summer-camp/enroll-client"
import { useStudentDatabaseId } from "@/lib/summer-camp/use-student-database-id"
import { CampContextHeader } from "@/components/summer-camp/CampContextHeader"
import type { CampScheduleDay } from "@/lib/summer-camp/module-schedule"

type TrainingFaculty = {
  id: number
  name: string
  email: string
  job_title: string | null
  institution: string | null
  phone?: string | null
  office?: string | null
  role: string
}

type TrainingMeta = {
  duration: string
  difficulty: string
  outcomes: string[]
  tags: string[]
}

function facultyRoleLabel(role: string) {
  if (role === "lead") return "Lead instructor"
  if (role === "dean") return "Dean"
  if (role === "assistant") return "Co-instructor"
  return role.replace(/_/g, " ")
}

export default function SummerCampTrainingPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const trainingId = params.trainingId as string
  const previewParam = searchParams.get("preview") === "1"
  const studentDbId = useStudentDatabaseId()
  const enrollInFlightRef = useRef(false)
  const [data, setData] = useState<{
    training: { title: string; description: string | null; camp_title: string }
    modules: Array<{
      id: number
      title: string
      description: string | null
      sort_order: number
      schedule_day?: number | null
      display_number?: number | null
      is_complete: boolean
      project_title?: string
    }>
    schedule_days?: CampScheduleDay[]
    faculty: TrainingFaculty[]
    meta: TrainingMeta
    enrolled: boolean
    preview: boolean
    overview: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)

  const moduleGroups = useMemo(() => {
    if (!data?.modules.length) return []
    const days = data.schedule_days ?? []
    const buckets = new Map<number, typeof data.modules>()
    for (const mod of data.modules) {
      const day = mod.schedule_day ?? 0
      if (!buckets.has(day)) buckets.set(day, [])
      buckets.get(day)!.push(mod)
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => {
        if (a === 0) return 1
        if (b === 0) return -1
        return a - b
      })
      .map(([dayKey, mods]) => {
        const meta = days.find((d) => d.day === dayKey)
        const label =
          dayKey === 0
            ? "Modules"
            : meta?.dateLabel
              ? `${meta.label} | ${meta.dateLabel}`
              : meta?.label ?? `Day ${dayKey}`
        return { dayKey, label, modules: mods }
      })
  }, [data])

  const load = useCallback(async () => {
    if (enrollInFlightRef.current) return

    const dbId = studentDbId
    if (!dbId) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      let payload = await fetchCampTrainingPage(trainingId, dbId, { preview: previewParam })
      if (!payload && previewParam) {
        payload = await fetchCampTrainingPage(trainingId, dbId, { preview: true })
      }
      setData(applyLocalEnrollmentToTrainingPayload(trainingId, payload))
    } finally {
      setLoading(false)
    }
  }, [studentDbId, trainingId, previewParam])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (data?.enrolled && previewParam && !enrollInFlightRef.current) {
      router.replace(campRoute(`/training/${trainingId}`))
    }
  }, [data?.enrolled, previewParam, trainingId, router])

  const enroll = async () => {
    setEnrollError(null)
    if (!studentDbId) {
      setEnrollError("Sign in to enroll in this training.")
      return
    }

    enrollInFlightRef.current = true
    setEnrolling(true)
    try {
      await postCampTrainingEnroll(Number(trainingId), studentDbId)
      markCampTrainingEnrolledLocally(trainingId)

      const refreshed = await fetchCampTrainingAfterEnroll(trainingId, studentDbId)
      if (refreshed) {
        setData(refreshed)
      } else {
        setData((prev) =>
          prev
            ? { ...prev, enrolled: true, preview: false, overview: false }
            : prev,
        )
      }

      router.replace(campRoute(`/training/${trainingId}`))
    } catch (error) {
      setEnrollError(error instanceof Error ? error.message : "Enrollment failed")
    } finally {
      setEnrolling(false)
      enrollInFlightRef.current = false
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center space-y-3 py-12">
        <p className="text-slate-500 dark:text-slate-400 dark:text-slate-400">Training not found or not available.</p>
        <Button
          variant="outline"
          size="sm"
          className="dark:border-white/20 dark:text-slate-200"
          asChild
        >
          <Link href={campRoute("/browse")}>Back to Browse Trainings</Link>
        </Button>
      </div>
    )
  }

  const isOverview = previewParam || data.overview
  const modulesLocked = !data.enrolled

  return (
    <div className="space-y-6 w-full min-w-0">
      {enrollError && (
        <Alert variant="destructive">
          <AlertDescription>{enrollError}</AlertDescription>
        </Alert>
      )}
      <CampContextHeader
        eyebrow={data.training.camp_title}
        title={data.training.title}
        description={data.training.description ?? undefined}
        backHref={campRoute("/browse")}
        backLabel="Browse Trainings"
      />

      <div className="flex flex-wrap gap-2">
        <span className="text-xs flex items-center gap-1 text-slate-500 dark:text-slate-400 dark:text-slate-400 rounded-full bg-slate-100 dark:bg-white/5 px-2.5 py-1">
          <Clock className="h-3.5 w-3.5" /> {data.meta.duration}
        </span>
        <span className="text-xs flex items-center gap-1 text-slate-500 dark:text-slate-400 dark:text-slate-400 rounded-full bg-slate-100 dark:bg-white/5 px-2.5 py-1">
          <BarChart3 className="h-3.5 w-3.5" /> {data.meta.difficulty}
        </span>
        {data.meta.tags.map((tag) => (
          <Badge key={tag} variant="outline" className="text-xs dark:border-white/20 dark:text-slate-300">
            {tag}
          </Badge>
        ))}
      </div>

      {data.meta.outcomes.length > 0 && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] p-4 sm:p-5">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400 dark:text-slate-400 mb-3">
            What you will learn
          </h2>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            {data.meta.outcomes.map((o) => (
              <li key={o} className="flex gap-2">
                <span className="text-violet-500 dark:text-violet-400 shrink-0">•</span>
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.faculty.length > 0 && (
        <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] p-4 sm:p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
            <User className="h-4 w-4 text-violet-500" />
            Faculty & mentors
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.faculty.map((f) => (
              <div
                key={f.id}
                className="rounded-xl border border-slate-200/80 dark:border-white/10 p-4 space-y-1.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white">{f.name}</p>
                  <Badge variant="secondary" className="text-[10px] capitalize">
                    {facultyRoleLabel(f.role)}
                  </Badge>
                </div>
                {f.job_title && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">{f.job_title}</p>
                )}
                {f.institution && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-400">{f.institution}</p>
                )}
                {f.office && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{f.office}</p>
                )}
                {f.phone && (
                  <a
                    href={`tel:${f.phone}`}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:underline"
                  >
                    {f.phone}
                  </a>
                )}
                {f.email && (
                  <a
                    href={`mailto:${f.email}`}
                    className="inline-flex items-center gap-1.5 text-sm text-violet-600 dark:text-violet-400 hover:underline mt-1"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {f.email}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {modulesLocked && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                {isOverview ? "Enroll to unlock modules" : "Enrollment required"}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                Browse the module list below. Enroll to unlock lessons, checkpoints, and XP.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            type="button"
            onClick={() => void enroll()}
            disabled={enrolling}
            className={cn("shrink-0 w-full sm:w-auto", camperCta)}
          >
            {enrolling ? "Enrolling…" : "Enroll in this training"}
          </Button>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
          <BookOpen className="h-4 w-4 text-violet-500" />
          Modules
          {modulesLocked && (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 dark:text-slate-400">
              ({data.modules.length} lessons)
            </span>
          )}
        </h2>
        {moduleGroups.map((group) => (
          <div key={group.dayKey} className="space-y-3">
            {group.dayKey > 0 ? (
              <h3 className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                {group.label}
              </h3>
            ) : null}
            {group.modules.map((mod) => {
          const lessonNum =
            mod.display_number ??
            mod.title.match(/^Module\s+(\d+)/i)?.[1] ??
            String(mod.sort_order ?? 0)
          const title = mod.title.replace(/^Module\s+\d+(\s*[—–-]|:|\s+)/i, "")

          const inner = (
            <>
              {modulesLocked ? (
                <Lock className="h-5 w-5 text-slate-300 dark:text-slate-500 dark:text-slate-400 shrink-0" />
              ) : mod.is_complete ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-slate-300 dark:text-slate-500 dark:text-slate-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-violet-600/80 dark:text-violet-400/80">
                  Lesson {lessonNum}
                </p>
                <p
                  className={cn(
                    "font-semibold text-slate-900 dark:text-white",
                    !modulesLocked && "group-hover:text-violet-600 dark:group-hover:text-violet-400",
                  )}
                >
                  {title}
                </p>
                {mod.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-400 line-clamp-2 mt-0.5">
                    {mod.description}
                  </p>
                )}
              </div>
              {!modulesLocked && (
                <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-500 dark:text-slate-400 shrink-0 group-hover:text-violet-500" />
              )}
            </>
          )

          if (modulesLocked) {
            return (
              <div
                key={mod.id}
                className="flex items-center gap-3 sm:gap-4 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] p-3 sm:p-4 opacity-90 cursor-not-allowed min-w-0"
                title="Enroll to access this module"
              >
                {inner}
              </div>
            )
          }

          return (
            <Link
              key={mod.id}
              href={campRoute(`/module/${mod.id}`)}
              className="flex items-center gap-3 sm:gap-4 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] p-3 sm:p-4 hover:border-violet-500/40 transition-colors group min-w-0"
            >
              {inner}
            </Link>
          )
        })}
          </div>
        ))}
      </section>
    </div>
  )
}
