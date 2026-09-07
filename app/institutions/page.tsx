"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Building2, Check, GraduationCap, ShieldCheck, Users } from "lucide-react"
import { InstitutionMarketingShell } from "@/components/institution/InstitutionMarketingShell"
import { InstitutionPrivacyTrustStrip } from "@/components/institution/InstitutionPrivacyTrustStrip"
import {
  INSTITUTION_PLANS,
  institutionPlanCtaHref,
  publicInstitutionPriceLabel,
  publicInstructorCapacityLabel,
  publicStudentCapacityLabel,
} from "@/lib/institution-plans"
import {
  landingCardClass,
  landingEyebrowClass,
  landingPrimaryButtonClass,
  landingSecondaryButtonClass,
  landingSectionClass,
  landingSectionDescClass,
  landingSectionHeaderClass,
  landingSectionInnerClass,
  landingSectionTitleClass,
} from "@/components/landing/landing-section-layout"
import { cn } from "@/lib/utils"

const INCLUDED = [
  "Institution-sponsored student and faculty access",
  "Cora, Practice Hub, CodeBench, and automated grading",
  "Centralized provisioning and institution administration",
  "Usage analytics across covered courses",
  "Annual contract, quotes, invoices, and POs",
  "Onboarding and support matched to plan level",
]

export default function InstitutionsPage() {
  const plans = INSTITUTION_PLANS.filter((p) => p.active).sort((a, b) => a.displayOrder - b.displayOrder)

  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "")
    if (!id) return
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  return (
    <InstitutionMarketingShell>
      <section className={landingSectionClass}>
        <div className={`${landingSectionInnerClass} max-w-[1100px]`}>
          <div className={landingSectionHeaderClass}>
            <span className={landingEyebrowClass}>
              <Building2 className="h-3.5 w-3.5" aria-hidden />
              CourseCollab for Institutions
            </span>
            <h1 className={landingSectionTitleClass}>
              Annual licenses that{" "}
              <span className="text-[var(--cc-accent)]">sponsor</span> student and faculty access
            </h1>
            <p className={landingSectionDescClass}>
              Your institution covers Course Collab for the people in scope. Covered students and instructors do not buy an equivalent individual membership. This access is sponsored — it is not free.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/institutions/course_pilot" className={landingPrimaryButtonClass}>
                Request a demo
              </Link>
              <Link href="/institutions/program" className={landingSecondaryButtonClass}>
                Request a quote
              </Link>
            </div>
          </div>

          <InstitutionPrivacyTrustStrip className="mb-8 sm:mb-10" />

          <div id="pricing" className="grid scroll-mt-24 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => {
              const href = institutionPlanCtaHref(plan)
              return (
                <article
                  key={plan.planKey}
                  className={cn(
                    landingCardClass,
                    "flex flex-col p-5 sm:p-6",
                    plan.recommended && "ring-2 ring-[var(--cc-accent)]",
                  )}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <h2 className="text-lg font-extrabold text-[var(--cc-text)]">{plan.displayName}</h2>
                    {plan.recommended ? (
                      <span className="rounded-full bg-[var(--cc-accent-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--cc-accent)]">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="text-2xl font-extrabold tracking-tight text-[var(--cc-text)]">
                    {publicInstitutionPriceLabel(plan)}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--cc-text-secondary)]">{plan.description}</p>
                  <ul className="mt-4 space-y-1.5 text-sm text-[var(--cc-text-muted)]">
                    <li>{publicStudentCapacityLabel(plan)}</li>
                    <li>{publicInstructorCapacityLabel(plan)}</li>
                    <li>12-month annual license</li>
                  </ul>
                  <Link
                    href={href}
                    className={cn(
                      "mt-auto inline-flex min-h-[44px] items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold",
                      plan.recommended
                        ? "bg-[var(--cc-accent-dark)] text-white hover:bg-[var(--cc-accent)]"
                        : "bg-[var(--cc-accent-soft)] text-[var(--cc-accent)] hover:bg-[var(--cc-accent)] hover:text-white",
                    )}
                  >
                    {plan.ctaLabel}
                  </Link>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className={landingSectionClass}>
        <div className={`${landingSectionInnerClass} grid max-w-[1100px] gap-6 lg:grid-cols-[1.1fr_0.9fr]`}>
          <div className={cn(landingCardClass, "p-6 sm:p-8")}>
            <h2 className="text-xl font-extrabold text-[var(--cc-text)]">What institutions receive</h2>
            <ul className="mt-5 space-y-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-[var(--cc-text-secondary)]">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--cc-accent-soft)]">
                    <Check className="h-3.5 w-3.5 text-[var(--cc-accent)]" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4">
            <div className={cn(landingCardClass, "p-6")}>
              <Users className="mb-3 h-5 w-5 text-[var(--cc-accent)]" />
              <h3 className="font-bold text-[var(--cc-text)]">Institution-sponsored access</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--cc-text-secondary)]">
                Covered students and faculty sign in as usual. Course Collab shows that the institution is paying. Individual Trailblazer or Instructor Pro purchases are not required while coverage is active.
              </p>
            </div>
            <div className={cn(landingCardClass, "p-6")}>
              <GraduationCap className="mb-3 h-5 w-5 text-[var(--cc-accent)]" />
              <h3 className="font-bold text-[var(--cc-text)]">Individuals can still buy</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--cc-text-secondary)]">
                Students and instructors outside a license can still purchase Scholar, Explorer, Trailblazer, Instructor Pro, or Instructor Teams on their own.
              </p>
            </div>
            <div className={cn(landingCardClass, "p-6")}>
              <ShieldCheck className="mb-3 h-5 w-5 text-[var(--cc-accent)]" />
              <h3 className="font-bold text-[var(--cc-text)]">Already have a contract?</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--cc-text-secondary)]">
                Institution administrators sign in to manage faculty, students, licenses, and Cora usage.
              </p>
              <Link href="/institution/login" className="mt-3 inline-flex text-sm font-semibold text-[var(--cc-accent)] hover:underline">
                Institution admin sign in
              </Link>
            </div>
          </div>
        </div>
      </section>
    </InstitutionMarketingShell>
  )
}
