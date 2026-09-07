"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Sun, Users, BookOpen, ChevronRight, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { FacultySummerCampShell } from "@/components/instructor/FacultySummerCampShell"

interface CampRow {
  id: number
  slug: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: string
  training_count: number
  enrollment_count: number
}

export default function AdminSummerCampPage() {
  const [camps, setCamps] = useState<CampRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/summer-camp/camps", { headers: buildAdminApiHeaders() })
      .then((r) => r.json())
      .then((d) => setCamps(d.camps ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <FacultySummerCampShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Sun className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-dashboard-v2-fg">Summer Camp</h1>
              <p className="text-sm text-dashboard-v2-muted">Manage camps, trainings, and faculty assignments</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : camps.length === 0 ? (
          <p className="text-dashboard-v2-muted">No camps yet. Run the seed migration or create one via API.</p>
        ) : (
          <div className="grid gap-4">
            {camps.map((camp) => (
              <Link
                key={camp.id}
                href={`/admin/dashboard-v2/summer-camp/${camp.id}`}
                className="rounded-2xl border border-dashboard-v2-border bg-dashboard-v2-card p-5 hover:border-violet-500/40 transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-semibold group-hover:text-violet-600 transition-colors">
                        {camp.title}
                      </h2>
                      <Badge variant="outline">{camp.status}</Badge>
                    </div>
                    {camp.description && (
                      <p className="text-sm text-dashboard-v2-muted line-clamp-2">{camp.description}</p>
                    )}
                    <div className="flex gap-4 mt-3 text-xs text-dashboard-v2-muted">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {camp.training_count} trainings
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {camp.enrollment_count} enrolled
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-violet-500 shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </FacultySummerCampShell>
  )
}
