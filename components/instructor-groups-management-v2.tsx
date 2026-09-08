"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

import { useEffect, useState, useCallback, useMemo, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Users, Trash2, Crown, CheckCircle, XCircle, Clock, AlertCircle, ArrowLeft, RotateCcw, Archive, Download } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { uniqueSessionCodes } from "@/lib/unique-session-codes"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"

interface Group {
  id: number
  name: string
  session: string
  created_by: number
  leader_name: string
  member_count: number
  status: "pending" | "approved" | "rejected" | "pending_update"
  deleted_at?: string | null
  deleted_by?: string | null
  pending_changes?: {
    name?: string
    addMembers?: number[]
    removeMembers?: number[]
  }
  members: Array<{
    id: number
    student_id: string
    full_name: string
    joined_at: string
  }>
}

export function InstructorGroupsManagement({ embedInDashboard }: { embedInDashboard?: boolean } = {}) {
  const chrome = facultyEmbedChrome("groups")
  const cardBase = PORTAL_CARD
  const { toast } = useToast()
  const [groups, setGroups] = useState<Group[]>([])
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [activeMenu, setActiveMenu] = usePersistedState<"all" | "pending" | "approved" | "deleted">("groups-menu", "all")
  const [selectedSession, setSelectedSession] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false)
  const [membersDialogOpen, setMembersDialogOpen] = useState(false)
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [selectedMember, setSelectedMember] = useState<{ id: number; name: string } | null>(null)
  const [viewMode, setViewMode] = useState<"card" | "list">("card")
  const [isPending, startTransition] = useTransition()
  const [sessions, setSessions] = useState<string[]>([])
  const { courseScopeVersion } = useInstructorDashboardV2()

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await instructorApiFetch("/api/instructor/sessions", { headers: getInstructorScopeHeaders() })
        if (!response.ok) return
        const data = await response.json()
        const codes = uniqueSessionCodes(data.sessions || []).map((s: { code: string }) => s.code)
        setSessions(codes)
      } catch (error) {
        console.error("[Group Management] Failed to fetch sessions:", error)
      }
    }
    fetchSessions()
  }, [courseScopeVersion])

  const menuCounts = useMemo(() => {
    const allGroups = groups.filter(g => !g.deleted_at)
    return {
      all: allGroups.length,
      pending: allGroups.filter(g => g.status === "pending" || g.status === "pending_update").length,
      approved: allGroups.filter(g => g.status === "approved").length,
      deleted: groups.filter(g => g.deleted_at).length
    }
  }, [groups])

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedSession !== "all") {
        params.append("session", selectedSession)
      }
      
      // Map menu to status filter
      if (activeMenu === "pending") {
        params.append("status", "pending")
      } else if (activeMenu === "approved") {
        params.append("status", "approved")
      } else if (activeMenu === "deleted") {
        params.append("status", "deleted")
      }

      const url = `/api/groups${params.toString() ? `?${params.toString()}` : ''}`
      const [response, countsResponse] = await Promise.all([
        fetch(url, { headers: getInstructorScopeHeaders() }),
        fetch("/api/groups/counts", { headers: getInstructorScopeHeaders() }),
      ])
      const data = await response.json()
      setGroups(data.groups || [])
      if (countsResponse.ok) {
        const countsData = await countsResponse.json()
        setSessionCounts(countsData.counts || {})
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error)
      toast({
        title: "❌ Failed to Load Groups",
        description: "Could not retrieve group data from the database. Please refresh the page or check your connection.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [selectedSession, activeMenu, toast, courseScopeVersion])

  useEffect(() => {
    fetchGroups()
  }, [selectedSession, activeMenu, fetchGroups])

  const handleApproveGroup = async (groupId: number, groupName: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/approve`, {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to approve group")
      }

      toast({
        title: "✅ Group Approved",
        description: `Group "${groupName}" has been approved and is now active.`,
      })

      fetchGroups()
    } catch (error: any) {
      console.error("Failed to approve group:", error)
      toast({
        title: "❌ Failed to Approve Group",
        description: error.message || "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRejectGroup = async (groupId: number, groupName: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/reject`, {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to reject group")
      }

      toast({
        title: "❌ Group Rejected",
        description: `Group "${groupName}" has been rejected.`,
      })

      fetchGroups()
    } catch (error: any) {
      console.error("Failed to reject group:", error)
      toast({
        title: "❌ Failed to Reject Group",
        description: error.message || "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    setSelectedGroup(groups.find((g) => g.id === groupId) || null)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteGroup = async () => {
    if (!selectedGroup) return

    try {
      const response = await fetch(`/api/groups/${selectedGroup.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete group")
      }

      toast({
        title: "🗑️ Group Deleted",
        description: `Group "${selectedGroup.name}" has been moved to deleted items. You can restore it later if needed.`,
      })

      setDeleteDialogOpen(false)
      setSelectedGroup(null)
      fetchGroups()
    } catch (error: any) {
      console.error("Failed to delete group:", error)
      toast({
        title: "❌ Failed to Delete Group",
        description: error.message || "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRestoreGroup = async (groupId: number, groupName: string) => {
    setSelectedGroup(groups.find((g) => g.id === groupId) || null)
    setRestoreDialogOpen(true)
  }

  const confirmRestoreGroup = async () => {
    if (!selectedGroup) return

    try {
      const response = await fetch(`/api/groups/${selectedGroup.id}/restore`, {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to restore group")
      }

      toast({
        title: "✅ Group Restored",
        description: `Group "${selectedGroup.name}" has been restored successfully.`,
      })

      setRestoreDialogOpen(false)
      setSelectedGroup(null)
      fetchGroups()
    } catch (error: any) {
      console.error("Failed to restore group:", error)
      toast({
        title: "❌ Failed to Restore Group",
        description: error.message || "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleRemoveMember = async (groupId: number, studentId: number, studentName: string) => {
    setSelectedGroup(groups.find((g) => g.id === groupId) || null)
    setSelectedMember({ id: studentId, name: studentName })
    setRemoveMemberDialogOpen(true)
  }

  const confirmRemoveMember = async () => {
    if (!selectedGroup || !selectedMember) return

    try {
      const instructorSession = localStorage.getItem("instructorSession")
      const instructorId = localStorage.getItem("instructorId")
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        "x-instructor-id": instructorId || "",
      }
      if (instructorSession) headers["authorization"] = instructorSession

      const response = await fetch("/api/groups/remove-member", {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          groupId: selectedGroup.id,
          studentId: selectedMember.id,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to remove member")
      }

      toast({
        title: "👤 Member Removed",
        description: `${selectedMember.name} has been removed from the group.`,
      })

      setRemoveMemberDialogOpen(false)
      setSelectedGroup(null)
      setSelectedMember(null)
      fetchGroups()
    } catch (error: any) {
      console.error("Failed to remove member:", error)
      toast({
        title: "❌ Failed to Remove Member",
        description: error.message || "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleExportPDF = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedSession !== "all") {
        params.append("session", selectedSession)
      }
      
      if (activeMenu === "pending") {
        params.append("status", "pending")
      } else if (activeMenu === "approved") {
        params.append("status", "approved")
      } else if (activeMenu === "deleted") {
        params.append("status", "deleted")
      }

      const instructorSession = localStorage.getItem("instructorSession")
      const instructorId = localStorage.getItem("instructorId")
      
      const headers: HeadersInit = {
        "x-instructor-id": instructorId || "",
      }
      if (instructorSession) {
        headers["authorization"] = instructorSession
      }

      const url = `/api/groups/export${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url, { headers })

      if (!response.ok) {
        throw new Error("Failed to export groups")
      }

      // Download PDF
      const blob = await response.blob()
      const url_blob = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url_blob
      a.download = `groups-report-${selectedSession || "all"}-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url_blob)
      document.body.removeChild(a)

      toast({
        title: "✅ PDF Exported",
        description: "Groups report has been downloaded successfully.",
      })
    } catch (error: any) {
      console.error("Failed to export PDF:", error)
      toast({
        title: "❌ Export Failed",
        description: error.message || "Failed to export groups to PDF. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleClearAllGroups = async () => {
    try {
      const response = await fetch("/api/admin/groups/clear", {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to clear all groups")
      }

      const deletedCount = groups.length
      toast({
        title: "🗑️ All Groups Cleared",
        description: `Successfully deleted all ${deletedCount} groups.`,
      })

      setClearAllDialogOpen(false)
      fetchGroups()
    } catch (error: any) {
      console.error("Failed to clear all groups:", error)
      toast({
        title: "❌ Failed to Clear Groups",
        description: error.message || "Please try again.",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string, deleted_at?: string | null) => {
    if (deleted_at) {
      return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--sidebar-accent)]/60 text-[var(--cc-text-muted)]">
          <Archive className="h-3 w-3" aria-hidden />
          Deleted
        </span>
      )
    }

    switch (status) {
      case "approved":
        return (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--cc-sem-success)]/15 text-[var(--cc-sem-success)]">
            <CheckCircle className="h-3 w-3" aria-hidden />
            Approved
          </span>
        )
      case "pending":
        return (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--cc-sem-warning)]/15 text-[var(--cc-sem-warning)]">
            <Clock className="h-3 w-3" aria-hidden />
            Pending
          </span>
        )
      case "pending_update":
        return (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--cc-sem-warning)]/15 text-[var(--cc-sem-warning)]">
            <AlertCircle className="h-3 w-3" aria-hidden />
            Update
          </span>
        )
      case "rejected":
        return (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--cc-sem-danger)]/15 text-[var(--cc-sem-danger)]">
            <XCircle className="h-3 w-3" aria-hidden />
            Rejected
          </span>
        )
      default:
        return null
    }
  }

  const groupCardMeta = (group: Group) =>
    `${group.session} · ${group.leader_name} · ${group.member_count} member${group.member_count !== 1 ? "s" : ""}`

  const cardActionClass =
    "h-7 w-7 text-[var(--cc-text-muted)] hover:bg-[var(--sidebar-accent)]/60 hover:text-[var(--cc-text)]"

  const filteredGroups = useMemo(() => {
    let filtered = groups
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (g) =>
          g.name.toLowerCase().includes(query) ||
          g.leader_name.toLowerCase().includes(query) ||
          g.session.toLowerCase().includes(query) ||
          g.members?.some(
            (m) =>
              m.full_name.toLowerCase().includes(query) ||
              m.student_id.toLowerCase().includes(query),
          ),
      )
    }
    return filtered
  }, [groups, searchQuery])

  const activeMenuLabel =
    activeMenu === "all"
      ? "all"
      : activeMenu === "pending"
        ? "pending"
        : activeMenu === "approved"
          ? "approved"
          : "deleted"

  const renderPendingChanges = (group: Group) => {
    if (!group.pending_changes || group.deleted_at) return null

    const changes = group.pending_changes
    const hasChanges = changes.name || changes.addMembers?.length || changes.removeMembers?.length

    if (!hasChanges) return null

    return (
      <div className="mt-2 rounded-lg border border-[var(--cc-sem-warning)]/25 bg-[var(--cc-sem-warning)]/10 p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--cc-sem-warning)]">Pending changes</p>
        <ul className={cn("mt-1 space-y-0.5 text-xs", PORTAL_TEXT_MUTED)}>
          {changes.name && (
            <li>
              Name: <span className={cn("font-medium", PORTAL_TEXT)}>{changes.name}</span>
            </li>
          )}
          {changes.addMembers && changes.addMembers.length > 0 && (
            <li>+{changes.addMembers.length} member{changes.addMembers.length !== 1 ? "s" : ""}</li>
          )}
          {changes.removeMembers && changes.removeMembers.length > 0 && (
            <li>−{changes.removeMembers.length} member{changes.removeMembers.length !== 1 ? "s" : ""}</li>
          )}
        </ul>
      </div>
    )
  }

  const renderGroupActions = (group: Group) => (
    <div className="flex items-center justify-end gap-0.5">
      {group.members && group.members.length > 0 && group.status === "approved" && !group.deleted_at ? (
        <Button
          variant="ghost"
          size="icon"
          className={cardActionClass}
          onClick={() => {
            setSelectedGroup(group)
            setMembersDialogOpen(true)
          }}
          title="Manage members"
        >
          <Users className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      {group.deleted_at ? (
        <Button
          variant="ghost"
          size="icon"
          className={cardActionClass}
          onClick={() => handleRestoreGroup(group.id, group.name)}
          title="Restore group"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <>
          {(group.status === "pending" || group.status === "pending_update") && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--cc-sem-success)] hover:bg-[var(--cc-sem-success)]/10"
                onClick={() => handleApproveGroup(group.id, group.name)}
                title="Approve"
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--cc-sem-danger)] hover:bg-[var(--cc-sem-danger)]/10"
                onClick={() => handleRejectGroup(group.id, group.name)}
                title="Reject"
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--cc-text-muted)] hover:bg-[var(--cc-sem-danger)]/10 hover:text-[var(--cc-sem-danger)]"
            onClick={() => handleDeleteGroup(group.id, group.name)}
            title="Delete group"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  )

  const renderGroupMembersSummary = (group: Group) => {
    if (group.deleted_at || !group.members?.length) return null

    return (
      <p className={cn("line-clamp-2 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
        {group.members.slice(0, 5).map((member, index) => (
          <span key={member.id}>
            {index > 0 ? ", " : null}
            {member.id === group.created_by ? (
              <span className="inline-flex items-center gap-0.5">
                <Crown className="h-3 w-3 text-[var(--cc-sem-warning)]" aria-hidden />
                {member.full_name}
              </span>
            ) : (
              member.full_name
            )}
          </span>
        ))}
        {group.members.length > 5 ? ` +${group.members.length - 5} more` : null}
      </p>
    )
  }

  const renderGroupCard = (group: Group) => (
    <article
      key={group.id}
      className={cn(
        cardBase,
        "flex flex-col overflow-hidden transition-colors hover:border-[var(--cc-accent)]/25",
        group.deleted_at && "opacity-75",
      )}
    >
      <div className="flex flex-1 gap-3 p-4">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", chrome.p.softBg)}>
          <Users className={cn("h-5 w-5", chrome.p.iconText)} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className={cn("truncate text-sm font-semibold leading-snug", PORTAL_TEXT)} title={group.name}>
                {group.name}
              </h3>
              <p className={cn("mt-0.5 line-clamp-1 text-xs", PORTAL_TEXT_MUTED)}>{groupCardMeta(group)}</p>
            </div>
            {getStatusBadge(group.status, group.deleted_at)}
          </div>
          {renderGroupMembersSummary(group)}
          {renderPendingChanges(group)}
        </div>
      </div>

      <div className="border-t border-[var(--border)]/60 px-2 py-1.5">{renderGroupActions(group)}</div>
    </article>
  )

  const renderGroupListItem = (group: Group) => (
    <article
      key={group.id}
      className={cn(
        cardBase,
        "flex flex-col gap-3 p-3 transition-colors hover:border-[var(--cc-accent)]/25 sm:flex-row sm:items-center sm:gap-4 sm:p-4",
        group.deleted_at && "opacity-75",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={cn("truncate text-sm font-semibold", PORTAL_TEXT)} title={group.name}>
            {group.name}
          </h3>
          {getStatusBadge(group.status, group.deleted_at)}
        </div>
        <p className={cn("mt-0.5 line-clamp-1 text-xs", PORTAL_TEXT_MUTED)}>{groupCardMeta(group)}</p>
        {renderGroupMembersSummary(group)}
        {renderPendingChanges(group)}
      </div>
      <div className="shrink-0 border-t border-[var(--border)]/60 pt-2 sm:border-0 sm:pt-0">{renderGroupActions(group)}</div>
    </article>
  )

  if (loading) {
    return (
      <div
        className={
          embedInDashboard
            ? "flex min-h-0 w-full min-w-0 flex-1 items-center justify-center"
            : "flex items-center justify-center py-12"
        }
      >
        <div className={cn("flex items-center gap-3 text-sm", PORTAL_TEXT_MUTED)}>
          <div className="size-5 animate-spin rounded-full border-2 border-[var(--cc-accent)] border-t-transparent" aria-hidden />
          Loading groups…
        </div>
      </div>
    )
  }

  return (
    <div
      className={
        embedInDashboard
          ? "flex min-h-0 w-full min-w-0 flex-1 flex-col"
          : "w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6"
      }
    >
      {!embedInDashboard && (
        <div className="flex justify-end mb-4">
          <Link href="/instructor/dashboard">
            <Button
              variant="outline"
              className="border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      )}

      <FacultyModuleSplitLayout
        scrollMode={embedInDashboard ? "panel" : "page"}
        className={embedInDashboard ? "min-h-0 flex-1" : undefined}
        menu={
          <FacultyModuleSideMenu
            moduleId="groups"
            title="Groups"
            activeId={activeMenu}
            onSelect={(id) => startTransition(() => setActiveMenu(id as typeof activeMenu))}
            items={[
              { id: "all", label: "All", icon: Users, badge: menuCounts.all },
              { id: "pending", label: "Pending", icon: Clock, badge: menuCounts.pending },
              { id: "approved", label: "Approved", icon: CheckCircle, badge: menuCounts.approved },
              { id: "deleted", label: "Deleted", icon: Archive, badge: menuCounts.deleted, tone: "destructive" },
            ]}
          />
        }
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-6">
          <div className="shrink-0">
            <FacultyIntegratedToolbar
            moduleId="groups"
            search={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by name, leader, or member…"
            viewMode={viewMode === "card" ? "grid" : "list"}
            onViewModeChange={(mode) => setViewMode(mode === "grid" ? "card" : "list")}
            filters={
              <Select
                value={selectedSession}
                onValueChange={(value) => startTransition(() => setSelectedSession(value))}
              >
                <SelectTrigger
                  className={cn(
                    facultyToolbarFilterButtonClass(selectedSession !== "all"),
                    "h-9 w-auto min-w-[8.5rem] gap-1.5 border-0 shadow-none focus:ring-1 focus:ring-[var(--cc-accent)]/35",
                  )}
                >
                  <SelectValue placeholder="Session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sessions</SelectItem>
                  {sessions.map((session) => (
                    <SelectItem key={session} value={session}>
                      {session} ({sessionCounts[session] || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
            trailing={
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportPDF}
                className={facultyToolbarFilterButtonClass()}
              >
                <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            }
            meta={
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-xs text-[var(--cc-text-muted)]">
                  {filteredGroups.length === groups.length ? (
                    <>
                      <span className="font-medium text-[var(--cc-text-secondary)] tabular-nums">
                        {filteredGroups.length}
                      </span>
                      {" "}group{filteredGroups.length === 1 ? "" : "s"}
                      {activeMenu !== "all" ? ` · ${activeMenuLabel}` : null}
                      {selectedSession !== "all" ? (
                        <>
                          {" "}·{" "}
                          <span>{selectedSession}</span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      Showing{" "}
                      <span className="font-medium text-[var(--cc-text-secondary)] tabular-nums">
                        {filteredGroups.length}
                      </span>
                      {" "}of{" "}
                      <span className="tabular-nums">{groups.length}</span>
                    </>
                  )}
                </p>
                {searchQuery ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="h-7 px-2 text-xs text-[var(--cc-text-muted)] hover:text-[var(--cc-text)]"
                  >
                    Clear search
                  </Button>
                ) : null}
              </div>
            }
          />
          </div>

          {/* Groups Content */}
          <div className="flex min-h-0 flex-1 flex-col">
            {isPending && (
              <div className={cn("flex flex-1 items-center justify-center text-sm", PORTAL_TEXT_MUTED)}>
                Loading…
              </div>
            )}
            {!isPending && filteredGroups.length === 0 ? (
              <div
                className={cn(
                  cardBase,
                  "flex min-h-0 flex-1 flex-col items-center justify-center border-dashed px-6 py-12 text-center sm:px-8",
                )}
              >
                <Users className={cn("mx-auto mb-3 h-10 w-10", PORTAL_TEXT_MUTED)} />
                <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
                  {activeMenu === "deleted"
                    ? "No deleted groups"
                    : activeMenu === "pending"
                      ? "No pending groups"
                      : activeMenu === "approved"
                        ? "No approved groups"
                        : searchQuery
                          ? "No groups match your search"
                          : "No groups found"}
                </p>
                <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
                  {searchQuery || selectedSession !== "all"
                    ? "Try adjusting your filters"
                    : "Groups appear here when students create them"}
                </p>
              </div>
            ) : !isPending && viewMode === "card" ? (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
                  {filteredGroups.map(renderGroupCard)}
                </div>
              </div>
            ) : !isPending ? (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {filteredGroups.map(renderGroupListItem)}
              </div>
            ) : null}
          </div>
        </div>
      </FacultyModuleSplitLayout>

      {/* Delete Group Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-red-500/10 p-2">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-800 dark:text-slate-100">Delete Group</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to delete "{selectedGroup?.name}"? This will move it to deleted items. You can restore it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 dark:text-slate-200 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGroup}
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Group Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/40 dark:to-indigo-950/30">
                <RotateCcw className="h-5 w-5 text-blue-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-800 dark:text-slate-100">Restore Group</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to restore "{selectedGroup?.name}"? It will be moved back to active groups.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 dark:text-slate-200 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRestoreGroup}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 rounded-xl"
            >
              Restore Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Members Dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedGroup?.name}</DialogTitle>
            <DialogDescription>Remove members from this approved group.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {selectedGroup?.members?.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--sidebar-accent)]/40"
              >
                <div className="min-w-0">
                  <p className={cn("truncate text-sm", PORTAL_TEXT)}>
                    {member.id === selectedGroup.created_by ? (
                      <span className="inline-flex items-center gap-1">
                        <Crown className="h-3.5 w-3.5 text-[var(--cc-sem-warning)]" aria-hidden />
                        {member.full_name}
                      </span>
                    ) : (
                      member.full_name
                    )}
                  </p>
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{member.student_id}</p>
                </div>
                {member.id !== selectedGroup.created_by ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-[var(--cc-sem-danger)] hover:bg-[var(--cc-sem-danger)]/10"
                    onClick={() => {
                      if (!selectedGroup) return
                      handleRemoveMember(selectedGroup.id, member.id, member.full_name)
                      setMembersDialogOpen(false)
                    }}
                    title={`Remove ${member.full_name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <AlertDialog open={removeMemberDialogOpen} onOpenChange={setRemoveMemberDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-red-500/10 p-2">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-800 dark:text-slate-100">Remove Member</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to remove {selectedMember?.name} from this group?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 dark:text-slate-200 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveMember}
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Groups Dialog */}
      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-red-500/10 p-2">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-800 dark:text-slate-100">Clear All Groups</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
              Are you sure you want to delete ALL groups? This action cannot be undone and will permanently remove all groups and their members from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 dark:text-slate-200 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllGroups}
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
            >
              Clear All Groups
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}



