"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Sun, BookOpen, Users, ChevronRight, Plus } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { CampStatusBadge, TrainingPublishActions } from "@/components/summer-camp/CampPublishControls"
import { FacultyIntegratedToolbar } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalThemeStripe } from "@/lib/portal-module-themes"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type CampRow = {
  id: number
  title: string
  status: string
  is_owner?: boolean
  training_count?: number
  enrollment_count?: number
}

type TrainingRow = {
  id: number
  title: string
  status: string
  camp_title: string
  camp_status?: string
  enrollment_count?: number
  is_camp_owner?: boolean
  faculty_role?: string
}

export function InstructorSummerCampHub() {
  const { p: fp, iconBadge, card, solid } = facultyEmbedChrome("summer-camp")

  const [camps, setCamps] = useState<CampRow[]>([])
  const [trainings, setTrainings] = useState<TrainingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [campDialogOpen, setCampDialogOpen] = useState(false)
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")

  const [campForm, setCampForm] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
  })
  const [trainingForm, setTrainingForm] = useState({
    camp_id: "",
    title: "",
    description: "",
  })

  const headers = () => ({
    ...buildInstructorApiHeaders(),
    "Content-Type": "application/json",
  })

  const load = useCallback(async () => {
    const [campRes, trainingRes] = await Promise.all([
      instructorApiFetch("/api/instructor/summer-camp/camps", { headers: buildInstructorApiHeaders() }),
      instructorApiFetch("/api/instructor/summer-camp/trainings", { headers: buildInstructorApiHeaders() }),
    ])
    if (campRes.ok) {
      const data = await campRes.json()
      setCamps((data.camps ?? []) as CampRow[])
    }
    if (trainingRes.ok) {
      const data = await trainingRes.json()
      setTrainings((data.trainings ?? []) as TrainingRow[])
    }
  }, [])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  const ownedCamps = camps.filter((c) => c.is_owner !== false)
  const query = search.trim().toLowerCase()

  const filteredCamps = useMemo(() => {
    if (!query) return ownedCamps
    return ownedCamps.filter((c) => c.title.toLowerCase().includes(query))
  }, [ownedCamps, query])

  const filteredTrainings = useMemo(() => {
    if (!query) return trainings
    return trainings.filter(
      (t) =>
        t.title.toLowerCase().includes(query) || t.camp_title.toLowerCase().includes(query),
    )
  }, [trainings, query])

  const createCamp = async () => {
    if (!campForm.title.trim()) return
    setSaving(true)
    setError("")
    try {
      const res = await instructorApiFetch("/api/instructor/summer-camp/camps", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          title: campForm.title,
          description: campForm.description || null,
          start_date: campForm.start_date || null,
          end_date: campForm.end_date || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create camp")
      setCampDialogOpen(false)
      setCampForm({ title: "", description: "", start_date: "", end_date: "" })
      await load()
      const camp = data.camp as { id: number }
      setTrainingForm((f) => ({ ...f, camp_id: String(camp.id) }))
      setTrainingDialogOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create camp")
    } finally {
      setSaving(false)
    }
  }

  const createTraining = async () => {
    if (!trainingForm.camp_id || !trainingForm.title.trim()) return
    setSaving(true)
    setError("")
    try {
      const res = await instructorApiFetch("/api/instructor/summer-camp/trainings", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          camp_id: Number(trainingForm.camp_id),
          title: trainingForm.title,
          description: trainingForm.description || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create training")
      setTrainingDialogOpen(false)
      setTrainingForm({ camp_id: "", title: "", description: "" })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create training")
    } finally {
      setSaving(false)
    }
  }

  const publishTraining = async (trainingId: number) => {
    await instructorApiFetch("/api/instructor/summer-camp/trainings", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ training_id: trainingId, status: "published" }),
    })
    await load()
  }

  const unpublishTraining = async (trainingId: number) => {
    await instructorApiFetch("/api/instructor/summer-camp/trainings", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ training_id: trainingId, status: "draft" }),
    })
    await load()
  }

  const publishCamp = async (campId: number) => {
    await instructorApiFetch("/api/instructor/summer-camp/camps", {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ camp_id: campId, status: "published" }),
    })
    await load()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  const metaLine = `${ownedCamps.length} program${ownedCamps.length === 1 ? "" : "s"} · ${trainings.length} track${trainings.length === 1 ? "" : "s"}`

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className={iconBadge("md")}>
          <Sun className="h-5 w-5 !text-white" />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h1 className={cn("text-lg font-semibold sm:text-xl", PORTAL_TEXT)}>Summer Camp</h1>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Create programs, publish training tracks, and manage camper enrollment.
          </p>
        </div>
      </div>

      <FacultyIntegratedToolbar
        moduleId="summer-camp"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search programs or tracks…"
        meta={<span className={PORTAL_TEXT_MUTED}>{metaLine}</span>}
        trailing={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" className={cn("gap-1.5 rounded-lg", solid)} onClick={() => setCampDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              New program
            </Button>
            <Button
              type="button"
              size="sm"
              className={cn("gap-1.5 rounded-lg", solid)}
              disabled={ownedCamps.length === 0}
              onClick={() => setTrainingDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add track
            </Button>
          </div>
        }
      />

      {ownedCamps.length > 0 ? (
        <div className={cn(card, "space-y-3 p-3 sm:p-4")}>
          <p className={cn("text-xs font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
            Your programs
          </p>
          <ul className="space-y-2">
            {filteredCamps.map((camp, index) => {
              const stripe = portalThemeStripe(index)
              return (
              <li
                key={camp.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-2.5",
                  stripe.row,
                  stripe.border,
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
                    <Sun className={cn("h-4 w-4", stripe.iconText)} />
                  </div>
                  <div className="min-w-0">
                    <p className={cn("font-medium", PORTAL_TEXT)}>{camp.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--cc-text-secondary)]">
                      {camp.training_count ?? 0} tracks · {camp.enrollment_count ?? 0} campers
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CampStatusBadge status={camp.status} />
                  {camp.status === "draft" ? (
                    <Button size="sm" className={cn("h-8 rounded-lg", solid)} onClick={() => void publishCamp(camp.id)}>
                      Publish
                    </Button>
                  ) : null}
                </div>
              </li>
              )
            })}
          </ul>
          {filteredCamps.length === 0 && query ? (
            <p className={cn("py-4 text-center text-sm", PORTAL_TEXT_MUTED)}>No programs match your search.</p>
          ) : null}
        </div>
      ) : null}

      <div className={cn(card, "space-y-3 p-3 sm:p-4")}>
        <p className={cn("text-xs font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
          Training tracks
        </p>

        {trainings.length === 0 ? (
          <div className={cn("rounded-2xl px-4 py-10 text-center", fp.softBg)}>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--cc-accent)]">
              <Sun className="h-6 w-6 !text-white" aria-hidden />
            </div>
            <p className={cn("mx-auto max-w-md text-sm", PORTAL_TEXT_MUTED)}>
              Create a summer program and training track so campers can enroll from the landing page.
            </p>
            <Button type="button" size="sm" className={cn("mt-4 gap-1.5 rounded-lg", solid)} onClick={() => setCampDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Create first program
            </Button>
          </div>
        ) : filteredTrainings.length === 0 ? (
          <p className={cn("py-6 text-center text-sm", PORTAL_TEXT_MUTED)}>No tracks match your search.</p>
        ) : (
          <ul className="space-y-2">
            {filteredTrainings.map((t, index) => {
              const stripe = portalThemeStripe(index)
              return (
              <li
                key={t.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-2xl border px-3 py-2.5",
                  stripe.row,
                  stripe.border,
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
                    <BookOpen className={cn("h-4 w-4", stripe.iconText)} />
                  </div>
                  <div className="min-w-0 flex-1">
                  <p className="text-xs text-[var(--cc-text-secondary)]">{t.camp_title}</p>
                  <Link
                    href={`${FACULTY_DASHBOARD_BASE}/summer-camp/training/${t.id}`}
                    className={cn(
                      "mt-0.5 inline-flex items-center gap-1.5 text-base font-semibold transition-colors",
                      PORTAL_TEXT,
                      "hover:opacity-80",
                    )}
                  >
                    {t.title}
                    <ChevronRight className="h-4 w-4 opacity-50" aria-hidden />
                  </Link>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-[var(--cc-text-secondary)]">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {t.enrollment_count ?? 0} campers
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      {t.faculty_role ?? "faculty"}
                    </span>
                  </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {t.is_camp_owner ? (
                    <TrainingPublishActions
                      status={t.status}
                      publishLabel="Publish"
                      className="ml-0"
                      onPublish={() => void publishTraining(t.id)}
                      onUnpublish={() => void unpublishTraining(t.id)}
                    />
                  ) : (
                    <CampStatusBadge status={t.status} />
                  )}
                </div>
              </li>
              )
            })}
          </ul>
        )}
      </div>

      <Dialog open={campDialogOpen} onOpenChange={setCampDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Create summer program</DialogTitle>
            <DialogDescription>
              A program groups one or more training tracks campers can enroll in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Program title</Label>
              <Input
                value={campForm.title}
                onChange={(e) => setCampForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Summer Camp 2026"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={campForm.description}
                onChange={(e) => setCampForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={campForm.start_date}
                  onChange={(e) => setCampForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={campForm.end_date}
                  onChange={(e) => setCampForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button className={cn("rounded-lg", solid)} onClick={() => void createCamp()} disabled={saving || !campForm.title.trim()}>
              {saving ? "Creating…" : "Create program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trainingDialogOpen} onOpenChange={setTrainingDialogOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Add training track</DialogTitle>
            <DialogDescription>
              Published tracks appear on the public summer camp page for camper enrollment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Summer program</Label>
              <Select
                value={trainingForm.camp_id}
                onValueChange={(v) => setTrainingForm((f) => ({ ...f, camp_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a program you created" />
                </SelectTrigger>
                <SelectContent>
                  {ownedCamps.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Track title</Label>
              <Input
                value={trainingForm.title}
                onChange={(e) => setTrainingForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="AI & Edge Computing"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={trainingForm.description}
                onChange={(e) => setTrainingForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              className={cn("rounded-lg", solid)}
              onClick={() => void createTraining()}
              disabled={saving || !trainingForm.camp_id || !trainingForm.title.trim()}
            >
              {saving ? "Creating…" : "Create track"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
