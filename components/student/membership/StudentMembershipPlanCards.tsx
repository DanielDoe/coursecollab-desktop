"use client"

import { useState } from "react"
import { Award, Check, Crown, Flame, Rocket, Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import type { BillingCadence, MembershipTier } from "@/lib/membership-constants"
import { MEMBERSHIP_PLANS } from "@/lib/membership-constants"
import { formatSemesterPrice, listStudentPlanCards } from "@/lib/student-membership-catalog"
import { StudentSemesterDiscountPrice } from "@/components/student/membership/StudentSemesterDiscountPrice"
import { resolveStudentBillingCadence } from "@/lib/student-billing-eligibility"

const ICONS = { Scholar: Award, Explorer: Star, Trailblazer: Crown }

type Props = {
  currentTier: string
  upgrading: string | null
  semesterOnlyBilling: boolean
  selectedCadence: Record<string, BillingCadence>
  setSelectedCadence: React.Dispatch<React.SetStateAction<Record<string, BillingCadence>>>
  onUpgrade: (tier: MembershipTier, cadence: BillingCadence) => void
}

export function StudentMembershipPlanCards({
  currentTier,
  upgrading,
  semesterOnlyBilling,
  selectedCadence,
  onUpgrade,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const cards = listStudentPlanCards()

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-5 items-start pt-3">
      {cards.map((tier) => {
        const Icon = ICONS[tier.id]
        const isCurrent = tier.id === (currentTier || "Scholar")
        const showAll = Boolean(expanded[tier.id])
        return (
          <Card
            key={tier.id}
            className={`relative border shadow-sm overflow-visible rounded-xl bg-card ${
              isCurrent ? "ring-2 ring-[var(--cc-accent)]" : ""
            } ${tier.popular ? "md:scale-[1.02]" : ""}`}
          >
            {tier.popular && (
              <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2">
                <Badge className="bg-amber-500 text-white px-2 py-0.5 text-[10px] sm:text-xs font-semibold shadow-sm">
                  <Flame className="mr-0.5 h-2.5 w-2.5" />
                  Most Popular
                </Badge>
              </div>
            )}
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${tier.colorClass}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base sm:text-lg font-bold">{tier.name}</CardTitle>
                    <CardDescription className="text-[11px] sm:text-xs">{tier.subtitle}</CardDescription>
                  </div>
                </div>
                {isCurrent && (
                  <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                    Current
                  </Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground">{tier.description}</p>

              <div>
                {tier.saveCents > 0 ? (
                  <StudentSemesterDiscountPrice tier={tier.id} />
                ) : (
                  <div className="text-2xl font-bold text-foreground">
                    {formatSemesterPrice(tier.semesterPriceInCents)}
                  </div>
                )}
                {tier.semesterPriceInCents > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    per semester · One-time payment · limited student offer
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Included with course enrollment</p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cora</p>
                <p className="text-sm font-semibold text-foreground">
                  {tier.monthlyCoraCredits.toLocaleString()} credits / month
                </p>
                {tier.id === "Trailblazer" && (
                  <p className="text-[11px] text-muted-foreground">Cora Lite remains available after allowance</p>
                )}
                {tier.id === "Explorer" && (
                  <p className="text-[11px] text-muted-foreground">Add credit packs anytime if you run out</p>
                )}
              </div>

              <ul className="space-y-1.5">
                {tier.highlights.map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs text-slate-600 dark:text-slate-300 leading-snug">{feature}</span>
                  </li>
                ))}
              </ul>

              {showAll && (
                <ul className="space-y-1.5 border-t border-border pt-2">
                  {tier.secondaryBenefits.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="text-xs text-slate-600 dark:text-slate-300 leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                className="text-[11px] font-medium text-[var(--cc-accent-dark)] dark:text-[var(--cc-accent)]"
                onClick={() => setExpanded((prev) => ({ ...prev, [tier.id]: !showAll }))}
              >
                {showAll ? "Hide extra features" : "See all features"}
              </button>

              {isCurrent ? (
                <Button disabled className="w-full min-h-[36px] text-xs">
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Current Plan
                </Button>
              ) : (
                <Button
                  onClick={() =>
                    onUpgrade(
                      tier.id,
                      resolveStudentBillingCadence(tier.id, selectedCadence[tier.id], semesterOnlyBilling),
                    )
                  }
                  disabled={upgrading === tier.id}
                  className={`w-full min-h-[36px] text-xs font-semibold text-white ${tier.colorClass} hover:opacity-90`}
                >
                  {upgrading === tier.id ? (
                    "Starting checkout…"
                  ) : (
                    <>
                      <Rocket className="mr-1.5 h-4 w-4" />
                      {tier.ctaLabel}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function studentPlanFromConstants(tier: MembershipTier) {
  return MEMBERSHIP_PLANS.find((p) => p.id === tier)
}
