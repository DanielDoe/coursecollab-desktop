"use client"

import { useCallback, useEffect, useState } from "react"
import { DollarSign, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type CostsPayload = {
  since: string
  totals: {
    providerCostUsd: number
    creditsCharged: number
    totalTokens: number
    requests: number
    activeUsers: number
    cacheRate: number
    avgCostPerActiveUser: number
  }
  byFeature: Array<Record<string, unknown>>
  byModel: Array<Record<string, unknown>>
  byRole: Array<Record<string, unknown>>
  byOperation?: Array<Record<string, unknown>>
  byTool?: Array<Record<string, unknown>>
  byProvider?: Array<Record<string, unknown>>
  topUsers: Array<Record<string, unknown>>
  institutionPools: Array<{
    institutionId: number
    periodKey: string
    softBudgetUsd: number
    spentUsd: number
    softLimitHit: boolean
  }>
  scopeGuardrail?: {
    total: number
    byClassification: Record<string, number>
    byDecision: Record<string, number>
    enforcedRedirects: number
    falsePositiveReports: number
    creditsProtected: number
  }
  studentEconomy?: {
    byTier: Array<{
      tier: string
      activeMembers: number
      creditsConsumed: number
      avgCredits: number
      medianCredits: number
      p90Credits: number
      p95Credits: number
      providerCostUsd: number
    }>
    creditPacks: { purchases: number; buyers: number; revenueUsd: number }
    liteEvents: number
  }
  guestEconomy?: {
    platformGuests: number
    lifetimeUnlocks: number
    lifetimePurchases: number
    creditPackPurchases: number
    revenueUsd: number
    creditsOutstanding: number
    usageProviderCostUsd: number
    usageCreditsCharged: number
    usageRequests: number
    activeGuestUsers: number
  }
}

function adminHeaders(): HeadersInit {
  const adminId =
    typeof window !== "undefined"
      ? localStorage.getItem("adminId") || sessionStorage.getItem("adminId")
      : null
  return adminId ? { "x-admin-id": adminId } : {}
}

function money(n: number) {
  return `$${n.toFixed(4)}`
}

export function AdminCoraCostCenter() {
  const [data, setData] = useState<CostsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [institutionId, setInstitutionId] = useState("1")
  const [softBudget, setSoftBudget] = useState("500")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/cora/costs", { headers: adminHeaders() })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed")
      setData((await res.json()) as CostsPayload)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function savePool() {
    const res = await fetch("/api/admin/cora/costs", {
      method: "PATCH",
      headers: { ...adminHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        institutionId: Number(institutionId),
        softBudgetUsd: Number(softBudget),
      }),
    })
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || "Pool update failed")
      return
    }
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Cora Cost Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provider $ vs Cora Credits. Soft institution budgets only — no hard user blocks.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric title="Provider cost (30d)" value={money(data.totals.providerCostUsd)} />
            <Metric title="Credits charged" value={data.totals.creditsCharged.toLocaleString()} />
            <Metric title="Requests" value={data.totals.requests.toLocaleString()} />
            <Metric
              title="Cache hit rate"
              value={`${(data.totals.cacheRate * 100).toFixed(1)}%`}
              hint={`Avg $/user ${money(data.totals.avgCostPerActiveUser)}`}
            />
          </div>

          {data.studentEconomy ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Student Cora economy</CardTitle>
                <CardDescription>
                  Allowance consumption, pack revenue, and estimated provider cost by tier.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric
                    title="Pack purchases"
                    value={data.studentEconomy.creditPacks.purchases.toLocaleString()}
                    hint={`${data.studentEconomy.creditPacks.buyers} buyers`}
                  />
                  <Metric
                    title="Pack revenue"
                    value={money(data.studentEconomy.creditPacks.revenueUsd)}
                  />
                  <Metric
                    title="Cora Lite events"
                    value={data.studentEconomy.liteEvents.toLocaleString()}
                  />
                </div>
                <div className="overflow-x-auto text-sm">
                  <table className="w-full text-left">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-3">Tier</th>
                        <th className="py-1 pr-3">Members</th>
                        <th className="py-1 pr-3">Credits</th>
                        <th className="py-1 pr-3">Avg / p90</th>
                        <th className="py-1">Provider $</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.studentEconomy.byTier.map((row) => (
                        <tr key={row.tier} className="border-t border-border/50">
                          <td className="py-1.5 pr-3 font-medium">{row.tier}</td>
                          <td className="py-1.5 pr-3">{row.activeMembers}</td>
                          <td className="py-1.5 pr-3">{row.creditsConsumed.toLocaleString()}</td>
                          <td className="py-1.5 pr-3">
                            {Math.round(row.avgCredits)} / {Math.round(row.p90Credits)}
                          </td>
                          <td className="py-1.5">{money(row.providerCostUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {data.guestEconomy ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Guest / Cora Career</CardTitle>
                <CardDescription>
                  Lifetime unlocks, credit packs, and Career Member AI usage (user_role=guest).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    title="Career Members"
                    value={data.guestEconomy.platformGuests.toLocaleString()}
                    hint={`${data.guestEconomy.lifetimeUnlocks} Cora Career lifetime`}
                  />
                  <Metric
                    title="Guest revenue (30d)"
                    value={money(data.guestEconomy.revenueUsd)}
                    hint={`${data.guestEconomy.lifetimePurchases} lifetime · ${data.guestEconomy.creditPackPurchases} packs`}
                  />
                  <Metric
                    title="Guest AI cost (30d)"
                    value={money(data.guestEconomy.usageProviderCostUsd)}
                    hint={`${data.guestEconomy.usageCreditsCharged.toLocaleString()} credits charged`}
                  />
                  <Metric
                    title="Credits outstanding"
                    value={data.guestEconomy.creditsOutstanding.toLocaleString()}
                    hint={`${data.guestEconomy.activeGuestUsers} active in period`}
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <TableCard
              title="By feature"
              rows={data.byFeature.map((r) => [
                String(r.feature),
                money(Number(r.provider_cost_usd ?? 0)),
                String(r.credits_charged ?? 0),
                String(r.requests ?? 0),
              ])}
              headers={["Feature", "Cost", "Credits", "Reqs"]}
            />
            <TableCard
              title="By operation / module"
              rows={(data.byOperation ?? []).map((r) => [
                `${String(r.module)}/${String(r.operation)}`,
                money(Number(r.provider_cost_usd ?? 0)),
                String(r.credits_charged ?? 0),
                String(r.requests ?? 0),
              ])}
              headers={["Operation", "Cost", "Credits", "Reqs"]}
            />
            <TableCard
              title="By tool"
              rows={(data.byTool ?? []).map((r) => [
                String(r.tool_name),
                money(Number(r.provider_cost_usd ?? 0)),
                String(r.credits_charged ?? 0),
                String(r.requests ?? 0),
              ])}
              headers={["Tool", "Cost", "Credits", "Reqs"]}
            />
            <TableCard
              title="By provider"
              rows={(data.byProvider ?? []).map((r) => [
                String(r.provider),
                money(Number(r.provider_cost_usd ?? 0)),
                String(r.credits_charged ?? 0),
                String(r.requests ?? 0),
              ])}
              headers={["Provider", "Cost", "Credits", "Reqs"]}
            />
            <TableCard
              title="By model"
              rows={data.byModel.map((r) => [
                String(r.model),
                money(Number(r.provider_cost_usd ?? 0)),
                String(r.requests ?? 0),
              ])}
              headers={["Model", "Cost", "Reqs"]}
            />
            <TableCard
              title="By role"
              rows={data.byRole.map((r) => [
                String(r.user_role),
                money(Number(r.provider_cost_usd ?? 0)),
                String(r.active_users ?? 0),
                String(r.credits_charged ?? 0),
              ])}
              headers={["Role", "Cost", "Users", "Credits"]}
            />
            <TableCard
              title="Top users"
              rows={data.topUsers.map((r) => [
                `${r.user_role}#${r.user_id}`,
                money(Number(r.provider_cost_usd ?? 0)),
                String(r.credits_charged ?? 0),
              ])}
              headers={["User", "Cost", "Credits"]}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scope guardrail</CardTitle>
              <CardDescription>
                Academic-purpose classifier (OBSERVE by default). Mode via CORA_SCOPE_MODE.
                Integrity/permission blocks stay separate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {data.scopeGuardrail ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Metric title="Classified" value={String(data.scopeGuardrail.total)} />
                    <Metric
                      title="Enforced redirects"
                      value={String(data.scopeGuardrail.enforcedRedirects)}
                    />
                    <Metric
                      title="False-positive reports"
                      value={String(data.scopeGuardrail.falsePositiveReports)}
                    />
                  </div>
                  <TableCard
                    title="By classification"
                    headers={["Class", "Count"]}
                    rows={Object.entries(data.scopeGuardrail.byClassification).map(([k, v]) => [
                      k,
                      String(v),
                    ])}
                  />
                </>
              ) : (
                <p className="text-muted-foreground">No scope events yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Institution soft pools</CardTitle>
              <CardDescription>
                Soft budget tracking for campus AI spend. Hitting the limit is informational only.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(data.institutionPools?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No pools yet — create one below.</p>
              ) : (
                <ul className="text-sm divide-y">
                  {data.institutionPools.map((p) => (
                    <li key={`${p.institutionId}-${p.periodKey}`} className="py-2 flex justify-between gap-3">
                      <span>
                        Institution {p.institutionId} · {p.periodKey}
                        {p.softLimitHit ? " · soft limit hit" : ""}
                      </span>
                      <span className="tabular-nums">
                        {money(p.spentUsd)} / {money(p.softBudgetUsd)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label htmlFor="inst">Institution ID</Label>
                  <Input
                    id="inst"
                    value={institutionId}
                    onChange={(e) => setInstitutionId(e.target.value)}
                    className="w-28"
                  />
                </div>
                <div>
                  <Label htmlFor="budget">Soft budget USD</Label>
                  <Input
                    id="budget"
                    value={softBudget}
                    onChange={(e) => setSoftBudget(e.target.value)}
                    className="w-32"
                  />
                </div>
                <Button type="button" onClick={() => void savePool()}>
                  Save pool
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Metric({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  )
}

function TableCard({
  title,
  headers,
  rows,
}: {
  title: string
  headers: string[]
  rows: string[][]
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              {headers.map((h) => (
                <th key={h} className="py-1.5 pr-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 15).map((row, i) => (
              <tr key={i} className="border-b border-border/40">
                {row.map((cell, j) => (
                  <td key={j} className="py-1.5 pr-3 tabular-nums">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
