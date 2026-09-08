"use client"

import { useState, useEffect, useMemo } from "react";

export const dynamic = 'force-dynamic';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Trophy,
  Star,
  BarChart3,
  FolderKanban,
  Target,
  Users,
  Settings,
  ArrowLeft,
  FileText,
  Calendar,
  RefreshCw,
} from "lucide-react";
import type { Project } from "@/lib/types/project";
import { getProjectModuleSessionsForCourse } from "@/lib/project-module-sessions";
import { readFacultySelectedCourseCode } from "@/lib/project-presentation-course-scope";
import { instructorApiFetch } from "@/lib/instructor-api-headers";
import { ProjectStarVoting } from "@/components/project-star-voting";
import { InstructorProjectsManagement } from "@/components/instructor-projects-management";
import { InstructorPresentationsSchedule } from "@/components/instructor-presentations-schedule";
import { InstructorPresentationConfig } from "@/components/instructor-presentation-config";
import { InstructorProjectStudentGrades } from "@/components/instructor-project-student-grades";
import Link from "next/link";
import { ProjectListPaginationBar } from "@/components/project-list-pagination-bar";
import type { ProjectListPageSize } from "@/lib/pagination-ui";
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome";
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes";
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar";
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context";
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers";
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout";
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu";
import {
  ProjectOverviewCard,
  ProjectScoreListCard,
  ProjectLeaderboardCard,
} from "@/components/instructor/projects/project-overview-card";
import { cn } from "@/lib/utils";
import {
  PortalLeaderboardPodium,
  buildPortalPodiumEntries,
} from "@/components/dashboard-v2/PortalLeaderboardPodium";

interface ProjectScore {
  projectId: number;
  title: string;
  groupName: string;
  leaderName: string;
  session: string;
  studentVotes: number;
  instructorVotes: number;
  studentPoints: number;
  instructorPoints: number;
  totalScore: number;
  status: string;
}

export default function InstructorProjectsPage({ embedInDashboard }: { embedInDashboard?: boolean } = {}) {
  const chrome = facultyEmbedChrome("projects");
  const fp = chrome.p;
  const cardBase = chrome.card;
  const { toast } = useToast();
  const { courseScopeVersion } = useInstructorDashboardV2();
  const [activeMenu, setActiveMenu] = useState("overview");
  const [projects, setProjects] = useState<Project[]>([]);
  const [scores, setScores] = useState<ProjectScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [instructorId, setInstructorId] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [overviewSearch, setOverviewSearch] = useState("");
  const [overviewRatingFilter, setOverviewRatingFilter] = useState<"all" | "scored" | "needs-rating">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [scoreProjectsPage, setScoreProjectsPage] = useState(1);
  const [scoreProjectsPageSize, setScoreProjectsPageSize] = useState<ProjectListPageSize>(30);

  const courseSessions = useMemo(
    () => getProjectModuleSessionsForCourse(readFacultySelectedCourseCode()),
    [courseScopeVersion],
  );

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
    setSelectedSession(null);
    setOverviewSearch("");
    setOverviewRatingFilter("all");
    setSelectedProject(null);
    setProjects([]);
    setScores([]);
    void fetchProjects();
  }, [courseScopeVersion]);

  useEffect(() => {
    setScoreProjectsPage(1);
  }, [selectedSession, scoreProjectsPageSize, overviewSearch, overviewRatingFilter, courseScopeVersion]);

  useEffect(() => {
    if (projects.length > 0) {
      void fetchScores();
    } else {
      setScores([]);
    }
  }, [projects, courseScopeVersion]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await instructorApiFetch("/api/projects/list", {
        headers: getInstructorScopeHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setProjects([]);
        toast({
          title: "Failed to load projects",
          description: typeof data.error === "string" ? data.error : undefined,
          variant: "destructive",
        });
        return;
      }
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      setProjects([]);
      toast({
        title: "Failed to load projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchScores = async () => {
    try {
      const totalsRes = await instructorApiFetch("/api/projects/vote-totals", {
        headers: getInstructorScopeHeaders(),
      });
      const totalsJson = (await totalsRes.json().catch(() => ({}))) as {
        byProjectId?: Record<
          string,
          {
            studentVotes?: number;
            instructorVotes?: number;
            studentPoints?: number;
            instructorPoints?: number;
            totalScore?: number;
          }
        >;
      };
      const byId = totalsRes.ok && totalsJson.byProjectId ? totalsJson.byProjectId : {};

      const scoresData: ProjectScore[] = projects.map((project) => {
        const row = byId[String(project.id)];
        return {
          projectId: project.id,
          title: project.title,
          groupName: project.group?.name || "",
          leaderName: project.leader?.full_name || "",
          session: project.group?.session || "",
          studentVotes: row?.studentVotes ?? 0,
          instructorVotes: row?.instructorVotes ?? 0,
          studentPoints: row?.studentPoints ?? 0,
          instructorPoints: row?.instructorPoints ?? 0,
          totalScore: row?.totalScore ?? 0,
          status: project.status,
        };
      });

      setScores(scoresData);
    } catch (error) {
      console.error("Failed to fetch scores:", error);
    }
  };

  const sortedScores = [...scores].sort((a, b) => b.totalScore - a.totalScore);
  const overviewScores = useMemo(() => {
    const query = overviewSearch.trim().toLowerCase();
    return sortedScores.filter((score) => {
      if (selectedSession && score.session !== selectedSession) return false;
      if (overviewRatingFilter === "scored" && score.instructorVotes === 0) return false;
      if (overviewRatingFilter === "needs-rating" && score.instructorVotes > 0) return false;
      if (!query) return true;
      return (
        score.title.toLowerCase().includes(query) ||
        score.groupName.toLowerCase().includes(query) ||
        score.leaderName.toLowerCase().includes(query) ||
        score.session.toLowerCase().includes(query)
      );
    });
  }, [sortedScores, overviewSearch, selectedSession, overviewRatingFilter]);
  const matchesProjectQuery = (title: string, groupName: string, leaderName: string, session: string) => {
    const query = overviewSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      title.toLowerCase().includes(query) ||
      groupName.toLowerCase().includes(query) ||
      leaderName.toLowerCase().includes(query) ||
      session.toLowerCase().includes(query)
    );
  };

  const filteredProjectsForScoring = useMemo(() => {
    return projects.filter((p) => {
      if (p.status !== "approved") return false;
      if (selectedSession && p.group?.session !== selectedSession) return false;
      const score = scores.find((s) => s.projectId === p.id);
      const instructorVotes = score?.instructorVotes ?? 0;
      if (overviewRatingFilter === "scored" && instructorVotes === 0) return false;
      if (overviewRatingFilter === "needs-rating" && instructorVotes > 0) return false;
      return matchesProjectQuery(
        p.title,
        p.group?.name ?? "",
        p.leader?.full_name ?? "",
        p.group?.session ?? "",
      );
    });
  }, [projects, selectedSession, scores, overviewSearch, overviewRatingFilter]);

  const leaderboardScores = useMemo(() => {
    const approvedIds = new Set(
      projects.filter((p) => p.status === "approved").map((p) => p.id),
    );
    return sortedScores.filter((s) => {
      if (!approvedIds.has(s.projectId)) return false;
      if (selectedSession && s.session !== selectedSession) return false;
      if (overviewRatingFilter === "scored" && s.instructorVotes === 0) return false;
      if (overviewRatingFilter === "needs-rating" && s.instructorVotes > 0) return false;
      return matchesProjectQuery(s.title, s.groupName, s.leaderName, s.session);
    });
  }, [sortedScores, projects, selectedSession, overviewSearch, overviewRatingFilter]);

  const podiumEntries = useMemo(
    () =>
      buildPortalPodiumEntries(leaderboardScores, (score, rank) => ({
        rank,
        primaryLabel: score.title,
        secondaryLabel: score.groupName,
        score: score.totalScore,
        scoreUnit: "pts",
        scoreDetail: `${score.studentPoints.toFixed(0)} + ${score.instructorPoints.toFixed(0)}`,
      })),
    [leaderboardScores],
  );

  const restLeaderboardScores = leaderboardScores.slice(3);

  const scoreTotalPages = Math.max(
    1,
    Math.ceil(filteredProjectsForScoring.length / scoreProjectsPageSize)
  );
  const scorePageClamped = Math.min(scoreProjectsPage, scoreTotalPages);
  const pagedScoreProjects = useMemo(() => {
    const start = (scorePageClamped - 1) * scoreProjectsPageSize;
    return filteredProjectsForScoring.slice(start, start + scoreProjectsPageSize);
  }, [filteredProjectsForScoring, scorePageClamped, scoreProjectsPageSize]);

  const menuItems = [
    { id: "overview", label: "Scores Overview", icon: BarChart3 },
    { id: "rate", label: "Score Projects", icon: Star },
    { id: "leaderboard", label: "Leaderboard", icon: Trophy },
    { id: "manage", label: "Manage Projects", icon: FolderKanban },
    { id: "presentations", label: "Presentations", icon: Calendar },
    { id: "config", label: "Configuration", icon: Settings },
    { id: "grades", label: "Student Grades", icon: Users },
  ];

  const panelTab = embedInDashboard;
  const tabSectionClass = panelTab ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4";
  const tabBodyClass = panelTab ? "flex min-h-0 flex-1 flex-col" : undefined;
  const emptyPanelClass = panelTab
    ? cn(cardBase, "flex min-h-0 flex-1 flex-col items-center justify-center border-dashed px-4 py-10 text-center")
    : cn(cardBase, "p-8 text-center sm:p-10");
  const loadingPanelClass = panelTab
    ? cn(cardBase, "flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10")
    : cn(cardBase, "py-12 text-center");
  const scrollListClass = panelTab ? "min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2" : undefined;

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
            <Button variant="outline" className="gap-2 rounded-xl border-slate-200 dark:border-white/10">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      )}

      <FacultyModuleSplitLayout
        scrollMode={embedInDashboard ? "panel" : "page"}
        className={embedInDashboard ? "min-h-0 flex-1" : undefined}
        menu={
          selectedProject && activeMenu === "rate" ? null : (
          <FacultyModuleSideMenu
            moduleId="projects"
            title="Projects"
            accent="theme"
            activeId={activeMenu}
            onSelect={(id) => {
              setSelectedProject(null)
              setActiveMenu(id)
            }}
            items={menuItems}
            footer={
              <div className="hidden lg:block">
                <p className={cn("mb-2 text-xs font-medium", PORTAL_TEXT)}>Scoring</p>
                <p className={cn("text-[11px] leading-relaxed", PORTAL_TEXT_MUTED)}>
                  <span className="block whitespace-nowrap">Students: 30+ votes = 30 pts · Avg × 6</span>
                  <span className="block whitespace-nowrap">Instructor: 1 score = 20 pts · Stars × 4</span>
                </p>
              </div>
            }
          />
          )
        }
      >
        {/* Main Content */}
        <div
          className={
            embedInDashboard
              ? "flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-6"
              : "min-w-0 flex-1 space-y-6"
          }
        >
            {/* Scores Overview */}
            {activeMenu === "overview" && (
              <div className={tabSectionClass}>
                <div className={panelTab ? "shrink-0" : undefined}>
                <FacultyIntegratedToolbar
                  moduleId="projects"
                  search={overviewSearch}
                  onSearchChange={setOverviewSearch}
                  onSearchClear={() => setOverviewSearch("")}
                  searchResetToken={courseScopeVersion}
                  searchPlaceholder="Search projects, groups, or leaders…"
                  filters={
                    <>
                      <Select
                        value={selectedSession || "all"}
                        onValueChange={(v) => setSelectedSession(v === "all" ? null : v)}
                      >
                        <SelectTrigger
                          className={cn(
                            facultyToolbarFilterButtonClass(Boolean(selectedSession)),
                            "h-9 w-[148px] shadow-none",
                          )}
                        >
                          <SelectValue placeholder="Session" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All sessions</SelectItem>
                          {courseSessions.map(({ code, label }) => (
                            <SelectItem key={code} value={code}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={overviewRatingFilter}
                        onValueChange={(v) => setOverviewRatingFilter(v as "all" | "scored" | "needs-rating")}
                      >
                        <SelectTrigger
                          className={cn(
                            facultyToolbarFilterButtonClass(overviewRatingFilter !== "all"),
                            "h-9 w-[148px] shadow-none",
                          )}
                        >
                          <SelectValue placeholder="Rating" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All ratings</SelectItem>
                          <SelectItem value="needs-rating">Needs rating</SelectItem>
                          <SelectItem value="scored">Rated</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  }
                  meta={
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      {overviewScores.length} of {sortedScores.length} project
                      {sortedScores.length === 1 ? "" : "s"} · student 30 + instructor 20
                    </p>
                  }
                  trailing={
                    <Button
                      onClick={() => { setLoading(true); fetchProjects(); }}
                      size="sm"
                      disabled={loading}
                      className={cn("h-9 gap-1.5 rounded-lg", chrome.quiet)}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                      Refresh
                    </Button>
                  }
                />
                </div>
                <div className={tabBodyClass}>
                {loading ? (
                  <div className={loadingPanelClass}>
                    <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading scores…</p>
                  </div>
                ) : sortedScores.length === 0 ? (
                  <div className={emptyPanelClass}>
                    <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
                      <Star className="h-5 w-5 !text-white" />
                    </div>
                    <p className={cn("font-semibold", PORTAL_TEXT)}>No scores yet</p>
                    <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>Scores appear after students vote and you rate projects.</p>
                  </div>
                ) : overviewScores.length === 0 ? (
                  <div className={emptyPanelClass}>
                    <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
                      <Star className="h-5 w-5 !text-white" />
                    </div>
                    <p className={cn("font-semibold", PORTAL_TEXT)}>No matching projects</p>
                    <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>Try a different search or clear the session and rating filters.</p>
                  </div>
                ) : (
                  <div className={cn(cardBase, "divide-y divide-[var(--border)] overflow-hidden", scrollListClass)}>
                    {overviewScores.map((score, index) => (
                      <ProjectOverviewCard
                        key={score.projectId}
                        index={index}
                        rank={index + 1}
                        title={score.title}
                        groupName={score.groupName}
                        session={score.session}
                        leaderName={score.leaderName}
                        status={score.status}
                        totalScore={score.totalScore}
                        studentVotes={score.studentVotes}
                        studentPoints={score.studentPoints}
                        instructorVotes={score.instructorVotes}
                        instructorPoints={score.instructorPoints}
                      />
                    ))}
                  </div>
                )}
                </div>
              </div>
            )}

            {/* Score Projects */}
            {activeMenu === "rate" && selectedProject ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setSelectedProject(null)}
                  className={cn("inline-flex items-center gap-1.5 text-sm font-medium", fp.iconText)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  All projects
                </button>
                <section className={cn(cardBase, "space-y-5 p-4 sm:p-5")}>
                  <div className="flex items-start gap-3">
                    <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", fp.softBg)}>
                      <FolderKanban className={cn("h-5 w-5", fp.iconText)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className={cn("text-lg font-semibold", PORTAL_TEXT)}>{selectedProject.title}</h2>
                      <p className={cn("mt-0.5 text-sm", PORTAL_TEXT_MUTED)}>
                        {selectedProject.group?.name} · {selectedProject.group?.session} · Led by{" "}
                        {selectedProject.leader?.full_name}
                      </p>
                    </div>
                  </div>
                  {(selectedProject.summary || selectedProject.deliverables) ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {selectedProject.summary ? (
                        <div>
                          <h5 className={cn("mb-1 flex items-center gap-2 text-sm font-semibold", PORTAL_TEXT)}>
                            <FileText className={cn("h-4 w-4", fp.iconText)} />
                            Summary
                          </h5>
                          <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{selectedProject.summary}</p>
                        </div>
                      ) : null}
                      {selectedProject.deliverables ? (
                        <div>
                          <h5 className={cn("mb-1 flex items-center gap-2 text-sm font-semibold", PORTAL_TEXT)}>
                            <Target className={cn("h-4 w-4", fp.iconText)} />
                            Deliverables
                          </h5>
                          <p className={cn("whitespace-pre-wrap text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
                            {selectedProject.deliverables}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {instructorId ? (
                    <ProjectStarVoting
                      projectId={selectedProject.id}
                      voterId={instructorId}
                      voterType="instructor"
                      onVoteUpdate={() => { fetchScores(); }}
                    />
                  ) : null}
                </section>
              </div>
            ) : activeMenu === "rate" ? (
              <div className={tabSectionClass}>
                <div className={panelTab ? "shrink-0" : undefined}>
                <FacultyIntegratedToolbar
                  moduleId="projects"
                  search={overviewSearch}
                  onSearchChange={setOverviewSearch}
                  onSearchClear={() => setOverviewSearch("")}
                  searchResetToken={courseScopeVersion}
                  searchPlaceholder="Search projects, groups, or leaders…"
                  filters={
                    <>
                      <Select value={selectedSession || "all"} onValueChange={(v) => setSelectedSession(v === "all" ? null : v)}>
                        <SelectTrigger
                          className={cn(
                            facultyToolbarFilterButtonClass(Boolean(selectedSession)),
                            "h-9 w-[148px] shadow-none",
                          )}
                        >
                          <SelectValue placeholder="Session" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All sessions</SelectItem>
                          {courseSessions.map(({ code, label }) => (
                            <SelectItem key={code} value={code}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={overviewRatingFilter}
                        onValueChange={(v) => setOverviewRatingFilter(v as "all" | "scored" | "needs-rating")}
                      >
                        <SelectTrigger
                          className={cn(
                            facultyToolbarFilterButtonClass(overviewRatingFilter !== "all"),
                            "h-9 w-[148px] shadow-none",
                          )}
                        >
                          <SelectValue placeholder="Rating" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All ratings</SelectItem>
                          <SelectItem value="needs-rating">Needs rating</SelectItem>
                          <SelectItem value="scored">Rated</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  }
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  meta={
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      {filteredProjectsForScoring.length} approved project{filteredProjectsForScoring.length === 1 ? "" : "s"}
                      {selectedSession ? ` · ${selectedSession}` : ""}
                    </p>
                  }
                />
                </div>

                <div className={tabBodyClass}>
                {filteredProjectsForScoring.length === 0 ? (
                  <div className={emptyPanelClass}>
                    <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
                      <FolderKanban className="h-5 w-5 !text-white" />
                    </div>
                    <p className={cn("font-semibold", PORTAL_TEXT)}>
                      {overviewSearch.trim() || selectedSession || overviewRatingFilter !== "all"
                        ? "No matching projects"
                        : "No approved projects to score"}
                    </p>
                  </div>
                ) : (
                  <>
                    <div
                      className={cn(
                        viewMode === "grid"
                          ? "grid grid-cols-1 gap-3 md:grid-cols-2"
                          : cn(cardBase, "divide-y divide-[var(--border)] overflow-hidden"),
                        scrollListClass,
                      )}
                    >
                      {pagedScoreProjects.map((project, index) => {
                        const projectScore = scores.find((s) => s.projectId === project.id)
                        return (
                          <ProjectScoreListCard
                            key={project.id}
                            index={index}
                            layout={viewMode === "grid" ? "card" : "list"}
                            title={project.title}
                            meta={`${project.group?.name ?? "Group"} · ${project.group?.session ?? ""} · ${project.leader?.full_name ?? ""}`}
                            scored={Boolean(projectScore && projectScore.instructorVotes > 0)}
                            votes={projectScore?.studentVotes}
                            totalScore={projectScore?.totalScore}
                            onSelect={() => setSelectedProject(project)}
                          />
                        )
                      })}
                    </div>
                    <div className={panelTab ? "shrink-0" : undefined}>
                    <ProjectListPaginationBar
                      totalItems={filteredProjectsForScoring.length}
                      page={scoreProjectsPage}
                      pageSize={scoreProjectsPageSize}
                      onPageChange={setScoreProjectsPage}
                      onPageSizeChange={setScoreProjectsPageSize}
                    />
                    </div>
                  </>
                )}
                </div>
              </div>
            ) : null}

            {/* Leaderboard */}
            {activeMenu === "leaderboard" && (
              <div className={tabSectionClass}>
                <div className={panelTab ? "shrink-0 space-y-4" : "space-y-4"}>
                <FacultyIntegratedToolbar
                  moduleId="projects"
                  search={overviewSearch}
                  onSearchChange={setOverviewSearch}
                  onSearchClear={() => setOverviewSearch("")}
                  searchResetToken={courseScopeVersion}
                  searchPlaceholder="Search projects, groups, or leaders…"
                  filters={
                    <>
                      <Select
                        value={selectedSession || "all"}
                        onValueChange={(v) => setSelectedSession(v === "all" ? null : v)}
                      >
                        <SelectTrigger
                          className={cn(
                            facultyToolbarFilterButtonClass(Boolean(selectedSession)),
                            "h-9 w-[148px] shadow-none",
                          )}
                        >
                          <SelectValue placeholder="Session" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All sessions</SelectItem>
                          {courseSessions.map(({ code, label }) => (
                            <SelectItem key={code} value={code}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={overviewRatingFilter}
                        onValueChange={(v) => setOverviewRatingFilter(v as "all" | "scored" | "needs-rating")}
                      >
                        <SelectTrigger
                          className={cn(
                            facultyToolbarFilterButtonClass(overviewRatingFilter !== "all"),
                            "h-9 w-[148px] shadow-none",
                          )}
                        >
                          <SelectValue placeholder="Rating" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All ratings</SelectItem>
                          <SelectItem value="needs-rating">Needs rating</SelectItem>
                          <SelectItem value="scored">Rated</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  }
                  trailing={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={loading}
                      className={cn("h-9 gap-2 rounded-lg", chrome.outline)}
                      onClick={() => {
                        setLoading(true);
                        void fetchProjects();
                      }}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                      Refresh
                    </Button>
                  }
                  meta={
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      {leaderboardScores.length} ranked project
                      {leaderboardScores.length === 1 ? "" : "s"}
                      {selectedSession ? ` · ${selectedSession}` : ""}
                    </p>
                  }
                />

                <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                  Combined student (30 pts) + instructor (20 pts) scores for approved projects.
                </p>
                </div>

                <div className={tabBodyClass}>
                {loading ? (
                  <div className={loadingPanelClass}>
                    <div
                      className="size-8 animate-spin rounded-full border-2 border-[var(--cc-accent)] border-t-transparent"
                      aria-hidden
                    />
                  </div>
                ) : leaderboardScores.length === 0 ? (
                  <div className={emptyPanelClass}>
                    <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
                      <Trophy className="h-5 w-5 !text-white" />
                    </div>
                    <p className={cn("text-sm font-medium", PORTAL_TEXT)}>No ranked projects yet</p>
                    <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
                      {selectedSession
                        ? `No approved projects with scores in session ${selectedSession}.`
                        : "Scores appear after students vote and you rate approved projects."}
                    </p>
                  </div>
                ) : (
                  <div className={cn("space-y-4", scrollListClass)}>
                    {podiumEntries.length > 0 ? (
                      <PortalLeaderboardPodium
                        entries={podiumEntries}
                        heading="Top projects"
                      />
                    ) : null}
                    {restLeaderboardScores.length > 0 ? (
                      <div className={cn(cardBase, "divide-y divide-[var(--border)] overflow-hidden")}>
                        {restLeaderboardScores.map((score, index) => (
                          <ProjectLeaderboardCard
                            key={score.projectId}
                            index={index}
                            rank={index + 4}
                            title={score.title}
                            groupName={score.groupName}
                            session={score.session}
                            studentPoints={score.studentPoints}
                            instructorPoints={score.instructorPoints}
                            totalScore={score.totalScore}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
                </div>
              </div>
            )}

            {activeMenu === "manage" && <InstructorProjectsManagement embedInDashboard={embedInDashboard} />}
            {activeMenu === "presentations" && <InstructorPresentationsSchedule embedInDashboard={embedInDashboard} />}
            {activeMenu === "config" && <InstructorPresentationConfig embedInDashboard={embedInDashboard} />}
            {activeMenu === "grades" && <InstructorProjectStudentGrades embedInDashboard={embedInDashboard} />}
        </div>
      </FacultyModuleSplitLayout>
    </div>
  );
}