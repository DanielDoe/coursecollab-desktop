"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarDays, Eye, EyeOff, GripVertical, Loader2, Plus, Presentation, RotateCcw, Save, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { CampStatusBadge } from "@/components/summer-camp/CampPublishControls"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalThemeStripe } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import {
  campModuleDisplayLabel,
  compareCampModulesBySchedule,
  type CampScheduleDay,
  type CampTrainingScheduleConfig,
} from "@/lib/summer-camp/module-schedule"

type ScheduleModule = {
  id: number
  title: string
  status: string
  schedule_day: number | null
  schedule_day_sort: number
  is_visible: boolean
  display_number: number | null
  sort_order: number
}

type Props = {
  trainingId: number
  editBasePath?: string
}

function dayLabel(day: CampScheduleDay) {
  return day.dateLabel ? `${day.label} | ${day.dateLabel}` : day.label
}

function nextDayNumber(days: CampScheduleDay[]) {
  return days.reduce((max, d) => Math.max(max, d.day), 0) + 1
}

export function FacultyCampModuleSchedulePanel({
  trainingId,
  editBasePath = "/faculty/dashboard/summer-camp/module",
}: Props) {
  const { card, p: fp, solid, quiet } = facultyEmbedChrome("summer-camp")
  const [modules, setModules] = useState<ScheduleModule[]>([])
  const [scheduleDays, setScheduleDays] = useState<CampScheduleDay[]>([])
  const [defaultSchedule, setDefaultSchedule] = useState<CampTrainingScheduleConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [renumberTitles, setRenumberTitles] = useState(false)

  const jsonHeaders = { ...buildInstructorApiHeaders(), "Content-Type": "application/json" }

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/instructor/summer-camp/modules/schedule?trainingId=${trainingId}`,
      { headers: buildInstructorApiHeaders() },
    )
    if (!res.ok) return
    const data = (await res.json()) as {
      modules?: ScheduleModule[]
      schedule_days?: CampScheduleDay[]
      default_schedule?: CampTrainingScheduleConfig | null
    }
    setModules(data.modules ?? [])
    setScheduleDays(data.schedule_days ?? [])
    setDefaultSchedule(data.default_schedule ?? null)
  }, [trainingId])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  const dayOptions = useMemo(() => {
    if (scheduleDays.length > 0) return [...scheduleDays].sort((a, b) => a.day - b.day)
    const maxDay = Math.max(1, ...modules.map((m) => m.schedule_day ?? 0))
    return Array.from({ length: maxDay || 4 }, (_, i) => ({
      day: i + 1,
      label: `Day ${i + 1}`,
    }))
  }, [modules, scheduleDays])

  const grouped = useMemo(() => {
    const sorted = [...modules].sort(compareCampModulesBySchedule)
    const buckets = new Map<number, ScheduleModule[]>()
    for (const mod of sorted) {
      const day = mod.schedule_day ?? 0
      if (!buckets.has(day)) buckets.set(day, [])
      buckets.get(day)!.push(mod)
    }
    return [...buckets.entries()].sort(([a], [b]) => {
      if (a === 0) return 1
      if (b === 0) return -1
      return a - b
    })
  }, [modules])

  const patchModule = (moduleId: number, patch: Partial<ScheduleModule>) => {
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, ...patch } : m)))
  }

  const patchDay = (day: number, patch: Partial<CampScheduleDay>) => {
    setScheduleDays((prev) =>
      prev.map((d) => (d.day === day ? { ...d, ...patch } : d)).sort((a, b) => a.day - b.day),
    )
  }

  const addDay = () => {
    setScheduleDays((prev) => {
      const day = nextDayNumber(prev)
      return [...prev, { day, label: `Day ${day}` }].sort((a, b) => a.day - b.day)
    })
  }

  const removeDay = (day: number) => {
    setScheduleDays((prev) => prev.filter((d) => d.day !== day))
    setModules((prev) =>
      prev.map((m) =>
        m.schedule_day === day ? { ...m, schedule_day: null, schedule_day_sort: 0 } : m,
      ),
    )
  }

  const moveWithinDay = (moduleId: number, direction: -1 | 1) => {
    setModules((prev) => {
      const mod = prev.find((m) => m.id === moduleId)
      if (!mod || mod.schedule_day == null) return prev
      const dayMods = prev
        .filter((m) => m.schedule_day === mod.schedule_day)
        .sort((a, b) => a.schedule_day_sort - b.schedule_day_sort || a.id - b.id)
      const idx = dayMods.findIndex((m) => m.id === moduleId)
      const swapIdx = idx + direction
      if (idx < 0 || swapIdx < 0 || swapIdx >= dayMods.length) return prev

      const a = dayMods[idx]!
      const b = dayMods[swapIdx]!
      return prev.map((m) => {
        if (m.id === a.id) return { ...m, schedule_day_sort: b.schedule_day_sort }
        if (m.id === b.id) return { ...m, schedule_day_sort: a.schedule_day_sort }
        return m
      })
    })
  }

  const saveSchedule = async (opts?: { resetToDefaults?: boolean }) => {
    setSaving(true)
    try {
      const res = await instructorApiFetch("/api/instructor/summer-camp/modules/schedule", {
        method: "PUT",
        headers: jsonHeaders,
        body: JSON.stringify({
          training_id: trainingId,
          schedule_days: scheduleDays,
          reset_to_defaults: opts?.resetToDefaults === true,
          renumber_titles: renumberTitles,
          modules: modules.map((m) => ({
            module_id: m.id,
            schedule_day: m.schedule_day,
            schedule_day_sort: m.schedule_day_sort,
            is_visible: m.is_visible,
          })),
        }),
      })
      if (!res.ok) return
      const data = (await res.json()) as {
        modules?: ScheduleModule[]
        schedule_days?: CampScheduleDay[]
        default_schedule?: CampTrainingScheduleConfig | null
      }
      setModules(data.modules ?? [])
      setScheduleDays(data.schedule_days ?? [])
      setDefaultSchedule(data.default_schedule ?? null)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full rounded-2xl" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (modules.length === 0) {
    return <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No curriculum modules yet.</p>
  }

  return (
    <div className="space-y-4">
      <div className={cn(card, "space-y-4 p-4")}>
        <div className="flex items-start gap-2">
          <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", fp.softBg)}>
            <CalendarDays className={cn("h-4 w-4", fp.iconText)} />
          </span>
          <div>
            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Workshop days & module order</p>
            <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
              Edit day labels and dates, assign modules, hide topics, then apply. Changes are saved
              to this training and reused after curriculum re-seeds.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
              Workshop days
            </p>
            <Button type="button" size="sm" className={cn("rounded-lg", solid)} onClick={addDay}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add day
            </Button>
          </div>
          {dayOptions.length === 0 ? (
            <p className="text-xs text-dashboard-v2-muted">
              No workshop days yet — add a day to start scheduling modules.
            </p>
          ) : (
            dayOptions.map((day, i) => {
              const stripe = portalThemeStripe(i)
              return (
              <div
                key={day.day}
                className={cn("grid gap-2 rounded-2xl border p-3 sm:grid-cols-[auto_1fr_1fr_auto]", stripe.row, stripe.border)}
              >
                <span className={cn("pt-2 font-mono text-xs", PORTAL_TEXT_MUTED)}>#{day.day}</span>
                <div className="space-y-1">
                  <label className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>Label</label>
                  <Input
                    value={day.label}
                    onChange={(e) => patchDay(day.day, { label: e.target.value })}
                    placeholder="Day 1"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>Date (optional)</label>
                  <Input
                    value={day.dateLabel ?? ""}
                    onChange={(e) =>
                      patchDay(day.day, { dateLabel: e.target.value.trim() || undefined })
                    }
                    placeholder="July 27th"
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 self-end text-red-600"
                  onClick={() => removeDay(day.day)}
                  aria-label={`Remove ${day.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              )
            })
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Switch checked={renumberTitles} onCheckedChange={setRenumberTitles} />
          Renumber module titles after apply (Module 0, 1, 2…)
        </label>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" className={cn("rounded-lg", solid)} onClick={() => void saveSchedule()} disabled={saving}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Apply schedule & reorder
          </Button>
          {defaultSchedule ? (
            <Button
              size="sm"
              className={cn("rounded-lg", quiet)}
              disabled={saving}
              onClick={() => {
                setScheduleDays(defaultSchedule.days)
                void saveSchedule({ resetToDefaults: true })
              }}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset to curriculum defaults
            </Button>
          ) : null}
        </div>
      </div>

      {grouped.map(([dayKey, dayModules]) => {
        const dayMeta = dayOptions.find((d) => d.day === dayKey)
        const heading =
          dayKey === 0
            ? "Unscheduled"
            : dayMeta
              ? dayLabel(dayMeta)
              : `Day ${dayKey}`

        return (
          <section key={dayKey} className="space-y-2">
            <h3 className={cn("text-xs font-bold uppercase tracking-wider", fp.iconText)}>{heading}</h3>
            {dayModules
              .sort(
                (a, b) =>
                  a.schedule_day_sort - b.schedule_day_sort ||
                  a.sort_order - b.sort_order ||
                  a.id - b.id,
              )
              .map((mod, i) => {
                const stripe = portalThemeStripe(i)
                return (
                <div
                  key={mod.id}
                  className={cn("flex flex-wrap items-center gap-3 rounded-2xl border p-3", stripe.row, stripe.border)}
                >
                  <GripVertical className={cn("h-4 w-4 shrink-0", PORTAL_TEXT_MUTED)} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`${editBasePath}/${mod.id}/edit`}
                      className={cn("line-clamp-2 font-medium hover:opacity-80", PORTAL_TEXT)}
                    >
                      {campModuleDisplayLabel(mod)}
                    </Link>
                    <p className={cn("mt-0.5 text-[11px]", PORTAL_TEXT_MUTED)}>{mod.title}</p>
                  </div>
                  <select
                    className="rounded-lg border px-2 py-1.5 text-xs bg-transparent"
                    value={mod.schedule_day ?? ""}
                    onChange={(e) => {
                      const v = e.target.value
                      patchModule(mod.id, {
                        schedule_day: v === "" ? null : Number(v),
                        schedule_day_sort: 0,
                      })
                    }}
                  >
                    <option value="">Unscheduled</option>
                    {dayOptions.map((d) => (
                      <option key={d.day} value={d.day}>
                        {dayLabel(d)}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      className={cn("h-8 w-8", quiet)}
                      onClick={() => moveWithinDay(mod.id, -1)}
                      aria-label="Move up"
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      className={cn("h-8 w-8", quiet)}
                      onClick={() => moveWithinDay(mod.id, 1)}
                      aria-label="Move down"
                    >
                      ↓
                    </Button>
                  </div>
                  <label className="flex items-center gap-2 text-xs shrink-0">
                    {mod.is_visible ? (
                      <Eye className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                    )}
                    <Switch
                      checked={mod.is_visible}
                      onCheckedChange={(checked) => patchModule(mod.id, { is_visible: checked })}
                    />
                    Visible
                  </label>
                  <CampStatusBadge status={mod.status} className="shrink-0" />
                  <Button size="sm" className={cn("h-8 shrink-0 gap-1 text-xs rounded-lg", solid)} asChild>
                    <Link href={`${editBasePath}/${mod.id}/lecture`}>
                      <Presentation className="h-3.5 w-3.5" />
                      Lecture
                    </Link>
                  </Button>
                </div>
                )
              })}
          </section>
        )
      })}
    </div>
  )
}
