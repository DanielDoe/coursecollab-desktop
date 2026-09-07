"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { FolderKanban, Loader2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CampStatusBadge } from "@/components/summer-camp/CampPublishControls"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalThemeStripe } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

export type FacultyCampProject = {
  id: number
  title: string
  description: string | null
  kind: string
  difficulty: string
  required: boolean
  estimated_hours: string
  badge: string
  overview: string
  learning_outcomes: string[]
  block_count: number
  primary_module_id: number | null
  modules: Array<{ id: number; title: string; status: string }>
}

type Props = {
  projects: FacultyCampProject[]
  onRefresh: () => Promise<void>
  editBasePath?: string
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
}

export function FacultyTrainingProjectsPanel({
  projects,
  onRefresh,
  editBasePath = "/faculty/dashboard/summer-camp/module",
}: Props) {
  const { card, solid, quiet } = facultyEmbedChrome("summer-camp")
  const router = useRouter()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [openingContentId, setOpeningContentId] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<number, Partial<FacultyCampProject>>>({})

  const jsonHeaders = { ...buildInstructorApiHeaders(), "Content-Type": "application/json" }

  const getDraft = (project: FacultyCampProject) =>
    drafts[project.id] ?? {
      title: project.title,
      description: project.description ?? "",
      overview: project.overview,
      difficulty: project.difficulty,
      estimated_hours: project.estimated_hours,
      badge: project.badge,
      learning_outcomes: project.learning_outcomes,
    }

  const openContentEditor = async (project: FacultyCampProject) => {
    setOpeningContentId(project.id)
    try {
      let moduleId = project.primary_module_id

      if (!moduleId || project.block_count === 0) {
        const res = await instructorApiFetch("/api/instructor/summer-camp/projects", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ project_id: project.id }),
        })
        if (!res.ok) return
        const data = (await res.json()) as { module?: { id?: number } }
        moduleId = data.module?.id ?? moduleId
        await onRefresh()
      }

      if (moduleId) {
        router.push(`${editBasePath}/${moduleId}/edit`)
      }
    } finally {
      setOpeningContentId(null)
    }
  }

  const saveProjectDetails = async (project: FacultyCampProject) => {
    const draft = getDraft(project)
    setSavingId(project.id)
    try {
      const res = await instructorApiFetch("/api/instructor/summer-camp/projects", {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({
          project_id: project.id,
          title: draft.title,
          description: draft.description,
          overview: draft.overview,
          difficulty: draft.difficulty,
          estimated_hours: draft.estimated_hours,
          badge: draft.badge,
          learning_outcomes: draft.learning_outcomes,
        }),
      })
      if (!res.ok) return
      setEditingId(null)
      await onRefresh()
    } finally {
      setSavingId(null)
    }
  }

  const updateDraft = useCallback((projectId: number, patch: Partial<FacultyCampProject>) => {
    setDrafts((prev) => ({
      ...prev,
      [projectId]: { ...prev[projectId], ...patch },
    }))
  }, [])

  if (projects.length === 0) {
    return (
      <div className={cn(card, "p-8 text-center")}>
        <FolderKanban className={cn("mx-auto mb-3 h-8 w-8", PORTAL_TEXT_MUTED)} />
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
          No capstone projects for this training yet. Run the project seed script or add capstone projects in admin.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
        Advanced research and capstone projects campers unlock after completing core training modules. Use{" "}
        <strong>Quick edit</strong> for project info (title, badge, overview). Use <strong>Edit content</strong> to
        edit the full lesson — markdown, code labs, checkpoints, and placeholders — the same way as training modules.
      </p>

      {projects.map((project, index) => {
        const module = project.modules[0]
        const draft = getDraft(project)
        const isEditing = editingId === project.id
        const kindLabel =
          project.kind === "team_capstone"
            ? "Team capstone"
            : `Research · Project ${index + 1}`

        return (
          <article
            key={project.id}
            className={cn("space-y-4 rounded-2xl border p-4", portalThemeStripe(index).row, portalThemeStripe(index).border)}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className={cn("text-[10px] font-semibold uppercase tracking-wider", portalThemeStripe(index).iconText)}>{kindLabel}</p>
                <h3 className={cn("mt-1 text-lg font-semibold", PORTAL_TEXT)}>{project.title}</h3>
                <p className={cn("mt-1 line-clamp-2 text-sm", PORTAL_TEXT_MUTED)}>
                  {project.overview || project.description}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {project.difficulty ? (
                    <Badge variant="secondary" className="capitalize text-[10px]">
                      {DIFFICULTY_LABEL[project.difficulty] ?? project.difficulty}
                    </Badge>
                  ) : null}
                  {project.required ? (
                    <Badge className={cn("text-[10px] border-0", solid)}>Required</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Optional
                    </Badge>
                  )}
                  {project.estimated_hours ? (
                    <Badge variant="outline" className="text-[10px]">
                      {project.estimated_hours} hrs
                    </Badge>
                  ) : null}
                  {project.badge ? (
                    <Badge variant="outline" className="text-[10px]">
                      Badge: {project.badge}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {module ? <CampStatusBadge status={module.status} /> : null}
                <Button
                  size="sm"
                  className={cn("rounded-lg", quiet)}
                  onClick={() => setEditingId(isEditing ? null : project.id)}
                >
                  {isEditing ? "Close" : "Quick edit"}
                </Button>
                <Button
                  size="sm"
                  className={cn("rounded-lg", solid)}
                  onClick={() => void openContentEditor(project)}
                  disabled={openingContentId === project.id}
                >
                  {openingContentId === project.id ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                  )}
                  Edit content
                </Button>
              </div>
            </div>

            {module ? (
              <p className="text-xs text-dashboard-v2-muted">
                Content workspace: {module.title} · {project.block_count} content block
                {project.block_count === 1 ? "" : "s"}
                {project.block_count === 0 ? " (curriculum will load when you open Edit content)" : ""}
              </p>
            ) : (
              <p className="text-xs text-dashboard-v2-muted">
                Content blocks will be prepared from the curriculum template when you open Edit content.
              </p>
            )}

            {isEditing ? (
              <div className="rounded-lg border border-dashboard-v2-border p-4 space-y-3 bg-dashboard-v2-bg/50">
                <div className="space-y-2">
                  <label className="text-xs font-medium">Project title</label>
                  <Input
                    value={String(draft.title ?? "")}
                    onChange={(e) => updateDraft(project.id, { title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Short description</label>
                  <Input
                    value={String(draft.description ?? "")}
                    onChange={(e) => updateDraft(project.id, { description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Overview (shown to campers)</label>
                  <Textarea
                    value={String(draft.overview ?? "")}
                    onChange={(e) => updateDraft(project.id, { overview: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Difficulty</label>
                    <select
                      className="w-full rounded-lg border px-3 py-2 text-sm bg-transparent"
                      value={String(draft.difficulty ?? "medium")}
                      onChange={(e) => updateDraft(project.id, { difficulty: e.target.value })}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Estimated hours</label>
                    <Input
                      value={String(draft.estimated_hours ?? "")}
                      onChange={(e) => updateDraft(project.id, { estimated_hours: e.target.value })}
                      placeholder="4–6"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Badge name</label>
                  <Input
                    value={String(draft.badge ?? "")}
                    onChange={(e) => updateDraft(project.id, { badge: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Learning outcomes (one per line)</label>
                  <Textarea
                    value={(draft.learning_outcomes ?? project.learning_outcomes).join("\n")}
                    onChange={(e) =>
                      updateDraft(project.id, {
                        learning_outcomes: e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    rows={4}
                  />
                </div>
                <Button
                  size="sm"
                  className={cn("rounded-lg", solid)}
                  onClick={() => void saveProjectDetails(project)}
                  disabled={savingId === project.id}
                >
                  {savingId === project.id ? "Saving…" : "Save changes"}
                </Button>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}
