"use client"

import { useEffect, useState } from "react"
import { Clock, Copy, Loader2, User } from "lucide-react"
import { buildPortalApiHeaders } from "@/lib/admin-api-headers"
import {
  categoryLabel,
  severityLabel,
  type SystemLogRow,
} from "@/lib/system-log-constants"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

function formatTimeFull(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    return iso
  }
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (value == null || value === "" || value === "—") return null
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-slate-100 py-2.5 last:border-0 dark:border-white/5">
      <dt className="pt-0.5 text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 break-all text-sm", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  )
}

function TabPanel({ children }: { children: React.ReactNode }) {
  return (
    <dl className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-1 dark:border-white/10 dark:bg-white/[0.02]">
      {children}
    </dl>
  )
}

type SystemLogDetailModalProps = {
  logId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  portal?: "admin" | "instructor"
  onSelectRelated?: (id: number) => void
}

export function SystemLogDetailModal({
  logId,
  open,
  onOpenChange,
  portal = "admin",
  onSelectRelated,
}: SystemLogDetailModalProps) {
  const { toast } = useToast()
  const [log, setLog] = useState<SystemLogRow | null>(null)
  const [related, setRelated] = useState<SystemLogRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || logId == null) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const headers = buildPortalApiHeaders(portal)
        const res = await fetch(`/api/admin/system-logs/${logId}`, { headers })
        if (!res.ok) throw new Error("Failed to load")
        const data = await res.json()
        if (!cancelled) {
          setLog(data.log)
          setRelated(data.related ?? [])
        }
      } catch {
        if (!cancelled) toast({ title: "Could not load log details", variant: "destructive" })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, logId, portal, toast])

  const copyForClaude = () => {
    if (!log) return
    const text = [
      `# CourseCollab Error Report`,
      ``,
      `**Log ID:** ${log.log_id}`,
      `**Severity:** ${log.severity}`,
      `**Category:** ${log.category}`,
      `**Module:** ${log.module_name ?? "Unknown"}`,
      `**When:** ${log.created_at}`,
      `**Environment:** ${log.environment}`,
      ``,
      `## What failed`,
      log.title ?? log.error_message ?? "—",
      ``,
      `## Error`,
      log.error_message ?? "—",
      ``,
      `## Where`,
      `- Page: ${log.page_url ?? log.route ?? "—"}`,
      `- API: ${log.http_method ?? ""} ${log.api_endpoint ?? "—"} ${log.http_status_code ?? ""}`,
      `- Feature: ${log.feature_name ?? "—"}`,
      ``,
      `## Who`,
      `- User: ${log.user_name ?? log.user_id ?? "—"} (${log.user_role ?? "unknown"})`,
      `- Course: ${log.course_name ?? log.course_id ?? "—"}`,
      ``,
      `## Device`,
      `- Browser: ${log.browser ?? "—"}`,
      `- OS: ${log.operating_system ?? "—"}`,
      `- Device: ${log.device_type ?? "—"}`,
      `- Screen: ${log.screen_resolution ?? "—"}`,
      ``,
      `## Stack trace`,
      "```",
      log.stack_trace ?? "No stack trace",
      "```",
      ``,
      `## Root cause hints`,
      ...(log.root_cause_hints?.length ? log.root_cause_hints.map((h) => `- ${h}`) : ["- None"]),
      ``,
      `## Metadata`,
      "```json",
      JSON.stringify(log.metadata ?? {}, null, 2),
      "```",
    ].join("\n")

    void navigator.clipboard.writeText(text)
    toast({ title: "Copied diagnostic report for Claude" })
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-hidden p-0">
        {loading || !log ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader className="space-y-3 border-b border-slate-200/80 px-6 pb-4 pt-6 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={log.severity === "critical" || log.severity === "error" ? "destructive" : "secondary"}>
                  {severityLabel(log.severity)}
                </Badge>
                <Badge variant="outline">{categoryLabel(log.category)}</Badge>
                {log.module_name && <Badge variant="outline">{log.module_name}</Badge>}
              </div>
              <DialogTitle className="pr-6 text-left text-lg leading-snug">
                {log.title ?? log.error_message ?? "System log"}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-1.5 text-left">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {formatTimeFull(log.created_at)}
              </DialogDescription>
              <Button variant="outline" size="sm" className="w-fit" onClick={copyForClaude}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy for Claude
              </Button>
            </DialogHeader>

            <Tabs defaultValue="overview" className="overflow-y-auto px-6 py-4">
              <TabsList className="mb-4 h-auto w-full flex-wrap gap-1 bg-muted/50 p-1">
                <TabsTrigger value="overview" className="min-w-[4.5rem] flex-1 text-xs sm:text-sm">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="stack" className="min-w-[4.5rem] flex-1 text-xs sm:text-sm">
                  Stack
                </TabsTrigger>
                <TabsTrigger value="request" className="min-w-[4.5rem] flex-1 text-xs sm:text-sm">
                  Request
                </TabsTrigger>
                <TabsTrigger value="related" className="min-w-[4.5rem] flex-1 text-xs sm:text-sm">
                  Related ({related.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <TabPanel>
                  <DetailRow label="Log ID" value={log.log_id} mono />
                  <DetailRow label="Description" value={log.description} />
                  <DetailRow label="Error" value={log.error_message} />
                  <DetailRow label="Module" value={log.module_name} />
                  <DetailRow label="Feature" value={log.feature_name} />
                  <DetailRow label="Environment" value={log.environment} />
                  <DetailRow label="Page URL" value={log.page_url} mono />
                  <DetailRow label="Route" value={log.route} mono />
                  <DetailRow
                    label="User"
                    value={
                      log.user_name || log.user_id ? (
                        <span className="inline-flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          {log.user_name ?? log.user_id}
                          {log.user_role ? ` (${log.user_role})` : ""}
                        </span>
                      ) : null
                    }
                  />
                  <DetailRow
                    label="Course"
                    value={log.course_name ?? (log.course_id ? `#${log.course_id}` : null)}
                  />
                  <DetailRow label="Session" value={log.session_id} mono />
                  <DetailRow
                    label="Hints"
                    value={
                      log.root_cause_hints?.length ? (
                        <ul className="list-inside list-disc space-y-1 text-xs">
                          {log.root_cause_hints.map((h) => (
                            <li key={h}>{h}</li>
                          ))}
                        </ul>
                      ) : null
                    }
                  />
                </TabPanel>
              </TabsContent>

              <TabsContent value="stack">
                <pre className="max-h-64 overflow-auto rounded-xl border bg-slate-950 p-4 text-xs text-slate-100">
                  {log.stack_trace ?? "No stack trace captured"}
                </pre>
              </TabsContent>

              <TabsContent value="request">
                <TabPanel>
                  <DetailRow label="Endpoint" value={log.api_endpoint} mono />
                  <DetailRow label="Method" value={log.http_method} />
                  <DetailRow label="Status" value={log.http_status_code} />
                  <DetailRow
                    label="Duration"
                    value={log.execution_time_ms != null ? `${log.execution_time_ms}ms` : null}
                  />
                  <DetailRow label="IP" value={log.ip_address} mono />
                  <DetailRow label="Browser" value={log.browser} />
                  <DetailRow label="OS" value={log.operating_system} />
                  <DetailRow label="Device" value={log.device_type} />
                  <DetailRow label="Screen" value={log.screen_resolution} />
                  <DetailRow label="User-Agent" value={log.user_agent} mono />
                </TabPanel>
                {Object.keys(log.metadata ?? {}).length > 0 && (
                  <pre className="mt-3 max-h-48 overflow-auto rounded-xl border bg-muted/30 p-3 text-xs">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </TabsContent>

              <TabsContent value="related">
                {related.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No related logs found.</p>
                ) : (
                  <div className="space-y-2">
                    {related.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onSelectRelated?.(r.id)}
                        className="w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {r.severity}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatTimeFull(r.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 truncate">{r.title ?? r.error_message}</p>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
