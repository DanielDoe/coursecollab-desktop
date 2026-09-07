"use client"

import Link from "next/link"
import { Map, CheckCircle2, Circle, CircleDot } from "lucide-react"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { useCampHub } from "@/components/summer-camp/use-camp-hub"
import { campRoute } from "@/lib/summer-camp/camper-nav"
import { cn } from "@/lib/utils"

type RoadmapHub = {
  roadmaps: Array<{
    training_id: number
    training_title: string
    percent: number
    milestones: Array<{
      id: number
      title: string
      status: string
      is_complete: boolean
    }>
  }>
}

export default function LearningRoadmapPage() {
  const { data, loading } = useCampHub<RoadmapHub>("roadmap")

  return (
    <CamperPageShell
      icon={Map}
      title="Learning Roadmap"
      subtitle="Visual progression through your training milestones — like a game map."
      loading={loading}
    >
      {(data?.roadmaps?.length ?? 0) === 0 ? (
        <p className="text-slate-500 dark:text-slate-400 dark:text-slate-400">
          Enroll in a training to see your roadmap.{" "}
          <Link href={campRoute("/browse")} className="text-violet-600 dark:text-violet-400 hover:underline">
            Browse trainings
          </Link>
        </p>
      ) : (
        <div className="space-y-8">
          {data!.roadmaps.map((rm) => (
            <section
              key={rm.training_id}
              className="rounded-2xl border border-slate-200/80 dark:border-white/10 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{rm.training_title}</h2>
                <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">{rm.percent}% complete</span>
              </div>
              <div className="relative space-y-0">
                {rm.milestones.map((m, i) => {
                  const Icon = m.is_complete ? CheckCircle2 : m.status === "current" ? CircleDot : Circle
                  const isLast = i === rm.milestones.length - 1
                  return (
                    <div key={m.id} className="flex gap-4 relative">
                      {!isLast && (
                        <div
                          className={cn(
                            "absolute left-[11px] top-8 w-0.5 h-[calc(100%-8px)]",
                            m.is_complete ? "bg-emerald-400" : "bg-slate-200 dark:bg-white/10",
                          )}
                        />
                      )}
                      <div className="shrink-0 mt-0.5 z-10">
                        <Icon
                          className={cn(
                            "h-6 w-6",
                            m.is_complete
                              ? "text-emerald-500"
                              : m.status === "current"
                                ? "text-amber-500 animate-pulse"
                                : "text-slate-300",
                          )}
                        />
                      </div>
                      <Link
                        href={campRoute(`/module/${m.id}`)}
                        className={cn(
                          "flex-1 pb-6 rounded-lg px-2 -mx-2 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors",
                          m.status === "current" && "bg-amber-500/5",
                        )}
                      >
                        <p
                          className={cn(
                            "font-medium",
                            m.is_complete && "text-emerald-700 dark:text-emerald-400",
                            m.status === "current" && "text-amber-700 dark:text-amber-300",
                            !m.is_complete && m.status !== "current" && "text-slate-500 dark:text-slate-400 dark:text-slate-400",
                          )}
                        >
                          {m.is_complete ? "✓ " : m.status === "current" ? "→ " : "○ "}
                          {m.title}
                        </p>
                      </Link>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </CamperPageShell>
  )
}
