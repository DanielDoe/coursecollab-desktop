"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Coins, Crown, Loader2 } from "lucide-react"
import { getStudentData } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import {
  EMBED_INNER_PANEL,
  EMBED_MATERIAL_PANEL,
} from "@/components/student/dashboard-v2/embed-module-ui"
import { getGuestPortalTheme } from "@/lib/guest-module-themes"
import { useGuestDashboard } from "@/components/guest/dashboard/GuestDashboardContext"
import { guestHasCapability } from "@/lib/guest/capabilities"
import { CoraCreditsInfoSheet } from "@/components/guest/career/CoraCreditsInfoSheet"
import {
  formatGuestAccessPrice,
  GUEST_CORA_CAREER_LIFETIME_CREDITS,
  GUEST_CORA_CREDIT_PACKS,
} from "@/lib/guest/membership-config"
import { cn } from "@/lib/utils"

const theme = getGuestPortalTheme()

export function GuestCoraCreditsPage() {
  const router = useRouter()
  const { entitlements } = useGuestDashboard()
  const hasCareer = guestHasCapability(entitlements.capabilities, "career.cora")
  const balance = entitlements.credits
  const balanceLevel = entitlements.balanceLevel
  const [checkoutEnabled, setCheckoutEnabled] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [careerBusy, setCareerBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    void fetch("/api/guest/cora-career/plans")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setCheckoutEnabled(Boolean(json.checkoutEnabled))
      })
      .catch(() => {})
  }, [])

  async function checkoutCareer() {
    const d = getStudentData()
    if (!d?.databaseId) {
      setError("Sign in to your Career Member account to purchase.")
      router.push("/student/login/guest")
      return
    }
    if (!checkoutEnabled) {
      setError("Cora Career checkout is not available right now.")
      return
    }
    setCareerBusy(true)
    setError("")
    try {
      const res = await fetch("/api/guest/cora-career/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentDatabaseId: d.databaseId }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.needsEmail) {
          setError("Add your email in Settings before purchasing.")
          router.push("/guest/settings?section=profile")
          return
        }
        throw new Error(json.error || "Checkout failed")
      }
      if (json.url) {
        window.location.href = json.url
        return
      }
      throw new Error("Checkout did not return a payment link.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed")
    } finally {
      setCareerBusy(false)
    }
  }

  async function buy(packId: string) {
    const d = getStudentData()
    if (!d?.databaseId) {
      setError("Sign in to your Career Member account to purchase.")
      router.push("/student/login/guest")
      return
    }
    if (!hasCareer) {
      router.push("/guest/cora-career/access?from=cora-credits")
      return
    }
    if (!checkoutEnabled) {
      setError("Credit pack checkout is not available right now.")
      return
    }
    setBusy(packId)
    setError("")
    try {
      const res = await fetch("/api/guest/cora-credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentDatabaseId: d.databaseId, packId }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.needsEmail) {
          setError("Add your email in Settings before purchasing.")
          router.push("/guest/settings?section=profile")
          return
        }
        throw new Error(json.error || "Checkout failed")
      }
      if (json.url) {
        window.location.href = json.url
        return
      }
      throw new Error("Checkout did not return a payment link.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--cc-text)] sm:text-2xl">
            Add Cora Credits
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--cc-text-muted)]">
            Credits power Cora&apos;s AI features. Purchased credits never expire.
          </p>
          <CoraCreditsInfoSheet triggerClassName="mt-2 h-8 px-0 text-xs text-[var(--cc-accent-dark)] hover:bg-transparent" />
        </div>
        {balance != null ? (
          <div className={cn(EMBED_MATERIAL_PANEL, "shrink-0 px-5 py-4")}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
              Current balance
            </p>
            <p className="mt-1 flex items-center gap-2 text-3xl font-bold tabular-nums text-[var(--cc-text)]">
              <Coins className="size-6 text-[var(--cc-accent-dark)]" />
              {balance.toLocaleString()}
              <span className="text-sm font-medium text-[var(--cc-text-muted)]">Credits</span>
            </p>
          </div>
        ) : null}
      </div>

      {(balanceLevel === "low" || balanceLevel === "critical") && hasCareer ? (
        <div className={cn(EMBED_INNER_PANEL, "p-4 text-sm text-[var(--cc-text-muted)]")}>
          Cora Credits are running low. Add a pack below to keep using AI-powered Career tools.
        </div>
      ) : null}

      {balanceLevel === "empty" && hasCareer ? (
        <div className={cn(EMBED_INNER_PANEL, "p-4 text-sm text-[var(--cc-text-muted)]")}>
          You need more Cora Credits for AI actions. Your Cora Career features remain unlocked — only
          AI compute is paused until you add credits.
        </div>
      ) : null}

      {!entitlements.loading && !hasCareer ? (
        <div className={cn(EMBED_INNER_PANEL, "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5")}>
          <div className="flex items-start gap-3 min-w-0">
            <Crown className="size-5 shrink-0 text-[var(--cc-accent-dark)] mt-0.5" />
            <p className="text-sm text-[var(--cc-text-muted)]">
              Credit packs require{" "}
              <span className="font-medium text-[var(--cc-text)]">Cora Career lifetime access</span>{" "}
              ({GUEST_CORA_CAREER_LIFETIME_CREDITS.toLocaleString()} credits included with unlock).
            </p>
          </div>
          <Button
            className={cn("shrink-0 rounded-xl", theme.page.cta)}
            disabled={careerBusy || !checkoutEnabled}
            onClick={() => void checkoutCareer()}
          >
            {careerBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              `Get Cora Career — ${formatGuestAccessPrice("cora_career")}`
            )}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {GUEST_CORA_CREDIT_PACKS.map((pack) => (
          <div key={pack.id} className={cn(EMBED_MATERIAL_PANEL, "flex flex-col p-5", pack.popular && "ring-2 ring-[var(--cc-accent)]/40")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--cc-text)]">{pack.name}</p>
                {pack.popular ? (
                  <span className="mt-1 inline-block rounded-full bg-[var(--cc-accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--cc-accent-dark)]">
                    Popular
                  </span>
                ) : null}
              </div>
              <p className="text-xl font-bold tabular-nums text-[var(--cc-text)]">${pack.priceUsd.toFixed(2)}</p>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-[var(--cc-accent-dark)]">
              {pack.credits.toLocaleString()} <span className="text-sm font-medium">Credits</span>
            </p>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-[var(--cc-text-muted)]">
              {pack.usageHint ?? pack.description}
            </p>
            <Button
              className={cn("mt-4 w-full rounded-xl", pack.popular && theme.page.cta)}
              variant={pack.popular ? "default" : "outline"}
              disabled={hasCareer && (busy === pack.id || !checkoutEnabled)}
              onClick={() => void buy(pack.id)}
            >
              {busy === pack.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : hasCareer ? (
                "Add Credits"
              ) : (
                "Unlock Cora Career to buy"
              )}
            </Button>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-[var(--cc-text-muted)]">
        Cora Credits are not AI tokens. Charges follow actual usage across agent runs.{" "}
        <Link href="/guest/cora-career/access" className="text-[var(--cc-accent-dark)] hover:underline">
          Compare lifetime plans
        </Link>
      </p>
    </div>
  )
}
