"use client"

import Link from "next/link"
import { GraduationCap, User, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { useCampHub } from "@/components/summer-camp/use-camp-hub"
import { campRoute } from "@/lib/summer-camp/camper-nav"

type MyTrainingsHub = {
  trainings: Array<{
    training_id: number
    training_title: string
    camp_title: string
    percent: number
    completed_modules: number
    total_modules: number
    completion_status: string
    faculty: Array<{ name: string; role: string }>
  }>
}

const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  in_progress: "In Progress",
  not_started: "Not Started",
}

export default function MyTrainingsPage() {
  const { data, loading } = useCampHub<MyTrainingsHub>("my-trainings")

  return (
    <CamperPageShell
      icon={GraduationCap}
      title="My Trainings"
      subtitle="Enrolled tracks, progress, and faculty mentors."
      loading={loading}
    >
      {(data?.trainings?.length ?? 0) === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 dark:text-slate-400">
          No enrollments yet.{" "}
          <Link
            href={campRoute("/browse")}
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            Browse trainings
          </Link>
        </p>
      ) : (
        <div className="space-y-4">
          {data!.trainings.map((t) => (
            <Link
              key={t.training_id}
              href={campRoute(`/training/${t.training_id}`)}
              className="block rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] p-5 hover:border-violet-500/40 transition-colors group"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400">
                      {t.training_title}
                    </h2>
                    <Badge variant="outline" className="dark:border-white/20 dark:text-slate-300">
                      {STATUS_LABEL[t.completion_status] ?? t.completion_status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-400 mt-0.5">{t.camp_title}</p>
                  {t.faculty?.[0] && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-400 mt-2 flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {t.faculty[0].name}
                      {t.faculty[0].role === "lead" ? " (Lead Faculty)" : ""}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{t.percent}%</p>
                  <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-500 dark:text-slate-400 ml-auto mt-1" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 dark:text-slate-400 mb-1">
                  <span>
                    {t.completed_modules} / {t.total_modules} modules
                  </span>
                </div>
                <Progress value={t.percent} className="h-2" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </CamperPageShell>
  )
}
