"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, X, KeyRound, Users, Settings, BookOpen, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  AM_EMPTY,
  AM_EMPTY_FILL,
  AM_ROW,
  AM_PANEL_SECTION,
  AM_PANEL_SCROLL,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/assessments/assessment-management-surface-classes"
import { cn } from "@/lib/utils"

const QB_SELECT_TRIGGER =
  "h-9 min-w-[7rem] border-0 bg-[var(--sidebar-accent)]/50 shadow-none sm:min-w-[9rem]"

type Props = {
  portal: "admin" | "faculty"
}

const campDialogContentClass =
  "border border-slate-200 !bg-white text-slate-900 shadow-xl sm:rounded-xl dark:border-dashboard-v2-border dark:!bg-slate-800 dark:text-dashboard-v2-fg"

const campDialogCancelClass =
  "border-slate-200 bg-white text-slate-900 hover:bg-slate-50 dark:border-white/25 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/10"

const campDialogActionClass =
  "border-0 text-white hover:opacity-90 focus-visible:ring-violet-500/40 dark:text-white"

function isPasswordResetRequest(r: Record<string, unknown>) {
  return String(r.request_kind ?? "") === "camp_password_reset"
}

function requestTypeLabel(r: Record<string, unknown>) {
  if (isPasswordResetRequest(r)) return "Password reset"
  if (String(r.request_kind ?? "") === "summer_student") return "New account · Summer student"
  return "New account · Summer camper"
}

export function CamperManagement({ portal }: Props) {
  const headers = portal === "admin" ? buildAdminApiHeaders : buildInstructorApiHeaders
  const apiBase = portal === "admin" ? "/api/admin/summer-camp/campers" : "/api/instructor/summer-camp/campers"
  const programsHref =
    portal === "admin" ? "/admin/dashboard-v2/summer-camp" : "/instructor/dashboard-v2/summer-camp"

  const [campers, setCampers] = useState<Array<Record<string, unknown>>>([])
  const [requests, setRequests] = useState<Array<Record<string, unknown>>>([])
  const [autoApprove, setAutoApprove] = useState(false)
  const [adminEmail, setAdminEmail] = useState("dmdoe@pvamu.edu")
  const [loading, setLoading] = useState(true)
  const [approvingAll, setApprovingAll] = useState(false)
  const [approveAllConfirmOpen, setApproveAllConfirmOpen] = useState(false)
  const [approveAllResult, setApproveAllResult] = useState<{
    title: string
    message: string
    variant: "success" | "error"
  } | null>(null)
  const [resetId, setResetId] = useState<number | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [activeMenu, setActiveMenu] = useState<"campers" | "requests" | "settings">("campers")
  const [searchTerm, setSearchTerm] = useState("")
  const [requestFilter, setRequestFilter] = useState<"all" | "pending" | "password_reset" | "signup">("all")

  const chrome = facultyEmbedChrome("campers")
  const fp = chrome.p

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, rRes] = await Promise.all([
        fetch(`${apiBase}?tab=campers`, { headers: headers() }),
        fetch(`${apiBase}?tab=requests`, { headers: headers() }),
      ])
      if (cRes.ok) setCampers((await cRes.json()).campers ?? [])
      if (rRes.ok) setRequests((await rRes.json()).requests ?? [])
      if (portal === "admin") {
        const sRes = await fetch(`${apiBase}?tab=settings`, { headers: headers() })
        if (sRes.ok) {
          const s = (await sRes.json()).settings ?? {}
          setAutoApprove(!!s.auto_approve_accounts)
          if (s.platform_admin_notify_email) setAdminEmail(s.platform_admin_notify_email)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [apiBase, headers, portal])

  useEffect(() => {
    void load()
  }, [load])

  const approve = async (id: number) => {
    const url =
      portal === "admin"
        ? `/api/admin/summer-camp/campers/requests/${id}/approve`
        : apiBase
    const opts =
      portal === "admin"
        ? { method: "POST", headers: headers() }
        : {
            method: "POST",
            headers: { ...headers(), "Content-Type": "application/json" },
            body: JSON.stringify({ action: "approve", request_id: id }),
          }
    await fetch(url, opts)
    await load()
  }

  const runApproveAll = async () => {
    if (pendingSignups.length === 0) return

    setApprovingAll(true)
    try {
      const url =
        portal === "admin"
          ? "/api/admin/summer-camp/campers/requests/approve-all"
          : apiBase
      const opts =
        portal === "admin"
          ? { method: "POST", headers: headers() }
          : {
              method: "POST",
              headers: { ...headers(), "Content-Type": "application/json" },
              body: JSON.stringify({ action: "approve_all" }),
            }
      const res = await fetch(url, opts)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setApproveAllResult({
          title: "Approval failed",
          message: String(data.error ?? "Failed to approve all requests."),
          variant: "error",
        })
        return
      }
      setApproveAllResult({
        title: "Accounts approved",
        message: String(data.message ?? `Approved ${data.approvedCount ?? 0} accounts.`),
        variant: "success",
      })
      await load()
    } finally {
      setApprovingAll(false)
    }
  }

  const handleConfirmApproveAll = () => {
    setApproveAllConfirmOpen(false)
    void runApproveAll()
  }

  const reject = async (id: number, reason = "Not eligible") => {
    const url =
      portal === "admin"
        ? `/api/admin/summer-camp/campers/requests/${id}/reject`
        : apiBase
    const opts =
      portal === "admin"
        ? {
            method: "POST",
            headers: { ...headers(), "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          }
        : {
            method: "POST",
            headers: { ...headers(), "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reject", request_id: id, reason }),
          }
    await fetch(url, opts)
    await load()
  }

  const resetPassword = async () => {
    if (!resetId || !newPassword) return
    const url =
      portal === "admin"
        ? `/api/admin/summer-camp/campers/${resetId}/reset-password`
        : apiBase
    const opts =
      portal === "admin"
        ? {
            method: "POST",
            headers: { ...headers(), "Content-Type": "application/json" },
            body: JSON.stringify({ password: newPassword }),
          }
        : {
            method: "POST",
            headers: { ...headers(), "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reset_password", student_id: resetId, password: newPassword }),
          }
    await fetch(url, opts)
    setResetId(null)
    setNewPassword("")
    await load()
  }

  const saveSettings = async () => {
    await fetch(apiBase, {
      method: "PATCH",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: { auto_approve_accounts: autoApprove, platform_admin_notify_email: adminEmail },
      }),
    })
  }

  const pending = requests.filter((r) => r.status === "pending")
  const pendingSignups = pending.filter((r) => !isPasswordResetRequest(r))

  const filteredCampers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return campers
    return campers.filter((c) => {
      const hay = [c.full_name, c.email, c.student_id].map((v) => String(v ?? "").toLowerCase()).join(" ")
      return hay.includes(q)
    })
  }, [campers, searchTerm])

  const filteredRequests = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return requests.filter((r) => {
      if (requestFilter === "pending" && r.status !== "pending") return false
      if (requestFilter === "password_reset" && !isPasswordResetRequest(r)) return false
      if (requestFilter === "signup" && isPasswordResetRequest(r)) return false
      if (q) {
        const hay = [r.full_name, r.email, r.school_affiliation, r.organization]
          .map((v) => String(v ?? "").toLowerCase())
          .join(" ")
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [requests, searchTerm, requestFilter])

  const menuItems = [
    { id: "campers" as const, label: "Campers", icon: Users, badge: campers.length },
    {
      id: "requests" as const,
      label: "Requests",
      icon: Check,
      badge: pending.length || undefined,
      tone: pending.length > 0 ? ("warning" as const) : undefined,
    },
    ...(portal === "admin"
      ? [{ id: "settings" as const, label: "Settings", icon: Settings }]
      : []),
  ]

  const sidebar = (
    <FacultyModuleSideMenu
      moduleId="campers"
      title="Campers"
      activeId={activeMenu}
      onSelect={(id) => setActiveMenu(id as typeof activeMenu)}
      items={menuItems}
    />
  )

  const toolbarTrailing = (
    <div className="flex flex-wrap items-center gap-1.5">
      {activeMenu === "requests" && pendingSignups.length > 0 ? (
        <Button
          size="sm"
          className={cn("h-9 gap-1.5", fp.cta)}
          onClick={() => setApproveAllConfirmOpen(true)}
          disabled={approvingAll}
        >
          <Check className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{approvingAll ? "Approving…" : "Approve all"}</span>
        </Button>
      ) : null}
      <Button asChild variant="ghost" size="sm" className={facultyToolbarFilterButtonClass()}>
        <Link href={programsHref}>
          <BookOpen className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Programs</span>
        </Link>
      </Button>
    </div>
  )

  const isPanel = portal === "faculty"
  const panelSection = isPanel ? AM_PANEL_SECTION : undefined
  const panelScroll = isPanel ? AM_PANEL_SCROLL : undefined
  const emptyState = isPanel ? AM_EMPTY_FILL : AM_EMPTY

  const mainContent = (
    <div className={cn("min-w-0", isPanel ? cn(panelSection, "gap-3") : "flex-1 space-y-3")}>
      {activeMenu !== "settings" ? (
        <FacultyIntegratedToolbar
          moduleId="campers"
          search={searchTerm}
          onSearchChange={setSearchTerm}
          onSearchClear={() => setSearchTerm("")}
          searchPlaceholder={activeMenu === "campers" ? "Search campers…" : "Search requests…"}
          filters={
            activeMenu === "requests" ? (
              <Select
                value={requestFilter}
                onValueChange={(v) => setRequestFilter(v as typeof requestFilter)}
              >
                <SelectTrigger className={QB_SELECT_TRIGGER}>
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All requests</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="signup">New accounts</SelectItem>
                  <SelectItem value="password_reset">Password resets</SelectItem>
                </SelectContent>
              </Select>
            ) : undefined
          }
          meta={
            <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {activeMenu === "campers"
                ? filteredCampers.length === campers.length
                  ? `${filteredCampers.length} camper${filteredCampers.length === 1 ? "" : "s"}`
                  : `${filteredCampers.length} of ${campers.length} campers`
                : filteredRequests.length === requests.length
                  ? `${filteredRequests.length} request${filteredRequests.length === 1 ? "" : "s"}`
                  : `${filteredRequests.length} of ${requests.length} requests`}
            </span>
          }
          trailing={toolbarTrailing}
        />
      ) : (
        <div className="flex justify-end">
          <Button asChild variant="ghost" size="sm" className={facultyToolbarFilterButtonClass()}>
            <Link href={programsHref}>
              <BookOpen className="h-3.5 w-3.5 sm:mr-2" />
              <span className="hidden sm:inline">Programs & Trainings</span>
            </Link>
          </Button>
        </div>
      )}

      {activeMenu === "campers" ? (
        loading ? (
          <div className={cn(emptyState, !isPanel && "py-10")}>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--cc-accent)]" />
          </div>
        ) : filteredCampers.length === 0 ? (
          <div className={emptyState}>
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
              {campers.length === 0 ? "No approved campers yet." : "No campers match your search."}
            </p>
          </div>
        ) : (
          <div className={cn(isPanel ? cn(chrome.card, "divide-y divide-[var(--border)] overflow-hidden", panelScroll) : "space-y-2")}>
            {filteredCampers.map((c) => (
              <article key={String(c.id)} className={cn(AM_ROW, "items-center gap-3")}>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{String(c.full_name)}</p>
                  <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>
                    {String(c.email)} · ID {String(c.student_id)} · {String(c.enrollments ?? 0)} enrollment
                    {Number(c.enrollments ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className={facultyToolbarFilterButtonClass()}
                  onClick={() => setResetId(Number(c.id))}
                >
                  <KeyRound className="h-3.5 w-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Reset password</span>
                </Button>
              </article>
            ))}
          </div>
        )
      ) : activeMenu === "requests" ? (
        requests.length === 0 ? (
          <div className={emptyState}>
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No account or password reset requests.</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className={emptyState}>
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No requests match your filters.</p>
          </div>
        ) : (
          <div className={cn(isPanel ? cn(chrome.card, "divide-y divide-[var(--border)] overflow-hidden", panelScroll) : "space-y-2")}>
            {filteredRequests.map((r) => (
              <article key={String(r.id)} className={cn(AM_ROW, "gap-3")}>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>{String(r.full_name)}</p>
                    <Badge variant={r.status === "pending" ? "secondary" : "outline"} className="h-5 text-[10px]">
                      {String(r.status)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 text-[10px]",
                        isPasswordResetRequest(r)
                          ? "border-amber-500/40 text-amber-800 dark:text-amber-200"
                          : "border-[var(--cc-accent)]/30 text-[var(--cc-accent-dark)]",
                      )}
                    >
                      {requestTypeLabel(r)}
                    </Badge>
                  </div>
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{String(r.email)}</p>
                  {!isPasswordResetRequest(r) && (
                    <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>
                      {String(r.school_affiliation ?? r.organization ?? "")}
                    </p>
                  )}
                </div>
                {r.status === "pending" && (
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Button size="sm" className={cn("h-9", fp.cta)} onClick={() => void approve(Number(r.id))}>
                      <Check className="h-3.5 w-3.5 sm:mr-1" />
                      <span className="hidden sm:inline">{isPasswordResetRequest(r) ? "Approve" : "Approve"}</span>
                    </Button>
                    {portal === "admin" && (
                      <Button size="sm" variant="ghost" className={facultyToolbarFilterButtonClass()} onClick={() => void reject(Number(r.id))}>
                        <X className="h-3.5 w-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Reject</span>
                      </Button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )
      ) : (
        <div className={cn(AM_ROW, "max-w-md flex-col items-stretch gap-4", isPanel && panelScroll)}>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="autoApprove">Auto-approve new camper accounts</Label>
            <Switch id="autoApprove" checked={autoApprove} onCheckedChange={setAutoApprove} />
          </div>
          <div>
            <Label htmlFor="adminEmail">Admin notification email</Label>
            <Input id="adminEmail" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="mt-1" />
          </div>
          <Button className={fp.cta} onClick={() => void saveSettings()}>
            Save settings
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <div className={cn(isPanel ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "space-y-3")}>
      <FacultyModuleSplitLayout
        scrollMode={isPanel ? "panel" : "page"}
        className={isPanel ? "min-h-0 flex-1" : undefined}
        menu={sidebar}
      >
        {mainContent}
      </FacultyModuleSplitLayout>

      {resetId != null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-semibold">Reset camper password</h3>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" />
            <div className="flex gap-2">
              <Button onClick={() => void resetPassword()} disabled={newPassword.length < 8}>
                Reset
              </Button>
              <Button variant="outline" onClick={() => setResetId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={approveAllConfirmOpen} onOpenChange={setApproveAllConfirmOpen}>
        <AlertDialogContent className={campDialogContentClass}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-900 dark:text-dashboard-v2-fg">
              Approve all pending accounts?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-dashboard-v2-muted text-sm leading-relaxed">
              This will approve {pendingSignups.length} pending new account request
              {pendingSignups.length === 1 ? "" : "s"}. Password reset requests must be approved individually.
              Each student will be able to sign in with the password they chose when they registered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approvingAll} className={campDialogCancelClass}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={approvingAll}
              onClick={handleConfirmApproveAll}
              className={cn(campDialogActionClass, fp.cta)}
            >
              {approvingAll ? "Approving…" : "Approve all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={approveAllResult != null}
        onOpenChange={(open) => {
          if (!open) setApproveAllResult(null)
        }}
      >
        <AlertDialogContent className={campDialogContentClass}>
          <AlertDialogHeader>
            <AlertDialogTitle
              className={
                approveAllResult?.variant === "error"
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-700 dark:text-emerald-400"
              }
            >
              {approveAllResult?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 dark:text-dashboard-v2-muted text-base leading-relaxed">
              {approveAllResult?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setApproveAllResult(null)} className={cn(campDialogActionClass, fp.cta)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
