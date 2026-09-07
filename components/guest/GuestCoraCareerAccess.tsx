"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, ChevronRight, Loader2, Sparkles, Shield } from "lucide-react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { CoraLogo } from "@/components/cora/CoraLogo"
import { EMBED_INNER_PANEL, EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { getStudentData } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { getGuestPortalTheme } from "@/lib/guest-module-themes"
import { cn } from "@/lib/utils"
import { formatGuestAccessPrice, guestPlanHasCareerUnlock } from "@/lib/guest/membership-config"
import { CAREER_MEMBER_FREE_PLAN } from "@/lib/guest/display"
import type { GuestPlan } from "@/lib/guest/types"

const theme = getGuestPortalTheme()

type Plan = {
  id: string
  name: string
  priceLabel: string
  priceUsd: number
  coraCreditsIncluded: number
  features: string[]
  popular?: boolean
}

type CompareCell = boolean | string

type CompareRow = {
  id: string
  label: string
  hint?: string
  guest_free: CompareCell
  cora_career_essentials: CompareCell
  cora_career: CompareCell
}

const PLAN_ORDER = ["guest_free", "cora_career_essentials", "cora_career"] as const

const PLAN_TAGLINES: Record<string, string> = {
  guest_free: "Recommendations & previews",
  cora_career_essentials: "Core career AI unlock",
  cora_career: "Full agent & interview prep",
}

const COMPARE_ROWS: CompareRow[] = [
  {
    id: "recommendations",
    label: "Faculty recommendation requests",
    hint: "Always free — no upgrade required",
    guest_free: true,
    cora_career_essentials: true,
    cora_career: true,
  },
  {
    id: "tracker",
    label: "Application tracker & messaging",
    guest_free: true,
    cora_career_essentials: true,
    cora_career: true,
  },
  {
    id: "master-resume",
    label: "Master résumé on file",
    guest_free: true,
    cora_career_essentials: true,
    cora_career: true,
  },
  {
    id: "preview-scans",
    label: "Resume Match scans",
    hint: `${CAREER_MEMBER_FREE_PLAN}: 2 lifetime complimentary scans. Paid tiers: no scan cap — each new analysis uses Cora Credits.`,
    guest_free: "2 complimentary",
    cora_career_essentials: "Uses credits",
    cora_career: "Uses credits",
  },
  {
    id: "full-match",
    label: "Full match evidence & scoring",
    guest_free: false,
    cora_career_essentials: true,
    cora_career: true,
  },
  {
    id: "cover-letter",
    label: "Cover letter assistance",
    guest_free: false,
    cora_career_essentials: true,
    cora_career: true,
  },
  {
    id: "cora-chat",
    label: "Cora Career chat & agent",
    guest_free: "Limited",
    cora_career_essentials: true,
    cora_career: true,
  },
  {
    id: "optimize",
    label: "Résumé optimize & tailoring",
    guest_free: false,
    cora_career_essentials: false,
    cora_career: true,
  },
  {
    id: "interview",
    label: "Interview prep & practice",
    guest_free: false,
    cora_career_essentials: false,
    cora_career: true,
  },
  {
    id: "grad",
    label: "Grad school & scholarship support",
    guest_free: false,
    cora_career_essentials: false,
    cora_career: true,
  },
  {
    id: "credits",
    label: "Cora Credits included",
    hint: "Credits power AI — purchased top-ups never expire",
    guest_free: "50 promo",
    cora_career_essentials: "2,000",
    cora_career: "5,000",
  },
  {
    id: "lifetime",
    label: "One-time purchase — no subscription",
    guest_free: true,
    cora_career_essentials: true,
    cora_career: true,
  },
]

function CompareCellValue({ value }: { value: CompareCell }) {
  if (value === true) {
    return (
      <span
        className={cn(
          "mx-auto flex size-7 items-center justify-center rounded-full",
          theme.page.iconBg,
        )}
      >
        <Check className={cn("size-4", theme.page.iconText)} strokeWidth={2.5} aria-hidden />
      </span>
    )
  }
  if (value === false) {
    return <span className="text-sm text-[var(--cc-text-muted)]">—</span>
  }
  return <span className="text-sm font-semibold text-[var(--cc-text)]">{value}</span>
}

function formatPlanPrice(plan: Plan): string {
  if (plan.priceUsd === 0) return "$0"
  return `$${plan.priceUsd.toFixed(2)}`
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl border shadow-sm",
        "border-[var(--border)] bg-white dark:bg-[var(--card)] text-[var(--cc-text)]",
      )}
    >
      <div className="relative">{children}</div>
    </div>
  )
}

export function GuestCoraCareerAccess() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [currentPlan, setCurrentPlan] = useState<GuestPlan>("guest_free")
  const [selectedPlanId, setSelectedPlanId] = useState<string>("cora_career")
  const [credits, setCredits] = useState<number | null>(null)
  const [checkoutEnabled, setCheckoutEnabled] = useState(true)
  const [busyPlan, setBusyPlan] = useState<string | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const d = getStudentData()
    if (!d?.databaseId) return
    const [plansRes, entRes] = await Promise.all([
      fetch("/api/guest/cora-career/plans"),
      fetch(`/api/guest/entitlements?studentDatabaseId=${encodeURIComponent(d.databaseId)}`),
    ])
    const plansJson = await plansRes.json()
    const entJson = await entRes.json()
    if (plansRes.ok) {
      const loaded = (plansJson.plans ?? []) as Plan[]
      setPlans(loaded)
      setCheckoutEnabled(Boolean(plansJson.checkoutEnabled))
      const popular = loaded.find((p) => p.popular)
      if (popular) setSelectedPlanId(popular.id)
    }
    if (entRes.ok) {
      const p = String(entJson.plan ?? "guest_free") as GuestPlan
      setCurrentPlan(p)
      setCredits(typeof entJson.coraCredits?.available === "number" ? entJson.coraCredits.available : null)
      if (guestPlanHasCareerUnlock(p)) setSelectedPlanId(p)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const planById = useMemo(() => {
    const map = new Map<string, Plan>()
    for (const p of plans) map.set(p.id, p)
    return map
  }, [plans])

  const orderedPlans = useMemo(
    () => PLAN_ORDER.map((id) => planById.get(id)).filter(Boolean) as Plan[],
    [planById],
  )

  async function checkout(planId: string) {
    const d = getStudentData()
    if (!d?.databaseId) return
    setBusyPlan(planId)
    setError("")
    try {
      const res = await fetch("/api/guest/cora-career/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentDatabaseId: d.databaseId, plan: planId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Checkout failed")
      if (json.url) window.location.href = json.url
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed")
    } finally {
      setBusyPlan(null)
    }
  }

  const hasCareerUnlock = guestPlanHasCareerUnlock(currentPlan)
  const selectedPlan = planById.get(selectedPlanId)
  const isCurrentSelection = selectedPlanId === currentPlan
  const canCheckout =
    checkoutEnabled &&
    selectedPlanId !== "guest_free" &&
    !isCurrentSelection &&
    (currentPlan === "guest_free" ||
      (currentPlan === "cora_career_essentials" && selectedPlanId === "cora_career"))

  function handleContinue() {
    if (selectedPlanId === "guest_free") {
      window.location.href = "/guest/cora-career"
      return
    }
    if (canCheckout) void checkout(selectedPlanId)
  }

  if (hasCareerUnlock) {
    const active = planById.get(currentPlan)
    return (
      <Shell>
        <div className="px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
          <div className="mx-auto max-w-2xl text-center">
            <div
              className={cn(
                "mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl ring-1 ring-[var(--border)]",
                theme.page.iconBg,
              )}
            >
              <Sparkles className={cn("size-7", theme.page.iconText)} aria-hidden />
            </div>
            <p className={cn("text-xs font-semibold uppercase tracking-[0.2em]", theme.page.iconText)}>
              Active membership
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--cc-text)] sm:text-3xl">
              {active?.name ?? "Cora Career"} unlocked
            </h1>
            <p className="mt-2 text-sm text-[var(--cc-text-muted)] sm:text-base">
              Lifetime access — features never expire. AI usage draws from Cora Credits.
            </p>
            {credits != null ? (
              <p className="mt-4 text-lg text-[var(--cc-text)]">
                <span className="font-bold">{credits.toLocaleString()}</span>
                <span className="text-[var(--cc-text-muted)]"> Cora Credits available</span>
              </p>
            ) : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button className={cn("h-12 rounded-full px-8 text-base font-semibold", theme.page.cta)} asChild>
                <Link href="/guest/cora-career">Open workspace</Link>
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-full border-[var(--border)] px-8 text-base text-[var(--cc-text)] hover:bg-[var(--muted)]"
                asChild
              >
                <Link href="/guest/cora-credits">Add credits</Link>
              </Button>
            </div>
            {currentPlan === "cora_career_essentials" ? (
              <div className={cn(EMBED_INNER_PANEL, "mt-8 p-5 text-left sm:text-center")}>
                <p className="text-sm text-[var(--cc-text-muted)]">
                  Upgrade to Lifetime for interview prep, résumé optimize, and{" "}
                  <span className="font-semibold text-[var(--cc-text)]">3,000 more</span> included credits.
                </p>
                <Button
                  className={cn("mt-4 h-11 rounded-full px-6 font-semibold", theme.page.cta)}
                  disabled={busyPlan === "cora_career" || !checkoutEnabled}
                  onClick={() => void checkout("cora_career")}
                >
                  {busyPlan === "cora_career" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Upgrade to Lifetime"
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 flex items-center justify-center gap-2.5">
            <CoraLogo size="md" />
            <span className="text-base font-medium text-[var(--cc-text-muted)] sm:text-lg">Career</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--cc-text)] sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
            Choose your lifetime membership
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-[var(--cc-text-muted)] sm:text-lg">
            Recommendations stay free forever. Pick a one-time Cora Career unlock — credits power AI;
            purchased top-ups never expire.
          </p>
          <div className={cn("mx-auto mt-4 h-1 w-12 rounded-full", theme.page.progress)} />
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--cc-text-muted)]">
            <Shield className="size-4 shrink-0" aria-hidden />
            One-time payment · No subscription · Secure Stripe checkout
          </p>
        </div>

        {error ? (
          <p className="mx-auto mt-4 max-w-lg text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        {/* Loading skeleton — avoids rendering feature rows with no plan headers */}
        {orderedPlans.length === 0 ? (
          <div className={cn(EMBED_MATERIAL_PANEL, "mx-auto mt-10 max-w-6xl p-8")}>
            <div className="flex items-center justify-center gap-3 py-16 text-[var(--cc-text-muted)]">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              <span className="text-sm">Loading membership plans…</span>
            </div>
          </div>
        ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={cn(EMBED_MATERIAL_PANEL, "mx-auto mt-10 max-w-6xl overflow-x-auto p-0")}
        >
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[minmax(180px,1.2fr)_repeat(3,minmax(140px,1fr))] gap-0">
              <div aria-hidden />
              {orderedPlans.map((plan) => {
                const selected = selectedPlanId === plan.id
                const isCurrent = currentPlan === plan.id
                const isPopular = plan.popular
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative px-3 pb-4 pt-2 text-center transition-colors sm:px-4",
                      selected && cn("rounded-t-2xl", theme.page.softBg),
                    )}
                  >
                    {isPopular ? (
                      <span
                        className={cn(
                          "mb-2 inline-block rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          theme.page.badge,
                          theme.page.border,
                        )}
                      >
                        Best value
                      </span>
                    ) : (
                      <span className="mb-2 inline-block h-[22px]" aria-hidden />
                    )}
                    <h2 className="text-base font-bold text-[var(--cc-text)] sm:text-lg">
                      {plan.name.replace("Cora Career ", "")}
                    </h2>
                    <p className="mt-1 min-h-[2.5rem] text-[11px] leading-snug text-[var(--cc-text-muted)] sm:text-xs">
                      {PLAN_TAGLINES[plan.id]}
                    </p>
                    <button
                      type="button"
                      disabled={isCurrent && plan.id !== "guest_free"}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={cn(
                        "mt-4 w-full rounded-lg px-3 py-2.5 text-sm font-semibold transition-all",
                        selected
                          ? theme.page.cta
                          : "border border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)] hover:bg-[var(--muted)]",
                        isCurrent && plan.id !== "guest_free" && "cursor-default opacity-80",
                      )}
                    >
                      {isCurrent ? "Current" : selected ? "Selected" : "Select"}
                    </button>
                    <p className="mt-4 text-2xl font-bold tracking-tight text-[var(--cc-text)]">
                      {formatPlanPrice(plan)}
                    </p>
                    <p className="text-[11px] text-[var(--cc-text-muted)]">
                      {plan.priceUsd === 0 ? "Forever free tier" : "One-time · Lifetime"}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="border-t border-[var(--border)]">
              {COMPARE_ROWS.map((row, rowIndex) => (
                <div
                  key={row.id}
                  className={cn(
                    "grid grid-cols-[minmax(180px,1.2fr)_repeat(3,minmax(140px,1fr))] gap-0 border-b border-[var(--border)]",
                    rowIndex % 2 === 0 && "bg-[var(--muted)]/20",
                  )}
                >
                  <div className="flex flex-col justify-center px-3 py-4 sm:px-4 sm:py-5">
                    <p className="text-sm font-medium text-[var(--cc-text)]">{row.label}</p>
                    {row.hint ? (
                      <p className="mt-0.5 text-[11px] leading-snug text-[var(--cc-text-muted)]">{row.hint}</p>
                    ) : null}
                  </div>
                  {PLAN_ORDER.map((planId) => {
                    const cell = row[planId]
                    const selected = selectedPlanId === planId
                    return (
                      <div
                        key={planId}
                        className={cn(
                          "flex items-center justify-center px-3 py-4 sm:py-5",
                          selected && theme.page.softBg,
                        )}
                      >
                        <CompareCellValue value={cell} />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[minmax(180px,1.2fr)_repeat(3,minmax(140px,1fr))] gap-0">
              <div aria-hidden />
              {PLAN_ORDER.map((planId) => {
                const selected = selectedPlanId === planId
                return (
                  <div
                    key={planId}
                    className={cn("px-3 pb-2 pt-4 sm:px-4", selected && cn("rounded-b-2xl", theme.page.softBg))}
                  />
                )
              })}
            </div>
          </div>
        </motion.div>
        )}

        {orderedPlans.length > 0 ? (
        <div className="mx-auto mt-8 max-w-md">
          <Button
            className={cn("h-14 w-full rounded-full text-base font-bold shadow-sm disabled:opacity-50", theme.page.cta)}
            disabled={
              Boolean(busyPlan) ||
              (selectedPlanId !== "guest_free" && !canCheckout && isCurrentSelection)
            }
            onClick={handleContinue}
          >
            {busyPlan ? (
              <Loader2 className="size-5 animate-spin" />
            ) : selectedPlanId === "guest_free" ? (
              <>
                Continue with {CAREER_MEMBER_FREE_PLAN}
                <ChevronRight className="ml-1 size-5" aria-hidden />
              </>
            ) : isCurrentSelection ? (
              "Current plan"
            ) : (
              <>
                Continue with {selectedPlan?.name.replace("Cora Career ", "") ?? "plan"}
                <ChevronRight className="ml-1 size-5" aria-hidden />
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-[11px] text-[var(--cc-text-muted)]">
            {selectedPlan
              ? `${formatGuestAccessPrice(selectedPlan.id as GuestPlan)} · ${selectedPlan.coraCreditsIncluded.toLocaleString()} credits included`
              : null}
          </p>
        </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[var(--cc-text-muted)]">
          <Link href="/guest/cora-career" className="transition-colors hover:text-[var(--cc-text)]">
            Back to workspace
          </Link>
          <Link href="/guest/cora-credits" className="transition-colors hover:text-[var(--cc-text)]">
            Credit packs
          </Link>
          <Link href="/guest/help" className="transition-colors hover:text-[var(--cc-text)]">
            Help center
          </Link>
        </div>
      </div>
    </Shell>
  )
}
