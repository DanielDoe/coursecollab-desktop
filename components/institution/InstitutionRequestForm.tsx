"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { InstitutionMarketingShell } from "@/components/institution/InstitutionMarketingShell"
import { InstitutionPrivacyTrustStrip } from "@/components/institution/InstitutionPrivacyTrustStrip"
import { getInstitutionPlan, INSTITUTION_PLANS } from "@/lib/institution-plans"
import {
  landingCardClass,
  landingPrimaryButtonClass,
  landingSectionInnerClass,
} from "@/components/landing/landing-section-layout"
import { cn } from "@/lib/utils"

const FIELD =
  "h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--cc-surface)] px-3.5 text-sm text-[var(--cc-text)] outline-none focus:border-[var(--cc-accent)]"

function InstitutionRequestFormInner({
  defaultKind = "demo",
  title = "Request a demo",
}: {
  defaultKind?: "demo" | "quote" | "pilot"
  title?: string
}) {
  const searchParams = useSearchParams()
  const requestedPlan = getInstitutionPlan(searchParams.get("plan"))
  const defaultPlan = requestedPlan?.planKey ?? "program"
  const [selectedPlanKey, setSelectedPlanKey] = useState(defaultPlan)
  const selectedPlan = getInstitutionPlan(selectedPlanKey)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workspaceHref, setWorkspaceHref] = useState("/institution/signup")

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const form = new FormData(e.currentTarget)
    const desiredPlan = String(form.get("desiredPlan") ?? "")
    const plan = getInstitutionPlan(desiredPlan)
    const res = await fetch("/api/institutions/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestKind: defaultKind === "demo" && plan?.planKey === "course_pilot" ? "pilot" : defaultKind,
        institutionName: form.get("institutionName"),
        domain: form.get("domain"),
        institutionType: form.get("institutionType"),
        contactName: form.get("contactName"),
        contactEmail: form.get("contactEmail"),
        jobTitle: form.get("jobTitle"),
        department: form.get("department"),
        phone: form.get("phone"),
        estimatedStudents: form.get("estimatedStudents"),
        estimatedInstructors: form.get("estimatedInstructors"),
        desiredScope: form.get("desiredScope"),
        desiredPlan: plan?.planKey ?? null,
      }),
    })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || "Could not submit")
      return
    }
    const params = new URLSearchParams()
    const email = String(form.get("contactEmail") ?? "").trim()
    const name = String(form.get("contactName") ?? "").trim()
    const institution = String(form.get("institutionName") ?? "").trim()
    if (email) params.set("email", email)
    if (name) params.set("name", name)
    if (institution) params.set("institution", institution)
    if (plan?.planKey) params.set("plan", plan.planKey)
    params.set("kind", defaultKind === "demo" && plan?.planKey === "course_pilot" ? "pilot" : defaultKind)
    setWorkspaceHref(`/institution/signup?${params.toString()}`)
    setDone(true)
  }

  if (done) {
    return (
      <InstitutionMarketingShell>
        <div className={`${landingSectionInnerClass} max-w-lg text-center`}>
          <h1 className="text-3xl font-extrabold text-[var(--cc-text)]">Request received</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--cc-text-secondary)]">
            A CourseCollab teammate will follow up. Create a workspace now so you can sign in and track this request. A license is not activated until a contract is signed.
          </p>
          <Link href={workspaceHref} className={cn(landingPrimaryButtonClass, "mt-6")}>
            Create institution workspace
          </Link>
          <Link href="/institution/login" className="mt-3 block text-sm font-semibold text-[var(--cc-accent)] hover:underline">
            Already have a workspace? Sign in
          </Link>
        </div>
      </InstitutionMarketingShell>
    )
  }

  return (
    <InstitutionMarketingShell>
      <div className={`${landingSectionInnerClass} max-w-xl`}>
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href={selectedPlan ? `/institutions/${selectedPlan.planKey}` : "/institutions"}
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--cc-accent)] hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            {selectedPlan ? `Back to ${selectedPlan.displayName}` : "Back to packages"}
          </Link>
          <Link href="/institutions#pricing" className="text-sm font-semibold text-[var(--cc-text-secondary)] hover:text-[var(--cc-accent)] hover:underline">
            Compare prices
          </Link>
        </div>
        <InstitutionPrivacyTrustStrip variant="compact" className="mb-4" />
        <form onSubmit={(e) => void submit(e)} className={cn(landingCardClass, "space-y-4 p-6 sm:p-8")}>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--cc-accent)]">Institutions</p>
            <h1 className="mt-1 text-2xl font-extrabold text-[var(--cc-text)]">{title}</h1>
            <p className="mt-2 text-sm text-[var(--cc-text-secondary)]">
              Tell us about your program. We use this to match a Course Pilot, Program, or larger license — not to charge a card.
            </p>
          </div>
          <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
            Institution name
            <input name="institutionName" required className={cn(FIELD, "mt-1.5")} />
          </label>
          <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
            Email domain
            <input name="domain" placeholder="university.edu" className={cn(FIELD, "mt-1.5")} />
          </label>
          <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
            Institution type
            <select name="institutionType" className={cn(FIELD, "mt-1.5")} defaultValue="university">
              {["university", "college", "community_college", "school", "training_provider", "company", "other"].map((t) => (
                <option key={t} value={t}>{t.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
            Contact name
            <input name="contactName" required className={cn(FIELD, "mt-1.5")} />
          </label>
          <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
            Contact email
            <input name="contactEmail" type="email" required className={cn(FIELD, "mt-1.5")} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
              Job title
              <input name="jobTitle" className={cn(FIELD, "mt-1.5")} />
            </label>
            <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
              Department
              <input name="department" className={cn(FIELD, "mt-1.5")} />
            </label>
          </div>
          <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
            Phone
            <input name="phone" className={cn(FIELD, "mt-1.5")} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
              Estimated active students
              <input name="estimatedStudents" type="number" min={0} className={cn(FIELD, "mt-1.5")} />
            </label>
            <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
              Estimated instructors
              <input name="estimatedInstructors" type="number" min={0} className={cn(FIELD, "mt-1.5")} />
            </label>
          </div>
          <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
            Package
            <select
              name="desiredPlan"
              className={cn(FIELD, "mt-1.5")}
              value={selectedPlanKey}
              onChange={(e) => setSelectedPlanKey(e.target.value)}
            >
              {INSTITUTION_PLANS.filter((p) => p.active).sort((a, b) => a.displayOrder - b.displayOrder).map((plan) => (
                <option key={plan.planKey} value={plan.planKey}>{plan.displayName}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-[var(--cc-text-muted)]">
            Courses or programs in scope
            <textarea name="desiredScope" className="mt-1.5 min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--cc-surface)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--cc-accent)]" />
          </label>
          {error ? <p className="text-sm text-[var(--cc-danger)]">{error}</p> : null}
          <button type="submit" disabled={busy} className={cn(landingPrimaryButtonClass, "w-full")}>
            {busy ? "Submitting…" : "Submit request"}
          </button>
        </form>
      </div>
    </InstitutionMarketingShell>
  )
}

export default function InstitutionRequestPage(props: {
  defaultKind?: "demo" | "quote" | "pilot"
  title?: string
}) {
  return (
    <Suspense fallback={<InstitutionMarketingShell><div className={landingSectionInnerClass} /></InstitutionMarketingShell>}>
      <InstitutionRequestFormInner {...props} />
    </Suspense>
  )
}
