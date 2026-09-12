"use client"

import { useState } from "react"
import { Images, Heart, Trophy, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { useCampHub } from "@/components/summer-camp/use-camp-hub"
import { cn } from "@/lib/utils"
import { useAppConfirm } from "@/components/providers/app-confirm-provider"

type GalleryEntry = {
  id: number
  student_id: number
  student_name: string
  title: string
  description: string | null
  project_type: string
  media_url: string | null
  vote_count: number
  has_voted: boolean
  is_featured: boolean
}

type GalleryHub = {
  training_id: number | null
  entries: GalleryEntry[]
  awards: Array<{ award_type: string; award_label: string; student_name: string }>
  peoples_choice_leaderboard: GalleryEntry[]
  award_types: Record<string, string>
}

export default function GalleryPage() {
  const { data, loading, reload, session } = useCampHub<GalleryHub>("gallery")
  const [votingId, setVotingId] = useState<number | null>(null)
  const { alert } = useAppConfirm()

  const vote = async (entryId: number) => {
    if (!session?.databaseId) return
    setVotingId(entryId)
    try {
      const res = await fetch("/api/summer-camp/gallery/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-student-id": session.databaseId },
        body: JSON.stringify({ entryId, studentDatabaseId: session.databaseId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Vote failed")
      }
      await reload()
    } catch (e) {
      await alert({
        title: "Vote failed",
        description: e instanceof Error ? e.message : "Vote failed",
      })
    } finally {
      setVotingId(null)
    }
  }

  return (
    <CamperPageShell
      icon={Images}
      title="Project Gallery"
      subtitle="Explore your fellow campers' Edge AI projects and vote for the People's Choice Award."
      loading={loading}
    >
      {(data?.awards?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 mb-6">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Trophy className="h-4 w-4 text-amber-600" />
            Showcase Awards
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data!.awards.map((a, i) => (
              <li key={i} className="rounded-xl border border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">{a.award_label}</p>
                <p className="font-medium">{a.student_name}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(data?.peoples_choice_leaderboard?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5 mb-6">
          <h2 className="font-semibold mb-3">People&apos;s Choice Leaderboard</h2>
          <ol className="space-y-2">
            {data!.peoples_choice_leaderboard.slice(0, 5).map((e, idx) => (
              <li key={e.id} className="flex items-center justify-between text-sm">
                <span>
                  <span className="font-bold text-violet-600 mr-2">#{idx + 1}</span>
                  {e.student_name} — {e.title}
                </span>
                <Badge variant="outline">{e.vote_count} votes</Badge>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section>
        <h2 className="font-semibold text-lg mb-4">All Projects</h2>
        {(data?.entries?.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Projects appear here after faculty approves video demonstrations in the Final Project Showcase.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data!.entries.map((entry) => {
              const isOwn = session?.databaseId != null && Number(session.databaseId) === entry.student_id
              return (
                <article
                  key={entry.id}
                  className={cn(
                    "rounded-xl border p-4 flex flex-col",
                    entry.is_featured
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-slate-200/80 dark:border-white/10",
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold">{entry.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{entry.student_name}</p>
                    </div>
                    {entry.is_featured && <Badge className="shrink-0">Featured</Badge>}
                  </div>
                  {entry.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{entry.description}</p>
                  )}
                  {entry.media_url && (
                    <a
                      href={entry.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-violet-600 hover:underline flex items-center gap-1 mb-3"
                    >
                      View {entry.project_type === "video" ? "demo video" : "screenshot"}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-sm flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <Heart className="h-4 w-4" />
                      {entry.vote_count}
                    </span>
                    {!isOwn && (
                      <Button
                        size="sm"
                        variant={entry.has_voted ? "secondary" : "default"}
                        disabled={entry.has_voted || votingId === entry.id}
                        onClick={() => void vote(entry.id)}
                      >
                        {entry.has_voted ? "Voted" : "Vote"}
                      </Button>
                    )}
                    {isOwn && <Badge variant="outline">Your project</Badge>}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </CamperPageShell>
  )
}
