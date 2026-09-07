"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bot,
  Check,
  Crown,
  Shield,
  Sparkles,
  CalendarDays,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { CoraCreditPacksPanel } from "@/components/cora/CoraCreditPacksPanel"
import { CoraUsagePanel } from "@/components/cora/CoraUsagePanel"
import { InstitutionalAccessBanner } from "@/components/membership/InstitutionalAccessBanner"
import { FACULTY_MEMBERSHIP_HREF } from "@/lib/faculty-portal-nav-config"
import { readFacultySession } from "@/lib/faculty-auth-flow"
import {
  facultyModuleIconBadgeClass,
  facultyModuleTabActiveClass,
} from "@/lib/faculty-module-themes"
import {
  PORTAL_CTA,
  PORTAL_OUTLINE_BTN,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
  PORTAL_CARD,
} from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import type {
  InstructorBillingCadence,
  InstructorMembershipTier,
} from "@/lib/instructor-membership-constants"

type PlanResponse = {
  id: InstructorMembershipTier
  displayName: string
  tagline: string
  description: string
  featureBullets: string[]
  semesterPriceInCents: number
  annualPriceInCents: number
  annualSavingsCents: number
  badge: string
  recommended?: boolean
}

function formatPrice(cents: number) {
  if (cents === 0) return "$0"
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

function formatExpiry(iso: string | null) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return null
  }
}

export function FacultyMembershipPlansHub() {
  const router = useRouter()
  const [cadence, setCadence] = useState<InstructorBillingCadence>("semester")
  const [plans, setPlans] = useState<PlanResponse[]>([])
  const [currentTier, setCurrentTier] = useState<InstructorMembershipTier>("Free")
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [billingCadence, setBillingCadence] = useState<InstructorBillingCadence | null>(null)
  const [loading, setLoading] = useState(true)
  const [instructorId, setInstructorId] = useState<string | null>(null)
  const [institutionalAccess, setInstitutionalAccess] = useState<{
    providedBy?: string | null
    expiresAt?: string | null
    personalTier?: string | null
    sponsoredFeatureTier?: string | null
  } | null>(null)

  useEffect(() => {
    const session = readFacultySession()
    const id =
      session?.id != null
        ? String(session.id)
        : localStorage.getItem("instructorId") || sessionStorage.getItem("instructorId")
    setInstructorId(id)

    if (!id) {
      router.push("/faculty/login")
      return
    }

    async function load() {
      try {
        const [plansRes, membershipRes] = await Promise.all([
          instructorApiFetch("/api/instructor/membership/plans"),
          instructorApiFetch(`/api/instructor/membership?instructorId=${id}`),
        ])
        if (plansRes.ok) {
          const data = await plansRes.json()
          setPlans(data.plans ?? [])
        }
        if (membershipRes.ok) {
          const data = await membershipRes.json()
          if (data.membership?.tier) setCurrentTier(data.membership.tier)
          setExpiresAt(data.membership?.expiresAt ?? null)
          setBillingCadence(data.membership?.billingCadence ?? null)
          if (data.institutionalAccess?.active) {
            setInstitutionalAccess(data.institutionalAccess)
            if (data.membership?.effectiveFeatureTier) {
              setCurrentTier(data.membership.effectiveFeatureTier)
            }
          }
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [router])

  function goToCheckout(tier: InstructorMembershipTier) {
    if (tier === "Free") return
    router.push(`${FACULTY_MEMBERSHIP_HREF}/checkout?plan=${tier}&cadence=${cadence}`)
  }

  if (loading) {
    return <InstructorPolicyLoadingState moduleId="membership" label="Loading plans…" />
  }

  const expiryLabel = formatExpiry(expiresAt)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 sm:space-y-8">
      {institutionalAccess ? (
        <InstitutionalAccessBanner
          title={`Your access is currently sponsored by ${institutionalAccess.providedBy ?? "your institution"}.`}
          providedBy={institutionalAccess.providedBy}
          expiresAt={institutionalAccess.expiresAt}
          personalTier={institutionalAccess.personalTier ?? currentTier}
          sponsoredFeatureTier={institutionalAccess.sponsoredFeatureTier}
        />
      ) : null}
      <InstructorPolicySurfaceCard variant="section" className="space-y-0">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <div className={facultyModuleIconBadgeClass("membership")}>
              <Bot className="h-6 w-6" />
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className={cn("text-2xl font-bold tracking-tight sm:text-3xl", PORTAL_TEXT)}>
                  Instructor Plans
                </h1>
                {currentTier !== "Free" && (
                  <Badge
                    variant="outline"
                    className="border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]"
                  >
                    {currentTier}
                  </Badge>
                )}
              </div>
              <p className={cn("max-w-2xl text-sm sm:text-base", PORTAL_TEXT_MUTED)}>
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--cc-accent-dark)]">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  Cora Teaching Copilot + Complete Course Authoring Suite
                </span>
                {" — "}
                Semester licenses for Fall, Spring, and Summer. No monthly subscription to cancel over breaks.
              </p>
              {currentTier !== "Free" && expiryLabel && (
                <p className={cn("flex items-center gap-1.5 text-xs sm:text-sm", PORTAL_TEXT_MUTED)}>
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  License active until {expiryLabel}
                  {billingCadence ? ` · ${billingCadence === "annual" ? "Annual" : "Semester"} billing` : ""}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 rounded-xl border border-[var(--border)] bg-[var(--sidebar-accent)]/20 p-1">
            {(["semester", "annual"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCadence(value)}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm",
                  cadence === value
                    ? facultyModuleTabActiveClass("membership")
                    : cn(PORTAL_TEXT_MUTED, "hover:bg-[var(--sidebar-accent)]/40 hover:text-[var(--cc-text)]"),
                )}
              >
                {value === "semester" ? "Per semester" : "Annual · save more"}
              </button>
            ))}
          </div>
        </div>
      </InstructorPolicySurfaceCard>

      <div className="grid gap-4 md:grid-cols-3 md:gap-5">
        {plans.map((plan) => {
          const price =
            cadence === "semester" ? plan.semesterPriceInCents : plan.annualPriceInCents
          const priceLabel = cadence === "semester" ? "/ semester" : "/ year"
          const isCurrent = plan.id === currentTier
          const isPaid = plan.id !== "Free"
          const canUpgrade =
            isPaid &&
            !isCurrent &&
            (plan.id === "Teams" || currentTier === "Free")

          return (
            <div
              key={plan.id}
              className={cn(
                PORTAL_CARD,
                "relative flex flex-col p-5 sm:p-6 transition-shadow",
                plan.recommended && "ring-2 ring-[var(--cc-accent)]/40 shadow-md",
              )}
            >
              {plan.recommended && (
                <Badge
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 border-0 px-3 shadow-sm"
                  style={{ background: "var(--cc-accent)", color: "white" }}
                >
                  Recommended
                </Badge>
              )}

              <div className="mb-4 space-y-2">
                <span className="text-2xl" aria-hidden>
                  {plan.badge}
                </span>
                <h2 className={cn("text-lg font-semibold", PORTAL_TEXT)}>{plan.displayName}</h2>
                <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{plan.tagline}</p>
              </div>

              <div className="mb-5 rounded-xl bg-[var(--sidebar-accent)]/15 px-4 py-3">
                <div className="flex items-baseline gap-1">
                  <span className={cn("text-3xl font-bold tabular-nums", PORTAL_TEXT)}>
                    {formatPrice(price)}
                  </span>
                  <span className={cn("text-sm", PORTAL_TEXT_MUTED)}>{priceLabel}</span>
                </div>
                {isPaid && (
                  <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>One-time · no auto-renew</p>
                )}
                {cadence === "annual" && plan.annualSavingsCents > 0 && isPaid && (
                  <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Save {formatPrice(plan.annualSavingsCents)} vs three semesters
                  </p>
                )}
              </div>

              <ul className="mb-6 flex-1 space-y-2.5">
                {plan.featureBullets.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
                    <span className={PORTAL_TEXT_MUTED}>{feature}</span>
                  </li>
                ))}
              </ul>

              {isPaid ? (
                <Button
                  className={cn(
                    "h-11 w-full rounded-xl font-semibold",
                    canUpgrade || plan.recommended ? PORTAL_CTA : PORTAL_OUTLINE_BTN,
                  )}
                  disabled={isCurrent || (plan.id === "Pro" && currentTier === "Teams")}
                  onClick={() => goToCheckout(plan.id)}
                >
                  {isCurrent ? (
                    "Current plan"
                  ) : plan.id === "Pro" && currentTier === "Teams" ? (
                    "Included in Teams"
                  ) : plan.id === "Teams" ? (
                    <>
                      <Crown className="mr-2 h-4 w-4" />
                      Upgrade to Teams
                    </>
                  ) : (
                    "Upgrade to Pro"
                  )}
                </Button>
              ) : (
                <Button variant="outline" className="h-11 w-full rounded-xl" disabled={isCurrent}>
                  {isCurrent ? "Current plan" : "Included"}
                </Button>
              )}
            </div>
          )
        })}
      </div>

      <div id="cora-usage" className="scroll-mt-24 mt-2">
        <CoraUsagePanel
          userId={instructorId}
          role="instructor"
          historyHref="/instructor/dashboard-v2/settings?section=cora-usage"
        />
      </div>

      <CoraCreditPacksPanel
        audience="instructor"
        buyerId={instructorId}
        className="mt-2"
        title="Faculty Cora Credit Packs"
        subtitle="Semester top-ups for assessment generation and heavy Copilot workflows. Purchased credits last 12 months."
      />

      <InstructorPolicySurfaceCard
        title="Academic billing"
        description="Licenses are tied to the academic calendar — not consumer-style monthly SaaS."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              title: "Semester",
              body: "Pay once per Fall, Spring, or Summer term. Expires at term end.",
            },
            {
              title: "Annual",
              body: "Covers all three terms for the year — best value for active instructors.",
            },
            {
              title: "Secure checkout",
              body: "Payments processed by Stripe. Upgrades activate immediately after checkout.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-[var(--border)] bg-[var(--sidebar-accent)]/10 px-4 py-3"
            >
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{item.title}</p>
              <p className={cn("mt-1 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{item.body}</p>
            </div>
          ))}
        </div>
        <p className={cn("mt-4 flex items-center gap-2 text-xs", PORTAL_TEXT_MUTED)}>
          <Shield className="h-3.5 w-3.5 shrink-0" />
          Need a department or multi-instructor workspace? Instructor Teams covers collaborative teaching. For campus-wide licensing, request an institutional quote.
        </p>
      </InstructorPolicySurfaceCard>
    </div>
  )
}
