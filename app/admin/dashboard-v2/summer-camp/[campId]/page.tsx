"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { FacultySummerCampShell } from "@/components/instructor/FacultySummerCampShell"
import { TrainingPublishActions } from "@/components/summer-camp/CampPublishControls"

export default function AdminSummerCampDetailPage() {
  const params = useParams()
  const campId = params.campId as string
  const [camp, setCamp] = useState<Record<string, unknown> | null>(null)
  const [trainings, setTrainings] = useState<Array<Record<string, unknown>>>([])
  const [instructors, setInstructors] = useState<Array<{ id: number; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [assignTrainingId, setAssignTrainingId] = useState("")
  const [assignInstructorId, setAssignInstructorId] = useState("")

  const load = useCallback(async () => {
    const [campRes, instRes] = await Promise.all([
      fetch(`/api/admin/summer-camp/camps/${campId}`, { headers: buildAdminApiHeaders() }),
      fetch("/api/admin/instructors?status=active", { headers: buildAdminApiHeaders() }),
    ])
    if (campRes.ok) {
      const data = await campRes.json()
      setCamp(data.camp)
      setTrainings(data.trainings ?? [])
    }
    if (instRes.ok) {
      const data = await instRes.json()
      setInstructors(
        (data.instructors ?? [])
          .filter((u: { role?: string }) => u.role !== "ta")
          .map((u: { id: number; name?: string; username?: string }) => ({
            id: u.id,
            name: u.name ?? u.username ?? `Instructor ${u.id}`,
          })),
      )
    }
  }, [campId])

  useEffect(() => {
    void load().finally(() => setLoading(false))
  }, [load])

  const updateCampStatus = async (status: string) => {
    await fetch(`/api/admin/summer-camp/camps/${campId}`, {
      method: "PUT",
      headers: { ...buildAdminApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  const toggleTrainingStatus = async (trainingId: number, status: string) => {
    await fetch("/api/admin/summer-camp/trainings", {
      method: "PATCH",
      headers: { ...buildAdminApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ training_id: trainingId, status }),
    })
    await load()
  }

  const assignFaculty = async () => {
    if (!assignTrainingId || !assignInstructorId) return
    await fetch("/api/admin/summer-camp/trainings/faculty", {
      method: "POST",
      headers: { ...buildAdminApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        training_id: Number(assignTrainingId),
        instructor_id: Number(assignInstructorId),
        role: "lead",
      }),
    })
    setAssignInstructorId("")
    await load()
  }

  if (loading) {
    return (
      <FacultySummerCampShell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      </FacultySummerCampShell>
    )
  }

  if (!camp) {
    return (
      <FacultySummerCampShell>
        <p className="text-dashboard-v2-muted">Camp not found.</p>
      </FacultySummerCampShell>
    )
  }

  return (
    <FacultySummerCampShell>
      <Link
        href="/admin/dashboard-v2/summer-camp"
        className="inline-flex items-center gap-1 text-sm text-dashboard-v2-muted hover:text-violet-600 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        All camps
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-dashboard-v2-fg">{String(camp.title)}</h1>
          <Badge className="mt-2">{String(camp.status)}</Badge>
        </div>
        <div className="flex gap-2">
          {(["published", "active", "archived"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={camp.status === s ? "default" : "outline"}
              onClick={() => void updateCampStatus(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-dashboard-v2-border bg-dashboard-v2-card p-5 mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Assign faculty to training
        </h2>
        <div className="flex flex-wrap gap-3">
          <Select value={assignTrainingId} onValueChange={setAssignTrainingId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Training" /></SelectTrigger>
            <SelectContent>
              {trainings.map((t) => (
                <SelectItem key={String(t.id)} value={String(t.id)}>{String(t.title)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={assignInstructorId} onValueChange={setAssignInstructorId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Instructor" /></SelectTrigger>
            <SelectContent>
              {instructors.length === 0 ? (
                <SelectItem value="_none" disabled>
                  No faculty available
                </SelectItem>
              ) : (
                instructors.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>{i.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button onClick={() => void assignFaculty()}>Assign</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-dashboard-v2-fg">Training tracks</h2>
        {trainings.map((t) => {
          const faculty = (t.faculty as Array<{ name: string; role: string }> | null) ?? []
          return (
            <div
              key={String(t.id)}
              className="rounded-xl border border-dashboard-v2-border bg-dashboard-v2-card p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{String(t.title)}</p>
                  <p className="text-xs text-dashboard-v2-muted mt-1">
                    {String(t.enrollment_count ?? 0)} enrolled
                    {faculty.length > 0 && ` · Faculty: ${faculty.map((f) => f.name).join(", ")}`}
                  </p>
                </div>
                <TrainingPublishActions
                  status={String(t.status)}
                  publishLabel="Publish"
                  onPublish={() => void toggleTrainingStatus(Number(t.id), "published")}
                  onUnpublish={() => void toggleTrainingStatus(Number(t.id), "unpublished")}
                />
              </div>
            </div>
          )
        })}
      </section>
    </FacultySummerCampShell>
  )
}
