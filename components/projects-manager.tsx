"use client"

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
import { Textarea } from "@/components/ui/textarea"
import {
  FolderKanban,
  Plus,
  Edit,
  Crown,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  FileText,
  AlertCircle,
  X,
  Rocket,
  Users,
  Target,
  Calendar,
  Sparkles,
  Zap,
  Star,
  Shield,
  ExternalLink,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Project } from "@/lib/types/project"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { getFacultyModuleTheme } from "@/lib/faculty-module-themes"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { ProjectsManagerPanelSkeleton } from "@/components/student/dashboard-v2/ProjectsPageSkeleton"

const projectsTheme = getStudentModuleTheme("projects")
import { buildStudentScopedSearchParams } from "@/lib/student-session-ids"

interface Milestone {
  id: string
  title: string
  deadline: string
}

interface Group {
  id: number
  name: string
  session: string
  created_by: number
  leader_name: string
  member_count: number
  status: "pending" | "approved" | "rejected" | "pending_update" | "pending_delete"
  members: Array<{ id: number; student_id: string; full_name: string }>
}

interface ProjectReport {
  id: number
  project_id: number
  student_id: number
  progress: string
  challenges: string | null
  deliverables_status: string | null
  created_at: string
  updated_at: string
  student_name: string
  student_number: string
}

interface ProjectsManagerProps {
  studentId: string
  studentSection: string
  studentDatabaseId: number
  embedInDashboard?: boolean
  sharedSectionData?: {
    allProjects: Project[]
    groups: Group[]
    loading: boolean
  }
  onSectionDataChange?: () => void
}

export function ProjectsManager({
  studentId,
  studentSection,
  studentDatabaseId,
  embedInDashboard = false,
  sharedSectionData,
  onSectionDataChange,
}: ProjectsManagerProps) {
  const fp = getFacultyModuleTheme("projects").page
  const cardBase = PORTAL_CARD

  const { toast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false)
  const [addReportDialogOpen, setAddReportDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectReports, setProjectReports] = useState<ProjectReport[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form states
  const [selectedGroupId, setSelectedGroupId] = useState("")
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [deliverables, setDeliverables] = useState("")
  const [targetPlatform, setTargetPlatform] = useState("")
  const [projectLink, setProjectLink] = useState("")
  const [timeline, setTimeline] = useState<Milestone[]>([])
  const [newMilestoneTitle, setNewMilestoneTitle] = useState("")
  const [newMilestoneDeadline, setNewMilestoneDeadline] = useState("")

  // Report form states
  const [reportProgress, setReportProgress] = useState("")
  const [reportChallenges, setReportChallenges] = useState("")
  const [reportDeliverables, setReportDeliverables] = useState("")

  useEffect(() => {
    if (sharedSectionData) {
      if (sharedSectionData.loading) {
        setLoading(true)
        return
      }
      const myProjects = sharedSectionData.allProjects.filter((p: Project) =>
        p.members?.some((m) => m.id === studentDatabaseId),
      )
      setProjects(myProjects)
      setGroups(sharedSectionData.groups)
      setLoading(false)
      return
    }
    fetchProjects()
    fetchGroups()
  }, [
    studentSection,
    studentDatabaseId,
    sharedSectionData?.loading,
    sharedSectionData?.allProjects,
    sharedSectionData?.groups,
  ])

  const refreshProjects = async () => {
    if (sharedSectionData && onSectionDataChange) {
      onSectionDataChange()
      return
    }
    await fetchProjects()
  }

  const fetchProjects = async () => {
    try {
      const params = buildStudentScopedSearchParams({ session: studentSection })
      const response = await fetch(`/api/projects/list?${params}`)
      if (!response.ok) throw new Error("Failed to fetch projects")
      const data = await response.json()
      const allProjects = data.projects || []
      const myProjects = allProjects.filter((p: Project) => p.members?.some((m) => m.id === studentDatabaseId))
      setProjects(myProjects)
    } catch {
      toast({ title: "Error", description: "Failed to load projects", variant: "destructive" })
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const fetchGroups = async () => {
    try {
      const groupParams = buildStudentScopedSearchParams({ session: studentSection })
      const response = await fetch(`/api/groups?${groupParams}`)
      const data = await response.json()
      setGroups(data.groups || [])
    } catch {
      toast({ title: "Error", description: "Failed to load groups", variant: "destructive" })
    }
  }

  const fetchProjectReports = async (projectId: number) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/reports`)
      const data = await response.json()
      setProjectReports(data.reports || [])
    } catch {
      toast({ title: "Error", description: "Failed to load project reports", variant: "destructive" })
    }
  }

  const resetForm = () => {
    setSelectedGroupId("")
    setTitle("")
    setSummary("")
    setDeliverables("")
    setTargetPlatform("")
    setProjectLink("")
    setTimeline([])
    setNewMilestoneTitle("")
    setNewMilestoneDeadline("")
  }

  const resetReportForm = () => {
    setReportProgress("")
    setReportChallenges("")
    setReportDeliverables("")
  }

  const getMyApprovedGroups = () =>
    groups.filter((g) => g.members?.some((m) => m.id === studentDatabaseId) && g.status === "approved")

  const getMyLeaderGroups = () =>
    groups.filter(
      (g) =>
        g.members?.some((m) => m.id === studentDatabaseId) &&
        g.status === "approved" &&
        g.created_by === studentDatabaseId,
    )

  const isLeaderOfAnyApprovedGroup = () => getMyApprovedGroups().some((g) => g.created_by === studentDatabaseId)

  const handleCreateProject = async () => {
    if (!isLeaderOfAnyApprovedGroup()) {
      toast({
        title: "Permission Denied",
        description: "Only group leaders can create projects",
        variant: "destructive",
      })
      return
    }
    if (!selectedGroupId || !title.trim()) {
      toast({
        title: "Error",
        description: "Please select a group and enter a project title",
        variant: "destructive",
      })
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/projects/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: Number(selectedGroupId),
          title,
          summary: summary || null,
          deliverables: deliverables || null,
          targetPlatform: targetPlatform || null,
          studentId: studentDatabaseId,
        }),
      })
      
      if (!response.ok) {
        // Try to extract the actual error message from the API response
        let errorMessage = "Failed to create project"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.details || errorMessage
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }
      
      toast({ title: "Success", description: "Project proposal submitted for approval" })
      resetForm()
      setCreateDialogOpen(false)
      await refreshProjects()
    } catch (error: any) {
      console.error("[Projects Manager] Error creating project:", error)
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create project. Please try again.", 
        variant: "destructive" 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditProject = async () => {
    if (!selectedProject || !title.trim()) {
      toast({ title: "Error", description: "Please enter a project title", variant: "destructive" })
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          summary: summary || null,
          deliverables: deliverables || null,
          targetPlatform: targetPlatform || null,
          projectLink: projectLink || null,
          studentId: studentDatabaseId,
        }),
      })
      if (!response.ok) throw new Error("Failed to update project")
      toast({ title: "Success", description: "Project updated successfully" })
      resetForm()
      setEditDialogOpen(false)
      setSelectedProject(null)
      await refreshProjects()
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteProject = (project: Project) => {
    setSelectedProject(project)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteProject = async () => {
    if (!selectedProject) return
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: studentDatabaseId }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to delete project")
      }
      toast({ title: "Success", description: "Project deleted successfully" })
      setDeleteDialogOpen(false)
      setSelectedProject(null)
      await refreshProjects()
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast({ title: "Error", description: errorMessage || "Failed to delete project", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddReport = async () => {
    if (!selectedProject || !reportProgress.trim()) {
      toast({
        title: "Error",
        description: "Please enter progress details",
        variant: "destructive",
      })
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentDatabaseId,
          progress: reportProgress,
          challenges: reportChallenges || null,
          deliverablesStatus: reportDeliverables || null,
        }),
      })
      if (!response.ok) throw new Error("Failed to add report")
      toast({ title: "Success", description: "Progress report added successfully" })
      resetReportForm()
      setAddReportDialogOpen(false)
      fetchProjectReports(selectedProject.id)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEditDialog = (project: Project) => {
    setSelectedProject(project)
    setTitle(project.title || "")
    setSummary(project.summary || "")
    setDeliverables(project.deliverables || "")
    setTargetPlatform(project.target_platform || "")
    setProjectLink(project.project_link || "")
    setTimeline(project.timeline || [])
    setEditDialogOpen(true)
  }

  const openReportsDialog = (project: Project) => {
    setSelectedProject(project)
    fetchProjectReports(project.id)
    setReportsDialogOpen(true)
  }

  const openAddReportDialog = (project: Project) => {
    setSelectedProject(project)
    resetReportForm()
    setAddReportDialogOpen(true)
  }

  const canEditProject = (project: Project) => project.group.created_by === studentDatabaseId
  const isProjectMember = (project: Project) =>
    groups.find((g) => g.id === project.group_id)?.members?.some((m) => m.id === studentDatabaseId)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-emerald-500 text-white border-0 px-3 py-1 rounded-full shadow-lg">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      case "pending":
        return (
          <Badge className="bg-amber-500 text-white border-0 px-3 py-1 rounded-full shadow-lg">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
      case "pending_update":
        return (
          <Badge className="bg-blue-500 text-white border-0 px-3 py-1 rounded-full shadow-lg">
            <Clock className="h-3 w-3 mr-1" />
            Update Pending
          </Badge>
        )
      case "pending_delete":
        return (
          <Badge className="bg-orange-500 text-white border-0 px-3 py-1 rounded-full shadow-lg">
            <Clock className="h-3 w-3 mr-1" />
            Delete Pending
          </Badge>
        )
      case "rejected":
        return (
          <Badge className="bg-red-500 text-white border-0 px-3 py-1 rounded-full shadow-lg">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        )
      default:
        return null
    }
  }

  const addMilestone = () => {
    if (!newMilestoneTitle.trim() || !newMilestoneDeadline) {
      toast({
        title: "Error",
        description: "Please enter milestone title and deadline",
        variant: "destructive",
      })
      return
    }
    const milestone: Milestone = {
      id: Date.now().toString(),
      title: newMilestoneTitle.trim(),
      deadline: newMilestoneDeadline,
    }
    setTimeline([...timeline, milestone])
    setNewMilestoneTitle("")
    setNewMilestoneDeadline("")
  }

  const removeMilestone = (id: string) => setTimeline(timeline.filter((m) => m.id !== id))

  if (loading) {
    if (embedInDashboard) {
      return <ProjectsManagerPanelSkeleton />
    }
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-center py-16"
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-6 h-6 border-2 border-slate-200 dark:border-slate-700 rounded-full animate-spin", "border-purple-600/30 border-t-purple-600")} />
          <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">Loading projects...</p>
        </div>
      </motion.div>
    )
  }

  return (
    <div className={cn(embedInDashboard ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4" : "max-w-5xl mx-auto space-y-6 sm:space-y-8 md:space-y-10 p-2")}>
      {!embedInDashboard ? (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className={cn(
            "p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl shrink-0",
            projectsTheme.page.iconBg
          )}>
            <Rocket className={cn("h-5 w-5 sm:h-6 sm:w-6", projectsTheme.page.iconText)} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200">My Projects</h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 sm:mt-1.5">
              <span className="sm:hidden">Create & manage</span>
              <span className="hidden sm:inline">Propose and manage projects for your approved groups</span>
            </p>
          </div>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          disabled={getMyApprovedGroups().length === 0}
          className={cn(
            "text-white rounded-lg sm:rounded-xl transition-all duration-300 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 font-semibold gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base w-full sm:w-auto shrink-0",
            projectsTheme.page.cta
          )}
        >
          <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="hidden sm:inline">Propose Project</span>
          <span className="sm:hidden">Propose</span>
        </Button>
      </div>
      ) : (
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--cc-text)]">My projects</p>
          <p className="text-xs text-[var(--cc-text-muted)]">Propose after your group is approved</p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          disabled={getMyApprovedGroups().length === 0}
          className="h-9 rounded-xl border-0 px-3 text-sm font-medium shadow-none hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "var(--cc-accent)", color: "#FFFFFF" }}
        >
          <Plus className="h-4 w-4" />
          Propose
        </Button>
      </div>
      )}

      {/* Status Alerts */}
      {getMyApprovedGroups().length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className={cn(
            "rounded-2xl",
            embedInDashboard
              ? "border border-[var(--border)] bg-[var(--muted)]/30"
              : "border border-amber-200/60 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-900/30 shadow-[0_8px_32px_rgba(245,158,11,0.2)] dark:shadow-[0_8px_32px_rgba(245,158,11,0.3)]",
          )}>
            <CardContent className="py-6 text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className={cn("p-2 rounded-lg", embedInDashboard ? projectsTheme.page.iconBg : "bg-amber-100 dark:bg-amber-900/50")}>
                  <AlertCircle className={cn("h-5 w-5", projectsTheme.page.iconText)} />
                </div>
                <h3 className={cn("text-base sm:text-lg font-semibold", embedInDashboard ? "text-[var(--cc-text)]" : "text-amber-800 dark:text-amber-300")}>Group Required</h3>
              </div>
              <p className={cn("text-xs sm:text-sm", embedInDashboard ? "text-[var(--cc-text-muted)]" : "text-amber-700 dark:text-amber-400")}>
                <span className="sm:hidden">Join an approved group first</span>
                <span className="hidden sm:inline">You need to be a member of an approved group before you can propose projects.</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {getMyApprovedGroups().length > 0 && !isLeaderOfAnyApprovedGroup() && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Alert className={cn(
            "rounded-2xl backdrop-blur-sm border",
            embedInDashboard
              ? "border-[var(--border)] bg-[var(--muted)]/30"
              : "border-blue-200/60 dark:border-blue-700/60 bg-blue-50/80 dark:bg-blue-900/30",
          )}>
            <div className={cn("p-2 rounded-lg", embedInDashboard ? "bg-[var(--cc-accent-soft)]" : "bg-blue-100 dark:bg-blue-900/50")}>
              <AlertCircle className={cn("h-5 w-5", embedInDashboard ? "text-[var(--cc-accent)]" : "text-blue-600 dark:text-blue-400")} />
            </div>
            <AlertDescription className={cn("text-xs sm:text-sm", embedInDashboard ? "text-[var(--cc-text)]" : "text-blue-800 dark:text-blue-200")}>
              <strong>Note:</strong> <span className="sm:hidden">Only leaders can propose projects</span>
              <span className="hidden sm:inline">Only group leaders can propose projects. You are a member of an approved group, but not the leader. Contact your group leader to propose a project.</span>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Projects Section */}
      <div className="grid gap-6">
        {projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className={cn(
              "rounded-2xl text-center py-16",
              embedInDashboard
                ? "border border-[var(--border)] bg-[var(--card)] shadow-none"
                : "border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
            )}>
              <CardContent>
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className={cn(
                    "p-4 rounded-2xl",
                    embedInDashboard ? projectsTheme.page.iconBg : "bg-purple-100 dark:bg-purple-900/50"
                  )}>
                    <FolderKanban className={cn(
                      "h-8 w-8",
                      embedInDashboard ? projectsTheme.page.iconText : "text-purple-600 dark:text-purple-400"
                    )} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-200">No Projects Yet</h3>
                </div>
                <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-400 mb-6 sm:mb-8 max-w-md mx-auto">
                  <span className="sm:hidden">Propose a project!</span>
                  <span className="hidden sm:inline">No projects in your section yet. Propose a project to get started!</span>
                </p>
                <Button 
                  onClick={() => setCreateDialogOpen(true)}
                  disabled={getMyApprovedGroups().length === 0}
                  className={cn(
                    "text-white rounded-lg sm:rounded-xl transition-all duration-300 px-6 sm:px-8 py-2.5 sm:py-3 font-semibold gap-2 text-sm sm:text-base w-full sm:w-auto",
                    embedInDashboard
                      ? projectsTheme.page.cta
                      : "bg-[var(--cc-accent)] hover:opacity-90 shadow-[0_8px_32px_rgba(147,51,234,0.3)] dark:shadow-[0_8px_32px_rgba(147,51,234,0.5)] hover:shadow-[0_12px_40px_rgba(147,51,234,0.4)] dark:hover:shadow-[0_12px_40px_rgba(147,51,234,0.6)]"
                  )}
                >
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="sm:hidden">Create Project</span>
                  <span className="hidden sm:inline">Create First Project</span>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          projects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <Card className="border border-slate-200/60 dark:border-slate-700/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl overflow-hidden group">
                <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <CardTitle className={cn(
                        "text-lg sm:text-xl md:text-2xl font-bold tracking-tight transition-colors duration-300 break-words dark:text-slate-200",
                        embedInDashboard ? "group-hover:text-amber-600 dark:group-hover:text-amber-400" : "group-hover:text-purple-600 dark:group-hover:text-purple-400"
                      )}>
                        {project.title}
                      </CardTitle>
                      <CardDescription className="text-xs sm:text-sm md:text-base text-slate-600 dark:text-slate-400 break-words">
                        <span className="sm:hidden">
                          {project.group.name} • {project.leader.full_name.split(' ')[0]}
                        </span>
                        <span className="hidden sm:inline">
                          {project.group.name} • Led by {project.leader.full_name}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:gap-2 w-full sm:w-auto">
                      {getStatusBadge(project.status)}
                      {canEditProject(project) && (
                        <Badge className="bg-amber-500 dark:bg-amber-600 text-white border-0 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full shadow-lg text-xs sm:text-sm">
                          <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                          Leader
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 sm:space-y-4 text-xs sm:text-sm px-4 sm:px-6 pb-4">
                  {project.rejection_reason && (
                    <Alert variant="destructive" className="rounded-lg sm:rounded-xl border-red-200/60 dark:border-red-700/60 bg-red-50/80 dark:bg-red-900/30">
                      <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 dark:text-red-400" />
                      <AlertDescription className="text-xs sm:text-sm dark:text-red-300">
                        <strong>Rejection:</strong> <span className="break-words">{project.rejection_reason}</span>
                      </AlertDescription>
                    </Alert>
                  )}

                  {project.group.pending_changes && (
                    <Alert className="rounded-lg sm:rounded-xl border-blue-200/60 dark:border-blue-700/60 bg-blue-50/80 dark:bg-blue-900/30">
                      <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 dark:text-blue-400" />
                      <AlertDescription className="text-xs sm:text-sm dark:text-blue-300">
                        <span className="sm:hidden">Pending changes</span>
                        <span className="hidden sm:inline">This project has pending changes awaiting admin approval.</span>
                      </AlertDescription>
                    </Alert>
                  )}

                  {project.summary && (
                    <div>
                      <p className="font-semibold mb-1.5 sm:mb-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200">Summary</p>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed break-words">{project.summary}</p>
                    </div>
                  )}
                  {project.deliverables && (
                    <div>
                      <p className="font-semibold mb-1.5 sm:mb-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200">Deliverables</p>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed break-words">{project.deliverables}</p>
                    </div>
                  )}

                  {project.project_link && (
                    <div>
                      <p className="font-semibold mb-2 text-slate-800 dark:text-slate-200">Project Link</p>
                      <a
                        href={project.project_link.startsWith('http://') || project.project_link.startsWith('https://') 
                          ? project.project_link 
                          : `https://${project.project_link}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 w-fit"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="truncate max-w-xs">{project.project_link}</span>
                      </a>
                    </div>
                  )}

                  {project.members?.length > 0 && (
                    <div>
                      <p className="font-semibold mb-2 sm:mb-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                        <span className="sm:hidden">Members</span>
                        <span className="hidden sm:inline">Group Members</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {project.members.map((member) => (
                          <Badge
                            key={member.id}
                            className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 border-0 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm"
                          >
                            {member.full_name}
                            {member.id === project.group.created_by && (
                              <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-1 inline text-amber-500 dark:text-amber-400" />
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {(project.target_platform || project.timeline?.length > 0) && (
                    <div className="flex flex-col gap-2 sm:gap-3 mt-2">
                      {project.target_platform && (
                        <div>
                          <p className="font-semibold mb-1.5 sm:mb-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                            <span className="sm:hidden">Platform</span>
                            <span className="hidden sm:inline">Target Platform</span>
                          </p>
                          <Badge className="bg-blue-500 dark:bg-blue-600 text-white border-0 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm">
                            {project.target_platform}
                          </Badge>
                        </div>
                      )}

                      {project.timeline?.length > 0 && (
                        <div>
                          <p className="font-semibold mb-1.5 sm:mb-2 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                            <span className="sm:hidden">Timeline</span>
                            <span className="hidden sm:inline">Timeline & Milestones</span>
                          </p>
                          <div className="space-y-1.5 sm:space-y-2">
                            {project.timeline.map((milestone) => (
                              <div key={milestone.id} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
                                <Badge className="bg-emerald-500 dark:bg-emerald-600 text-white border-0 px-2 py-0.5 rounded-full text-xs w-fit">
                                  {new Date(milestone.deadline).toLocaleDateString()}
                                </Badge>
                                <span className="break-words">{milestone.title}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-slate-500 dark:text-slate-500 pt-1">
                    <span className="sm:hidden">Updated: {new Date(project.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span className="hidden sm:inline">Last updated: {new Date(project.updated_at).toLocaleDateString()}</span>
                  </div>
                </CardContent>

                <CardFooter className="flex flex-wrap gap-2 sm:gap-3 pt-4 px-4 sm:px-6 pb-4 sm:pb-6">
                  {isProjectMember(project) && project.status === "approved" && (
                    <Button
                      variant="outline"
                      onClick={() => openAddReportDialog(project)}
                      className="rounded-lg sm:rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 dark:border-slate-700 dark:text-slate-300 transition-all duration-200 text-xs sm:text-sm px-2 sm:px-3 md:px-4 h-8 sm:h-9 md:h-10 flex-1 sm:flex-initial"
                    >
                      <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Add Report</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => openReportsDialog(project)}
                    className="rounded-lg sm:rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 dark:border-slate-700 dark:text-slate-300 transition-all duration-200 text-xs sm:text-sm px-2 sm:px-3 md:px-4 h-8 sm:h-9 md:h-10 flex-1 sm:flex-initial"
                  >
                    <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">View Reports</span>
                    <span className="sm:hidden">Reports</span>
                  </Button>

                  {canEditProject(project) && project.status !== "pending_delete" && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => openEditDialog(project)}
                        disabled={project.status === "pending" || project.status === "pending_update"}
                        className="rounded-lg sm:rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-400 dark:border-slate-700 dark:text-slate-300 transition-all duration-200 text-xs sm:text-sm px-2 sm:px-3 md:px-4 h-8 sm:h-9 md:h-10 flex-1 sm:flex-initial"
                      >
                        <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteProject(project)}
                        disabled={project.status === "pending" || project.status === "pending_delete"}
                        className="rounded-lg sm:rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 dark:border-slate-700 dark:text-slate-300 transition-all duration-200 text-xs sm:text-sm px-2 sm:px-3 md:px-4 h-8 sm:h-9 md:h-10 flex-1 sm:flex-initial"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        Delete
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Project Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl backdrop-blur-sm w-[calc(100%-2rem)] sm:w-full dark:bg-slate-800/95 dark:border-slate-700/60">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <DialogTitle className="text-xl sm:text-2xl dark:text-slate-200 flex items-center gap-2 sm:gap-3">
              <div className={cn("p-1.5 sm:p-2 rounded-lg shrink-0", embedInDashboard ? projectsTheme.page.iconBg : "bg-purple-100 dark:bg-purple-900/50")}>
                <Plus className={cn("h-4 w-4 sm:h-5 sm:w-5", embedInDashboard ? projectsTheme.page.iconText : "text-purple-600 dark:text-purple-400")} />
              </div>
              <span>
                <span className="sm:hidden">New Project</span>
                <span className="hidden sm:inline">Propose New Project</span>
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm dark:text-slate-400">
              <span className="sm:hidden">Create project proposal</span>
              <span className="hidden sm:inline">Propose a project for your group. Your proposal will be reviewed by the admin.</span>
            </DialogDescription>
          </DialogHeader>

          {!isLeaderOfAnyApprovedGroup() && (
            <Alert variant="destructive" className="mb-3 sm:mb-4 mx-4 sm:mx-6 rounded-lg sm:rounded-xl dark:bg-red-900/30 dark:border-red-700/60">
              <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 dark:text-red-400" />
              <AlertDescription className="text-xs sm:text-sm dark:text-red-300">
                <strong>Permission Denied:</strong> <span className="sm:hidden">Only leaders can create</span>
                <span className="hidden sm:inline">Only group leaders can create projects. You must be the leader of a group to propose a project.</span>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3 sm:space-y-4 py-4 px-4 sm:px-6">
            <div className="space-y-2">
              <Label htmlFor="group" className="text-sm sm:text-base dark:text-slate-300">
                <span className="sm:hidden">Group *</span>
                <span className="hidden sm:inline">Group *</span>
              </Label>
              <Select
                value={selectedGroupId}
                onValueChange={setSelectedGroupId}
                disabled={isSubmitting || !isLeaderOfAnyApprovedGroup()}
              >
                <SelectTrigger className={cn(
                  "rounded-lg sm:rounded-full h-9 sm:h-10 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200",
                  embedInDashboard && "focus:ring-2 focus:ring-amber-500/30",
                )}>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                  {getMyLeaderGroups().map((group) => (
                    <SelectItem key={group.id} value={group.id.toString()} className="dark:text-slate-200">
                      {group.name} <Crown className="h-3 w-3 ml-1 inline" />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground dark:text-slate-500">
                <span className="sm:hidden">Leader groups only</span>
                <span className="hidden sm:inline">Only groups where you are the leader are shown</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm sm:text-base dark:text-slate-300">
                <span className="sm:hidden">Title *</span>
                <span className="hidden sm:inline">Project Title *</span>
              </Label>
              <Input
                id="title"
                placeholder="Enter project title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting || !isLeaderOfAnyApprovedGroup()}
                className={cn(
                  "rounded-lg sm:rounded-full h-9 sm:h-10 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-sm sm:text-base",
                  embedInDashboard && "focus-visible:ring-2 focus-visible:ring-amber-500/30",
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary" className="text-sm sm:text-base dark:text-slate-300">Summary</Label>
              <Textarea
                id="summary"
                placeholder="Brief description..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                disabled={isSubmitting || !isLeaderOfAnyApprovedGroup()}
                rows={3}
                className="rounded-lg sm:rounded-xl dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-sm sm:text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliverables" className="text-sm sm:text-base dark:text-slate-300">Deliverables</Label>
              <Textarea
                id="deliverables"
                placeholder="List deliverables..."
                value={deliverables}
                onChange={(e) => setDeliverables(e.target.value)}
                disabled={isSubmitting || !isLeaderOfAnyApprovedGroup()}
                rows={4}
                className="rounded-lg sm:rounded-xl dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-sm sm:text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform" className="text-sm sm:text-base dark:text-slate-300">
                <span className="sm:hidden">Platform</span>
                <span className="hidden sm:inline">Target Platform</span>
              </Label>
              <Input
                id="platform"
                placeholder="e.g., Web, Mobile..."
                value={targetPlatform}
                onChange={(e) => setTargetPlatform(e.target.value)}
                disabled={isSubmitting || !isLeaderOfAnyApprovedGroup()}
                className={cn(
                  "rounded-lg sm:rounded-full h-9 sm:h-10 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-sm sm:text-base",
                  embedInDashboard && "focus-visible:ring-2 focus-visible:ring-amber-500/30",
                )}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm sm:text-base dark:text-slate-300">
                <span className="sm:hidden">Milestones</span>
                <span className="hidden sm:inline">Timeline & Milestones</span>
              </Label>
              <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 border rounded-lg sm:rounded-xl bg-muted/30 dark:bg-slate-800/50 dark:border-slate-700">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                  <Input
                    placeholder="Milestone title"
                    value={newMilestoneTitle}
                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                    disabled={isSubmitting || !isLeaderOfAnyApprovedGroup()}
                    className={cn(
                  "rounded-lg sm:rounded-full h-9 sm:h-10 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-sm sm:text-base",
                  embedInDashboard && "focus-visible:ring-2 focus-visible:ring-amber-500/30",
                )}
                  />
                  <Input
                    type="date"
                    value={newMilestoneDeadline}
                    onChange={(e) => setNewMilestoneDeadline(e.target.value)}
                    disabled={isSubmitting || !isLeaderOfAnyApprovedGroup()}
                    className="w-full sm:w-40 rounded-lg sm:rounded-full h-9 sm:h-10 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-xs sm:text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMilestone}
                    disabled={isSubmitting || !isLeaderOfAnyApprovedGroup()}
                    className="rounded-lg sm:rounded-full bg-transparent h-9 sm:h-10 w-full sm:w-auto dark:border-slate-700 dark:text-slate-300"
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
                {timeline.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    {timeline.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="flex items-center justify-between gap-2 p-2 bg-background rounded-xl"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <Badge variant="outline">{new Date(milestone.deadline).toLocaleDateString()}</Badge>
                          <span className="text-sm">{milestone.title}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMilestone(milestone.id)}
                          disabled={isSubmitting || !isLeaderOfAnyApprovedGroup()}
                          className="rounded-full"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg sm:rounded-full w-full sm:w-auto text-xs sm:text-sm dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={isSubmitting || !isLeaderOfAnyApprovedGroup()}
              className={cn(
                "rounded-lg sm:rounded-full w-full sm:w-auto text-xs sm:text-sm",
                embedInDashboard
                  ? projectsTheme.page.cta
                  : "bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white",
              )}
            >
              {isSubmitting ? (
                <>
                  <span className="hidden sm:inline">Submitting...</span>
                  <span className="sm:hidden">Submitting</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Submit Proposal</span>
                  <span className="sm:hidden">Submit</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl backdrop-blur-sm w-[calc(100%-2rem)] sm:w-full dark:bg-slate-800/95 dark:border-slate-700/60">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <DialogTitle className="text-xl sm:text-2xl dark:text-slate-200">Edit Project</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm dark:text-slate-400">
              <span className="sm:hidden">Update project details</span>
              <span className="hidden sm:inline">Update your project details. Changes to approved projects will require admin approval.</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 py-4 px-4 sm:px-6">
            <div className="space-y-2">
              <Label htmlFor="edit-title" className="text-sm sm:text-base dark:text-slate-300">
                <span className="sm:hidden">Title *</span>
                <span className="hidden sm:inline">Project Title *</span>
              </Label>
              <Input
                id="edit-title"
                placeholder="Enter project title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
                className={cn(
                  "rounded-lg sm:rounded-full h-9 sm:h-10 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-sm sm:text-base",
                  embedInDashboard && "focus-visible:ring-2 focus-visible:ring-amber-500/30",
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-summary" className="text-sm sm:text-base dark:text-slate-300">Summary</Label>
              <Textarea
                id="edit-summary"
                placeholder="Brief description..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                disabled={isSubmitting}
                rows={3}
                className="rounded-lg sm:rounded-xl dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-sm sm:text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-deliverables" className="text-sm sm:text-base dark:text-slate-300">Deliverables</Label>
              <Textarea
                id="edit-deliverables"
                placeholder="List deliverables..."
                value={deliverables}
                onChange={(e) => setDeliverables(e.target.value)}
                disabled={isSubmitting}
                rows={4}
                className="rounded-lg sm:rounded-xl dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-sm sm:text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-platform" className="text-sm sm:text-base dark:text-slate-300">
                <span className="sm:hidden">Platform</span>
                <span className="hidden sm:inline">Target Platform</span>
              </Label>
              <Input
                id="edit-platform"
                placeholder="e.g., Web, Mobile..."
                value={targetPlatform}
                onChange={(e) => setTargetPlatform(e.target.value)}
                disabled={isSubmitting}
                className={cn(
                  "rounded-lg sm:rounded-full h-9 sm:h-10 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-sm sm:text-base",
                  embedInDashboard && "focus-visible:ring-2 focus-visible:ring-amber-500/30",
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-link" className="text-sm sm:text-base dark:text-slate-300">
                <span className="sm:hidden">Link</span>
                <span className="hidden sm:inline">Project Link</span>
              </Label>
              <Input
                id="edit-link"
                type="url"
                placeholder="https://your-project-link.com"
                value={projectLink}
                onChange={(e) => setProjectLink(e.target.value)}
                disabled={isSubmitting}
                className={cn(
                  "rounded-lg sm:rounded-full h-9 sm:h-10 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-sm sm:text-base",
                  embedInDashboard && "focus-visible:ring-2 focus-visible:ring-amber-500/30",
                )}
              />
              <p className="text-xs text-muted-foreground dark:text-slate-500">
                <span className="sm:hidden">Project link URL</span>
                <span className="hidden sm:inline">Share the link to your finalized project. Link updates are saved immediately without approval.</span>
              </p>
            </div>

            {/* Milestones */}
            <div className="space-y-2">
              <Label className="text-sm sm:text-base dark:text-slate-300">
                <span className="sm:hidden">Milestones</span>
                <span className="hidden sm:inline">Timeline & Milestones</span>
              </Label>
              <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 border rounded-lg sm:rounded-xl bg-muted/30 dark:bg-slate-800/50 dark:border-slate-700">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                  <Input
                    placeholder="Milestone title"
                    value={newMilestoneTitle}
                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                    disabled={isSubmitting}
                    className={cn(
                  "rounded-lg sm:rounded-full h-9 sm:h-10 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-sm sm:text-base",
                  embedInDashboard && "focus-visible:ring-2 focus-visible:ring-amber-500/30",
                )}
                  />
                  <Input
                    type="date"
                    value={newMilestoneDeadline}
                    onChange={(e) => setNewMilestoneDeadline(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full sm:w-40 rounded-lg sm:rounded-full h-9 sm:h-10 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-xs sm:text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMilestone}
                    disabled={isSubmitting}
                    className="rounded-lg sm:rounded-full bg-transparent h-9 sm:h-10 w-full sm:w-auto dark:border-slate-700 dark:text-slate-300"
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
                {timeline.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    {timeline.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="flex items-center justify-between gap-2 p-2 bg-slate-50/50 dark:bg-slate-800/50 rounded-lg sm:rounded-xl border border-slate-200/60 dark:border-slate-700/60"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Badge variant="outline" className="text-xs shrink-0 dark:border-slate-700 dark:text-slate-300">
                            {new Date(milestone.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
                          <span className="text-xs sm:text-sm dark:text-slate-300 truncate">{milestone.title}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMilestone(milestone.id)}
                          disabled={isSubmitting}
                          className="rounded-full h-7 w-7 sm:h-8 sm:w-8 p-0 dark:hover:bg-slate-700"
                        >
                          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg sm:rounded-full w-full sm:w-auto text-xs sm:text-sm dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditProject}
              disabled={isSubmitting}
              className="rounded-lg sm:rounded-full bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white w-full sm:w-auto text-xs sm:text-sm"
            >
              {isSubmitting ? (
                <>
                  <span className="hidden sm:inline">Saving...</span>
                  <span className="sm:hidden">Saving</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Save Changes</span>
                  <span className="sm:hidden">Save</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Reports Dialog */}
      <Dialog open={reportsDialogOpen} onOpenChange={setReportsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl backdrop-blur-sm w-[calc(100%-2rem)] sm:w-full dark:bg-slate-800/95 dark:border-slate-700/60">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <DialogTitle className="text-lg sm:text-xl md:text-2xl dark:text-slate-200">
              <span className="sm:hidden">Reports</span>
              <span className="hidden sm:inline">Project Reports - {selectedProject?.title}</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm dark:text-slate-400">
              <span className="sm:hidden">Team progress updates</span>
              <span className="hidden sm:inline">Progress updates and reports from all team members.</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 py-4 px-4 sm:px-6">
            {projectReports.length === 0 ? (
              <div className="text-center py-6 sm:py-8 text-muted-foreground dark:text-slate-400">
                <FileText className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50 dark:text-slate-500" />
                <p className="text-xs sm:text-sm">No progress reports yet.</p>
              </div>
            ) : (
              projectReports.map((report) => (
                <Card key={report.id} className="rounded-xl sm:rounded-2xl border border-indigo-400/20 dark:border-indigo-700/40 bg-indigo-500/5 dark:bg-indigo-900/20">
                  <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm sm:text-base font-semibold dark:text-slate-200 break-words">{report.student_name}</CardTitle>
                        <CardDescription className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400">
                          <span className="sm:hidden">
                            {new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="hidden sm:inline">
                            {new Date(report.created_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })} •{" "}
                            {new Date(report.created_at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' })}
                          </span>
                        </CardDescription>
                      </div>
                      {report.student_id === studentDatabaseId && (
                        <Badge variant="outline" className="rounded-full text-indigo-600 dark:text-indigo-400 dark:border-indigo-700 text-xs px-2 py-0.5 sm:py-1 w-fit">
                          Your Report
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 sm:space-y-3 px-4 sm:px-6 pb-4 sm:pb-6">
                    <div>
                      <p className="text-xs sm:text-sm font-medium mb-1 dark:text-slate-300">
                        <span className="sm:hidden">Progress</span>
                        <span className="hidden sm:inline">Progress Made</span>
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400 whitespace-pre-wrap break-words">{report.progress}</p>
                    </div>
                    {report.challenges && (
                      <div>
                        <p className="text-xs sm:text-sm font-medium mb-1 dark:text-slate-300">
                          <span className="sm:hidden">Challenges</span>
                          <span className="hidden sm:inline">Challenges Encountered</span>
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400 whitespace-pre-wrap break-words">{report.challenges}</p>
                      </div>
                    )}
                    {report.deliverables_status && (
                      <div>
                        <p className="text-xs sm:text-sm font-medium mb-1 dark:text-slate-300">
                          <span className="sm:hidden">Deliverables</span>
                          <span className="hidden sm:inline">Deliverables Status</span>
                        </p>
                        <p className="text-xs sm:text-sm text-muted-foreground dark:text-slate-400 whitespace-pre-wrap break-words">
                          {report.deliverables_status}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Progress Report Dialog */}
      <Dialog open={addReportDialogOpen} onOpenChange={setAddReportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-2xl backdrop-blur-sm w-[calc(100%-2rem)] sm:w-full dark:bg-slate-800/95 dark:border-slate-700/60">
          <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <DialogTitle className="text-xl sm:text-2xl dark:text-slate-200">
              <span className="sm:hidden">New Report</span>
              <span className="hidden sm:inline">Add Progress Report</span>
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm dark:text-slate-400">
              <span className="sm:hidden">Document progress</span>
              <span className="hidden sm:inline">Document your progress, challenges, and deliverables for <strong>{selectedProject?.title}</strong>.</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4 py-4 px-4 sm:px-6">
            <div className="space-y-2">
              <Label htmlFor="report-progress" className="text-sm sm:text-base dark:text-slate-300">
                <span className="sm:hidden">Progress *</span>
                <span className="hidden sm:inline">Progress Made *</span>
              </Label>
              <Textarea
                id="report-progress"
                placeholder="Describe what you've accomplished..."
                value={reportProgress}
                onChange={(e) => setReportProgress(e.target.value)}
                disabled={isSubmitting}
                rows={4}
                className="rounded-lg sm:rounded-xl dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-sm sm:text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-challenges" className="text-sm sm:text-base dark:text-slate-300">
                <span className="sm:hidden">Challenges</span>
                <span className="hidden sm:inline">Challenges Encountered</span>
              </Label>
              <Textarea
                id="report-challenges"
                placeholder="Any obstacles..."
                value={reportChallenges}
                onChange={(e) => setReportChallenges(e.target.value)}
                disabled={isSubmitting}
                rows={3}
                className="rounded-lg sm:rounded-xl dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-sm sm:text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-deliverables" className="text-sm sm:text-base dark:text-slate-300">
                <span className="sm:hidden">Deliverables</span>
                <span className="hidden sm:inline">Deliverables Status</span>
              </Label>
              <Textarea
                id="report-deliverables"
                placeholder="Status of deliverables..."
                value={reportDeliverables}
                onChange={(e) => setReportDeliverables(e.target.value)}
                disabled={isSubmitting}
                rows={3}
                className="rounded-lg sm:rounded-xl dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-200 text-sm sm:text-base"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setAddReportDialogOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg sm:rounded-full w-full sm:w-auto text-xs sm:text-sm dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddReport}
              disabled={isSubmitting}
              className="rounded-lg sm:rounded-full bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white w-full sm:w-auto text-xs sm:text-sm"
            >
              {isSubmitting ? (
                <>
                  <span className="hidden sm:inline">Submitting...</span>
                  <span className="sm:hidden">Submitting</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Submit Report</span>
                  <span className="sm:hidden">Submit</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project AlertDialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 rounded-xl sm:rounded-2xl shadow-md w-[calc(100%-2rem)] sm:w-full max-w-md">
          <AlertDialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4">
            <AlertDialogTitle className="text-lg sm:text-xl dark:text-slate-200">Delete Project</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm dark:text-slate-400 break-words">
              <span className="sm:hidden">
                Delete "{selectedProject?.title}"? This cannot be undone.
              </span>
              <span className="hidden sm:inline">
                Are you sure you want to delete "{selectedProject?.title}"? This action cannot be undone and will remove all associated reports and data.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6 flex-col sm:flex-row">
            <AlertDialogCancel className="w-full sm:w-auto text-xs sm:text-sm rounded-lg sm:rounded-xl dark:border-slate-700 dark:text-slate-300 h-9 sm:h-10">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteProject} 
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
    </div>
  )
}
