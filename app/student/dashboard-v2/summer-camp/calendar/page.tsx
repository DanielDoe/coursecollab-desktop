"use client"

import { Calendar, Users, Mic, Flag } from "lucide-react"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { useCampHub } from "@/components/summer-camp/use-camp-hub"

type CalendarHub = {
  events: Array<{ id: number; title: string; date: string | null; type: string }>
}

const TYPE_ICON: Record<string, typeof Calendar> = {
  workshop: Users,
  deadline: Flag,
  speaker: Mic,
}

export default function CampCalendarPage() {
  const { data, loading } = useCampHub<CalendarHub>("calendar")

  return (
    <CamperPageShell
      icon={Calendar}
      title="Camp Calendar"
      subtitle="Workshops, guest speakers, faculty meetings, and submission deadlines."
      loading={loading}
    >
      <div className="space-y-3">
        {(data?.events ?? []).map((ev) => {
          const Icon = TYPE_ICON[ev.type] ?? Calendar
          return (
            <div
              key={ev.id}
              className="flex items-center gap-4 rounded-xl border border-slate-200/80 dark:border-white/10 p-4"
            >
              <div className="size-10 rounded-lg bg-sky-500/15 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="font-medium">{ev.title}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{ev.type.replace("_", " ")}</p>
              </div>
              <p className="ml-auto text-sm text-slate-500 dark:text-slate-400">{ev.date ?? "TBD"}</p>
            </div>
          )
        })}
        {(data?.events?.length ?? 0) === 0 && (
          <p className="text-slate-500 dark:text-slate-400">Camp calendar events will be posted here.</p>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-6">
        Teams, leaderboard, and detailed workshop scheduling coming in a future release.
      </p>
    </CamperPageShell>
  )
}
