"use client"

import { useEffect, useState } from "react"
import { Award } from "lucide-react"
import { CampCertificateTemplateEditor } from "@/components/summer-camp/CampCertificateTemplateEditor"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export default function InstructorCampCertificatesPage() {
  const { iconBadge, card } = facultyEmbedChrome("summer-camp")
  const [trainings, setTrainings] = useState<
    Array<{ id: number; title: string; camp_title: string }>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    instructorApiFetch("/api/instructor/summer-camp/trainings", { headers: buildInstructorApiHeaders() })
      .then((r) => (r.ok ? r.json() : { trainings: [] }))
      .then((data) => setTrainings(data.trainings ?? []))
      .catch(() => setTrainings([]))
      .finally(() => setLoading(false))
  }, [])

  const emptyPanelClass = cn(
    card,
    "flex min-h-0 flex-1 flex-col items-center justify-center border-dashed px-4 py-10 text-center",
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-start gap-3">
        <span className={iconBadge("md")}>
          <Award className="h-5 w-5 !text-white" />
        </span>
        <div className="min-w-0">
          <h1 className={cn("text-lg font-semibold sm:text-xl", PORTAL_TEXT)}>Certificate templates</h1>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Customize PDF certificates — signatories, sections, and branding per track.
          </p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <div className="grid gap-4 xl:grid-cols-2">
              <Skeleton className="h-80 w-full rounded-2xl" />
              <Skeleton className="h-80 w-full rounded-2xl" />
            </div>
          </div>
        ) : trainings.length === 0 ? (
          <div className={emptyPanelClass}>
            <Award className={cn("mx-auto mb-2 h-8 w-8", PORTAL_TEXT_MUTED)} />
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
              No training tracks yet. Create a track under Programs & tracks to design its certificate.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2">
            <CampCertificateTemplateEditor trainings={trainings} />
          </div>
        )}
      </div>
    </div>
  )
}
