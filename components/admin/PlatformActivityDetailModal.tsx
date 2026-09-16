"use client"

import {
  Clock,
  Hash,
  User,
} from "lucide-react"
import {
  categoryLabel,
  clientPlatformLabel,
  formatActivityActorPrimary,
  formatActivityActorSecondary,
  portalLabel,
  resolveActivityClientPlatform,
  type PlatformActivityRow,
} from "@/lib/platform-activity-constants"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

function actionBadgeVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action === "login_failed") return "destructive"
  if (action === "login_success") return "default"
  if (action.includes("password")) return "secondary"
  return "outline"
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (value == null || value === "" || value === "—") return null
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2.5 border-b border-slate-100 dark:border-white/5 last:border-0">
      <dt className="text-xs font-medium text-muted-foreground pt-0.5">{label}</dt>
      <dd className={cn("text-sm break-all min-w-0", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  )
}

function TabPanel({ children }: { children: React.ReactNode }) {
  return <dl className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] px-4 py-1">{children}</dl>
}

type PlatformActivityDetailModalProps = {
  row: PlatformActivityRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlatformActivityDetailModal({ row, open, onOpenChange }: PlatformActivityDetailModalProps) {
  if (!row) return null

  const actorDisplay = formatActivityActorPrimary(row)
  const actorStudentId = formatActivityActorSecondary(row)
  const showStudentId =
    row.actor_label?.trim() && actorStudentId !== portalLabel(row.portal)
  const metadataEntries = Object.entries(row.metadata ?? {})
  const hasMetadata = metadataEntries.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200/80 dark:border-white/10 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={actionBadgeVariant(row.action)}>{row.action}</Badge>
            <Badge variant="outline">{portalLabel(row.portal)}</Badge>
            <Badge variant="secondary">
              {clientPlatformLabel(resolveActivityClientPlatform(row))}
            </Badge>
            {row.success ? (
              <Badge className="bg-emerald-600/90 hover:bg-emerald-600/90">Success</Badge>
            ) : (
              <Badge variant="destructive">Failed</Badge>
            )}
          </div>
          <DialogTitle className="text-left text-lg leading-snug pr-6">
            {row.summary ?? row.action}
          </DialogTitle>
          <DialogDescription className="text-left flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {formatTimeFull(row.created_at)}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="px-6 py-4">
          <TabsList className="w-full h-auto flex-wrap gap-1 bg-muted/50 p-1 mb-4">
            <TabsTrigger value="overview" className="flex-1 min-w-[4.5rem] text-xs sm:text-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="user" className="flex-1 min-w-[4.5rem] text-xs sm:text-sm">
              User
            </TabsTrigger>
            <TabsTrigger value="request" className="flex-1 min-w-[4.5rem] text-xs sm:text-sm">
              Request
            </TabsTrigger>
            <TabsTrigger value="metadata" className="flex-1 min-w-[4.5rem] text-xs sm:text-sm">
              Metadata
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0 space-y-3">
            <TabPanel>
              <DetailRow label="Event ID" value={`#${row.id}`} mono />
              <DetailRow label="Action" value={row.action} />
              <DetailRow label="Category" value={categoryLabel(row.category)} />
              <DetailRow label="Portal" value={portalLabel(row.portal)} />
              <DetailRow label="Summary" value={row.summary ?? "—"} />
              <DetailRow label="Status" value={row.success ? "Successful" : "Failed"} />
            </TabPanel>
          </TabsContent>

          <TabsContent value="user" className="mt-0 space-y-3">
            <TabPanel>
              <DetailRow label="Display name" value={actorDisplay} />
              {showStudentId ? (
                <DetailRow label="Student ID" value={actorStudentId} mono />
              ) : null}
              <DetailRow label="Email" value={row.actor_email ?? "—"} />
              <DetailRow label="Database ID" value={row.actor_id != null ? String(row.actor_id) : "—"} mono />
              <DetailRow label="Actor type" value={row.actor_type} />
            </TabPanel>
          </TabsContent>

          <TabsContent value="request" className="mt-0 space-y-3">
            <TabPanel>
              <DetailRow label="Path" value={row.path ?? "—"} mono />
              <DetailRow label="Method" value={row.method ?? "—"} />
              <DetailRow
                label="Client"
                value={clientPlatformLabel(resolveActivityClientPlatform(row))}
              />
              <DetailRow label="IP address" value={row.ip_address ?? "—"} mono />
              <DetailRow
                label="User agent"
                value={row.user_agent ?? "—"}
                mono
              />
              <DetailRow label="Entity type" value={row.entity_type ?? "—"} />
              <DetailRow label="Entity ID" value={row.entity_id ?? "—"} mono />
              <DetailRow label="Course ID" value={row.course_id != null ? String(row.course_id) : "—"} mono />
            </TabPanel>
          </TabsContent>

          <TabsContent value="metadata" className="mt-0 space-y-3">
            {hasMetadata ? (
              <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-950/95 dark:bg-black/40 p-4 overflow-x-auto">
                <pre className="text-xs font-mono text-slate-100 whitespace-pre-wrap break-all">
                  {JSON.stringify(row.metadata, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                No additional metadata for this event.
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="px-6 pb-6 pt-0 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" /> {actorDisplay}
          </span>
          <span className="inline-flex items-center gap-1 justify-end">
            <Hash className="h-3 w-3" /> Log #{row.id}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function formatTimeShort(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function actionBadgeVariantPublic(action: string) {
  return actionBadgeVariant(action)
}
