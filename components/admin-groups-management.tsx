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
import { Users, Trash2, Crown, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSessionCatalog } from "@/components/session-catalog-provider"

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

export function AdminGroupsManagement() {
  const { toast } = useToast()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false)
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [selectedMember, setSelectedMember] = useState<{ id: number; name: string } | null>(null)
  const sessions = codes

  useEffect(() => {
    fetchGroups()
  }, [selectedSession, statusFilter])

  const fetchGroups = async () => {
    try {
      const url = selectedSession === "all" ? "/api/groups" : `/api/groups?session=${selectedSession}`
      const adminId = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("adminId") : null
      const headers: HeadersInit = {}
      if (adminId) headers["x-admin-id"] = adminId
      const response = await fetch(url, { headers })
      const data = await response.json()
      setGroups(data.groups || [])
    } catch (error) {
      console.error("Failed to fetch groups:", error)
      toast({
        title: "Error",
        description: "Failed to load groups",
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
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to approve group")
      }

      toast({
        title: "Success",
        description: `Group "${groupName}" has been approved`,
      })

      fetchGroups()
    } catch (error: any) {
      console.error("Failed to approve group:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to approve group",
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
        title: "Success",
        description: `Group "${groupName}" has been rejected`,
      })

      fetchGroups()
    } catch (error: any) {
      console.error("Failed to reject group:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to reject group",
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
        title: "Success",
        description: "Group deleted successfully",
      })

      setDeleteDialogOpen(false)
      setSelectedGroup(null)
      fetchGroups()
    } catch (error: any) {
      console.error("Failed to delete group:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete group",
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
      const adminId = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("adminId") : null
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (adminId) headers["x-admin-id"] = adminId

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
        title: "Success",
        description: "Member removed successfully",
      })

      setRemoveMemberDialogOpen(false)
      setSelectedGroup(null)
      setSelectedMember(null)
      fetchGroups()
    } catch (error: any) {
      console.error("Failed to remove member:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
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

      toast({
        title: "Success",
        description: "All groups have been cleared",
      })

      setClearAllDialogOpen(false)
      fetchGroups()
    } catch (error: any) {
      console.error("Failed to clear all groups:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to clear all groups",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-success">
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

  const getFilteredGroups = () => {
    if (statusFilter === "all") return groups
    return groups.filter((g) => g.status === statusFilter)
  }

  const renderPendingChanges = (group: Group) => {
    if (!group.pending_changes) return null

    const changes = group.pending_changes
    const hasChanges = changes.name || changes.addMembers?.length || changes.removeMembers?.length

    if (!hasChanges) return null

    return (
      <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-md">
        <p className="text-sm font-medium text-orange-600 mb-2">Pending Changes:</p>
        <ul className="text-sm space-y-1">
          {changes.name && (
            <li className="text-muted-foreground">
              • Name change: <span className="font-medium">{changes.name}</span>
            </li>
          )}
          {changes.addMembers && changes.addMembers.length > 0 && (
            <li className="text-muted-foreground">
              • Add {changes.addMembers.length} member{changes.addMembers.length !== 1 ? "s" : ""}
            </li>
          )}
          {changes.removeMembers && changes.removeMembers.length > 0 && (
            <li className="text-muted-foreground">
              • Remove {changes.removeMembers.length} member{changes.removeMembers.length !== 1 ? "s" : ""}
            </li>
          )}
        </ul>
      </div>
    )
  }

  const renderGroupCard = (group: Group) => (
    <Card key={group.id} className="border-2">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{group.name}</CardTitle>
            <CardDescription className="mt-2">
              Section {group.session} • Led by {group.leader_name} • {group.member_count} member
              {group.member_count !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {getStatusBadge(group.status)}
            <Badge variant="outline">{group.session}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm font-medium">Members:</p>
          <div className="space-y-2">
            {group.members?.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-2 rounded-md bg-muted">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{member.full_name}</span>
                  <span className="text-xs text-muted-foreground">({member.student_id})</span>
                  {member.id === group.created_by && (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500 text-xs">
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
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
        {renderPendingChanges(group)}
      </CardContent>
      <CardFooter className="flex gap-2">
        {(group.status === "pending" || group.status === "pending_update") && (
          <>
            <Button
              variant="default"
              className="bg-success hover:bg-success/90"
              onClick={() => handleApproveGroup(group.id, group.name)}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button variant="destructive" onClick={() => handleRejectGroup(group.id, group.name)}>
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </>
        )}
        <Button variant="destructive" onClick={() => handleDeleteGroup(group.id, group.name)}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Group
        </Button>
      </CardFooter>
    </Card>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading groups...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex gap-2">
          <Button variant="destructive" onClick={() => setClearAllDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All Groups
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
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
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              {sessions.map((session) => (
                <SelectItem key={session} value={session}>
                  Section {session}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedSession === "all" ? (
        <Tabs defaultValue={sessions[0]} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {sessions.map((session) => (
              <TabsTrigger key={session} value={session}>
                Section {session} ({getGroupsBySession(session).length})
              </TabsTrigger>
            ))}
          </TabsList>
          {sessions.map((session) => (
            <TabsContent key={session} value={session} className="space-y-4 mt-6">
              {getGroupsBySession(session).length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No groups in Section {session} yet.</p>
                  </CardContent>
                </Card>
              ) : (
                getGroupsBySession(session).map(renderGroupCard)
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="space-y-4">
          {getFilteredGroups().length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No groups found.</p>
              </CardContent>
            </Card>
          ) : (
            getFilteredGroups().map(renderGroupCard)
          )}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedGroup?.name}"? This action cannot be undone and will remove all
              members and associated projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteGroup}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={removeMemberDialogOpen} onOpenChange={setRemoveMemberDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedMember?.name} from this group?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Groups</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete ALL groups? This action cannot be undone and will permanently remove all
              groups and their members from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllGroups}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All Groups
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
