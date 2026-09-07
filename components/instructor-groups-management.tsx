"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { Users, Trash2, Crown, CheckCircle, XCircle, Clock, AlertCircle, ArrowLeft, Filter, LayoutGrid, List, Search, FileDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"

interface Group {
  id: number
  name: string
  session: string
  created_by: number
  leader_name: string
  member_count: number
  status: "pending" | "approved" | "rejected" | "pending_update"
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

export function InstructorGroupsManagement() {
  const { toast } = useToast()
  const [groups, setGroups] = useState<Group[]>([])
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false)
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [selectedMember, setSelectedMember] = useState<{ id: number; name: string } | null>(null)
  const [viewMode, setViewMode] = useState<"card" | "list">("card")
  const [sessions, setSessions] = useState<string[]>(["all"])

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/sessions")
      if (!response.ok) throw new Error("Failed to fetch sessions")
      const data = await response.json()
      const sessionCodes = data.sessions?.map((s: any) => s.code) || []
      setSessions(["all", ...sessionCodes])
    } catch (error) {
      console.error("[Groups Management] Failed to fetch sessions:", error)
      setSessions(["all"])
    }
  }

  useEffect(() => {
    fetchGroups()
  }, [selectedSession, statusFilter])

  const fetchGroups = async () => {
    try {
      const url = selectedSession === "all" ? "/api/groups" : `/api/groups?session=${selectedSession}`
      const headers = buildInstructorApiHeaders()
      const [response, countsResponse] = await Promise.all([
        fetch(url, { headers }),
        fetch("/api/groups/counts", { headers }),
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
  }

  const handleApproveGroup = async (groupId: number, groupName: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/approve`, {
        method: "POST",
        headers: buildInstructorApiHeaders(),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to approve group")
      }

      toast({
        title: "✅ Group Approved",
        description: `Group "${groupName}" has been approved and is now active. All members can now collaborate on projects and assignments.`,
      })

      fetchGroups()
    } catch (error: any) {
      console.error("Failed to approve group:", error)
      toast({
        title: "❌ Failed to Approve Group",
        description: `Could not approve "${groupName}". ${error.message || 'Please try again or check if the group still exists.'}`,
        variant: "destructive",
      })
    }
  }

  const handleRejectGroup = async (groupId: number, groupName: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/reject`, {
        method: "POST",
        headers: buildInstructorApiHeaders(),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to reject group")
      }

      toast({
        title: "❌ Group Rejected",
        description: `Group "${groupName}" has been rejected. The group leader will be notified and can make necessary changes before resubmitting.`,
      })

      fetchGroups()
    } catch (error: any) {
      console.error("Failed to reject group:", error)
      toast({
        title: "❌ Failed to Reject Group",
        description: `Could not reject "${groupName}". ${error.message || 'Please try again.'}`,
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
    const groupId = selectedGroup.id
    const groupName = selectedGroup.name


    try {
      const response = await fetch(`/api/groups/${selectedGroup.id}`, {
        method: "DELETE",
        headers: buildInstructorApiHeaders(),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete group")
      }

      toast({
        title: "🗑️ Group Deleted",
        description: `Group "${groupName}" (ID: ${groupId}) has been permanently deleted along with all associated data and projects.`,
      })

      setDeleteDialogOpen(false)
      setSelectedGroup(null)
      fetchGroups()
    } catch (error: any) {
      console.error("Failed to delete group:", error)
      toast({
        title: "❌ Failed to Delete Group",
        description: `Could not delete "${groupName}". ${error.message || 'Please try again or contact support.'}`,
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
    const studentName = selectedMember.name

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
        description: `${studentName} has been removed from the group. They will be notified and can join a different group if needed.`,
      })

      setRemoveMemberDialogOpen(false)
      setSelectedGroup(null)
      setSelectedMember(null)
      fetchGroups()
    } catch (error: any) {
      console.error("Failed to remove member:", error)
      toast({
        title: "❌ Failed to Remove Member",
        description: `Could not remove ${studentName} from the group. ${error.message || 'The student might be the group leader.'}`,
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
        description: `Successfully deleted all ${deletedCount} groups from the database. All group members have been unassigned and can now form new groups.`,
      })

      setClearAllDialogOpen(false)
      fetchGroups()
    } catch (error: any) {
      console.error("Failed to clear all groups:", error)
      toast({
        title: "❌ Failed to Clear Groups",
        description: `Could not delete all groups. ${error.message || 'Some groups might be in use by projects. Please try again.'}`,
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      case "pending_update":
        return (
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending Update
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        )
      default:
        return null
    }
  }

  const getGroupsBySession = (session: string) => {
    let filtered = groups.filter((g) => g.session === session)
    if (statusFilter !== "all") {
      filtered = filtered.filter((g) => g.status === statusFilter)
    }
    return filtered
  }

  const handleExportGroups = async () => {
    // Show loading toast
    const loadingToast = toast({
      title: (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Generating PDF Report</span>
        </div>
      ),
      description: "Please wait while we prepare your groups export...",
      duration: Infinity, // Keep it open until we update it
    })

    try {
      const params = new URLSearchParams()
      if (selectedSession !== "all") {
        params.append("session", selectedSession)
      }
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
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
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.details || "Failed to export groups")
      }

      // Download PDF
      const blob = await response.blob()
      const url_blob = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      const fileName = `groups-report-${selectedSession || "all"}-${Date.now()}.pdf`
      a.href = url_blob
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url_blob)
      document.body.removeChild(a)

      // Update toast to success
      loadingToast.update({
        id: loadingToast.id,
        title: (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>PDF Export Successful</span>
          </div>
        ),
        description: (
          <div className="flex flex-col gap-1">
            <span>Groups report has been downloaded successfully.</span>
            <span className="text-xs opacity-75 font-mono">{fileName}</span>
          </div>
        ),
        duration: 5000,
      })
    } catch (error: any) {
      console.error("Failed to export groups PDF:", error)
      
      // Update toast to error
      loadingToast.update({
        id: loadingToast.id,
        title: (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span>Export Failed</span>
          </div>
        ),
        description: error.message || "Failed to export groups to PDF. Please try again.",
        variant: "destructive",
        duration: 5000,
      })
    }
  }

  const getFilteredGroups = () => {
    let filtered = groups
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((g) => g.status === statusFilter)
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((g) => 
        g.name.toLowerCase().includes(query) ||
        g.leader_name.toLowerCase().includes(query) ||
        g.session.toLowerCase().includes(query) ||
        g.members?.some(m => 
          m.full_name.toLowerCase().includes(query) ||
          m.student_id.toLowerCase().includes(query)
        )
      )
    }
    
    return filtered
  }

  const renderPendingChanges = (group: Group) => {
    if (!group.pending_changes) return null

    const changes = group.pending_changes
    const hasChanges = changes.name || changes.addMembers?.length || changes.removeMembers?.length

    if (!hasChanges) return null

    return (
      <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl">
        <p className="text-sm font-medium text-orange-600 mb-2">Pending Changes:</p>
        <ul className="text-sm space-y-1">
          {changes.name && (
            <li className="text-slate-600">
              • Name change: <span className="font-medium">{changes.name}</span>
            </li>
          )}
          {changes.addMembers && changes.addMembers.length > 0 && (
            <li className="text-slate-600">
              • Add {changes.addMembers.length} member{changes.addMembers.length !== 1 ? "s" : ""}
            </li>
          )}
          {changes.removeMembers && changes.removeMembers.length > 0 && (
            <li className="text-slate-600">
              • Remove {changes.removeMembers.length} member{changes.removeMembers.length !== 1 ? "s" : ""}
            </li>
          )}
        </ul>
      </div>
    )
  }

  const renderGroupCard = (group: Group) => (
    <Card key={group.id} className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-lg hover:border-blue-300 transition-all">
      <CardHeader className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-slate-800">{group.name}</CardTitle>
            <CardDescription className="mt-1 text-sm text-slate-600">
              Section {group.session} • Led by {group.leader_name} • {group.member_count} member
              {group.member_count !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {getStatusBadge(group.status)}
            <Badge variant="outline" className="border-slate-200 text-slate-600 text-xs">{group.session}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Members:</p>
          <div className="space-y-2">
            {group.members?.slice(0, 3).map((member) => (
              <div key={member.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{member.full_name}</span>
                  <span className="text-xs text-slate-500">({member.student_id})</span>
                  {member.id === group.created_by && (
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                      <Crown className="h-3 w-3 mr-1" />
                      Leader
                    </Badge>
                  )}
                </div>
                {member.id !== group.created_by && group.status === "approved" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(group.id, member.id, member.full_name)}
                    className="hover:bg-red-50 hover:text-red-600 transition-all rounded-lg h-6 w-6 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            {group.members && group.members.length > 3 && (
              <div className="text-xs text-slate-500 text-center py-1">
                +{group.members.length - 3} more members
              </div>
            )}
          </div>
        </div>
        {renderPendingChanges(group)}
      </CardContent>
      <CardFooter className="p-4 pt-0 flex gap-2">
        {(group.status === "pending" || group.status === "pending_update") && (
          <>
            <Button
              variant="default"
              size="sm"
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25 rounded-xl"
              onClick={() => handleApproveGroup(group.id, group.name)}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg shadow-red-500/25 rounded-xl"
              onClick={() => handleRejectGroup(group.id, group.name)}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </>
        )}
        <Button 
          variant="destructive" 
          size="sm"
          className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg shadow-red-500/25 rounded-xl"
          onClick={() => handleDeleteGroup(group.id, group.name)}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  )

  const renderGroupListItem = (group: Group) => (
    <Card key={group.id} className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-3">
              {getStatusBadge(group.status)}
              <Badge variant="outline" className="border-slate-200 text-slate-600">{group.session}</Badge>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-800 truncate">{group.name}</h3>
              <p className="text-sm text-slate-600 truncate">
                Led by {group.leader_name} • {group.member_count} member{group.member_count !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="text-sm text-slate-500">
              {group.members?.length} members
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(group.status === "pending" || group.status === "pending_update") && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/25 rounded-xl"
                  onClick={() => handleApproveGroup(group.id, group.name)}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg shadow-red-500/25 rounded-xl"
                  onClick={() => handleRejectGroup(group.id, group.name)}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </>
            )}
            <Button 
              variant="destructive" 
              size="sm"
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg shadow-red-500/25 rounded-xl"
              onClick={() => handleDeleteGroup(group.id, group.name)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading groups...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div />
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

      {/* Session Selection */}
      <Tabs value={selectedSession} onValueChange={setSelectedSession} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm h-12">
            {sessions.map((session) => (
              <TabsTrigger key={session} value={session} className="rounded-xl">
                Session {session} ({sessionCounts[session] || 0})
              </TabsTrigger>
            ))}
            <TabsTrigger value="all" className="rounded-xl">
              All Sessions ({sessionCounts['total'] || 0})
            </TabsTrigger>
          </TabsList>

          {/* View Toggle and Actions */}
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-xl shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("card")}
                className={`rounded-lg transition-all ${
                  viewMode === "card"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:from-blue-700 hover:to-indigo-700"
                    : "hover:bg-slate-100"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("list")}
                className={`rounded-lg transition-all ${
                  viewMode === "list"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:from-blue-700 hover:to-indigo-700"
                    : "hover:bg-slate-100"
                }`}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Export Button */}
            <Button 
              variant="outline"
              onClick={handleExportGroups}
              className="border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-blue-700 rounded-xl"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export to PDF
            </Button>

            {/* Clear All Button */}
            <Button 
              variant="destructive" 
              onClick={() => setClearAllDialogOpen(true)}
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg shadow-red-500/25 rounded-xl"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Groups
            </Button>
          </div>
        </div>
      </Tabs>

      {/* Filters Bar */}
      <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                <Filter className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Search & Filter</h3>
                <p className="text-xs text-slate-600">Find groups by name, leader, or members</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search groups, leaders, or members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-slate-200 rounded-xl"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] border-slate-200 rounded-xl">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="pending_update">Pending Update</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Groups Content */}
      <div className="space-y-4">
        {getFilteredGroups().length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm p-12 text-center">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Users className="h-10 w-10 text-blue-600" />
            </div>
            <p className="text-slate-600">No groups found.</p>
          </div>
        ) : viewMode === "card" ? (
          // Card View - 3 columns grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getFilteredGroups().map(renderGroupCard)}
          </div>
        ) : (
          // List View - Compact table-like layout
          <div className="space-y-2">
            {getFilteredGroups().map(renderGroupListItem)}
          </div>
        )}
      </div>

      {/* Delete Group Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white rounded-2xl border-slate-200">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-100 to-pink-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-800">Delete Group</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600">
              Are you sure you want to delete "{selectedGroup?.name}"? This action cannot be undone and will remove all
              members and associated projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 hover:bg-slate-50 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGroup}
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg shadow-red-500/25 rounded-xl"
            >
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Member Dialog */}
      <AlertDialog open={removeMemberDialogOpen} onOpenChange={setRemoveMemberDialogOpen}>
        <AlertDialogContent className="bg-white rounded-2xl border-slate-200">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-100 to-pink-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-800">Remove Member</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600">
              Are you sure you want to remove {selectedMember?.name} from this group?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 hover:bg-slate-50 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveMember}
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg shadow-red-500/25 rounded-xl"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Groups Dialog */}
      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent className="bg-white rounded-2xl border-slate-200">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-100 to-pink-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-800">Clear All Groups</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600">
              Are you sure you want to delete ALL groups? This action cannot be undone and will permanently remove all
              groups and their members from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 hover:bg-slate-50 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllGroups}
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg shadow-red-500/25 rounded-xl"
            >
              Clear All Groups
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

