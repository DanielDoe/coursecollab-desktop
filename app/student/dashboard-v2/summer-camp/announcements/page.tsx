"use client"

import { Megaphone } from "lucide-react"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { useCampHub } from "@/components/summer-camp/use-camp-hub"

type AnnouncementsHub = {
  announcements: Array<{ id: number; title: string; body: string; date: string | null }>
}

export default function CampAnnouncementsPage() {
  const { data, loading } = useCampHub<AnnouncementsHub>("announcements")

  return (
    <CamperPageShell
      icon={Megaphone}
      title="Announcements"
      subtitle="Important updates from camp faculty and coordinators."
      loading={loading}
    >
      <ul className="space-y-4">
        {(data?.announcements ?? []).map((a) => (
          <li key={a.id} className="rounded-2xl border border-slate-200/80 dark:border-white/10 p-5">
            <p className="font-semibold text-lg">{a.title}</p>
            {a.date && <p className="text-xs text-slate-400 mt-1">{a.date}</p>}
            <p className="text-slate-600 dark:text-slate-400 mt-2">{a.body}</p>
          </li>
        ))}
        {(data?.announcements?.length ?? 0) === 0 && (
          <p className="text-slate-500 dark:text-slate-400">No announcements at this time.</p>
        )}
      </ul>
    </CamperPageShell>
  )
}
