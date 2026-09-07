"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderKanban, Zap, Crown, Users, Target, Calendar, FileText, Sparkles, Rocket, Star, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutStudent, getStudentData } from "@/lib/auth";
import { ProjectsManager } from "@/components/projects-manager";
import { ProjectsList } from "@/components/projects-list";
import { ProjectPresentationScheduler } from "@/components/project-presentation-scheduler";
import type { Project } from "@/lib/types/project";
import { StudentHeader } from "@/components/student-header";
import { motion } from "framer-motion";

export default function StudentProjectsPage() {
  const router = useRouter();
  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentSection, setStudentSection] = useState("");
  const [studentDatabaseId, setStudentDatabaseId] = useState<number | null>(
    null
  );
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [myApprovedProject, setMyApprovedProject] = useState<Project | null>(null);

  useEffect(() => {
    const dbId = sessionStorage.getItem("studentDatabaseId");
    const id = sessionStorage.getItem("studentId");
    const name = sessionStorage.getItem("studentName");
    const section = sessionStorage.getItem("studentSection");

    if (!id || !dbId) {
      router.push("/student/login");
      return;
    }

    setStudentDatabaseId(Number.parseInt(dbId));
    setStudentId(id);
    setStudentName(name || "");
    setStudentSection(section || "");
  }, [router]);

  useEffect(() => {
    if (!studentSection) return;

    const fetchAllProjects = async () => {
      try {
        setLoadingProjects(true);
        const response = await fetch(
          `/api/projects/list?session=${studentSection}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch projects");
        }
        const data = await response.json();
        setAllProjects(data.projects || []);
      } catch (error) {
        console.error("[v0] Failed to fetch all projects:", error);
        setAllProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchAllProjects();
  }, [studentSection]);

  // Find student's approved project for presentation scheduling
  useEffect(() => {
    const fetchMyProject = async () => {
      if (!studentDatabaseId || !studentSection) {
        console.log("[DEBUG] Missing data:", { studentDatabaseId, studentSection });
        return;
      }
      
      try {
        console.log("[DEBUG] Fetching groups for session:", studentSection);
        // Get all groups in the student's section
        const groupResponse = await fetch(
          `/api/groups?session=${encodeURIComponent(studentSection)}&studentId=${encodeURIComponent(String(studentDatabaseId))}`,
          { headers: { "x-student-id": String(studentDatabaseId) } },
        );
        if (!groupResponse.ok) {
          console.error("[DEBUG] Failed to fetch groups");
          return;
        }
        
        const groupData = await groupResponse.json();
        console.log("[DEBUG] Groups data:", groupData);
        
        // Find the group where student is a member
        const myGroup = groupData.groups?.find((g: any) => {
          const isMember = g.members?.some((m: any) => m.id === studentDatabaseId);
          console.log(`[DEBUG] Checking group ${g.id} (${g.name}):`, { isMember, members: g.members });
          return isMember;
        });
        
        console.log("[DEBUG] My group:", myGroup);
        
        if (!myGroup) {
          console.log("[DEBUG] Student is not in any group");
          return;
        }
        
        // Find approved project for this group
        const approvedProject = allProjects.find(
          (p) => {
            const match = p.status === "approved" && p.group_id === myGroup.id;
            console.log(`[DEBUG] Checking project ${p.id} (${p.title}):`, { 
              status: p.status, 
              groupId: p.group_id, 
              myGroupId: myGroup.id,
              match 
            });
            return match;
          }
        );
        
        console.log("[DEBUG] Approved project found:", approvedProject);
        setMyApprovedProject(approvedProject || null);
        
        if (approvedProject) {
          console.log("✅ [PRESENTATION SCHEDULER] Should be visible!");
          console.log("   Project:", approvedProject.title);
          console.log("   Group ID:", approvedProject.group_id);
        } else {
          console.log("⚠️ [PRESENTATION SCHEDULER] Not visible - no approved project");
        }
      } catch (error) {
        console.error("[DEBUG] Error fetching student's project:", error);
      }
    };
    
    if (allProjects.length > 0 && studentDatabaseId) {
      fetchMyProject();
    } else {
      console.log("[DEBUG] Not fetching project:", { 
        projectsLength: allProjects.length, 
        studentDatabaseId 
      });
    }
  }, [allProjects, studentDatabaseId, studentSection]);

  // Debug log when myApprovedProject changes
  useEffect(() => {
    console.log("🎯 [SCHEDULER STATUS] myApprovedProject state changed:", myApprovedProject);
    if (myApprovedProject) {
      console.log("   ✅ Scheduler will render!");
      console.log("   Project:", myApprovedProject.title);
      console.log("   ID:", myApprovedProject.id);
      console.log("   Group ID:", myApprovedProject.group_id);
    } else {
      console.log("   ❌ Scheduler will NOT render");
    }
  }, [myApprovedProject]);

  const handleLogout = () => {
    logoutStudent();
  };

  if (!studentId || !studentDatabaseId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <StudentHeader />

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10 max-w-7xl">
        {/* Futuristic Page Header */}
        <div className="mb-8 sm:mb-10 md:mb-12 relative">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <div className="relative shrink-0">
              <div className="p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 dark:from-purple-700 dark:via-indigo-700 dark:to-blue-700 shadow-[0_8px_32px_rgba(147,51,234,0.3)] dark:shadow-[0_8px_32px_rgba(147,51,234,0.5)]">
                <FolderKanban className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-800 via-indigo-600 to-blue-600 dark:from-purple-300 dark:via-indigo-400 dark:to-blue-400">
                <span className="sm:hidden">Projects</span>
                <span className="hidden sm:inline md:hidden">Projects Hub</span>
                <span className="hidden md:inline">Project Innovation Hub</span>
              </h2>
              <p className="text-xs sm:text-sm md:text-base lg:text-lg text-slate-600 dark:text-slate-400 mt-1 sm:mt-2 break-words">
                <span className="sm:hidden">{studentName}</span>
                <span className="hidden sm:inline">{studentName} • Section {studentSection}</span>
              </p>
            </div>
          </div>
          
          {/* Back Button - Floating to the right on mobile, full buttons on desktop */}
          <div className="absolute top-0 right-0 flex items-center gap-2 sm:gap-3">
            <Button 
              onClick={() => router.push("/student/projects/leaderboard")} 
              variant="outline" 
              size="sm"
              className="sm:hidden h-9 px-3 rounded-lg border-2 border-purple-200/60 dark:border-purple-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 hover:border-purple-400 dark:hover:border-purple-500 text-purple-700 dark:text-purple-300 shadow-md hover:shadow-lg transition-all duration-200 gap-1.5"
              title="Leaderboard"
            >
              <Trophy className="h-4 w-4" />
            </Button>
            
            <Button 
              onClick={() => router.push("/student/dashboard")} 
              variant="outline" 
              size="sm"
              className="sm:hidden h-9 px-3 rounded-lg border-2 border-purple-200/60 dark:border-purple-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 hover:border-purple-400 dark:hover:border-purple-500 text-purple-700 dark:text-purple-300 shadow-md hover:shadow-lg transition-all duration-200 gap-1.5"
              title="Back to Dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Back</span>
            </Button>
            
            <Button 
              onClick={() => router.push("/student/projects/leaderboard")} 
              variant="outline" 
              size="lg"
              className="hidden sm:flex rounded-xl border-2 border-purple-200/60 dark:border-purple-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 hover:border-purple-400 dark:hover:border-purple-500 text-purple-700 dark:text-purple-300 transition-all duration-200 shadow-lg hover:shadow-xl text-sm md:text-base px-3 md:px-4 shrink-0"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Leaderboard
            </Button>
            
            <Button 
              onClick={() => router.push("/student/dashboard")} 
              variant="outline" 
              size="lg"
              className="hidden sm:flex rounded-xl border-2 border-purple-200/60 dark:border-purple-700/60 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 hover:border-purple-400 dark:hover:border-purple-500 text-purple-700 dark:text-purple-300 transition-all duration-200 shadow-lg hover:shadow-xl text-sm md:text-base px-3 md:px-4 shrink-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-8 sm:mb-10 md:mb-12"
        >
          <div className="bg-gradient-to-br from-purple-50/80 to-indigo-50/60 dark:from-purple-900/30 dark:to-indigo-900/20 border border-purple-200/60 dark:border-purple-700/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/50 dark:to-indigo-900/50 shrink-0">
                <Rocket className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-purple-800 dark:text-purple-300">Projects</p>
                <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-400">
                  <span className="sm:hidden">Manage</span>
                  <span className="hidden sm:inline">Create & Manage</span>
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/60 dark:from-emerald-900/30 dark:to-teal-900/20 border border-emerald-200/60 dark:border-emerald-700/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50 shrink-0">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-800 dark:text-emerald-300">Collaboration</p>
                <p className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                  <span className="sm:hidden">Teams</span>
                  <span className="hidden sm:inline">Team Projects</span>
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50/80 to-cyan-50/60 dark:from-blue-900/30 dark:to-cyan-900/20 border border-blue-200/60 dark:border-blue-700/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/50 dark:to-cyan-900/50 shrink-0">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-blue-800 dark:text-blue-300">Reports</p>
                <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-400">
                  <span className="sm:hidden">Track</span>
                  <span className="hidden sm:inline">Track Progress</span>
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/60 dark:from-amber-900/30 dark:to-orange-900/20 border border-amber-200/60 dark:border-amber-700/60 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <div className="p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50 shrink-0">
                <Crown className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-amber-800 dark:text-amber-300">Leadership</p>
                <p className="text-xs sm:text-sm text-amber-600 dark:text-amber-400">
                  <span className="sm:hidden">Lead</span>
                  <span className="hidden sm:inline">Lead Projects</span>
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Content Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="rounded-xl sm:rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl p-4 sm:p-6 md:p-8 hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-all duration-300"
        >
          <div className="grid md:grid-cols-[1fr_2fr] gap-4 sm:gap-6 md:gap-10 items-start">
            {/* Left: All Projects (1/3) */}
            <div className="space-y-4 sm:space-y-6 min-w-0">
              <ProjectsList 
                projects={allProjects} 
                loading={loadingProjects}
                studentId={studentDatabaseId}
                showVoting={true}
              />
            </div>

            {/* Right: Propose Project (2/3) */}
            <div className="space-y-4 sm:space-y-6 min-w-0">
              <ProjectsManager
                studentId={studentId}
                studentSection={studentSection}
                studentDatabaseId={studentDatabaseId}
              />
            </div>
          </div>
        </motion.div>

        {/* Presentation Scheduler - Show if student has an approved project */}
        {myApprovedProject && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8"
          >
            <div className="mb-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-200">
                  <span className="sm:hidden">Schedule</span>
                  <span className="hidden sm:inline">Schedule Presentation</span>
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                <span className="sm:hidden">Book presentation slot</span>
                <span className="hidden sm:inline">Book a 20-minute slot to present your approved project</span>
              </p>
            </div>
            <ProjectPresentationScheduler
              projectId={myApprovedProject.id}
              groupId={myApprovedProject.group_id}
              projectTitle={myApprovedProject.title}
              groupName={myApprovedProject.group?.name || ""}
              studentSession={studentSection}
            />
          </motion.div>
        )}
      </main>
    </div>
  );
}
