"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, Coins, Cpu, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Role = "student" | "instructor"

type BalancePayload = {
  credits: number
  includedBalance: number
  purchasedBalance: number
  reservedCredits: number
  periodKey: string
  lifetimeCreditsUsed: number
  membershipTier: string | null
  coraMode: "premium" | "lite"
  isLow: boolean
  month: {
    creditsUsed: number
    interactions: number
    agentRuns: number
    tokensProcessed: number
    inputTokens: number
    cachedInputTokens: number
    outputTokens: number
    reasoningTokens: number
  }
}

type ActivityRow = {
  id: number
  feature: string
  title?: string
  module?: string | null
  operation?: string | null
  toolName?: string | null
  model: string | null
  creditsCharged: number
  tokens: { input: number; cachedInput: number; output: number; reasoning: number; total: number }
  createdAt: string
  latencyMs: number | null
}

/** Compact membership preview — fixed page size, no growing list. */
const ACTIVITY_PAGE_SIZE = 5

function authHeaders(role: Role, userId: number | string): HeadersInit {
  if (role === "instructor") {
    return { "x-instructor-id": String(userId) }
  }
  return { "x-student-id": String(userId) }
}

function fmt(n: number) {
  return Math.round(n).toLocaleString()
}

function activityLabel(row: ActivityRow): string {
  if (row.title?.trim()) return row.title
  if (row.toolName) return row.toolName.replace(/_/g, " ")
  if (row.operation && !["agent_turn", "runCoraAgent"].includes(row.operation)) {
    return row.operation.replace(/_/g, " ")
  }
  return row.feature
}

export function CoraUsagePanel({
  userId,
  role,
  className,
  historyHref,
}: {
  userId: number | string | null
  role: Role
  className?: string
  /** Optional link to full searchable history (settings/profile). */
  historyHref?: string
}) {
  const [balance, setBalance] = useState<BalancePayload | null>(null)
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loadingPage, setLoadingPage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchActivityPage = useCallback(
    async (nextPage: number) => {
      if (!userId) return
      const headers = authHeaders(role, userId)
      const aRes = await fetch(
        `/api/cora/usage/activity?role=${role}&limit=${ACTIVITY_PAGE_SIZE}&page=${nextPage}`,
        { headers },
      )
      if (!aRes.ok) throw new Error((await aRes.json().catch(() => ({}))).error || "Activity failed")
      const a = (await aRes.json()) as {
        activity: ActivityRow[]
        page?: number
        totalPages?: number
        total?: number
      }
      setActivity(a.activity ?? [])
      setPage(a.page ?? nextPage)
      setTotalPages(a.totalPages ?? 1)
      setTotal(a.total ?? (a.activity ?? []).length)
    },
    [userId, role],
  )

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const headers = authHeaders(role, userId)
      const bRes = await fetch(`/api/cora/credits/balance?role=${role}`, { headers })
      if (!bRes.ok) throw new Error((await bRes.json().catch(() => ({}))).error || "Balance failed")
      const b = (await bRes.json()) as BalancePayload
      setBalance(b)
      await fetchActivityPage(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load usage")
    } finally {
      setLoading(false)
    }
  }, [userId, role, fetchActivityPage])

  const goToPage = useCallback(
    async (nextPage: number) => {
      if (!userId || loadingPage) return
      const target = Math.max(1, Math.min(totalPages, nextPage))
      if (target === page && activity.length) return
      setLoadingPage(true)
      setError(null)
      try {
        await fetchActivityPage(target)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load activity page")
      } finally {
        setLoadingPage(false)
      }
    },
    [userId, loadingPage, totalPages, page, activity.length, fetchActivityPage],
  )

  useEffect(() => {
    void load()
  }, [load])

  if (!userId) return null

  const canPrev = page > 1
  const canNext = page < totalPages
  const defaultHistoryHref =
    role === "instructor"
      ? "/instructor/dashboard-v2/settings?section=cora-usage"
      : "/student/dashboard-v2/settings/cora-usage"

  return (
    <Card className={cn("border-border/60", className)}>
      <CardHeader className="pb-3">
        <CardTitle className={cn("text-lg flex items-center gap-2", PORTAL_TEXT)}>
          <Coins className="h-5 w-5 text-amber-600" />
          Cora Usage
        </CardTitle>
        <CardDescription className={PORTAL_TEXT_MUTED}>
          Credits are how your plan meters AI. Tokens measure processing volume — not your bill.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading usage…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && balance && (
          <Tabs defaultValue="overview">
            <TabsList className="mb-4 grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="tokens">Tokens</TabsTrigger>
              <TabsTrigger value="credits">Credits</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                  icon={<Coins className="h-4 w-4" />}
                  label="Available"
                  value={
                    balance.coraMode === "lite"
                      ? "Cora Lite"
                      : `${fmt(balance.credits)} credits`
                  }
                  hint={balance.isLow ? "Low balance" : balance.periodKey}
                />
                <Stat
                  icon={<Activity className="h-4 w-4" />}
                  label="This period used"
                  value={fmt(balance.month.creditsUsed)}
                  hint={`${balance.month.interactions} interactions`}
                />
                <Stat
                  icon={<Layers className="h-4 w-4" />}
                  label="Lifetime used"
                  value={fmt(balance.lifetimeCreditsUsed)}
                  hint={balance.membershipTier || "—"}
                />
              </div>
            </TabsContent>

            <TabsContent value="activity" className="space-y-3">
              {activity.length === 0 && !loadingPage ? (
                <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No AI activity recorded yet.</p>
              ) : loadingPage ? (
                <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading page…</p>
              ) : (
                <ul className="divide-y divide-border/60 text-sm">
                  {activity.map((row) => (
                    <li key={row.id} className="flex items-start justify-between gap-3 py-2">
                      <div>
                        <p className={cn("font-medium capitalize", PORTAL_TEXT)}>{activityLabel(row)}</p>
                        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                          {row.model || "model"} · {new Date(row.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn("font-medium", PORTAL_TEXT)}>{row.creditsCharged} cr</p>
                        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{fmt(row.tokens.total)} tok</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {total > 0 ? (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void goToPage(page - 1)}
                    disabled={!canPrev || loadingPage}
                    className="rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <p className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                    Page {page} of {totalPages}
                    {total > 0 ? ` · ${fmt(total)}` : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => void goToPage(page + 1)}
                    disabled={!canNext || loadingPage}
                    className="rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 text-sm font-medium disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              ) : null}

              <a
                href={historyHref ?? defaultHistoryHref}
                className="inline-flex text-sm font-medium text-[var(--cc-accent-dark)] hover:underline dark:text-[var(--cc-accent)]"
              >
                Detailed history & search
              </a>
            </TabsContent>

            <TabsContent value="tokens" className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Stat icon={<Cpu className="h-4 w-4" />} label="Input" value={fmt(balance.month.inputTokens)} />
                <Stat
                  icon={<Cpu className="h-4 w-4" />}
                  label="Cached input"
                  value={fmt(balance.month.cachedInputTokens)}
                />
                <Stat icon={<Cpu className="h-4 w-4" />} label="Output" value={fmt(balance.month.outputTokens)} />
                <Stat
                  icon={<Cpu className="h-4 w-4" />}
                  label="Reasoning"
                  value={fmt(balance.month.reasoningTokens)}
                />
              </div>
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                Total processed this month: {fmt(balance.month.tokensProcessed)} tokens. Provider dollar cost is
                not shown on student/faculty views.
              </p>
            </TabsContent>

            <TabsContent value="credits" className="space-y-2 text-sm">
              <Row label="Included remaining" value={fmt(balance.includedBalance)} />
              <Row label="Purchased remaining" value={fmt(balance.purchasedBalance)} />
              <Row label="Reserved (in flight)" value={fmt(balance.reservedCredits)} />
              <Row label="Available" value={fmt(balance.credits)} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className={cn("flex items-center gap-1.5 text-xs", PORTAL_TEXT_MUTED)}>
        <span className="shrink-0 opacity-80">{icon}</span>
        {label}
      </div>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", PORTAL_TEXT)}>{value}</p>
      {hint ? <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>{hint}</p> : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2 last:border-0">
      <span className={PORTAL_TEXT_MUTED}>{label}</span>
      <span className={cn("font-medium tabular-nums", PORTAL_TEXT)}>{value}</span>
    </div>
  )
}
