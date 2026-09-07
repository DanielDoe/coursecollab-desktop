"use client"

import Link from "next/link"
import { Check, ChevronLeft } from "lucide-react"
import { InstitutionMarketingShell } from "@/components/institution/InstitutionMarketingShell"
import {
  institutionPlanRequestHref,
  publicInstitutionPriceLabel,
  publicInstructorCapacityLabel,
  publicStudentCapacityLabel,
  type InstitutionPlan,
} from "@/lib/institution-plans"
import {
  landingCardClass,
  landingEyebrowClass,
  landingPrimaryButtonClass,
  landingSecondaryButtonClass,
  landingSectionClass,
  landingSectionInnerClass,
} from "@/components/landing/landing-section-layout"
import { cn } from "@/lib/utils"

export function InstitutionPlanPerksView({ plan }: { plan: InstitutionPlan }) {
  const requestHref = institutionPlanRequestHref(plan)
  return (
    <InstitutionMarketingShell>
      <section className={landingSectionClass}>
        <div className={`${landingSectionInnerClass} max-w-[880px]`}>
          <Link
            href="/institutions"
            className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-[var(--cc-accent)] hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            All institution packages
          </Link>

          <div className={cn(landingCardClass, "p-6 sm:p-8")}>
            <span className={landingEyebrowClass}>{plan.recommended ? plan.recommendedBadge : "Institutional license"}</span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--cc-text)] sm:text-4xl">
              {plan.displayName}
            </h1>
            <p className="mt-2 text-2xl font-extrabold text-[var(--cc-accent)]">{publicInstitutionPriceLabel(plan)}</p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--cc-text-secondary)] sm:text-base">{plan.description}</p>
            <p className="mt-4 text-sm text-[var(--cc-text-muted)]">
              {publicStudentCapacityLabel(plan)} · {publicInstructorCapacityLabel(plan)}
            </p>

            <h2 className="mt-8 text-lg font-extrabold text-[var(--cc-text)]">What this license includes</h2>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {plan.includedPerks.map((perk) => (
                <li key={perk} className="flex items-start gap-2.5 text-sm text-[var(--cc-text-secondary)]">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--cc-accent-soft)]">
                    <Check className="h-3.5 w-3.5 text-[var(--cc-accent)]" strokeWidth={3} />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>

            <p className="mt-6 text-xs leading-relaxed text-[var(--cc-text-muted)]">
              Covered students and faculty receive Course Collab through the institution. This access is sponsored — it is not free. Submitting the next form does not charge a card or activate a license.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={requestHref} className={landingPrimaryButtonClass}>
                Continue to request
              </Link>
              <Link href="/institutions#pricing" className={landingSecondaryButtonClass}>
                Compare prices
              </Link>
            </div>
          </div>
        </div>
      </section>
    </InstitutionMarketingShell>
  )
}
