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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FolderKanban, Trash2, Eye, CheckCircle, XCircle, Clock, FileText, Edit, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Project } from "@/lib/types/project"
import { buildProjectsListUrl } from "@/lib/build-projects-list-url"
import { PROJECT_MODULE_SESSIONS } from "@/lib/project-module-sessions"

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

export function AdminProjectsManagement() {
  const { toast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectReports, setProjectReports] = useState<ProjectReport[]>([])
  const [rejectionReason, setRejectionReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Edit form state
  const [editTitle, setEditTitle] = useState("")
  const [editSummary, setEditSummary] = useState("")
  const [editDeliverables, setEditDeliverables] = useState("")
  const [editPlatform, setEditPlatform] = useState("")
  const [editTimeline, setEditTimeline] = useState("")

  const sessions = PROJECT_MODULE_SESSIONS.map((s) => s.code)

  useEffect(() => {
    fetchProjects()
  }, [selectedSession, statusFilter])

  const fetchProjects = async () => {
    try {
      const response = await fetch(buildProjectsListUrl(selectedSession, statusFilter))
      const data = await response.json()
      setProjects(data.projects || [])
    } catch (error) {
      console.error("[v0] Failed to fetch projects:", error)
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchProjectReports = async (projectId: number) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/reports`)
      const data = await response.json()
      setProjectReports(data.reports || [])
    } catch (error) {
      console.error("[v0] Failed to fetch project reports:", error)
      toast({
        title: "Error",
        description: "Failed to load project reports",
        variant: "destructive",
      })
    }
  }

  const handleApproveProject = async (projectId: number, projectTitle: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/approve`, {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to approve project")
      }

      const data = await response.json()

      toast({
        title: "Success",
        description: data.deleted
          ? `Project "${projectTitle}" has been deleted`
          : `Project "${projectTitle}" has been approved`,
      })

      fetchProjects()
    } catch (error: any) {
      console.error("[v0] Failed to approve project:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to approve project",
        variant: "destructive",
      })
    }
  }

  const openRejectDialog = (project: Project) => {
    setSelectedProject(project)
    setRejectionReason("")
    setRejectDialogOpen(true)
  }

  const handleRejectProject = async () => {
    if (!selectedProject) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason || null }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to reject project")
      }

      toast({
        title: "Success",
        description: `Project "${selectedProject.title}" has been rejected`,
      })

      setRejectDialogOpen(false)
      setSelectedProject(null)
      setRejectionReason("")
      fetchProjects()
    } catch (error: any) {
      console.error("[v0] Failed to reject project:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to reject project",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEditDialog = (project: Project) => {
    setSelectedProject(project)
    setEditTitle(project.title)
    setEditSummary(project.summary || "")
    setEditDeliverables(project.deliverables || "")
    setEditPlatform(project.target_platform || "")
    setEditTimeline(project.timeline || "")
    setEditDialogOpen(true)
  }

  const handleEditProject = async () => {
    if (!selectedProject || !editTitle.trim()) {
      toast({
        title: "Error",
        description: "Project title is required",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          summary: editSummary || null,
          deliverables: editDeliverables || null,
          targetPlatform: editPlatform || null,
          timeline: editTimeline || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update project")
      }

      toast({
        title: "Success",
        description: "Project updated successfully",
      })

      setEditDialogOpen(false)
      setSelectedProject(null)
      fetchProjects()
    } catch (error: any) {
      console.error("[v0] Failed to update project:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update project",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteProject = async (project: Project) => {
    setSelectedProject(project)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteProject = async () => {
    if (!selectedProject) return

    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete project")
      }

      toast({
        title: "Success",
        description: "Project deleted successfully",
      })

      setDeleteDialogOpen(false)
      setSelectedProject(null)
      fetchProjects()
    } catch (error: any) {
      console.error("[v0] Failed to delete project:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      })
    }
  }

  const openViewDialog = (project: Project) => {
    setSelectedProject(project)
    setViewDialogOpen(true)
  }

  const openReportsDialog = (project: Project) => {
    setSelectedProject(project)
    fetchProjectReports(project.id)
    setReportsDialogOpen(true)
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
            Pending Approval
          </Badge>
        )
      case "pending_update":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500">
            <Clock className="h-3 w-3 mr-1" />
            Update Pending
          </Badge>
        )
      case "pending_delete":
        return (
          <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500">
            <Clock className="h-3 w-3 mr-1" />
            Delete Pending
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

  const getProjectsBySession = (session: string) => {
    let filtered = projects.filter((p) => p.group.session === session)
    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.status === statusFilter)
    }
    return filtered
  }

  const getFilteredProjects = () => {
    if (statusFilter === "all") return projects
    return projects.filter((p) => p.status === statusFilter)
  }

  const renderProjectCard = (project: Project) => (
    <Card key={project.id} className="border-2">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">{project.title}</CardTitle>
            <CardDescription className="mt-2">
              {project.group.name} • Section {project.group.session} • Led by {project.leader.full_name}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {getStatusBadge(project.status)}
            <Badge variant="outline">{project.group.session}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {project.rejection_reason && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Rejection Reason:</strong> {project.rejection_reason}
            </AlertDescription>
          </Alert>
        )}

        {project.group.pending_changes && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>This project has pending changes awaiting approval.</AlertDescription>
          </Alert>
        )}

        {project.summary && (
          <div>
            <p className="text-sm font-medium mb-1">Summary</p>
            <p className="text-sm text-muted-foreground line-clamp-2">{project.summary}</p>
          </div>
        )}
        <div className="flex gap-4 flex-wrap">
          {project.target_platform && (
            <div>
              <p className="text-sm font-medium mb-1">Platform</p>
              <Badge variant="secondary">{project.target_platform}</Badge>
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Created: {new Date(project.created_at).toLocaleDateString()} • Last updated:{" "}
          {new Date(project.updated_at).toLocaleDateString()}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 flex-wrap">
        {(project.status === "pending" ||
          project.status === "pending_update" ||
          project.status === "pending_delete") && (
          <>
            <Button
              variant="default"
              className="bg-success hover:bg-success/90"
              onClick={() => handleApproveProject(project.id, project.title)}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
            <Button variant="destructive" onClick={() => openRejectDialog(project)}>
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => openViewDialog(project)}>
          <Eye className="h-4 w-4 mr-2" />
          View Details
        </Button>
        <Button variant="outline" onClick={() => openReportsDialog(project)}>
          <FileText className="h-4 w-4 mr-2" />
          View Reports
        </Button>
        <Button variant="outline" onClick={() => openEditDialog(project)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
        {project.status !== "pending_delete" && (
          <Button variant="destructive" onClick={() => handleDeleteProject(project)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
      </CardFooter>
    </Card>
  )

  const handleClearAllProjects = async () => {
    try {
      const response = await fetch("/api/admin/projects/clear", {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to clear all projects")
      }

      toast({
        title: "Success",
        description: "All projects have been cleared",
      })

      setClearAllDialogOpen(false)
      fetchProjects()
    } catch (error: any) {
      console.error("Failed to clear all projects:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to clear all projects",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading projects...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Manage Projects</h2>
          <p className="text-muted-foreground">View and manage student projects across all sections</p>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={() => setClearAllDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All Projects
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="pending_update">Pending Update</SelectItem>
              <SelectItem value="pending_delete">Pending Delete</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              {PROJECT_MODULE_SESSIONS.map(({ code, label }) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedSession === "all" ? (
        <Tabs defaultValue={sessions[0]} className="w-full">
          <TabsList
            className="grid w-full"
            style={{ gridTemplateColumns: `repeat(${sessions.length}, minmax(0, 1fr))` }}
          >
            {sessions.map((session) => {
              const label =
                PROJECT_MODULE_SESSIONS.find((s) => s.code === session)?.label ?? session
              return (
                <TabsTrigger key={session} value={session}>
                  {label} ({getProjectsBySession(session).length})
                </TabsTrigger>
              )
            })}
          </TabsList>
          {sessions.map((session) => (
            <TabsContent key={session} value={session} className="space-y-4 mt-6">
              {getProjectsBySession(session).length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No projects in Section {session} yet.</p>
                  </CardContent>
                </Card>
              ) : (
                getProjectsBySession(session).map(renderProjectCard)
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="space-y-4">
          {getFilteredProjects().length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No projects found.</p>
              </CardContent>
            </Card>
          ) : (
            getFilteredProjects().map(renderProjectCard)
          )}
        </div>
      )}

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedProject?.title}</DialogTitle>
            <DialogDescription>
              {selectedProject?.group.name} • Section {selectedProject?.group.session} • Led by{" "}
              {selectedProject?.leader.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedProject?.group.pending_changes && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <strong>Pending Changes:</strong>
                  <pre className="mt-2 text-xs bg-muted p-2 rounded">
                    {JSON.stringify(selectedProject.group.pending_changes, null, 2)}
                  </pre>
                </AlertDescription>
              </Alert>
            )}

            {selectedProject?.rejection_reason && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Rejection Reason:</strong> {selectedProject.rejection_reason}
                </AlertDescription>
              </Alert>
            )}

            {selectedProject?.summary && (
              <div>
                <p className="text-sm font-medium mb-2">Summary</p>
                <p className="text-sm text-muted-foreground">{selectedProject.summary}</p>
              </div>
            )}
            {selectedProject?.deliverables && (
              <div>
                <p className="text-sm font-medium mb-2">Deliverables</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedProject.deliverables}</p>
              </div>
            )}
            <div className="flex gap-4">
              {selectedProject?.target_platform && (
                <div>
                  <p className="text-sm font-medium mb-2">Target Platform</p>
                  <Badge variant="secondary">{selectedProject.target_platform}</Badge>
                </div>
              )}
              {selectedProject?.timeline && (
                <div>
                  <p className="text-sm font-medium mb-2">Timeline</p>
                  <Badge variant="outline">{selectedProject.timeline}</Badge>
                </div>
              )}
            </div>
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Created: {selectedProject && new Date(selectedProject.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })}
              </p>
              <p className="text-xs text-muted-foreground">
                Last Updated: {selectedProject && new Date(selectedProject.updated_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project (Admin Override)</DialogTitle>
            <DialogDescription>
              Make direct changes to this project. Changes are applied immediately without approval.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-edit-title">Project Title *</Label>
              <Input
                id="admin-edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-edit-summary">Summary</Label>
              <Textarea
                id="admin-edit-summary"
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                disabled={isSubmitting}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-edit-deliverables">Deliverables</Label>
              <Textarea
                id="admin-edit-deliverables"
                value={editDeliverables}
                onChange={(e) => setEditDeliverables(e.target.value)}
                disabled={isSubmitting}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-edit-platform">Target Platform</Label>
              <Input
                id="admin-edit-platform"
                value={editPlatform}
                onChange={(e) => setEditPlatform(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-edit-timeline">Timeline</Label>
              <Input
                id="admin-edit-timeline"
                value={editTimeline}
                onChange={(e) => setEditTimeline(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleEditProject} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Reports Dialog */}
      <Dialog open={reportsDialogOpen} onOpenChange={setReportsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Project Reports - {selectedProject?.title}</DialogTitle>
            <DialogDescription>Progress updates from all team members</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {projectReports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No progress reports yet.</p>
              </div>
            ) : (
              projectReports.map((report) => (
                <Card key={report.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">
                          {report.student_name} ({report.student_number})
                        </CardTitle>
                        <CardDescription>
                          {new Date(report.created_at).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })} at{" "}
                          {new Date(report.created_at).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' })}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-1">Progress Made</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.progress}</p>
                    </div>
                    {report.challenges && (
                      <div>
                        <p className="text-sm font-medium mb-1">Challenges Encountered</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.challenges}</p>
                      </div>
                    )}
                    {report.deliverables_status && (
                      <div>
                        <p className="text-sm font-medium mb-1">Deliverables Status</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
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

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Project</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting "{selectedProject?.title}". This will be visible to the group leader.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason (Optional)</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Explain why this project is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                disabled={isSubmitting}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRejectProject} disabled={isSubmitting}>
              {isSubmitting ? "Rejecting..." : "Reject Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedProject?.title}"? This action cannot be undone and will also
              delete all associated project reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Projects Confirmation Dialog */}
      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Projects</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete ALL projects? This action cannot be undone and will permanently remove all
              projects and their reports from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllProjects}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All Projects
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
