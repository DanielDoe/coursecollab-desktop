"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Users,
  Plus,
  UserPlus,
  UserMinus,
  Crown,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  Star,
  Shield,
  Globe,
  Sparkles,
  Search,
  AlertCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { GroupsManagerPanelSkeleton } from "@/components/student/dashboard-v2/GroupsPageSkeleton"
import { portalOutlineButtonClass } from "@/lib/portal-module-themes"

const groupsTheme = getStudentModuleTheme("groups")
import { buildStudentScopedSearchParams } from "@/lib/student-session-ids"

interface Group {
  id: number
  name: string
  session: string
  created_by: number
  leader_name: string
  leader_student_id: string
  member_count: number
  status: "pending" | "approved" | "rejected" | "pending_update"
  members: Array<{
    id: number
    student_id: string
    full_name: string
    joined_at: string
  }>
}

interface Student {
  id: number
  student_id: string
  full_name: string
  section: string
}

interface GroupsManagerProps {
  studentDatabaseId: number
  studentSection: string
  embedInDashboard?: boolean
  sharedSectionData?: {
    groups: Group[]
    students: Student[]
    loading: boolean
  }
  onSectionDataChange?: () => void
}

export function GroupsManager({
  studentDatabaseId,
  studentSection,
  embedInDashboard = false,
  sharedSectionData,
  onSectionDataChange,
}: GroupsManagerProps) {
  const { toast } = useToast()
  const [groups, setGroups] = useState<Group[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [newGroupName, setNewGroupName] = useState("")
  const [editGroupName, setEditGroupName] = useState("")
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [selectedInitialMembers, setSelectedInitialMembers] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null)

  useEffect(() => {
    if (sharedSectionData) {
      if (sharedSectionData.loading) {
        setLoading(true)
        return
      }
      setGroups(sharedSectionData.groups)
      setStudents(sharedSectionData.students)
      const me = sharedSectionData.students.find((s) => s.id === studentDatabaseId)
      setCurrentStudent(me ?? null)
      setLoading(false)
      return
    }
    fetchGroups()
    fetchStudents()
  }, [
    studentSection,
    studentDatabaseId,
    sharedSectionData?.loading,
    sharedSectionData?.groups,
    sharedSectionData?.students,
  ])

  const refreshSectionData = async () => {
    if (sharedSectionData && onSectionDataChange) {
      onSectionDataChange()
      return
    }
    await fetchGroups()
    await fetchStudents()
  }

  const fetchGroups = async () => {
    try {
      const params = buildStudentScopedSearchParams({ session: studentSection })
      const res = await fetch(`/api/groups?${params}`)
      const data = await res.json()
      setGroups(data.groups || [])
    } catch {
      toast({ title: "Error", description: "Failed to load groups", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const fetchStudents = async () => {
    try {
      const params = buildStudentScopedSearchParams({ section: studentSection })
      const res = await studentApiFetch(`/api/student/roster?${params}`)
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to fetch roster" }))
        toast({ 
          title: "Error", 
          description: errorData.error || "Failed to load students.", 
          variant: "destructive" 
        })
        return
      }
      
      const data = await res.json()
      const roster = data.students?.map((s: any) => ({ ...s, section: studentSection })) || []
      setStudents(roster)
      
      const me = roster.find((s: Student) => s.id === studentDatabaseId)
      if (me) {
        setCurrentStudent(me)
      } else {
        // Only show error if roster is not empty (student might not be in roster yet)
        if (roster.length > 0) {
          toast({ 
            title: "Warning", 
            description: "Unable to identify current student in roster.", 
            variant: "destructive" 
          })
        }
      }
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to load students.", 
        variant: "destructive" 
      })
    }
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast({ title: "Error", description: "Please enter a group name", variant: "destructive" })
      return
    }
    if (!currentStudent) {
      toast({ title: "Error", description: "Unable to identify current student.", variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-student-id": String(studentDatabaseId),
        },
        body: JSON.stringify({
          name: newGroupName,
          session: studentSection,
          createdBy: studentDatabaseId,
          initialMembers: selectedInitialMembers,
        }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        const errorMessage = data.error || "Failed to create group"
        throw new Error(errorMessage)
      }
      
      toast({ title: "Success", description: "Group proposed successfully" })
      setNewGroupName("")
      setSelectedInitialMembers([])
      setCreateDialogOpen(false)
      await refreshSectionData()
    } catch (e: any) {
      console.error("Group creation error:", e)
      toast({ 
        title: "Error", 
        description: e.message || "Failed to create group. Please try again.", 
        variant: "destructive" 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditGroup = async () => {
    if (!editGroupName.trim() || !selectedGroup) {
      toast({ title: "Error", description: "Please enter a group name", variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/groups/${selectedGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editGroupName }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to update group" }))
        throw new Error(errorData.error || "Failed to update group")
      }
      toast({ title: "Success", description: "Group updated successfully" })
      setEditGroupName("")
      setEditDialogOpen(false)
      setSelectedGroup(null)
      await refreshSectionData()
    } catch (e: any) {
      console.error("Edit group error:", e)
      const errorMessage = e instanceof Error ? e.message : typeof e === 'string' ? e : "Failed to update group. Please try again."
      toast({ title: "Error", description: errorMessage, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/groups/${selectedGroup.id}`, { method: "DELETE" })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to delete group" }))
        throw new Error(errorData.error || "Failed to delete group")
      }
      toast({ title: "Success", description: "Group deleted successfully" })
      setDeleteDialogOpen(false)
      setSelectedGroup(null)
      await refreshSectionData()
    } catch (e: any) {
      console.error("Delete group error:", e)
      const errorMessage = e instanceof Error ? e.message : typeof e === 'string' ? e : "Failed to delete group. Please try again."
      toast({ title: "Error", description: errorMessage, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveMember = (groupId: number) => {
    setSelectedGroup(groups.find((g) => g.id === groupId) || null)
    setLeaveDialogOpen(true)
  }

  const confirmLeaveGroup = async () => {
    if (!selectedGroup || !currentStudent) return
    try {
      const res = await fetch("/api/groups/remove-member", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroup.id, studentId: currentStudent.id }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to leave group" }))
        throw new Error(errorData.error || "Failed to leave group")
      }
      toast({ title: "Success", description: "You have left the group" })
      setLeaveDialogOpen(false)
      setSelectedGroup(null)
      await refreshSectionData()
    } catch (e: any) {
      console.error("Leave group error:", e)
      const errorMessage = e instanceof Error ? e.message : typeof e === 'string' ? e : "Failed to leave group. Please try again."
      toast({ title: "Error", description: errorMessage, variant: "destructive" })
    }
  }

  const handleAddMember = async () => {
    if (!selectedGroup || !selectedStudentId) return
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/groups/add-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroup.id, studentId: Number.parseInt(selectedStudentId) }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to add member" }))
        throw new Error(errorData.error || "Failed to add member")
      }
      toast({ title: "Success", description: "Member added successfully" })
      setAddMemberDialogOpen(false)
      setSelectedStudentId("")
      await refreshSectionData()
    } catch (e: any) {
      console.error("Add member error:", e)
      const errorMessage = e instanceof Error ? e.message : typeof e === 'string' ? e : "Failed to add member. Please try again."
      toast({ title: "Error", description: errorMessage, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isGroupLeader = (g: Group) => g.created_by === studentDatabaseId
  const isGroupMember = (g: Group) => g.members?.some((m) => m.id === studentDatabaseId)

  const getAvailableStudents = () => {
    if (!selectedGroup) return []
    const memberIds = selectedGroup.members?.map((m) => m.id) || []
    return students.filter((s) => !memberIds.includes(s.id))
  }

  const getAvailableStudentsForCreation = () =>
    students.filter((s) => s.id !== studentDatabaseId)

  const toggleInitialMember = (studentId: number) => {
    setSelectedInitialMembers((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
    )
  }

  const getFilteredGroups = () => {
    return groups.filter(group => {
      const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           group.leader_name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || group.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }

  const statusColor = (status: string) => {
    if (status === "approved") return "var(--cc-success)"
    if (status === "rejected") return "var(--cc-danger)"
    return "var(--cc-warning)"
  }

  const getStatusBadge = (status: string) => {
    const label =
      status === "approved"
        ? "Approved"
        : status === "pending"
          ? "Pending"
          : status === "pending_update"
            ? "Update"
            : status === "rejected"
              ? "Rejected"
              : status
    if (embedInDashboard) {
      return (
        <span className="text-xs font-medium capitalize" style={{ color: statusColor(status) }}>
          {label}
        </span>
      )
    }
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500 dark:bg-emerald-600 text-white border-0 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg text-xs sm:text-sm"><CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />Approved</Badge>
      case "pending":
        return <Badge className="bg-amber-500 dark:bg-amber-600 text-white border-0 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg text-xs sm:text-sm"><Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />Pending</Badge>
      case "pending_update":
        return <Badge className="bg-orange-500 dark:bg-orange-600 text-white border-0 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg text-xs sm:text-sm"><Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />Update</Badge>
      case "rejected":
        return <Badge className="bg-red-500 dark:bg-red-600 text-white border-0 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg text-xs sm:text-sm"><XCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />Rejected</Badge>
      default:
        return null
    }
  }

  if (loading) {
    if (embedInDashboard) {
      return <GroupsManagerPanelSkeleton />
    }
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 dark:border-slate-700 border-t-blue-500 dark:border-t-blue-400" />
      </div>
    )
  }

  const cardClass = embedInDashboard
    ? "border border-[var(--border)] bg-[var(--card)] rounded-2xl"
    : "border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] rounded-xl sm:rounded-2xl"
  const headerIconClass = embedInDashboard
    ? "flex size-9 items-center justify-center rounded-xl bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]"
    : "p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-blue-100 dark:bg-blue-900/50 shrink-0"
  const iconClass = embedInDashboard ? "text-[var(--cc-accent)]" : "text-blue-600 dark:text-blue-400"
  const btnClass = embedInDashboard
    ? "h-9 rounded-xl border-0 px-3 text-sm font-medium shadow-none hover:opacity-90"
    : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-lg sm:rounded-xl shadow-[0_8px_32px_rgba(59,130,246,0.3)] dark:shadow-[0_8px_32px_rgba(59,130,246,0.5)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.4)] dark:hover:shadow-[0_12px_40px_rgba(59,130,246,0.6)] transition-all duration-300 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 font-semibold gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base w-full sm:w-auto shrink-0"

  return (
    <div className={cn("flex flex-col", embedInDashboard ? "min-h-0 flex-1" : "h-[600px] sm:h-[650px] md:h-[700px]")}>
      <div className={cn(
        embedInDashboard
          ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4"
          : "rounded-2xl border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] shadow-sm p-4 sm:p-5 md:p-6",
      )}>
      <div className={cn("flex shrink-0 items-end justify-between gap-3", embedInDashboard ? "mb-3" : "mb-6")}>
        {!embedInDashboard ? (
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className={cn(headerIconClass)}>
            <Users className={cn("h-5 w-5 sm:h-6 sm:w-6", iconClass)} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200">My Groups</h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <span className="sm:hidden">Create & collaborate</span>
              <span className="hidden sm:inline">Propose groups to collaborate on projects</span>
            </p>
          </div>
        </div>
        ) : (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--cc-text)]">My groups</p>
            <p className="text-xs text-[var(--cc-text-muted)]">{getFilteredGroups().length} shown</p>
          </div>
        )}
        <Button 
          onClick={() => setCreateDialogOpen(true)} 
          className={btnClass}
          style={embedInDashboard ? { backgroundColor: "var(--cc-accent)", color: "#FFFFFF" } : undefined}
        >
          <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="hidden sm:inline">Propose Group</span>
          <span className="sm:hidden">Propose</span>
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="mb-4 sm:mb-6 flex shrink-0 flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 dark:text-slate-500" />
          <Input
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "pl-8 sm:pl-10 h-9 sm:h-10 text-sm sm:text-base rounded-lg sm:rounded-xl placeholder:text-xs sm:placeholder:text-sm",
              embedInDashboard
                ? "border-[var(--border)] bg-[var(--muted)]/40 text-[var(--cc-text)]"
                : "bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700",
            )}
            title="Search groups or leaders"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={cn(
            "w-full sm:w-[160px] md:w-[180px] h-9 sm:h-10 text-xs sm:text-sm rounded-lg sm:rounded-xl",
            embedInDashboard
              ? "border-[var(--border)] bg-[var(--muted)]/40 text-[var(--cc-text)]"
              : "bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700",
          )}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
            <SelectItem value="all" className="dark:text-slate-200">All Status</SelectItem>
            <SelectItem value="pending" className="dark:text-slate-200">Pending</SelectItem>
            <SelectItem value="approved" className="dark:text-slate-200">Approved</SelectItem>
            <SelectItem value="rejected" className="dark:text-slate-200">Rejected</SelectItem>
            <SelectItem value="pending_update" className="dark:text-slate-200">Pending Update</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2",
          embedInDashboard
            ? "flex flex-col"
            : "space-y-4 sm:space-y-5 md:space-y-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent",
        )}
      >
        {getFilteredGroups().length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={cn(embedInDashboard && "flex min-h-0 flex-1 flex-col")}
          >
            <Card
              className={cn(
                "text-center",
                embedInDashboard
                  ? "flex min-h-0 flex-1 flex-col items-center justify-center gap-2 border border-[var(--border)] bg-[var(--muted)]/15 py-10 px-4 shadow-none rounded-xl"
                  : cn("py-12 sm:py-16 px-4 sm:px-6", cardClass),
              )}
            >
              <CardContent className={cn(embedInDashboard && "flex flex-col items-center justify-center px-0")}>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div
                    className={cn(
                      "p-3 sm:p-4 rounded-xl sm:rounded-2xl",
                      embedInDashboard ? "bg-[var(--cc-accent-soft)]" : "bg-slate-100 dark:bg-slate-700",
                    )}
                  >
                    <Users
                      className={cn(
                        "h-6 w-6 sm:h-8 sm:w-8",
                        embedInDashboard ? "text-[var(--cc-accent-dark)]" : "text-slate-600 dark:text-slate-400",
                      )}
                    />
                  </div>
                  <h3
                    className={cn(
                      "text-xl sm:text-2xl font-bold",
                      embedInDashboard ? "text-[var(--cc-text)]" : "text-slate-800 dark:text-slate-200",
                    )}
                  >
                    No Groups Yet
                  </h3>
                </div>
                <p
                  className={cn(
                    "text-sm sm:text-base md:text-lg mb-6 sm:mb-8 max-w-md mx-auto",
                    embedInDashboard ? "text-[var(--cc-text-muted)]" : "text-slate-600 dark:text-slate-400",
                  )}
                >
                  <span className="sm:hidden">Propose the first group!</span>
                  <span className="hidden sm:inline">No groups in your section yet. Propose the first group to get started!</span>
                </p>
                <Button 
                  onClick={() => setCreateDialogOpen(true)}
                  className={embedInDashboard ? "h-10 rounded-xl border-0 px-4 text-sm font-medium shadow-none hover:opacity-90" : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-lg sm:rounded-xl shadow-[0_8px_32px_rgba(59,130,246,0.3)] dark:shadow-[0_8px_32px_rgba(59,130,246,0.5)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.4)] dark:hover:shadow-[0_12px_40px_rgba(59,130,246,0.6)] transition-all duration-300 px-6 sm:px-8 py-2.5 sm:py-3 font-semibold gap-2 text-sm sm:text-base w-full sm:w-auto"}
                  style={embedInDashboard ? { backgroundColor: "var(--cc-accent)", color: "#FFFFFF" } : undefined}
                >
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="sm:hidden">Create Group</span>
                  <span className="hidden sm:inline">Create First Group</span>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="space-y-4 sm:space-y-5 md:space-y-6">
          {getFilteredGroups().map((g, index) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className={cn(
                embedInDashboard
                  ? "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-none"
                  : "border backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-xl sm:rounded-2xl overflow-hidden group border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85",
              )}>
                <CardHeader className={cn(embedInDashboard ? "p-3" : "pb-3 sm:pb-4 p-4 sm:p-6")}>
                  <div className={cn(
                    "flex items-center gap-3",
                    !embedInDashboard && "flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4",
                  )}>
                    {embedInDashboard ? (
                      <span
                        className="flex size-14 shrink-0 items-center justify-center rounded-[14px]"
                        style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
                      >
                        <Users className="h-6 w-6" />
                      </span>
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <CardTitle className={cn(
                        embedInDashboard
                          ? "text-sm font-semibold text-[var(--cc-text)]"
                          : "text-lg sm:text-xl md:text-2xl flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2 sm:mb-3",
                      )}>
                        <span className={cn(
                          "break-words",
                          embedInDashboard ? "text-[var(--cc-text)]" : "transition-colors duration-300 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400",
                        )}>
                          {g.name}
                        </span>
                        {isGroupLeader(g) && (
                          <Badge className="bg-amber-500 dark:bg-amber-600 text-white border-0 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg text-xs sm:text-sm w-fit">
                            <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                            Leader
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className={cn(
                        embedInDashboard ? "mt-0.5 text-xs text-[var(--cc-text-muted)]" : "text-xs sm:text-sm md:text-base dark:text-slate-400",
                      )}>
                        {g.leader_name.split(" ")[0]} · {g.member_count} member{g.member_count !== 1 && "s"}
                        {isGroupLeader(g) ? " · leader" : isGroupMember(g) ? " · member" : ""}
                      </CardDescription>
                    </div>
                    <div className={cn(
                      "flex flex-wrap items-center gap-2",
                      embedInDashboard ? "shrink-0" : "ml-0 sm:ml-4 w-full sm:w-auto",
                    )}>
                      {g.status && getStatusBadge(g.status)}
                      {!embedInDashboard && (isGroupMember(g) ? (
                        <Badge className="bg-emerald-500 dark:bg-emerald-600 text-white border-0 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg text-xs sm:text-sm">
                          <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                          Member
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-500 dark:bg-slate-600 text-white border-0 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg text-xs sm:text-sm">
                          <Shield className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                          <span className="sm:hidden">Not Member</span>
                          <span className="hidden sm:inline">Not a Member</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={cn(embedInDashboard ? "px-3 pb-3 pt-0" : "pt-0 px-4 sm:px-6 pb-4")}>
                  <div className="space-y-2 sm:space-y-3">
                    <p className={cn(
                      "text-xs font-semibold",
                      embedInDashboard ? "text-[var(--cc-text-muted)]" : "sm:text-sm text-slate-700 dark:text-slate-300",
                    )}>
                      Members
                    </p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {g.members?.map((m) => (
                        <Badge key={m.id} className={cn(
                          "border-0 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm",
                          embedInDashboard
                            ? "bg-[var(--cc-accent-soft)] text-[var(--cc-accent)]"
                            : "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300",
                        )}>
                          {m.full_name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className={cn(
                  "flex flex-wrap gap-2",
                  embedInDashboard ? "px-3 pb-3 pt-0" : "sm:gap-3 pt-4 px-4 sm:px-6 pb-4 sm:pb-6",
                )}>
                  {isGroupLeader(g) && (
                    <>
                      {g.status === "approved" && (
                        <>
                          <Button 
                            variant="outline" 
                            onClick={() => { setSelectedGroup(g); setAddMemberDialogOpen(true) }}
                            className={cn("rounded-lg sm:rounded-xl dark:border-slate-700 dark:text-slate-300 transition-all duration-200 text-xs sm:text-sm px-2 sm:px-3 md:px-4 h-8 sm:h-9 md:h-10 flex-1 sm:flex-initial", embedInDashboard ? "border-[var(--border)] text-[var(--cc-text)] hover:bg-[var(--muted)]" : "hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400")}
                          >
                            <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Add Member</span>
                            <span className="sm:hidden">Add</span>
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => { setSelectedGroup(g); setEditGroupName(g.name); setEditDialogOpen(true) }}
                            className="rounded-lg sm:rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 dark:border-slate-700 dark:text-slate-300 transition-all duration-200 text-xs sm:text-sm px-2 sm:px-3 md:px-4 h-8 sm:h-9 md:h-10 flex-1 sm:flex-initial"
                          >
                            <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            Edit
                          </Button>
                        </>
                      )}
                      <Button 
                        variant="outline" 
                        className="rounded-lg sm:rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 dark:border-slate-700 dark:text-slate-300 transition-all duration-200 text-xs sm:text-sm px-2 sm:px-3 md:px-4 h-8 sm:h-9 md:h-10 flex-1 sm:flex-initial"
                        onClick={() => { setSelectedGroup(g); setDeleteDialogOpen(true) }}
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Delete
                      </Button>
                    </>
                  )}
                  {isGroupMember(g) && !isGroupLeader(g) && g.status === "approved" && (
                    <Button 
                      variant="outline" 
                      onClick={() => handleRemoveMember(g.id)}
                      className="rounded-lg sm:rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-400 dark:border-slate-700 dark:text-slate-300 transition-all duration-200 text-xs sm:text-sm px-2 sm:px-3 md:px-4 h-8 sm:h-9 md:h-10 w-full sm:w-auto"
                    >
                      <UserMinus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      Leave
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          ))}
          </div>
        )}
      </div>
      </div>

      {/* === All Dialogs retained with modern styles === */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 rounded-xl sm:rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] max-h-[85vh] sm:max-h-[80vh] overflow-y-auto w-[calc(100%-2rem)] sm:w-full max-w-lg">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 sm:gap-3">
              <div className={cn("p-1.5 sm:p-2 rounded-lg shrink-0", embedInDashboard ? groupsTheme.page.iconBg : "bg-blue-100 dark:bg-blue-900/50")}>
                <Plus className={cn("h-4 w-4 sm:h-5 sm:w-5", embedInDashboard ? groupsTheme.page.iconText : "text-blue-600 dark:text-blue-400")} />
              </div>
              <span>
                <span className="sm:hidden">New Group</span>
                <span className="hidden sm:inline">Propose New Group</span>
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <span className="sm:hidden">Create a group to collaborate</span>
              <span className="hidden sm:inline">Propose a group to collaborate with your classmates. You can create a group with just yourself if working individually.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-6 py-4 px-4 sm:px-6">
            <div className={cn(
              "rounded-lg sm:rounded-xl p-3 sm:p-4 border",
              embedInDashboard
                ? cn(groupsTheme.page.softBg, groupsTheme.page.border)
                : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
            )}>
              <div className="flex items-start gap-2 sm:gap-3">
                <AlertCircle className={cn("h-4 w-4 sm:h-5 sm:w-5 mt-0.5 flex-shrink-0", embedInDashboard ? groupsTheme.page.iconText : "text-blue-600 dark:text-blue-400")} />
                <div className={cn("text-xs sm:text-sm min-w-0", embedInDashboard ? "text-slate-700 dark:text-slate-300" : "text-blue-800 dark:text-blue-200")}>
                  <p className="font-semibold mb-1">
                    <span className="sm:hidden">Individual Allowed</span>
                    <span className="hidden sm:inline">Individual Projects Allowed</span>
                  </p>
                  <p className="break-words">
                    <span className="sm:hidden">Create a group with just yourself</span>
                    <span className="hidden sm:inline">You can create a group with just yourself if you prefer to work individually. Simply enter a group name and click "Propose" without adding any members.</span>
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">
                <span className="sm:hidden">Name</span>
                <span className="hidden sm:inline">Group Name</span>
              </Label>
              <Input 
                value={newGroupName} 
                onChange={(e) => setNewGroupName(e.target.value)} 
                disabled={isSubmitting}
                className={cn(
                  "rounded-lg sm:rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-white dark:bg-slate-900/80 dark:text-slate-200 text-sm sm:text-base h-9 sm:h-10",
                  embedInDashboard ? "focus-visible:ring-2 focus-visible:ring-amber-500/30" : "focus:ring-blue-500 dark:focus:ring-blue-400",
                )}
                placeholder="Enter group name..."
              />
            </div>
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">
                <span className="sm:hidden">Members (Optional)</span>
                <span className="hidden sm:inline">Add Initial Members (Optional - You can work alone)</span>
              </Label>
              <div className="border border-slate-200/70 dark:border-slate-700/60 rounded-lg sm:rounded-xl p-3 sm:p-4 max-h-48 sm:max-h-60 overflow-y-auto space-y-2 sm:space-y-3 bg-white dark:bg-slate-800/50">
                {getAvailableStudentsForCreation().map((s) => (
                  <div key={s.id} className="flex items-center space-x-2 sm:space-x-3 p-2 rounded-lg hover:bg-white/60 dark:hover:bg-slate-700/60 transition-colors duration-200">
                    <Checkbox
                      checked={selectedInitialMembers.includes(s.id)}
                      onCheckedChange={() => toggleInitialMember(s.id)}
                      disabled={isSubmitting}
                      className="rounded dark:border-slate-600"
                    />
                    <label className="text-xs sm:text-sm cursor-pointer text-slate-700 dark:text-slate-300 font-medium break-words">
                      {s.full_name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6 flex-col sm:flex-row">
            <Button 
              variant="outline" 
              onClick={() => setCreateDialogOpen(false)}
              className="rounded-lg sm:rounded-xl bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 text-xs sm:text-sm w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCreateGroup} 
              disabled={isSubmitting}
              className={cn(
                "rounded-lg sm:rounded-xl px-4 sm:px-6 py-2 font-semibold text-xs sm:text-sm w-full sm:w-auto",
                embedInDashboard
                  ? groupsTheme.page.cta
                  : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white shadow-[0_8px_32px_rgba(59,130,246,0.3)] dark:shadow-[0_8px_32px_rgba(59,130,246,0.5)] hover:shadow-[0_12px_40px_rgba(59,130,246,0.4)] dark:hover:shadow-[0_12px_40px_rgba(59,130,246,0.6)] transition-all duration-300",
              )}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="hidden sm:inline">Proposing...</span>
                  <span className="sm:hidden">Proposing</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Propose
                </div>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 rounded-xl sm:rounded-2xl shadow-md w-[calc(100%-2rem)] sm:w-full max-w-md">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <DialogTitle className="text-lg sm:text-xl dark:text-slate-200">Edit Group</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm dark:text-slate-400">
              <span className="sm:hidden">Update group name</span>
              <span className="hidden sm:inline">Update the group name. Changes require admin approval.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 py-4 px-4 sm:px-6">
            <Label className="text-sm sm:text-base dark:text-slate-300">
              <span className="sm:hidden">Name</span>
              <span className="hidden sm:inline">Group Name</span>
            </Label>
            <Input 
              value={editGroupName} 
              onChange={(e) => setEditGroupName(e.target.value)} 
              className="dark:bg-slate-900/80 dark:text-slate-200 dark:border-slate-700 dark:placeholder:text-slate-500 rounded-lg sm:rounded-xl h-9 sm:h-10 text-sm sm:text-base"
              placeholder="Enter group name..."
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6 flex-col sm:flex-row">
            <Button 
              variant="outline" 
              onClick={() => setEditDialogOpen(false)}
              className="w-full sm:w-auto text-xs sm:text-sm rounded-lg sm:rounded-xl dark:border-slate-700 dark:text-slate-300 h-9 sm:h-10"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEditGroup}
              className={cn(
                "w-full sm:w-auto text-xs sm:text-sm rounded-lg sm:rounded-xl h-9 sm:h-10",
                embedInDashboard
                  ? groupsTheme.page.cta
                  : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white",
              )}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="hidden sm:inline">Updating...</span>
                  <span className="sm:hidden">Updating</span>
                </>
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 rounded-xl sm:rounded-2xl shadow-md w-[calc(100%-2rem)] sm:w-full max-w-md">
          <AlertDialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <AlertDialogTitle className="text-lg sm:text-xl dark:text-slate-200">Delete Group</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm dark:text-slate-400 break-words">
              <span className="sm:hidden">
                Delete "{selectedGroup?.name}"? This cannot be undone.
              </span>
              <span className="hidden sm:inline">
                Are you sure you want to delete "{selectedGroup?.name}"? This action cannot be undone and will remove all members and associated projects.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6 flex-col sm:flex-row">
            <AlertDialogCancel className="w-full sm:w-auto text-xs sm:text-sm rounded-lg sm:rounded-xl dark:border-slate-700 dark:text-slate-300 h-9 sm:h-10">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteGroup} 
              className="bg-destructive dark:bg-red-600 text-white hover:bg-destructive/90 dark:hover:bg-red-700 w-full sm:w-auto text-xs sm:text-sm rounded-lg sm:rounded-xl h-9 sm:h-10"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="hidden sm:inline">Deleting...</span>
                  <span className="sm:hidden">Deleting</span>
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 rounded-xl sm:rounded-2xl shadow-md w-[calc(100%-2rem)] sm:w-full max-w-md">
          <AlertDialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <AlertDialogTitle className="text-lg sm:text-xl dark:text-slate-200">Leave Group</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm dark:text-slate-400 break-words">
              <span className="sm:hidden">
                Leave "{selectedGroup?.name}"?
              </span>
              <span className="hidden sm:inline">
                Are you sure you want to leave "{selectedGroup?.name}"?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6 flex-col sm:flex-row">
            <AlertDialogCancel className="w-full sm:w-auto text-xs sm:text-sm rounded-lg sm:rounded-xl dark:border-slate-700 dark:text-slate-300 h-9 sm:h-10">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmLeaveGroup} 
              className="bg-destructive dark:bg-red-600 text-white hover:bg-destructive/90 dark:hover:bg-red-700 w-full sm:w-auto text-xs sm:text-sm rounded-lg sm:rounded-xl h-9 sm:h-10"
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 rounded-xl sm:rounded-2xl shadow-md w-[calc(100%-2rem)] sm:w-full max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <DialogTitle className="text-lg sm:text-xl dark:text-slate-200 break-words">
              <span className="sm:hidden">Add Member</span>
              <span className="hidden sm:inline">Add Member to {selectedGroup?.name}</span>
            </DialogTitle>
            {selectedGroup?.name && (
              <DialogDescription className="text-xs sm:text-sm dark:text-slate-400 sm:hidden">
                Group: {selectedGroup.name}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 py-4 px-4 sm:px-6">
            <Label className="text-sm sm:text-base dark:text-slate-300">
              <span className="sm:hidden">Student</span>
              <span className="hidden sm:inline">Select Student</span>
            </Label>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger className="dark:bg-slate-900/80 dark:text-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl h-9 sm:h-10 text-sm sm:text-base">
                <SelectValue placeholder="Choose a student" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                {getAvailableStudents().map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()} className="dark:text-slate-200 text-sm sm:text-base">
                    {s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6 flex-col sm:flex-row">
            <Button 
              variant="outline" 
              onClick={() => setAddMemberDialogOpen(false)}
              className="w-full sm:w-auto text-xs sm:text-sm rounded-lg sm:rounded-xl dark:border-slate-700 dark:text-slate-300 h-9 sm:h-10"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddMember}
              disabled={isSubmitting}
              className="w-full sm:w-auto text-xs sm:text-sm rounded-lg sm:rounded-xl h-9 sm:h-10 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <span className="hidden sm:inline">Adding...</span>
                  <span className="sm:hidden">Adding</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Add Member</span>
                  <span className="sm:hidden">Add</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
