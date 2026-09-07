import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"
import { CheckCircle2, Shield, Award, BadgeCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getCertificateVerificationDetails } from "@/lib/summer-camp/certificate-verification"

export const dynamic = "force-dynamic"

type PageProps = { params: Promise<{ code: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params
  const details = await getCertificateVerificationDetails(code)
  if (!details) {
    return { title: "Certificate Not Found" }
  }
  return {
    title: `Verify Certificate — ${details.studentName}`,
    description: `Valid Prairie View A&M University summer camp certificate (${details.certificateNumber}).`,
  }
}

export default async function CertificateVerificationPage({ params }: PageProps) {
  const { code } = await params
  const details = await getCertificateVerificationDetails(code)
  if (!details) notFound()

  const verifiedDate = new Date(details.verifiedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
  const issueDate = new Date(details.issueDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fcfaf6] to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#582c83]/10">
            <Shield className="h-7 w-7 text-[#582c83]" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Certificate Verification</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Prairie View A&M University
            {details.partnerIssuer ? ` · ${details.partnerIssuer}` : " · CREDIT Center"}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 mb-6 flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-800 dark:text-emerald-200">Valid Certificate</p>
            <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 mt-1">
              This credential was issued by Prairie View A&M University and verified on {verifiedDate}.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-white/[0.03] p-6 space-y-5 mb-6">
          <h2 className="font-semibold text-lg">Certificate Details</h2>
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Student</dt>
              <dd className="font-semibold mt-0.5">{details.studentName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Certificate Number</dt>
              <dd className="font-mono font-medium mt-0.5">{details.certificateNumber}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Camp</dt>
              <dd className="font-medium mt-0.5">{details.campName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Training Track</dt>
              <dd className="font-medium mt-0.5">{details.trainingTrack}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Issue Date</dt>
              <dd className="font-medium mt-0.5">{issueDate}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Hours Completed</dt>
              <dd className="font-medium mt-0.5">{details.hoursCompleted ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Final Project</dt>
              <dd className="font-medium mt-0.5">{details.finalProject ?? details.projectTitle}</dd>
            </div>
          </dl>
        </section>

        {details.signatories.length > 0 && (
          <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-white/[0.03] p-6 mb-6">
            <h2 className="font-semibold mb-3">Faculty Signatories</h2>
            <ul className="space-y-2 text-sm">
              {details.signatories.map((s) => (
                <li key={s.name}>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-slate-500"> — {s.title}, {s.department}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-white/[0.03] p-6 mb-6">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <BadgeCheck className="h-4 w-4 text-violet-600" />
            Completion Requirements
          </h2>
          <ul className="space-y-2">
            {details.completionRequirements.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${r.met ? "text-emerald-500" : "text-slate-300"}`} />
                <span className={r.met ? "" : "text-slate-500"}>{r.label}</span>
                {r.detail && <span className="text-xs text-slate-400">({r.detail})</span>}
              </li>
            ))}
          </ul>
        </section>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-white/[0.03] p-5">
            <h2 className="font-semibold text-sm mb-3">Skills Earned</h2>
            <div className="flex flex-wrap gap-1.5">
              {details.skillsEarned.map((skill) => (
                <Badge key={skill} variant="outline" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-white/[0.03] p-5">
            <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-500" />
              Badges Earned
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {details.badgesEarned.length > 0 ? (
                details.badgesEarned.map((b) => (
                  <Badge key={b} variant="secondary" className="text-xs">
                    {b.replace(/-/g, " ")}
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-slate-500">No badges recorded</p>
              )}
            </div>
            {details.totalXp != null && (
              <p className="text-xs text-slate-500 mt-3">
                {details.modulesCompleted}/{details.modulesTotal} modules · {details.totalXp} XP
              </p>
            )}
          </section>
        </div>

        <p className="text-center text-xs text-slate-500">
          Verification code: <span className="font-mono">{details.verificationCode}</span>
          <br />
          <Link href="/" className="text-violet-600 hover:underline mt-2 inline-block">
            Return to CourseCollab
          </Link>
        </p>
      </div>
    </div>
  )
}
