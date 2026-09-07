"use client"

import Link from "next/link"
import { motion } from "@/components/landing/framer"
import { useLandingMotionEnabled } from "@/components/landing/LandingMotionProvider"
import { CalendarCheck, Check, Sparkles, Building2 } from "lucide-react"
import {
  INSTITUTION_PLANS,
  institutionPlanCtaHref,
  publicInstitutionPriceLabel,
  publicInstructorCapacityLabel,
  publicStudentCapacityLabel,
} from "@/lib/institution-plans"
import {
  landingSectionClass,
  landingSectionInnerClass,
  landingSectionHeaderClass,
  landingEyebrowClass,
  landingSectionTitleClass,
  landingSectionDescClass,
} from "@/components/landing/landing-section-layout"
import {
  fadeUp,
  LANDING_VIEWPORT,
  sectionHeader,
  staggerContainer,
} from "@/components/landing/landing-motion"

const INCLUDED = [
  "Institution-sponsored student & faculty access",
  "Cora, Practice Hub, CodeBench & auto-grading",
  "Centralized institution administration",
  "Institutional analytics & reporting",
  "Quotes, invoices, and annual contracts",
  "Onboarding and dedicated support",
]

export function PricingSection() {
  const effectsEnabled = useLandingMotionEnabled()
  const inView = effectsEnabled
    ? ({ initial: "hidden" as const, whileInView: "show" as const, viewport: LANDING_VIEWPORT })
    : ({ initial: false as const })
  const plans = INSTITUTION_PLANS.filter((p) => p.active).sort((a, b) => a.displayOrder - b.displayOrder)

  return (
    <section id="pricing" className={landingSectionClass}>
      <div className={`${landingSectionInnerClass} max-w-[1100px] max-md:py-12`}>
        <motion.div className={landingSectionHeaderClass} variants={sectionHeader} {...inView}>
          <span className={landingEyebrowClass}>Pricing</span>
          <h2 className={landingSectionTitleClass}>
            Annual licenses for{" "}
            <span className="text-[var(--cc-accent)]">institutions</span>
          </h2>
          <p className={landingSectionDescClass}>
            Cover students and instructors under one institutional license. Individual memberships stay available when the institution is not paying.
          </p>
        </motion.div>

        <motion.div
          className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          {...inView}
        >
          {plans.map((plan) => (
            <motion.div
              key={plan.planKey}
              variants={fadeUp}
              className="flex flex-col rounded-[1.25rem] border border-[var(--border)] bg-[var(--cc-surface)] p-4 shadow-[0_16px_40px_-28px_color-mix(in_srgb,var(--cc-accent)_40%,transparent)] sm:p-5"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-[var(--cc-text)]">{plan.displayName}</h3>
                {plan.recommended ? (
                  <span className="rounded-full bg-[var(--cc-accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-accent)]">
                    Recommended
                  </span>
                ) : null}
              </div>
              <p className="text-lg font-extrabold text-[var(--cc-text)]">{publicInstitutionPriceLabel(plan)}</p>
              <p className="mt-1 text-xs text-[var(--cc-text-muted)]">{publicStudentCapacityLabel(plan)}</p>
              <p className="text-xs text-[var(--cc-text-muted)]">{publicInstructorCapacityLabel(plan)}</p>
              <Link
                href={institutionPlanCtaHref(plan)}
                className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-full bg-[var(--cc-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--cc-accent-hover)]"
              >
                {plan.ctaLabel}
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={fadeUp}
          {...inView}
          className="overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--cc-surface)] sm:rounded-[1.75rem]"
        >
          <div className="grid md:grid-cols-[1.15fr_0.85fr]">
            <div className="p-5 sm:p-8">
              <div className="mb-5 flex items-center gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-bold text-[var(--cc-text)]">Institution-sponsored access</p>
                  <p className="text-xs text-[var(--cc-text-muted)]">
                    Your institution covers Course Collab — it is not free.
                  </p>
                </div>
              </div>
              <ul className="grid gap-2.5">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-[var(--cc-text-secondary)]">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--cc-accent-soft)]">
                      <Check className="h-3.5 w-3.5 text-[var(--cc-accent)]" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-center gap-3 border-t border-[var(--border)] bg-[var(--cc-accent-soft)] p-5 sm:p-8 md:border-l md:border-t-0">
              <div className="flex items-center gap-2 text-[var(--cc-accent)]">
                <Sparkles className="h-5 w-5 text-[var(--cc-warning)]" />
                <p className="text-sm font-semibold">See packages or talk with Course Collab</p>
              </div>
              <Link
                href="/institutions"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[var(--cc-accent)] px-6 text-sm font-semibold text-white hover:bg-[var(--cc-accent-hover)]"
              >
                View institution packages
              </Link>
              <Link
                href="/institutions/request-quote"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border-2 border-[var(--cc-accent)]/30 bg-[var(--cc-surface)] px-6 text-sm font-semibold text-[var(--cc-accent)]"
              >
                Request a quote
              </Link>
              <Link
                href="/institutions/request-demo"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 text-sm font-semibold text-[var(--cc-accent)] underline-offset-2 hover:underline"
              >
                <CalendarCheck className="h-4 w-4" />
                Request a demo
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
