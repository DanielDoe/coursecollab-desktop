"use client"

import Link from "next/link"
import {
  GraduationCap,
  CheckCircle2,
  Circle,
  Trophy,
  MessageSquare,
  Images,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CampCertificateStudentActions } from "@/components/summer-camp/CampCertificateStudentActions"
import { Badge } from "@/components/ui/badge"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { useCampHub } from "@/components/summer-camp/use-camp-hub"
import { campRoute } from "@/lib/summer-camp/camper-nav"
import { cn } from "@/lib/utils"

type Requirement = { id: string; label: string; met: boolean; detail?: string }

type GraduationTraining = {
  training_id: number
  training_title: string
  camp_title: string
  requirements: Requirement[]
  ready_to_graduate: boolean
  modules_completed: number
  modules_total: number
  certificate: {
    id: number
    verification_code: string
    linkedin_share_url: string | null
    issued_at: string
  } | null
  awards: Array<{ award_type: string; label: string; student_name: string }>
  feedback_cards: Array<{
    id: number
    title: string
    message: string
    strengths: string | null
    improvements: string | null
    instructor_name: string
    created_at: string
  }>
  gallery_count: number
  total_xp: number
}

type GraduationHub = {
  trainings: GraduationTraining[]
  total_xp: number
  badges: string[]
}

export default function GraduationPage() {
  const { data, loading, session } = useCampHub<GraduationHub>("graduation")
  const training = data?.trainings?.[0]

  return (
    <CamperPageShell
      icon={GraduationCap}
      title="Camp Graduation"
      subtitle="Track your graduation requirements, awards, faculty feedback, and download your certificate."
      loading={loading}
    >
      {training && (
        <>
          <div
            className={cn(
              "rounded-2xl border p-6 mb-6 text-center",
              training.ready_to_graduate
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-slate-200/80 dark:border-white/10",
            )}
          >
            <p className="text-4xl mb-2">{training.ready_to_graduate ? "🎓" : "🚀"}</p>
            <h2 className="text-xl font-bold">
              {training.ready_to_graduate
                ? "Congratulations — You're a Summer Camp Graduate!"
                : "Almost there — keep building!"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              {training.camp_title} · {training.training_title}
            </p>
            <p className="text-sm mt-1">
              {training.modules_completed} / {training.modules_total} modules · {training.total_xp} XP
            </p>
          </div>

          <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 p-5 mb-6">
            <h2 className="font-semibold mb-4">Graduation Requirements</h2>
            <ul className="space-y-3">
              {training.requirements.map((r) => (
                <li key={r.id} className="flex items-start gap-3">
                  {r.met ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={cn("font-medium", !r.met && "text-slate-500 dark:text-slate-400")}>{r.label}</p>
                    {r.detail && <p className="text-xs text-slate-500 dark:text-slate-400">{r.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {training.certificate && (
            <section className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5 mb-6">
              <h2 className="font-semibold mb-3">Your Certificate</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                Verification: {training.certificate.verification_code}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Issued {new Date(training.certificate.issued_at).toLocaleDateString()}
              </p>
              {session?.databaseId && (
                <CampCertificateStudentActions
                  certId={training.certificate.id}
                  verificationCode={training.certificate.verification_code}
                  linkedinUrl={training.certificate.linkedin_share_url}
                  studentDatabaseId={session.databaseId}
                />
              )}
            </section>
          )}

          {(training.awards?.length ?? 0) > 0 && (
            <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 mb-6">
              <h2 className="font-semibold flex items-center gap-2 mb-4">
                <Trophy className="h-4 w-4 text-amber-600" />
                Awards
              </h2>
              <ul className="space-y-2">
                {training.awards.map((a, i) => (
                  <li key={i} className="flex items-center justify-between rounded-xl border border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] p-3">
                    <span className="text-sm">{a.label}</span>
                    <Badge>{a.student_name}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(training.feedback_cards?.length ?? 0) > 0 && (
            <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 p-5 mb-6">
              <h2 className="font-semibold flex items-center gap-2 mb-4">
                <MessageSquare className="h-4 w-4 text-violet-500" />
                Faculty Feedback Cards
              </h2>
              <ul className="space-y-4">
                {training.feedback_cards.map((card) => (
                  <li key={card.id} className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">{card.title}</p>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{card.instructor_name}</span>
                    </div>
                    <p className="text-sm">{card.message}</p>
                    {card.strengths && (
                      <p className="text-sm mt-2 text-emerald-700 dark:text-emerald-400">
                        <strong>Strengths:</strong> {card.strengths}
                      </p>
                    )}
                    {card.improvements && (
                      <p className="text-sm mt-1 text-amber-700 dark:text-amber-400">
                        <strong>Growth areas:</strong> {card.improvements}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link href={campRoute("/gallery")}>
                <Images className="h-4 w-4 mr-1" />
                Project Gallery ({training.gallery_count})
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={campRoute("/achievements")}>Certificates & Achievements</Link>
            </Button>
          </div>
        </>
      )}
    </CamperPageShell>
  )
}
