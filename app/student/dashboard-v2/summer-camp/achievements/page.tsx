"use client"

import { Award } from "lucide-react"
import { CampCertificateStudentActions } from "@/components/summer-camp/CampCertificateStudentActions"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { useCampHub } from "@/components/summer-camp/use-camp-hub"
import { campRoute } from "@/lib/summer-camp/camper-nav"
import Link from "next/link"
import { cn } from "@/lib/utils"

type AchievementsHub = {
  badges: Array<{ id: string; title: string; emoji: string; earned: boolean; description: string }>
  certificates: Array<{
    id: number
    title: string
    available: boolean
    verification_code?: string | null
    linkedin_share_url?: string | null
    issued_at?: string | null
  }>
  stats: { modules_completed: number; modules_total: number; badges_earned: number; total_xp: number }
}

export default function AchievementsPage() {
  const { data, loading, session } = useCampHub<AchievementsHub>("achievements")

  return (
    <CamperPageShell
      icon={Award}
      title="Certificates & Achievements"
      subtitle="Earn badges as you complete milestones and download certificates when you graduate."
      loading={loading}
    >
      {data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 text-center">
            <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">{data.stats.total_xp}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total XP</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 dark:border-white/10 p-4 text-center">
            <p className="text-2xl font-bold">{data.stats.badges_earned}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Badges earned</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 dark:border-white/10 p-4 text-center">
            <p className="text-2xl font-bold">{data.stats.modules_completed}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Modules complete</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 dark:border-white/10 p-4 text-center">
            <p className="text-2xl font-bold">{data.stats.modules_total}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total modules</p>
          </div>
        </div>
      )}

      <section className="mb-8">
        <h2 className="font-semibold text-lg mb-4">Badges</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(data?.badges ?? []).map((b) => (
            <div
              key={b.id}
              className={cn(
                "rounded-xl border p-4 flex gap-3",
                b.earned
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-slate-200/80 dark:border-white/10 opacity-60",
              )}
            >
              <span className="text-3xl">{b.emoji}</span>
              <div>
                <p className="font-semibold">{b.title}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{b.description}</p>
                {b.earned && <p className="text-xs text-emerald-600 mt-1 font-medium">Earned!</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-lg mb-4">Certificates</h2>
        {(data?.certificates?.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Complete all graduation requirements on the{" "}
            <Link href={campRoute("/graduation")} className="text-violet-600 hover:underline">
              Camp Graduation
            </Link>{" "}
            page to unlock your Summer Camp certificate.
          </p>
        ) : (
          <ul className="space-y-3">
            {data!.certificates.map((c) => (
              <li
                key={c.id || c.title}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4"
              >
                <div>
                  <p className="font-medium">{c.title}</p>
                  {c.verification_code && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Code: {c.verification_code}</p>
                  )}
                  {!c.available && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Complete graduation requirements to unlock</p>
                  )}
                </div>
                {session?.databaseId && c.available && c.id > 0 && c.verification_code && (
                  <CampCertificateStudentActions
                    certId={c.id}
                    verificationCode={c.verification_code}
                    linkedinUrl={c.linkedin_share_url ?? null}
                    studentDatabaseId={session.databaseId}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </CamperPageShell>
  )
}
