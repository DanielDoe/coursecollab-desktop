"use client"

import Link from "next/link"
import {
  Award,
  Clock,
  FolderKanban,
  Lock,
  Play,
  User,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CamperPageShell } from "@/components/summer-camp/CamperPageShell"
import { useCampHub } from "@/components/summer-camp/use-camp-hub"
import { campRoute } from "@/lib/summer-camp/camper-nav"
import { camperCta } from "@/lib/summer-camp/camper-ui-theme"
import { cn } from "@/lib/utils"

type CurriculumProgress = {
  total_modules: number
  completed_modules: number
  percent: number
  complete: boolean
}

type ProjectsHub = {
  projects: Array<{
    project_id: number
    project_title: string
    project_description: string | null
    training_title: string
    training_id: number
    mentor: string | null
    status: string
    progress_percent: number
    primary_module_id: number | null
    difficulty: string
    required: boolean
    estimated_hours: string
    badge: string
    xp_reward: number
    overview: string
    tasks_completed: number
    tasks_total: number
    checkpoints_passed: number
    checkpoints_total: number
    unlocked: boolean
    assigned_student_name: string | null
    assigned_student_university: string | null
    project_number: number | null
    project_kind: string
    curriculum: CurriculumProgress
  }>
}

const DIFFICULTY_STYLE: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  hard: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
}

function statusLabel(status: string) {
  if (status === "completed") return "Completed"
  if (status === "in_progress") return "In progress"
  return "Not started"
}

function ProjectCard({
  p,
  index,
  locked,
}: {
  p: ProjectsHub["projects"][0]
  index: number
  locked: boolean
}) {
  const moduleId = p.primary_module_id ?? null
  const isStarted = p.status !== "not_started"
  const diffClass = DIFFICULTY_STYLE[p.difficulty] ?? DIFFICULTY_STYLE.medium

  return (
    <article
      className={cn(
        "rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] p-5 flex flex-col shadow-sm",
        locked && "opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-violet-600 dark:text-violet-400">
          {p.project_kind === "team_capstone"
            ? "Team capstone"
            : p.project_number
              ? `Research · Project ${p.project_number}`
              : `Advanced · Project ${index + 1}`}
        </p>
        <div className="flex items-center gap-1.5">
          {locked && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Lock className="h-3 w-3" /> Locked
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] capitalize">
            {statusLabel(p.status)}
          </Badge>
        </div>
      </div>

      <h2 className="text-lg font-bold leading-snug">{p.project_title}</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.training_title}</p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize", diffClass)}>
          {p.difficulty}
        </span>
        {p.required ? (
          <Badge className="text-[10px] h-5 bg-violet-600">Required</Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] h-5">
            Optional
          </Badge>
        )}
        {p.estimated_hours && (
          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5">
            <Clock className="h-3 w-3" /> {p.estimated_hours} hrs
          </span>
        )}
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 line-clamp-3 flex-1">
        {p.overview || p.project_description}
      </p>

      {p.badge && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-3 inline-flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5 shrink-0" />
          Badge: {p.badge}
        </p>
      )}

      {p.assigned_student_name && (
        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-2">
          <User className="h-3.5 w-3.5" /> Lead: {p.assigned_student_name}
          {p.assigned_student_university ? ` · ${p.assigned_student_university}` : ""}
        </p>
      )}

      {p.mentor && (
        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-2">
          <User className="h-3.5 w-3.5" /> Instructor: {p.mentor}
        </p>
      )}

      {!locked && (
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{p.progress_percent}%</span>
          </div>
          <Progress value={p.progress_percent} className="h-2" />
          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1">
            <span>
              Tasks {p.tasks_completed}/{p.tasks_total}
            </span>
            <span className="text-right">
              Checkpoints {p.checkpoints_passed}/{p.checkpoints_total}
            </span>
          </div>
        </div>
      )}

      {p.xp_reward > 0 && (
        <p className="text-xs font-medium text-violet-600 dark:text-violet-400 mt-3 inline-flex items-center gap-1">
          <Zap className="h-3.5 w-3.5" /> {p.xp_reward} XP reward
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-slate-200/80 dark:border-white/10">
        {locked ? (
          <p className="text-xs text-center text-muted-foreground py-2">
            Finish all core modules to unlock this project.
          </p>
        ) : moduleId ? (
          <Button
            className={cn("w-full gap-2 rounded-xl", !isStarted && camperCta)}
            variant={isStarted ? "outline" : "default"}
            asChild
          >
            <Link href={campRoute(`/module/${moduleId}`)}>
              <Play className="h-4 w-4" />
              {isStarted ? "Continue project" : "Start project"}
            </Link>
          </Button>
        ) : null}
      </div>
    </article>
  )
}

export default function CampProjectsPage() {
  const { data, loading } = useCampHub<ProjectsHub>("projects")

  const projects = data?.projects ?? []
  const curriculum = projects[0]?.curriculum
  const allUnlocked = projects.length > 0 && projects.every((p) => p.unlocked)

  return (
    <CamperPageShell
      icon={FolderKanban}
      title="Projects"
      subtitle={
        allUnlocked
          ? "Your assigned research project and team capstone — unlocked after completing core modules."
          : "Complete all core training modules to unlock research projects and the team capstone."
      }
      loading={loading}
    >
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-12 text-center space-y-3">
          <p className="text-slate-500 dark:text-slate-400">No capstone projects yet.</p>
          <Button variant="outline" size="sm" asChild>
            <Link href={campRoute("/browse")}>Browse trainings</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {!allUnlocked && curriculum && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900 dark:text-amber-100">Core modules required</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                    Advanced projects unlock when you finish all training modules (
                    {curriculum.completed_modules}/{curriculum.total_modules} complete).
                  </p>
                  <Progress value={curriculum.percent} className="h-2 mt-3 max-w-xs" />
                </div>
              </div>
              <Button size="sm" className={cn("shrink-0 w-full sm:w-auto", camperCta)} asChild>
                <Link href={campRoute(`/training/${projects[0].training_id}`)}>Continue modules</Link>
              </Button>
            </div>
          )}

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-4">
              Advanced projects
            </h2>
            <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {projects.map((p, index) => (
                <ProjectCard key={p.project_id} p={p} index={index} locked={!p.unlocked} />
              ))}
            </div>
          </section>
        </div>
      )}
    </CamperPageShell>
  )
}
