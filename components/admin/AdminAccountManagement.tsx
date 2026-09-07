"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  KeyRound,
  UserPlus,
  Shield,
  Users,
  UserCog,
  Loader2,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Lock,
  Mail,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { dashboardV2PageStackClass } from "@/lib/dashboard-v2-layout"
import type { LucideIcon } from "lucide-react"
import { getAdminData } from "@/lib/auth"
import { cn } from "@/lib/utils"
import {
  STUDENT_ROSTER_DEFAULT_PASSWORD,
  STUDENT_ROSTER_DEFAULT_PASSWORD_ECE2202,
} from "@/lib/student-roster-default-password"

type PasswordResetRequest = {
  id: number
  student_id: number
  student_number: string
  full_name: string
  section: string
  email: string | null
  status: string
  requested_at: string
  reviewed_at: string | null
  admin_notes: string | null
  is_platform_guest?: boolean
}

type AccountRequest = {
  id: number
  full_name: string
  student_id: string
  section: string | null
  email: string | null
  status: string
  created_at: string
  request_kind?: string
  account_type?: string | null
  guest_purpose?: string | null
  guest_purpose_detail?: string | null
  organization?: string | null
  faculty_job_title?: string | null
  rejection_reason?: string | null
  email_verified_at?: string | null
  camp_id?: number | null
  sponsoring_faculty_id?: number | null
}

type AccountTab = "resets" | "requests" | "config" | "security"

function QueueStatSegment({
  active,
  onClick,
  label,
  value,
  description,
  icon: Icon,
  iconBg,
  iconColor,
  badges,
  loading,
}: {
  active: boolean
  onClick: () => void
  label: string
  value: number
  description: string
  icon: LucideIcon
  iconBg: string
  iconColor: string
  badges?: Array<{ label: string; count: number }>
  loading?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5 text-left transition-colors",
        "hover:bg-slate-50/80 dark:hover:bg-white/[0.03]",
        active && "bg-violet-50/70 dark:bg-violet-950/25",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p
            className={cn(
              "mt-1 text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white",
              !loading && value > 0 && "text-violet-700 dark:text-violet-300",
            )}
          >
            {loading ? "—" : value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground leading-snug">{description}</p>
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.08] transition-transform group-hover:scale-105",
            iconBg,
          )}
        >
          <Icon className={cn("h-5 w-5", iconColor)} strokeWidth={2} />
        </div>
      </div>
      {badges && badges.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200/80 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
            >
              {badge.label}
              <span className="tabular-nums text-slate-900 dark:text-white">{badge.count}</span>
            </span>
          ))}
        </div>
      ) : null}
    </button>
  )
}

function statusBadge(status: string) {
  const s = status.toLowerCase()
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    completed: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  }
  return (
    <Badge variant="secondary" className={cn("capitalize", map[s] ?? "")}>
      {status}
    </Badge>
  )
}

export function AdminAccountManagement() {
  const { toast } = useToast()
  const headers = useMemo(() => buildAdminApiHeaders(), [])

  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([])
  const [accountRequests, setAccountRequests] = useState<AccountRequest[]>([])
  const [loadingResets, setLoadingResets] = useState(true)
  const [loadingAccounts, setLoadingAccounts] = useState(true)

  const [resetFilter, setResetFilter] = useState("pending")
  const [resetSearch, setResetSearch] = useState("")
  const [accountFilter, setAccountFilter] = useState("pending")
  const [accountTypeFilter, setAccountTypeFilter] = useState("all")
  const [accountSearch, setAccountSearch] = useState("")
  const [accountLoadError, setAccountLoadError] = useState<string | null>(null)

  const [selectedReset, setSelectedReset] = useState<PasswordResetRequest | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<AccountRequest | null>(null)
  const [reviewNotes, setReviewNotes] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [reviewing, setReviewing] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [activeTab, setActiveTab] = useState<AccountTab>("requests")

  const fetchResets = useCallback(async () => {
    setLoadingResets(true)
    try {
      const res = await fetch("/api/admin/password-resets", { headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setResetRequests(data.requests ?? [])
    } catch (e) {
      toast({
        title: "Could not load password resets",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoadingResets(false)
    }
  }, [headers, toast])

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    setAccountLoadError(null)
    try {
      const params = new URLSearchParams()
      if (accountFilter !== "all") params.set("status", accountFilter)
      if (accountTypeFilter !== "all") params.set("accountType", accountTypeFilter)
      const qs = params.toString()
      const res = await fetch(`/api/admin/account-requests${qs ? `?${qs}` : ""}`, { headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setAccountRequests(Array.isArray(data.requests) ? data.requests : [])
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error"
      setAccountRequests([])
      setAccountLoadError(message)
      toast({
        title: "Could not load account requests",
        description: message,
        variant: "destructive",
      })
    } finally {
      setLoadingAccounts(false)
    }
  }, [headers, toast, accountFilter, accountTypeFilter])

  useEffect(() => {
    void fetchResets()
    void fetchAccounts()
  }, [fetchResets, fetchAccounts])

  const queueStats = useMemo(() => {
    const pendingResetList = resetRequests.filter((r) => r.status === "pending")
    const pendingAccountList = accountRequests.filter((r) => r.status === "pending")
    const guestPending = pendingAccountList.filter(
      (r) => r.request_kind === "guest" || r.request_kind === "summer_student",
    ).length
    const facultyPending = pendingAccountList.filter((r) => r.request_kind === "faculty").length
    const rosterPending = pendingAccountList.filter(
      (r) =>
        r.request_kind !== "guest" &&
        r.request_kind !== "faculty" &&
        r.request_kind !== "summer_student",
    ).length
    return {
      pendingResets: pendingResetList.length,
      pendingAccounts: pendingAccountList.length,
      totalNeedsAction: pendingResetList.length + pendingAccountList.length,
      guestPending,
      facultyPending,
      rosterPending,
    }
  }, [resetRequests, accountRequests])

  const kpiLoading = loadingResets || loadingAccounts

  const filteredResets = useMemo(() => {
    let list = resetRequests
    if (resetFilter !== "all") list = list.filter((r) => r.status === resetFilter)
    const q = resetSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          r.student_number.toLowerCase().includes(q) ||
          (r.email?.toLowerCase().includes(q) ?? false),
      )
    }
    return list
  }, [resetRequests, resetFilter, resetSearch])

  const filteredAccounts = useMemo(() => {
    let list = accountRequests
    if (accountFilter !== "all") list = list.filter((r) => r.status === accountFilter)
    if (accountTypeFilter !== "all") {
      list = list.filter((r) => {
        const type =
          r.account_type ??
          (r.request_kind === "guest"
            ? "career_member"
            : r.request_kind === "faculty"
              ? "faculty"
              : r.request_kind === "summer_student" || r.request_kind === "summer_camper"
                ? "summer_student"
                : "student")
        return type === accountTypeFilter
      })
    }
    const q = accountSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          r.student_id.toLowerCase().includes(q) ||
          (r.email?.toLowerCase().includes(q) ?? false),
      )
    }
    return list
  }, [accountRequests, accountFilter, accountTypeFilter, accountSearch])

  const approveReset = async () => {
    if (!selectedReset) return
    const admin = getAdminData()
    setReviewing(true)
    try {
      const res = await fetch(`/api/admin/password-resets/${selectedReset.id}/approve`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: admin?.id, notes: reviewNotes }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || data.details || "Approve failed")
      toast({
        title: "Password reset approved",
        description:
          data.emailSent === true
            ? `${selectedReset.full_name} was emailed a temporary password.`
            : `Approved for ${selectedReset.full_name}. Share the course default password if email was not sent.`,
      })
      setSelectedReset(null)
      setReviewNotes("")
      void fetchResets()
    } catch (e) {
      toast({
        title: "Approval failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setReviewing(false)
    }
  }

  const rejectReset = async () => {
    if (!selectedReset) return
    const admin = getAdminData()
    setReviewing(true)
    try {
      const res = await fetch(`/api/admin/password-resets/${selectedReset.id}/reject`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: admin?.id, notes: reviewNotes }),
      })
      if (!res.ok) throw new Error("Reject failed")
      toast({ title: "Request rejected" })
      setSelectedReset(null)
      setReviewNotes("")
      void fetchResets()
    } catch (e) {
      toast({
        title: "Rejection failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setReviewing(false)
    }
  }

  const approveAccount = async () => {
    if (!selectedAccount) return
    setReviewing(true)
    try {
      const res = await fetch(`/api/admin/account-requests/${selectedAccount.id}/approve`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Approve failed")
      toast({
        title: "Account approved",
        description:
          selectedAccount.request_kind === "guest"
            ? String(data.message ?? "Guest can sign in with their submitted credentials.")
            : selectedAccount.request_kind === "faculty"
              ? String(data.message ?? "Faculty member can sign in at the faculty portal.")
              : `${selectedAccount.full_name} can sign in with the roster default password.`,
      })
      setSelectedAccount(null)
      void fetchAccounts()
    } catch (e) {
      toast({
        title: "Approval failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setReviewing(false)
    }
  }

  const rejectAccount = async () => {
    if (!selectedAccount) return
    setReviewing(true)
    try {
      const res = await fetch(`/api/admin/account-requests/${selectedAccount.id}/reject`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Reject failed")
      toast({ title: "Account request rejected" })
      setSelectedAccount(null)
      setRejectionReason("")
      void fetchAccounts()
    } catch (e) {
      toast({
        title: "Rejection failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setReviewing(false)
    }
  }

  const changeAdminPassword = async () => {
    const admin = getAdminData()
    if (!admin?.id) {
      toast({ title: "Not signed in", variant: "destructive" })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" })
      return
    }
    setChangingPassword(true)
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: admin.id,
          currentPassword,
          newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      toast({ title: "Admin password updated" })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (e) {
      toast({
        title: "Could not change password",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className={cn("max-w-[1600px]", dashboardV2PageStackClass)}>
      <div className="rounded-2xl border border-slate-200/80 bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.04] shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                <KeyRound className="h-6 w-6 shrink-0" />
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  Account Management
                </h1>
              </div>
              {!kpiLoading && queueStats.totalNeedsAction > 0 ? (
                <Badge
                  variant="secondary"
                  className="rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 tabular-nums"
                >
                  {queueStats.totalNeedsAction} pending
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Review password resets and new account requests, configure roster defaults, and manage
              platform admin credentials.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" className="rounded-xl h-8" asChild>
              <Link href="/admin/dashboard-v2/administration/roles-permissions">
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                Roles
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl h-8" asChild>
              <Link href="/admin/dashboard-v2/management/students">
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Students
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl h-8" asChild>
              <Link href="/admin/dashboard-v2/management/faculty">
                <UserCog className="h-3.5 w-3.5 mr-1.5" />
                Faculty
              </Link>
            </Button>
          </div>
        </div>

        <div
          className="border-t border-slate-200/80 dark:border-white/[0.08] grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 dark:divide-white/[0.08]"
        >
          <QueueStatSegment
            active={activeTab === "resets"}
            onClick={() => setActiveTab("resets")}
            label="Password resets"
            value={queueStats.pendingResets}
            description="Pending student and guest password resets"
            icon={KeyRound}
            iconBg="bg-violet-500/10"
            iconColor="text-violet-600 dark:text-violet-400"
            loading={kpiLoading}
          />
          <QueueStatSegment
            active={activeTab === "requests"}
            onClick={() => {
              setActiveTab("requests")
              void fetchAccounts()
            }}
            label="Account requests"
            value={queueStats.pendingAccounts}
            description="Roster enrollments, Career Members, and faculty signups"
            icon={UserPlus}
            iconBg="bg-sky-500/10"
            iconColor="text-sky-600 dark:text-sky-400"
            loading={kpiLoading}
            badges={[
              { label: "Career Member", count: queueStats.guestPending },
              { label: "Faculty", count: queueStats.facultyPending },
              { label: "Roster", count: queueStats.rosterPending },
            ]}
          />
        </div>
      </div>

      <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const next = v as AccountTab
            setActiveTab(next)
            if (next === "requests") void fetchAccounts()
          }}
          className="space-y-4"
        >
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 rounded-xl">
          <TabsTrigger value="resets" className="rounded-lg gap-2">
            Password resets
            {!kpiLoading && queueStats.pendingResets > 0 ? (
              <Badge
                variant="secondary"
                className="h-5 min-w-5 px-1.5 tabular-nums bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
              >
                {queueStats.pendingResets}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="requests" className="rounded-lg gap-2">
            Account requests
            {!kpiLoading && queueStats.pendingAccounts > 0 ? (
              <Badge
                variant="secondary"
                className="h-5 min-w-5 px-1.5 tabular-nums bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
              >
                {queueStats.pendingAccounts}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="config" className="rounded-lg">Configuration</TabsTrigger>
          <TabsTrigger value="security" className="rounded-lg">Admin security</TabsTrigger>
        </TabsList>

        <TabsContent value="resets">
          <Card className="border-slate-200/80 dark:border-white/10">
            <CardHeader>
              <CardTitle className="text-base">Password reset queue</CardTitle>
              <CardDescription>
                Students and Career Members who requested a password reset.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search name, ID, email…"
                    value={resetSearch}
                    onChange={(e) => setResetSearch(e.target.value)}
                  />
                </div>
                <Select value={resetFilter} onValueChange={setResetFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loadingResets ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                </div>
              ) : filteredResets.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">No requests found.</p>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResets.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-medium">{r.full_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.student_number} · {r.section}
                              {r.is_platform_guest ? " · Guest" : ""}
                            </div>
                          </TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(r.requested_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.status === "pending" ? (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedAccount(null)
                                  setRejectionReason("")
                                  setReviewNotes("")
                                  setSelectedReset(r)
                                }}
                              >
                                Review
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card className="border-slate-200/80 dark:border-white/10">
            <CardHeader>
              <CardTitle className="text-base">New account requests</CardTitle>
              <CardDescription>
                Roster enrollments, Career Members, and faculty signup requests awaiting approval.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search name, ID, email…"
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                  />
                </div>
                <Select value={accountFilter} onValueChange={setAccountFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Account type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="faculty">Faculty</SelectItem>
                    <SelectItem value="student">Students</SelectItem>
                    <SelectItem value="career_member">Career Members</SelectItem>
                    <SelectItem value="summer_student">Summer Students</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loadingAccounts ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                </div>
              ) : accountLoadError ? (
                <p className="text-center text-sm text-destructive py-10">{accountLoadError}</p>
              ) : filteredAccounts.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">No requests found.</p>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Applicant</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAccounts.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-medium">{r.full_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.student_id}
                              {r.email ? ` · ${r.email}` : ""}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {r.request_kind === "guest"
                                ? "Career Member"
                                : r.request_kind === "faculty"
                                  ? "Faculty"
                                  : "Roster"}
                            </Badge>
                          </TableCell>
                          <TableCell>{statusBadge(r.status)}</TableCell>
                          <TableCell className="text-right">
                            {r.status === "pending" ? (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedReset(null)
                                  setReviewNotes("")
                                  setRejectionReason("")
                                  setSelectedAccount(r)
                                }}
                              >
                                Review
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-slate-200/80 dark:border-white/10">
              <CardHeader>
                <CardTitle className="text-base">Default roster passwords</CardTitle>
                <CardDescription>
                  First-login passwords applied when approving roster requests or resetting passwords
                  (by course).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between rounded-lg border px-3 py-2">
                  <span>ELEG / default courses</span>
                  <code className="font-mono text-violet-700 dark:text-violet-300">
                    {STUDENT_ROSTER_DEFAULT_PASSWORD}
                  </code>
                </div>
                <div className="flex justify-between rounded-lg border px-3 py-2">
                  <span>ECE 2202</span>
                  <code className="font-mono text-violet-700 dark:text-violet-300">
                    {STUDENT_ROSTER_DEFAULT_PASSWORD_ECE2202}
                  </code>
                </div>
                <p className="text-xs text-muted-foreground flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Students should change their password after first login. Career Member accounts use the
                  password they submit on the registration form.
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 dark:border-white/10">
              <CardHeader>
                <CardTitle className="text-base">Account workflows</CardTitle>
                <CardDescription>Where to manage users and roles.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  {
                    href: "/admin/dashboard-v2/administration/roles-permissions",
                    label: "Roles & Permissions",
                    desc: "Assign platform, faculty, and course roles",
                  },
                  {
                    href: "/admin/dashboard-v2/management/students",
                    label: "Student roster",
                    desc: "Import, enroll, and bulk operations",
                  },
                  {
                    href: "/admin/dashboard-v2/management/faculty",
                    label: "Faculty accounts",
                    desc: "Instructors, teaching assistants, and department admins",
                  },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between rounded-lg border px-3 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <Card className="border-slate-200/80 dark:border-white/10 max-w-lg">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Change platform admin password
              </CardTitle>
              <CardDescription>
                Updates your signed-in admin account. Minimum 8 characters with a number and special
                character.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Current password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <Label>New password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label>Confirm new password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button onClick={() => void changeAdminPassword()} disabled={changingPassword}>
                {changingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Update password"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!selectedReset}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedReset(null)
            setReviewNotes("")
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[min(90dvh,720px)] overflow-y-auto">
          <DialogHeader className="space-y-2 pb-1">
            <DialogTitle>Review password reset</DialogTitle>
            <DialogDescription>
              {selectedReset?.full_name} ({selectedReset?.student_number})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm pt-1">
            <div className="space-y-2">
              {selectedReset?.email && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  {selectedReset.email}
                </p>
              )}
              <p className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                {selectedReset && new Date(selectedReset.requested_at).toLocaleString()}
              </p>
            </div>
            <div className="space-y-2 border-t border-slate-200/80 pt-4 dark:border-white/10">
              <Label className="text-sm font-medium">Admin notes (optional)</Label>
              <Textarea
                className="mt-0 min-h-[100px]"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Internal notes for this decision…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" onClick={() => void rejectReset()} disabled={reviewing}>
              <XCircle className="h-4 w-4 mr-1.5" />
              Reject
            </Button>
            <Button onClick={() => void approveReset()} disabled={reviewing}>
              {reviewing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Approve
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedAccount}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedAccount(null)
            setRejectionReason("")
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[min(90dvh,720px)] overflow-y-auto">
          <DialogHeader className="space-y-2 pb-1">
            <DialogTitle>Review account request</DialogTitle>
            <DialogDescription>{selectedAccount?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm pt-1">
            <div className="space-y-2">
              <p>
                <span className="text-muted-foreground">ID:</span> {selectedAccount?.student_id}
              </p>
              {selectedAccount?.section && (
                <p>
                  <span className="text-muted-foreground">Section:</span> {selectedAccount.section}
                </p>
              )}
              {selectedAccount?.email && (
                <p>
                  <span className="text-muted-foreground">Email:</span> {selectedAccount.email}
                </p>
              )}
              {selectedAccount?.request_kind === "guest" && (
                <>
                  <p>
                    <span className="text-muted-foreground">Purpose:</span>{" "}
                    {selectedAccount.guest_purpose ?? "—"}
                  </p>
                  {selectedAccount.organization && (
                    <p>
                      <span className="text-muted-foreground">Organization:</span>{" "}
                      {selectedAccount.organization}
                    </p>
                  )}
                </>
              )}
              {selectedAccount?.request_kind === "faculty" && (
                <>
                  <p>
                    <span className="text-muted-foreground">Username:</span> {selectedAccount.student_id}
                  </p>
                  {selectedAccount.organization && (
                    <p>
                      <span className="text-muted-foreground">Institution:</span>{" "}
                      {selectedAccount.organization}
                    </p>
                  )}
                  {selectedAccount.faculty_job_title && (
                    <p>
                      <span className="text-muted-foreground">Title:</span>{" "}
                      {selectedAccount.faculty_job_title}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="space-y-2 border-t border-slate-200/80 pt-4 dark:border-white/10">
              <Label className="text-sm font-medium">Rejection reason (if rejecting)</Label>
              <Textarea
                className="mt-0 min-h-[100px]"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Optional reason sent to applicant…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" onClick={() => void rejectAccount()} disabled={reviewing}>
              Reject
            </Button>
            <Button onClick={() => void approveAccount()} disabled={reviewing}>
              {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
