"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FolderKanban,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Edit,
  AlertCircle,
  ExternalLink,
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Project } from "@/lib/types/project";
import { buildProjectsListUrl } from "@/lib/build-projects-list-url"
import { ProjectListPaginationBar } from "@/components/project-list-pagination-bar"
import type { ProjectListPageSize } from "@/lib/pagination-ui"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { uniqueSessionCodes } from "@/lib/unique-session-codes"
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import { cn } from "@/lib/utils"
import { ProjectStarVoting } from "@/components/project-star-voting"

function projectCardMeta(project: Project): string {
  const parts: string[] = []
  const groupName = project.group?.name?.trim()
  if (groupName && groupName.toLowerCase() !== project.title.trim().toLowerCase()) {
    parts.push(groupName)
  }
  if (project.group?.session) parts.push(project.group.session)
  if (project.leader?.full_name) parts.push(project.leader.full_name)
  const memberCount = project.members?.length ?? 0
  if (memberCount > 0) {
    parts.push(`${memberCount} member${memberCount === 1 ? "" : "s"}`)
  }
  return parts.join(" · ")
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      return star[1].trim()
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header)
  if (quoted?.[1]) return quoted[1].trim()
  const bare = /filename=([^;\s]+)/i.exec(header)
  return bare?.[1]?.replace(/^["']|["']$/g, "").trim() ?? null
}

interface ProjectReport {
  id: number;
  project_id: number;
  student_id: number;
  progress: string;
  challenges: string | null;
  deliverables_status: string | null;
  created_at: string;
  student_name: string;
  student_number: string;
}

export function InstructorProjectsManagement() {
  const chrome = facultyEmbedChrome("projects")
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectReports, setProjectReports] = useState<ProjectReport[]>([]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [instructorId, setInstructorId] = useState<number | null>(null);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState<ProjectListPageSize>(30);
  const { courseScopeVersion } = useInstructorDashboardV2();

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editDeliverables, setEditDeliverables] = useState("");
  const [editPlatform, setEditPlatform] = useState("");
  const [editTimeline, setEditTimeline] = useState("");
  const [sessions, setSessions] = useState<string[]>(["all"]);

  // Get instructor ID from localStorage
  useEffect(() => {
    fetchSessions()
  }, [courseScopeVersion])

  const fetchSessions = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/sessions", { headers: getInstructorScopeHeaders() })
      if (!response.ok) throw new Error("Failed to fetch sessions")
      const data = await response.json()
      const sessionCodes = uniqueSessionCodes(data.sessions || []).map((s: { code: string }) => s.code)
      setSessions(["all", ...sessionCodes])
    } catch (error) {
      console.error("[Projects Management] Failed to fetch sessions:", error)
      setSessions(["all"])
    }
  }

  useEffect(() => {
    const instructorSession = localStorage.getItem("instructorSession");
    if (instructorSession) {
      try {
        const session = JSON.parse(instructorSession);
        setInstructorId(session.databaseId || session.id);
      } catch (error) {
        console.error("Error parsing instructor session:", error);
      }
    }
  }, []);

  useEffect(() => {
    setListPage(1);
  }, [selectedSession, statusFilter, searchQuery, listPageSize]);

  useEffect(() => {
    fetchProjects();
  }, [selectedSession, statusFilter, courseScopeVersion]);

  const fetchProjects = async () => {
    try {
      const url = buildProjectsListUrl(selectedSession, statusFilter);
      const response = await fetch(url, { headers: getInstructorScopeHeaders() });
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error("[v0] Failed to fetch projects:", error);
      toast({
        title: "❌ Failed to Load Projects",
        description:
          "Could not retrieve project data from the database. Please refresh the page or check your connection.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectReports = async (projectId: number) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/reports`);
      const data = await response.json();
      setProjectReports(data.reports || []);
    } catch (error) {
      console.error("[v0] Failed to fetch project reports:", error);
      toast({
        title: "Error",
        description: "Failed to load project reports",
        variant: "destructive",
      });
    }
  };

  const handleApproveProject = async (
    projectId: number,
    projectTitle: string
  ) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/approve`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve project");
      }

      const data = await response.json();

      toast({
        title: data.deleted ? "🗑️ Project Deleted" : "✅ Project Approved",
        description: data.deleted
          ? `Project "${projectTitle}" was a duplicate and has been removed automatically.`
          : `Project "${projectTitle}" has been approved and is now active. The team can proceed with development.`,
      });

      fetchProjects();
    } catch (error: any) {
      console.error("[v0] Failed to approve project:", error);
      toast({
        title: "❌ Failed to Approve Project",
        description: `Could not approve "${projectTitle}". ${
          error.message || "Please try again."
        }`,
        variant: "destructive",
      });
    }
  };

  const openRejectDialog = (project: Project) => {
    setSelectedProject(project);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleRejectProject = async () => {
    if (!selectedProject) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/projects/${selectedProject.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectionReason || null }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reject project");
      }

      toast({
        title: "❌ Project Rejected",
        description: rejectionReason
          ? `Project "${selectedProject.title}" has been rejected. Reason: "${rejectionReason}". The team will be notified and can resubmit.`
          : `Project "${selectedProject.title}" has been rejected. The team will be notified and can make improvements before resubmitting.`,
      });

      setRejectDialogOpen(false);
      setSelectedProject(null);
      setRejectionReason("");
      fetchProjects();
    } catch (error: any) {
      console.error("[v0] Failed to reject project:", error);
      toast({
        title: "❌ Failed to Reject Project",
        description: `Could not reject project. ${
          error.message || "Please try again."
        }`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (project: Project) => {
    setSelectedProject(project);
    setEditTitle(project.title);
    setEditSummary(project.summary || "");
    setEditDeliverables(project.deliverables || "");
    setEditPlatform(project.target_platform || "");
    // Convert timeline array to string representation for editing
    if (Array.isArray(project.timeline) && project.timeline.length > 0) {
      setEditTimeline(JSON.stringify(project.timeline, null, 2));
    } else {
      setEditTimeline(project.timeline ? String(project.timeline) : "");
    }
    setEditDialogOpen(true);
  };

  const handleEditProject = async () => {
    if (!selectedProject || !editTitle.trim()) {
      toast({
        title: "⚠️ Title Required",
        description:
          "Please enter a project title before saving. The title is required to identify the project.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
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
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update project");
      }

      toast({
        title: "✅ Project Updated",
        description: `Successfully updated "${editTitle}". Changes include: ${
          [
            editTitle !== selectedProject.title ? "title" : null,
            editSummary !== selectedProject.summary ? "summary" : null,
            editDeliverables !== selectedProject.deliverables
              ? "deliverables"
              : null,
            editPlatform !== selectedProject.target_platform
              ? "platform"
              : null,
            editTimeline !==
            (typeof selectedProject.timeline === "string"
              ? selectedProject.timeline
              : JSON.stringify(selectedProject.timeline ?? "", null, 2))
              ? "timeline"
              : null,
          ]
            .filter(Boolean)
            .join(", ") || "project details"
        }. The team will be notified.`,
      });

      setEditDialogOpen(false);
      setSelectedProject(null);
      fetchProjects();
    } catch (error: any) {
      console.error("[v0] Failed to update project:", error);
      toast({
        title: "❌ Failed to Update Project",
        description: `Could not save changes to "${editTitle}". ${
          error.message || "Please try again."
        }`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteProject = async () => {
    if (!selectedProject) return;

    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete project");
      }

      toast({
        title: "🗑️ Project Deleted",
        description: `Project "${selectedProject.title}" (ID: ${selectedProject.id}) has been permanently deleted along with all progress reports. This action cannot be undone.`,
      });

      setDeleteDialogOpen(false);
      setSelectedProject(null);
      fetchProjects();
    } catch (error: any) {
      console.error("[v0] Failed to delete project:", error);
      toast({
        title: "❌ Failed to Delete Project",
        description: `Could not delete project "${selectedProject?.title}". ${
          error.message || "Please try again."
        }`,
        variant: "destructive",
      });
    }
  };

  const handleClearAllProjects = async () => {
    try {
      const response = await fetch("/api/admin/projects/clear", {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to clear all projects");
      }

      toast({
        title: "Success",
        description: "All projects have been cleared",
      });

      setClearAllDialogOpen(false);
      fetchProjects();
    } catch (error: any) {
      console.error("[v0] Failed to clear all projects:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to clear all projects",
        variant: "destructive",
      });
    }
  };

  const openViewDialog = (project: Project) => {
    setSelectedProject(project);
    setViewDialogOpen(true);
  };

  const openReportsDialog = async (project: Project) => {
    setSelectedProject(project);
    await fetchProjectReports(project.id);
    setReportsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--cc-sem-success)]/15 text-[var(--cc-sem-success)]">
            <CheckCircle className="h-3 w-3" aria-hidden />
            Approved
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--cc-sem-warning)]/15 text-[var(--cc-sem-warning)]">
            <Clock className="h-3 w-3" aria-hidden />
            Pending
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--cc-sem-danger)]/15 text-[var(--cc-sem-danger)]">
            <XCircle className="h-3 w-3" aria-hidden />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const handleExportPDF = async () => {
    // Show loading toast
    const loadingToast = toast({
      title: (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Generating PDF Report</span>
        </div>
      ),
      description: "Please wait while we prepare your projects export...",
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

      const url = `/api/projects/export${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url, {
        headers: buildInstructorAuthorizedApiHeaders(),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.details || "Failed to export projects")
      }

      // Download PDF
      const blob = await response.blob()
      const url_blob = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      const fromHeader = filenameFromContentDisposition(response.headers.get("content-disposition"))
      const fileName =
        fromHeader && /\.pdf$/i.test(fromHeader)
          ? fromHeader
          : `projects-report-${selectedSession || "all"}-${Date.now()}.pdf`
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
            <span>Projects report has been downloaded successfully.</span>
            <span className="text-xs opacity-75 font-mono">{fileName}</span>
          </div>
        ),
        duration: 5000,
      })
    } catch (error: any) {
      console.error("Failed to export PDF:", error)
      
      // Update toast to error
      loadingToast.update({
        id: loadingToast.id,
        title: (
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span>Export Failed</span>
          </div>
        ),
        description: error.message || "Failed to export projects to PDF. Please try again.",
        variant: "destructive",
        duration: 5000,
      })
    }
  }

  const filteredProjects = useMemo(() => {
    let filtered = projects;

    if (selectedSession !== "all") {
      filtered = filtered.filter((p) => p.group?.session === selectedSession);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.group?.name.toLowerCase().includes(query) ||
          p.leader?.full_name.toLowerCase().includes(query) ||
          p.summary?.toLowerCase().includes(query) ||
          p.deliverables?.toLowerCase().includes(query) ||
          p.target_platform?.toLowerCase().includes(query) ||
          p.members?.some(
            (m) =>
              m.full_name.toLowerCase().includes(query) ||
              m.student_id.toLowerCase().includes(query)
          )
      );
    }

    return filtered;
  }, [projects, selectedSession, statusFilter, searchQuery]);

  const listTotalPages = Math.max(1, Math.ceil(filteredProjects.length / listPageSize));
  const listPageClamped = Math.min(listPage, listTotalPages);
  const paginatedProjects = useMemo(() => {
    const start = (listPageClamped - 1) * listPageSize;
    return filteredProjects.slice(start, start + listPageSize);
  }, [filteredProjects, listPageClamped, listPageSize]);

  const cardActionClass =
    "h-7 w-7 text-[var(--cc-text-muted)] hover:bg-[var(--cc-accent-soft)]/45 hover:text-[var(--cc-text)]"

  const renderProjectCard = (project: Project, index: number) => {
    const stripe = portalListStripe(index, chrome.theme.family)
    return (
    <article
      key={project.id}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-colors hover:bg-[var(--cc-accent-soft)]/45",
      )}
    >
      <button
        type="button"
        onClick={() => openViewDialog(project)}
        className="flex flex-1 flex-col gap-3 p-3 text-left sm:p-4"
      >
        <div className="flex items-start gap-3">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
            <FolderKanban className={cn("h-5 w-5", stripe.iconText)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3
                className={cn("min-w-0 flex-1 text-sm font-semibold leading-snug line-clamp-2", PORTAL_TEXT)}
                title={project.title}
              >
                {project.title}
              </h3>
              {getStatusBadge(project.status)}
            </div>
            <p className={cn("mt-0.5 text-xs line-clamp-1", PORTAL_TEXT_MUTED)}>{projectCardMeta(project)}</p>
          </div>
        </div>
        {project.summary ? (
          <p className={cn("text-xs leading-relaxed line-clamp-2", PORTAL_TEXT_MUTED)}>{project.summary}</p>
        ) : null}
      </button>
      <div
        className="flex items-center justify-between gap-2 border-t border-[var(--border)]/60 px-2 py-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className={cardActionClass} onClick={() => openViewDialog(project)} title="View">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className={cardActionClass} onClick={() => openEditDialog(project)} title="Edit">
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className={cardActionClass} onClick={() => openReportsDialog(project)} title="Reports">
            <FileText className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-0.5">
          {project.status === "pending" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--cc-sem-success)] hover:bg-[var(--cc-sem-success)]/10"
                onClick={() => handleApproveProject(project.id, project.title)}
                title="Approve"
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--cc-sem-danger)] hover:bg-[var(--cc-sem-danger)]/10"
                onClick={() => openRejectDialog(project)}
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
            onClick={() => handleDeleteProject(project)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </article>
    )
  };

  const renderProjectListItem = (project: Project, index: number) => {
    const stripe = portalListStripe(index, chrome.theme.family)
    return (
    <div
      key={project.id}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--cc-accent-soft)]/45 sm:gap-4 sm:px-4 sm:py-3",
      )}
    >
      <button
        type="button"
        onClick={() => openViewDialog(project)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4"
      >
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
          <FolderKanban className={cn("h-4 w-4", stripe.iconText)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("truncate text-sm font-medium", PORTAL_TEXT)} title={project.title}>
              {project.title}
            </h3>
            {getStatusBadge(project.status)}
          </div>
          <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>{projectCardMeta(project)}</p>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className={cardActionClass} onClick={() => openViewDialog(project)}>
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className={cardActionClass} onClick={() => openEditDialog(project)}>
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className={cardActionClass} onClick={() => openReportsDialog(project)}>
          <FileText className="h-3.5 w-3.5" />
        </Button>
        {project.status === "pending" && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-[var(--cc-sem-success)]" onClick={() => handleApproveProject(project.id, project.title)}>
              <CheckCircle className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-[var(--cc-sem-danger)]" onClick={() => openRejectDialog(project)}>
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-[var(--cc-text-muted)] hover:text-[var(--cc-sem-danger)]" onClick={() => handleDeleteProject(project)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
    )
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className={cn("flex items-center gap-3 text-sm", PORTAL_TEXT_MUTED)}>
          <div className="size-5 animate-spin rounded-full border-2 border-[var(--cc-accent)] border-t-transparent" aria-hidden />
          Loading projects…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FacultyIntegratedToolbar
        moduleId="projects"
        search={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchClear={() => setSearchQuery("")}
        searchPlaceholder="Search projects…"
        filters={
          <>
            <Select value={selectedSession} onValueChange={setSelectedSession}>
              <SelectTrigger
                className={cn(
                  facultyToolbarFilterButtonClass(selectedSession !== "all"),
                  "h-9 w-[148px] shadow-none",
                )}
              >
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections ({projects.length})</SelectItem>
                {sessions.filter((s) => s !== "all").map((session) => (
                  <SelectItem key={session} value={session}>
                    {session} ({projects.filter((p) => p.group?.session === session).length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className={cn(
                  facultyToolbarFilterButtonClass(statusFilter !== "all"),
                  "h-9 w-[120px] shadow-none",
                )}
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        viewMode={viewMode === "card" ? "grid" : "list"}
        onViewModeChange={(mode) => setViewMode(mode === "grid" ? "card" : "list")}
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {filteredProjects.length === projects.length
              ? `${filteredProjects.length} projects`
              : `${filteredProjects.length} of ${projects.length} projects`}
          </p>
        }
        trailing={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportPDF}
              className={facultyToolbarFilterButtonClass()}
            >
              <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setClearAllDialogOpen(true)}
              className={cn(facultyToolbarFilterButtonClass(), "text-red-600 hover:text-red-700")}
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span className="hidden sm:inline">Clear all</span>
            </Button>
          </>
        }
      />

      {/* Projects Content */}
      <div>
        {filteredProjects.length === 0 ? (
          <div className={cn(chrome.card, "border-dashed py-14 text-center")}>
            <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
              <FolderKanban className="h-5 w-5 !text-white" />
            </div>
            <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No projects found</p>
            <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
              {searchQuery || selectedSession !== "all" || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Projects will appear here once submitted"}
            </p>
          </div>
        ) : viewMode === "card" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {paginatedProjects.map(renderProjectCard)}
          </div>
        ) : (
          // List View - Compact table-like layout
          <div className={cn(chrome.card, "divide-y divide-[var(--border)] overflow-hidden")}>
            {paginatedProjects.map(renderProjectListItem)}
          </div>
        )}
        {filteredProjects.length > 0 && (
          <ProjectListPaginationBar
            totalItems={filteredProjects.length}
            page={listPage}
            pageSize={listPageSize}
            onPageChange={setListPage}
            onPageSizeChange={setListPageSize}
          />
        )}
      </div>

      {/* View Project Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="rounded-xl border-slate-200 dark:border-white/10 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-slate-500" />
              Project Details
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              View complete project information
            </DialogDescription>
          </DialogHeader>
          {selectedProject && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Project Title
                  </Label>
                  <p className="text-slate-800 font-medium">
                    {selectedProject.title}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Status
                  </Label>
                  <div className="mt-1">
                    {getStatusBadge(selectedProject.status)}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Group
                  </Label>
                  <p className="text-slate-800">
                    {selectedProject.group?.name}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Section
                  </Label>
                  <p className="text-slate-800">
                    {selectedProject.group?.session}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Leader
                  </Label>
                  <p className="text-slate-800">
                    {selectedProject.leader?.full_name} (
                    {selectedProject.leader?.student_id})
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Target Platform
                  </Label>
                  <p className="text-slate-800">
                    {selectedProject.target_platform || "Not specified"}
                  </p>
                </div>
              </div>

              {selectedProject.summary && (
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Summary
                  </Label>
                  <p className="text-slate-800 mt-1 whitespace-pre-wrap">
                    {selectedProject.summary}
                  </p>
                </div>
              )}

              {selectedProject.deliverables && (
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Deliverables
                  </Label>
                  <p className="text-slate-800 mt-1 whitespace-pre-wrap">
                    {selectedProject.deliverables}
                  </p>
                </div>
              )}

              {selectedProject.timeline && (
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Timeline
                  </Label>
                  <div className="text-slate-800 mt-1 space-y-2">
                    {(() => {
                      // Handle different timeline formats
                      let timelineData: unknown = selectedProject.timeline;
                      
                      // If it's an object with phases, extract the phases array
                      if (timelineData && typeof timelineData === 'object' && !Array.isArray(timelineData)) {
                        if ('phases' in timelineData && Array.isArray(timelineData.phases)) {
                          timelineData = timelineData.phases;
                        } else {
                          // If it's an object but not an array, try to render it as JSON
                          return (
                            <pre className="text-xs bg-slate-50 p-2 rounded border border-slate-200 overflow-auto">
                              {JSON.stringify(timelineData, null, 2)}
                            </pre>
                          );
                        }
                      }
                      
                      // Now handle as array
                      if (Array.isArray(timelineData) && timelineData.length > 0) {
                        return timelineData.map((milestone: any, index: number) => (
                          <div key={milestone.id || index} className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="font-medium text-sm">{milestone.title || milestone.name || `Milestone ${index + 1}`}</p>
                            {milestone.deadline && (
                              <p className="text-xs text-slate-600 mt-1">
                                Deadline: {new Date(milestone.deadline).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ));
                      } else if (typeof timelineData === 'string') {
                        return <p className="whitespace-pre-wrap">{timelineData}</p>;
                      } else {
                        return <p className="text-sm text-slate-600">No timeline milestones</p>;
                      }
                    })()}
                  </div>
                </div>
              )}

              {selectedProject.project_link && (
                <div>
                  <Label className="text-sm font-semibold text-slate-700">
                    Project Link
                  </Label>
                  <div className="mt-1">
                    <a
                      href={selectedProject.project_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span className="truncate">{selectedProject.project_link}</span>
                    </a>
                  </div>
                </div>
              )}

              {selectedProject.members &&
                selectedProject.members.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">
                      Team Members ({selectedProject.members.length})
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {selectedProject.members.map((member) => (
                        <div
                          key={member.id}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <p className="font-medium text-slate-800">
                            {member.full_name}
                          </p>
                          <p className="text-sm text-slate-600">
                            {member.student_id}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Instructor Voting Section */}
              {instructorId && selectedProject.status === 'approved' && (
                <div className="pt-6 border-t border-slate-200">
                  <ProjectStarVoting
                    projectId={selectedProject.id}
                    voterId={instructorId}
                    voterType="instructor"
                    onVoteUpdate={() => {
                      fetchProjects();
                    }}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewDialogOpen(false)}
              className="border-slate-200 hover:bg-slate-50 rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="rounded-xl border-slate-200 dark:border-white/10 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Edit className="h-4 w-4 text-slate-500" />
              Edit Project
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Update project details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label
                htmlFor="edit-title"
                className="text-sm font-semibold text-slate-700"
              >
                Project Title *
              </Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-slate-950/50 dark:text-slate-100 h-11"
                placeholder="Enter project title"
              />
            </div>
            <div>
              <Label
                htmlFor="edit-summary"
                className="text-sm font-semibold text-slate-700"
              >
                Summary
              </Label>
              <Textarea
                id="edit-summary"
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                className="border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-slate-950/50 dark:text-slate-100 min-h-[100px]"
                placeholder="Enter project summary"
              />
            </div>
            <div>
              <Label
                htmlFor="edit-deliverables"
                className="text-sm font-semibold text-slate-700"
              >
                Deliverables
              </Label>
              <Textarea
                id="edit-deliverables"
                value={editDeliverables}
                onChange={(e) => setEditDeliverables(e.target.value)}
                className="border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-slate-950/50 dark:text-slate-100 min-h-[100px]"
                placeholder="Enter project deliverables"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="edit-platform"
                  className="text-sm font-semibold text-slate-700"
                >
                  Target Platform
                </Label>
                <Input
                  id="edit-platform"
                  value={editPlatform}
                  onChange={(e) => setEditPlatform(e.target.value)}
                  className="border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-slate-950/50 dark:text-slate-100 h-11"
                  placeholder="e.g., Web, Mobile, Desktop"
                />
              </div>
              <div>
                <Label
                  htmlFor="edit-timeline"
                  className="text-sm font-semibold text-slate-700"
                >
                  Timeline
                </Label>
                <Input
                  id="edit-timeline"
                  value={editTimeline}
                  onChange={(e) => setEditTimeline(e.target.value)}
                  className="border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-slate-950/50 dark:text-slate-100 h-11"
                  placeholder="e.g., 4 weeks"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="border-slate-200 hover:bg-slate-50 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditProject}
              disabled={isSubmitting}
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-lg"
            >
              {isSubmitting ? "Updating..." : "Update Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Reports Dialog */}
      <Dialog open={reportsDialogOpen} onOpenChange={setReportsDialogOpen}>
        <DialogContent className="rounded-xl border-slate-200 dark:border-white/10 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              Project Reports
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              View progress reports from team members
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {projectReports.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600">No reports submitted yet.</p>
              </div>
            ) : (
              projectReports.map((report) => (
                <Card
                  key={report.id}
                  className="border border-slate-200 rounded-xl"
                >
                  <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg text-slate-800">
                          {report.student_name}
                        </CardTitle>
                        <CardDescription className="text-slate-600">
                          {report.student_number}
                        </CardDescription>
                      </div>
                      <div className="text-sm text-slate-500">
                        {new Date(report.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-3">
                    <div>
                      <Label className="text-sm font-semibold text-slate-700">
                        Progress
                      </Label>
                      <p className="text-slate-800 whitespace-pre-wrap">
                        {report.progress}
                      </p>
                    </div>
                    {report.challenges && (
                      <div>
                        <Label className="text-sm font-semibold text-slate-700">
                          Challenges
                        </Label>
                        <p className="text-slate-800 whitespace-pre-wrap">
                          {report.challenges}
                        </p>
                      </div>
                    )}
                    {report.deliverables_status && (
                      <div>
                        <Label className="text-sm font-semibold text-slate-700">
                          Deliverables Status
                        </Label>
                        <p className="text-slate-800 whitespace-pre-wrap">
                          {report.deliverables_status}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReportsDialogOpen(false)}
              className="border-slate-200 hover:bg-slate-50 rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Project Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="rounded-xl border-slate-200 dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Reject Project
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Provide a reason for rejecting this project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label
                htmlFor="rejection-reason"
                className="text-sm font-semibold text-slate-700"
              >
                Rejection Reason (Optional)
              </Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-slate-950/50 dark:text-slate-100 min-h-[100px]"
                placeholder="Enter reason for rejection (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              className="border-slate-200 hover:bg-slate-50 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRejectProject}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              {isSubmitting ? "Rejecting..." : "Reject Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-xl border-slate-200 dark:border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              Delete Project
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              Are you sure you want to delete "{selectedProject?.title}"? This
              action cannot be undone and will remove all associated reports and
              data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 hover:bg-slate-50 rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProject}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Projects Dialog */}
      <AlertDialog
        open={clearAllDialogOpen}
        onOpenChange={setClearAllDialogOpen}
      >
        <AlertDialogContent className="rounded-xl border-slate-200 dark:border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              Clear All Projects
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              Are you sure you want to delete ALL projects? This action cannot
              be undone and will permanently remove all projects and their
              associated data from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 hover:bg-slate-50 rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllProjects}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Clear All Projects
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
