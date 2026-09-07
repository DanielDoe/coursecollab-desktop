"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, Loader2 } from "lucide-react"
import { getStudentData } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { portalCard, portalSubtitle, portalTitle } from "@/lib/appearance/portal-shell-theme"
import { cn } from "@/lib/utils"

type Plan = {
  id: string
  name: string
  priceLabel: string
  features: string[]
}

export function GuestMembershipPlans() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [currentPlan, setCurrentPlan] = useState("guest_free")
  const [checkoutEnabled, setCheckoutEnabled] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    const d = getStudentData()
    if (!d?.databaseId) return
    const [plansRes, entRes] = await Promise.all([
      fetch("/api/guest/membership/plans"),
      fetch(`/api/guest/entitlements?studentDatabaseId=${encodeURIComponent(d.databaseId)}`),
    ])
    const plansJson = await plansRes.json()
    const entJson = await entRes.json()
    if (plansRes.ok) {
      setPlans(plansJson.plans ?? [])
      setCheckoutEnabled(Boolean(plansJson.checkoutEnabled))
    }
    if (entRes.ok) setCurrentPlan(String(entJson.plan ?? "guest_free"))
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function checkout() {
    const d = getStudentData()
    if (!d?.databaseId) return
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/guest/membership/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentDatabaseId: d.databaseId, plan: "cora_career" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Checkout failed")
      if (json.url) window.location.href = json.url
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed")
    } finally {
      setBusy(false)
    }
  }

  const free = plans.find((p) => p.id === "guest_free")
  const career = plans.find((p) => p.id === "cora_career")

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/guest" className="mb-4 inline-flex text-sm text-[var(--cc-text-muted)] hover:text-[var(--cc-accent-dark)]">
          ← Career Member home
        </Link>
        <h1 className={portalTitle}>Career Member plans</h1>
        <p className={cn(portalSubtitle, "mt-1 max-w-xl")}>
          Recommendation requesting and tracking stay free. Cora Career adds optional AI help for
          applications, résumés, and interview preparation — it never affects faculty decisions.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className={cn(portalCard, "flex flex-col p-5 sm:p-6")}>
          <h2 className="text-lg font-semibold text-[var(--cc-text)]">{free?.name ?? "Career Member Free"}</h2>
          <p className="mt-1 text-2xl font-bold text-[var(--cc-text)]">$0</p>
          <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--cc-text-muted)]">
            {(free?.features ?? []).slice(0, 8).map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="size-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-6 rounded-xl w-full" disabled={currentPlan === "guest_free"}>
            {currentPlan === "guest_free" ? "Current plan" : "Included"}
          </Button>
        </div>

        <div className={cn(portalCard, "flex flex-col p-5 sm:p-6 border-violet-300/50 dark:border-violet-500/30")}>
          <h2 className="text-lg font-semibold text-[var(--cc-text)]">{career?.name ?? "Cora Career"}</h2>
          <p className="mt-1 text-2xl font-bold text-[var(--cc-text)]">{career?.priceLabel ?? "$9.99 / 90-day Application Pass"}</p>
          <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--cc-text-muted)]">
            {(career?.features ?? []).slice(0, 10).map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="size-4 shrink-0 text-violet-600 mt-0.5" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <Button
            className="mt-6 rounded-xl w-full"
            disabled={busy || currentPlan === "cora_career" || !checkoutEnabled}
            onClick={() => void checkout()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {currentPlan === "cora_career" ? "Current plan" : "Get Cora Career"}
          </Button>
        </div>
      </div>
    </div>
  )
}
