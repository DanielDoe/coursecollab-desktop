"use client"

import { useCallback, useEffect, useState } from "react"
import { Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { solidListThumb } from "@/lib/student-color-hunt-theme"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

type PackRow = {
  id: string
  name: string
  credits: number
  priceInCents: number
  priceDisplay: string
  description: string
  perThousandDisplay: string
}

type Props = {
  audience: "student" | "instructor"
  buyerId: number | string | null
  className?: string
  title?: string
  subtitle?: string
}

export function CoraCreditPacksPanel({
  audience,
  buyerId,
  className,
  title = "Cora Credit Packs",
  subtitle = "Purchased credits do not expire with your monthly allowance reset.",
}: Props) {
  const [packs, setPacks] = useState<PackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/cora-credits/packs?audience=${audience}`)
        const data = await res.json()
        if (!cancelled) setPacks(Array.isArray(data.packs) ? data.packs : [])
      } catch {
        if (!cancelled) setError("Could not load credit packs.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [audience])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("cora_pack") !== "success") return
    const sessionId = params.get("session_id")
    if (!sessionId) return
    void fetch("/api/cora-credits/confirm-purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).finally(() => {
      params.delete("cora_pack")
      params.delete("pack")
      params.delete("session_id")
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`
      window.history.replaceState({}, "", next)
    })
  }, [])

  const buy = useCallback(
    async (packId: string) => {
      if (!buyerId) {
        setError("Sign in to purchase Cora Credits.")
        return
      }
      setBuyingId(packId)
      setError(null)
      try {
        const endpoint =
          audience === "student"
            ? "/api/student/cora-credits/checkout"
            : "/api/instructor/cora-credits/checkout"
        const body =
          audience === "student"
            ? { studentId: buyerId, packId }
            : { instructorId: buyerId, packId }
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Checkout failed")
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl
          return
        }
        throw new Error("No checkout URL returned")
      } catch (e) {
        setError(e instanceof Error ? e.message : "Checkout failed")
      } finally {
        setBuyingId(null)
      }
    },
    [audience, buyerId],
  )

  const headerThumb = solidListThumb(2)

  return (
    <div className={cn("rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 sm:p-6", className)}>
      <div className="mb-4 flex items-start gap-3">
        <SolidListThumbTile thumb={headerThumb} icon={Sparkles} size="compact" />
        <div>
          <h3 className={cn("text-lg font-semibold tracking-tight", PORTAL_TEXT)}>{title}</h3>
          <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>{subtitle}</p>
        </div>
      </div>

      {loading ? (
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading packs…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {packs.map((pack, idx) => {
            const thumb = solidListThumb(idx)
            return (
              <div
                key={pack.id}
                className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <div className="flex items-center gap-2">
                  <SolidListThumbTile thumb={thumb} icon={Zap} size="compact" />
                  <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>
                    {pack.credits.toLocaleString()} credits
                  </p>
                </div>
                <p className={cn("mt-3 text-2xl font-bold tabular-nums", PORTAL_TEXT)}>{pack.priceDisplay}</p>
                <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>{pack.perThousandDisplay}</p>
                <p className={cn("mt-2 flex-1 text-sm", PORTAL_TEXT_MUTED)}>{pack.description}</p>
                <Button
                  className="mt-4 w-full rounded-xl border-0 hover:opacity-90"
                  style={{ backgroundColor: thumb.fill, color: thumb.icon }}
                  disabled={!buyerId || buyingId === pack.id}
                  onClick={() => buy(pack.id)}
                >
                  {buyingId === pack.id ? "Starting checkout…" : "Buy pack"}
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
