"use client"

import { useCallback, useEffect, useState } from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Role = "student" | "instructor"

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

const PAGE_SIZE = 15

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

/**
 * Full searchable Cora usage history for settings / profile.
 */
export function CoraUsageHistory({
  userId,
  role,
  className,
}: {
  userId: number | string | null
  role: Role
  className?: string
}) {
  const [query, setQuery] = useState("")
  const [committedQuery, setCommittedQuery] = useState("")
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (nextPage: number, q: string) => {
      if (!userId) return
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          role,
          limit: String(PAGE_SIZE),
          page: String(nextPage),
        })
        if (q.trim()) params.set("q", q.trim())
        const res = await fetch(`/api/cora/usage/activity?${params}`, {
          headers: authHeaders(role, userId),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to load")
        const data = (await res.json()) as {
          activity: ActivityRow[]
          page?: number
          totalPages?: number
          total?: number
        }
        setRows(data.activity ?? [])
        setPage(data.page ?? nextPage)
        setTotalPages(data.totalPages ?? 1)
        setTotal(data.total ?? 0)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load history")
        setRows([])
      } finally {
        setLoading(false)
      }
    },
    [userId, role],
  )

  useEffect(() => {
    if (!userId) return
    void load(1, committedQuery)
  }, [userId, committedQuery, load])

  if (!userId) return null

  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <Card className={cn("border-border/60", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Cora usage history</CardTitle>
        <CardDescription>
          Search and review Cora activity — what you asked Cora to do, and credits used.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            setCommittedQuery(query.trim())
            setPage(1)
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tool, module, model…"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {committedQuery ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setQuery("")
                setCommittedQuery("")
              }}
            >
              Clear
            </Button>
          ) : null}
        </form>

        <p className="text-xs text-muted-foreground">
          {total === 0 ? "No matching events" : `${fmt(total)} event${total === 1 ? "" : "s"}`}
        </p>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching activity.</p>
        ) : (
          <ul className="divide-y divide-border/60 text-sm">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium capitalize">{activityLabel(row)}</p>
                  <p className="text-xs text-muted-foreground">
                    {[row.module, row.model, new Date(row.createdAt).toLocaleString()]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium">{row.creditsCharged} cr</p>
                  <p className="text-xs text-muted-foreground">{fmt(row.tokens.total)} tok</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPrev || loading}
              onClick={() => void load(page - 1, committedQuery)}
            >
              Previous
            </Button>
            <p className="text-xs text-muted-foreground tabular-nums">
              Page {page} of {totalPages}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canNext || loading}
              onClick={() => void load(page + 1, committedQuery)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
