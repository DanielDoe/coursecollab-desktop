"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Crown,
  Clock,
  AlertCircle,
  Users,
  Zap,
  Target,
  Calendar,
  Activity,
  FileText,
  Check,
  X,
  FolderKanban,
  ExternalLink,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Project } from "@/lib/types/project";
import { motion } from "framer-motion";
import { ProjectSimpleVote } from "./project-simple-vote";
import { cn } from "@/lib/utils";
import { getStudentModuleTheme } from "@/lib/student-module-themes";
import { ProjectsListPanelSkeleton } from "@/components/student/dashboard-v2/ProjectsPageSkeleton";
import { StudentGradedReport } from "@/components/projects/StudentGradedReport";

const projectsTheme = getStudentModuleTheme("projects");

interface ProjectsListProps {
  projects: Project[];
  loading: boolean;
  studentId?: number;
  showVoting?: boolean;
  embedInDashboard?: boolean;
}

export function ProjectsList({
  projects,
  loading,
  studentId,
  showVoting = false,
  embedInDashboard = false,
}: ProjectsListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProject, setExpandedProject] = useState<number | null>(null);
  const [gradeProject, setGradeProject] = useState<Project | null>(null);
  const [progress, setProgress] = useState<{
    complete: number;
    total: number;
    status: string;
    events: Array<{ id: number; name: string; verb: string; section: string; when: string }>;
  } | null>(null);

  useEffect(() => {
    if (expandedProject == null) {
      setProgress(null);
      return;
    }
    let cancel = false;
    const session = JSON.parse(localStorage.getItem("studentSession") || "{}") as { studentId?: string };
    const headers: Record<string, string> = {};
    if (session.studentId) headers["x-student-id"] = String(session.studentId);
    void fetch(`/api/projects/workspace/${expandedProject}`, { headers })
      .then(async (res) => {
        if (cancel) return;
        if (!res.ok) {
          setProgress(null);
          return;
        }
        const data = await res.json();
        const sections = (data.sections ?? []) as Array<{ status?: string }>;
        const complete = sections.filter((section) => String(section.status) === "COMPLETE").length;
        const events = ((data.activity ?? []) as Array<{
          id?: number;
          event_type?: string;
          actor_name?: string | null;
          section_title?: string | null;
          created_at?: string;
        }>).slice(0, 4).map((row) => ({
          id: Number(row.id) || 0,
          name: String(row.actor_name || "Someone"),
          verb: activityVerb(row.event_type),
          section: String(row.section_title || "").replace(/^Section \d+\.\s*/, ""),
          when: relativeTime(row.created_at),
        }));
        setProgress({
          complete,
          total: sections.length,
          status: String(data.workspace?.submission_status || data.project?.status || "").replace(/_/g, " "),
          events,
        });
      })
      .catch(() => {
        if (!cancel) setProgress(null);
      });
    return () => {
      cancel = true;
    };
  }, [expandedProject]);

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const query = searchQuery.toLowerCase();

    return projects.filter((project) => {
      // Search in project title
      if (project.title?.toLowerCase().includes(query)) return true;
      // Search in group name
      if (project.group?.name?.toLowerCase().includes(query)) return true;
      // Search in leader name
      if (project.leader?.full_name?.toLowerCase().includes(query)) return true;
      // Search in project summary
      if (project.summary?.toLowerCase().includes(query)) return true;
      // Search in deliverables
      if (project.deliverables?.toLowerCase().includes(query)) return true;
      // Search in target platform
      if (project.target_platform?.toLowerCase().includes(query)) return true;
      // Search in member names
      if (
        Array.isArray(project.members) &&
        project.members.some((m) => m?.full_name?.toLowerCase().includes(query))
      )
        return true;
      // Search in timeline/milestones
      if (
        Array.isArray(project.timeline) &&
        project.timeline.some((t) => t?.title?.toLowerCase().includes(query))
      )
        return true;
      return false;
    });
  }, [projects, searchQuery]);

  // Loading state
  if (loading) {
    if (embedInDashboard) {
      return <ProjectsListPanelSkeleton />;
    }
    return (
      <div className="space-y-4 pt-5">
        <h3 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200">
          <span className="text-xl sm:text-2xl md:text-3xl">🧭</span> <span className="sm:hidden">Projects</span><span className="hidden sm:inline">All Projects</span>
        </h3>
        <div className="relative">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3.5 w-3.5 sm:h-4 sm:w-4 dark:text-slate-500" />
          <Input
            placeholder="Search..."
            aria-label="Search projects"
            disabled
            className="pl-8 sm:pl-10 h-9 sm:h-10 rounded-lg sm:rounded-xl border-2 text-sm sm:text-base dark:bg-slate-800/50 dark:border-slate-700"
            title="Search projects..."
          />
        </div>
        <ProjectsListPanelSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className={cn(embedInDashboard ? "flex h-full min-h-0 flex-col space-y-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4" : "space-y-3 sm:space-y-4 pt-3 sm:pt-5")}>
      <h3 className={cn(
        embedInDashboard
          ? "text-sm font-semibold text-[var(--cc-text)]"
          : "text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-200",
      )}>
        {embedInDashboard ? "All projects" : (
          <>
        <span className="text-xl sm:text-2xl md:text-3xl">🧭</span> <span className="sm:hidden">Projects</span><span className="hidden sm:inline">All Projects</span>
          </>
        )}
      </h3>
      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3.5 w-3.5 sm:h-4 sm:w-4 dark:text-slate-500" />
        <Input
          placeholder="Search..."
          aria-label="Search projects"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            "pl-8 sm:pl-10 h-9 sm:h-10 rounded-lg sm:rounded-xl border-2 transition-colors text-sm sm:text-base dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-200 dark:placeholder:text-slate-500",
            embedInDashboard ? "border-[var(--border)] bg-[var(--muted)]/40 text-[var(--cc-text)]" : "focus:border-indigo-500 dark:focus:border-indigo-400"
          )}
          title="Search projects..."
        />
      </motion.div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <motion.div
          className={embedInDashboard ? "min-h-0 flex-1" : undefined}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center py-12"
        >
          <div className={cn(
            "p-4 rounded-2xl inline-block mb-4",
            embedInDashboard ? projectsTheme.page.iconBg : "bg-slate-50 dark:bg-slate-800"
          )}>
            <FolderKanban className={cn(
              "h-12 w-12",
              embedInDashboard ? projectsTheme.page.iconText : "text-slate-400"
            )} />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-muted-foreground dark:text-slate-400 mb-2">
            {searchQuery
              ? "No projects match your search."
              : "No projects in your session yet"}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground dark:text-slate-500">
            {searchQuery
              ? "Try adjusting your search terms."
              : "Projects will appear here once they are created by groups in your session."}
          </p>
        </motion.div>
      ) : (
        <div className={cn(
          "flex min-h-0 flex-col overflow-y-auto pr-1",
          embedInDashboard ? "flex-1 gap-2" : "gap-5 max-h-[70vh] pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent",
        )}>
          {filteredProjects.map((project, index) => {
            const isMine =
              studentId != null &&
              (project.members?.some((member) => member.id === studentId) ||
                project.leader?.id === studentId ||
                project.group?.created_by === studentId);
            return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: index * 0.05,
                type: "spring",
                stiffness: 200,
              }}
              whileHover={{ scale: 1.02 }}
              className={cn(
                embedInDashboard
                  ? "rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
                  : "group rounded-xl sm:rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 p-3 sm:p-4 md:p-5 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700",
              )}
            >
              <div className="flex flex-col gap-2 sm:gap-3">
                {/* Title & Status */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className={cn(
                    "text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 transition-colors line-clamp-2 flex-1 break-words",
                    embedInDashboard ? "text-[var(--cc-text)]" : "group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                  )}>
                    {project.title}
                  </h3>
                  <Badge
                    className={cn(
                      "shrink-0 border-0 text-xs",
                      !embedInDashboard && (
                        project.status === "approved"
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : project.status === "pending"
                            ? "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                      ),
                    )}
                    style={embedInDashboard ? {
                      backgroundColor: "transparent",
                      color:
                        project.status === "approved"
                          ? "var(--cc-success)"
                          : project.status === "pending"
                            ? "var(--cc-warning)"
                            : "var(--cc-danger)",
                    } : undefined}
                  >
                    {project.status === "approved" && (
                      <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                    )}
                    {project.status === "pending" && (
                      <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                    )}
                    {project.status === "rejected" && (
                      <X className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                    )}
                    {project.status === "approved"
                      ? "Approved"
                      : project.status === "pending"
                      ? "Pending"
                      : "Rejected"}
                  </Badge>
                </div>

                {/* Description */}
                {project.summary && (
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-2 break-words">
                    {project.summary}
                  </p>
                )}

                {/* Badges Row */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {project.target_platform && (
                    <Badge
                      variant="outline"
                      className="text-xs border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 px-1.5 sm:px-2 py-0.5 sm:py-1"
                    >
                      <Target className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 shrink-0" />
                      <span className="truncate max-w-[80px] sm:max-w-none">{project.target_platform}</span>
                    </Badge>
                  )}
                  {project.leader && (
                    <Badge
                      variant="outline"
                      className="text-xs border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 px-1.5 sm:px-2 py-0.5 sm:py-1"
                    >
                      <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 shrink-0" />
                      {project.leader.full_name.split(" ")[0]}
                    </Badge>
                  )}
                  {project.members && project.members.length > 0 && (
                    <Badge
                      variant="outline"
                      className="text-xs border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300 px-1.5 sm:px-2 py-0.5 sm:py-1"
                    >
                      <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1 shrink-0" />
                      {project.members.length}
                    </Badge>
                  )}
                </div>

                {/* Rejection Warning */}
                {project.rejection_reason && (
                  <Alert className="py-2 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
                    <AlertCircle className="h-3 w-3 text-red-600" />
                    <AlertDescription className="text-xs text-red-700 dark:text-red-300 line-clamp-1 ml-6">
                      {project.rejection_reason}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setExpandedProject(
                        expandedProject === project.id ? null : project.id
                      )
                    }
                    className="flex-1 rounded-lg sm:rounded-full text-xs h-8 sm:h-9 dark:border-slate-700 dark:text-slate-300"
                  >
                    {expandedProject === project.id ? "Hide" : "View"}
                  </Button>
                  {isMine ? (
                    <Button
                      size="sm"
                      onClick={() => setGradeProject(project)}
                      className={cn(
                        "flex-1 rounded-lg sm:rounded-full text-xs h-8 sm:h-9",
                        embedInDashboard
                          ? "border-0 shadow-none hover:opacity-90"
                          : "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800",
                      )}
                      style={embedInDashboard ? { backgroundColor: "var(--cc-accent)", color: "#FFFFFF" } : undefined}
                    >
                      View grade
                    </Button>
                  ) : null}
                  {showVoting && studentId && project.status === "approved" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        setExpandedProject(
                          expandedProject === project.id ? null : project.id
                        )
                      }
                      className={cn(
                        "flex-1 rounded-lg sm:rounded-full text-xs h-8 sm:h-9",
                        embedInDashboard
                          ? "border-0 shadow-none hover:opacity-90"
                          : "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800",
                      )}
                      style={embedInDashboard ? { backgroundColor: "var(--cc-accent)", color: "#FFFFFF" } : undefined}
                    >
                      Engage
                    </Button>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedProject === project.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-[var(--border)] space-y-3"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["Group", project.group?.name || "—"],
                      ["Session", project.group?.session || "—"],
                      ["Leader", project.leader?.full_name || "—"],
                      ["Updated", project.updated_at ? new Date(project.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-[var(--border)] px-2.5 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cc-text-muted)]">{label}</p>
                        <p className="mt-0.5 truncate text-xs font-medium text-[var(--cc-text)]">{value}</p>
                      </div>
                    ))}
                  </div>

                  {expandedProject === project.id && progress ? (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Activity className="h-3.5 w-3.5 text-[var(--cc-accent)]" />
                        <h4 className="text-xs font-semibold text-[var(--cc-text)]">Progress</h4>
                      </div>
                      <div className="pl-5 space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-xs text-[var(--cc-text-muted)]">
                            {progress.complete} of {progress.total || 0} sections complete
                            {progress.status ? ` · ${progress.status}` : ""}
                          </p>
                          <p className="text-xs font-semibold tabular-nums text-[var(--cc-text)]">
                            {progress.total ? Math.round((progress.complete / progress.total) * 100) : 0}%
                          </p>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--cc-text)_10%,transparent)]">
                          <div
                            className="h-full rounded-full bg-[var(--cc-accent)]"
                            style={{ width: `${progress.total ? (progress.complete / progress.total) * 100 : 0}%` }}
                          />
                        </div>
                        {progress.events.length ? (
                          <ul className="space-y-1.5">
                            {progress.events.map((event) => (
                              <li key={event.id || `${event.name}-${event.when}`} className="text-xs text-[var(--cc-text-muted)]">
                                <span className="font-medium text-[var(--cc-text)]">{event.name}</span>
                                {" "}{event.verb}
                                {event.section ? ` · ${event.section}` : ""}
                                <span className="ml-1">{event.when}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-[var(--cc-text-muted)]">No activity yet.</p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {project.summary && (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <FileText className="h-3.5 w-3.5 text-[var(--cc-accent)]" />
                        <h4 className="text-xs font-semibold text-[var(--cc-text)]">
                          Summary
                        </h4>
                      </div>
                      <p className="text-xs leading-relaxed pl-5 text-[var(--cc-text-muted)]">
                        {project.summary}
                      </p>
                    </div>
                  )}

                  {/* Deliverables */}
                  {project.deliverables && (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Zap className="h-3.5 w-3.5 text-purple-600" />
                        <h4 className="text-xs font-semibold text-[var(--cc-text)]">
                          Deliverables
                        </h4>
                      </div>
                      <p className="text-xs leading-relaxed pl-5 whitespace-pre-wrap text-[var(--cc-text-muted)]">
                        {project.deliverables}
                      </p>
                    </div>
                  )}

                  {/* Timeline */}
                  {(() => {
                    // Handle different timeline formats
                    let timelineArray: any[] = [];
                    if (project.timeline) {
                      if (Array.isArray(project.timeline)) {
                        timelineArray = project.timeline;
                      } else if (typeof project.timeline === 'string') {
                        try {
                          const parsed = JSON.parse(project.timeline);
                          timelineArray = Array.isArray(parsed) ? parsed : (parsed?.phases || []);
                        } catch {
                          // If parsing fails, timelineArray remains empty
                        }
                      } else if (typeof project.timeline === 'object' && 'phases' in project.timeline) {
                        timelineArray = Array.isArray(project.timeline.phases) ? project.timeline.phases : [];
                      }
                    }

                    if (timelineArray.length > 0) {
                      return (
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <Calendar className="h-3.5 w-3.5 text-green-600" />
                            <h4 className="text-xs font-semibold text-[var(--cc-text)]">
                              Timeline ({timelineArray.length})
                            </h4>
                          </div>
                          <div className="space-y-1.5 pl-5">
                            {timelineArray.slice(0, 3).map((milestone: any, idx: number) => (
                              <div
                                key={milestone.id || milestone.title || idx}
                                className="flex items-start gap-2"
                              >
                                {milestone.deadline && (
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 px-1.5 py-0.5 text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                                  >
                                    {new Date(milestone.deadline).toLocaleDateString(
                                      "en-US",
                                      { month: "short", day: "numeric" }
                                    )}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground line-clamp-1">
                                  {milestone.title || milestone.name || 'Milestone'}
                                </span>
                              </div>
                            ))}
                            {timelineArray.length > 3 && (
                              <p className="text-xs text-muted-foreground italic">
                                +{timelineArray.length - 3} more
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Team Members */}
                  {project.members && project.members.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Users className="h-3.5 w-3.5 text-[var(--cc-accent)]" />
                        <h4 className="text-xs font-semibold text-[var(--cc-text)]">
                          Team ({project.members.length})
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-1 pl-5">
                        {project.members.map((member) => (
                          <Badge
                            key={member.id}
                            variant="outline"
                            className={cn(
                              "px-1.5 py-0.5 text-xs",
                              member.id === project.group?.created_by
                                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400"
                                : "border-[var(--border)] bg-[var(--card)] text-[var(--cc-text)]",
                            )}
                          >
                            {member.id === project.group?.created_by && (
                              <Crown className="h-2.5 w-2.5 mr-0.5" />
                            )}
                            {member.full_name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Project Link */}
                  {project.project_link && (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
                        <h4 className="text-xs font-semibold text-[var(--cc-text)]">
                          Project Link
                        </h4>
                      </div>
                      <div className="pl-5">
                        <a
                          href={project.project_link.startsWith('http://') || project.project_link.startsWith('https://') 
                            ? project.project_link 
                            : `https://${project.project_link}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          {project.project_link}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}

                   {showVoting && studentId && project.status === "approved" && (
                     <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                       <ProjectSimpleVote
                         projectId={project.id}
                         studentId={studentId}
                         onVoteUpdate={() => {
                           // No need to refresh - project data is already loaded
                           // The vote component handles its own state updates
                         }}
                       />
                     </div>
                   )}
                </motion.div>
              )}
            </motion.div>
            );
          })}
        </div>
      )}
      <Dialog open={gradeProject != null} onOpenChange={(open) => { if (!open) setGradeProject(null); }}>
        <DialogContent className="!flex h-[min(90vh,920px)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b border-[var(--border)] px-5 py-4 pr-12">
            <DialogTitle>Graded report</DialogTitle>
            <DialogDescription>{gradeProject?.title}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            {gradeProject ? (
              <StudentGradedReport
                projectId={gradeProject.id}
                dockActions
                onPreview={() => {
                  const id = gradeProject.id
                  setGradeProject(null)
                  router.push(`/student/dashboard-v2/projects/grade/${id}`)
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function activityVerb(type?: string) {
  switch (type) {
    case "SECTION_COMPLETED":
      return "marked a section complete";
    case "SECTION_EDITED":
      return "saved a draft";
    case "COMMENT_ADDED":
      return "posted a comment";
    case "FILE_UPLOADED":
      return "uploaded a file";
    case "FILE_DELETED":
      return "removed a file";
    case "REFERENCE_ADDED":
      return "added a reference";
    case "SUBMISSION_STATUS_CHANGED":
      return "updated the submission";
    default:
      return "updated the project";
  }
}

function relativeTime(iso?: string) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
