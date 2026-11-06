"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, FileText, Trash2, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import type { CourseProjectAssignmentRecord } from "@/lib/projects/project-grading-types"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { formatGradingMethodsSummary } from "@/lib/projects/project-grading-methods"
import {
  PROJECT_SETUP_PRESETS,
  applyEngineeringReportTemplate,
  buildAssignmentFromPreset,
  type ProjectSetupPresetId,
} from "@/lib/projects/project-setup-presets"
import { parseProjectPolicy } from "@/lib/course-policy-settings"
import { overlayProjectPolicyDefaults } from "@/lib/projects/overlay-project-policy-defaults"
import { portalListStripe } from "@/lib/portal-module-themes"
import {
  ProjectFormCallout,
  ProjectFormField,
  ProjectFormLoading,
  projectFormInputClass,
} from "@/components/instructor/projects/project-form-ui"

export function InstructorProjectAssignmentsPanel({
  onAssignmentsLoaded,
}: {
  onAssignmentsLoaded?: (items: CourseProjectAssignmentRecord[]) => void
} = {}) {
  const chrome = facultyEmbedChrome("projects")
  const router = useRouter()
  const { toast } = useToast()
  const { basePath, courseScopeVersion } = useInstructorDashboardV2()
  const setupBase = `${basePath}/management/projects/setup`

  const [assignments, setAssignments] = useState<CourseProjectAssignmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [presetId, setPresetId] = useState<ProjectSetupPresetId>("structured_engineering_report")
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CourseProjectAssignmentRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch("/api/instructor/project-assignments", {
        headers: buildInstructorApiHeaders(),
      })
      if (!res.ok) throw new Error("load failed")
      const data = await res.json()
      const list = data.assignments || []
      setAssignments(list)
      onAssignmentsLoaded?.(list)
    } catch {
      toast({ title: "Could not load project setups", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast, onAssignmentsLoaded])

  useEffect(() => {
    void load()
  }, [load, courseScopeVersion])

  const openEditor = (id: number) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("cc-projects-menu", "project-setup")
    }
    router.push(`${setupBase}/${id}/edit`)
  }

  const createSetup = async () => {
    const preset = PROJECT_SETUP_PRESETS.find((p) => p.id === presetId) ?? PROJECT_SETUP_PRESETS[0]
    setCreating(true)
    try {
      let payload = buildAssignmentFromPreset(presetId, newTitle)
      try {
        const policyRes = await instructorApiFetch("/api/instructor/courses/policies", {
          headers: buildInstructorApiHeaders(),
        })
        if (policyRes.ok) {
          const policyJson = await policyRes.json()
          payload = overlayProjectPolicyDefaults(payload, parseProjectPolicy(policyJson.project_policy), {
            applyGradingMix: presetId === "custom",
          })
        }
      } catch {
        /* keep preset as-is */
      }
      const headers = { ...buildInstructorApiHeaders(), "Content-Type": "application/json" }
      const res = await instructorApiFetch("/api/instructor/project-assignments", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("create failed")
      const json = await res.json()
      const assignmentId = Number(json.assignment?.id)
      if (preset.applyEngineeringSectionTemplate && assignmentId) {
        await applyEngineeringReportTemplate(assignmentId, (url, init) => instructorApiFetch(url, init), headers)
      }
      toast({
        title: "Project configuration created",
        description: "Finish setup in the four editor tabs, then link a group under Manage Projects.",
      })
      setCreateOpen(false)
      setNewTitle("")
      if (assignmentId) {
        openEditor(assignmentId)
      } else {
        await load()
      }
    } catch {
      toast({ title: "Create failed", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/project-assignments/${deleteTarget.id}`, {
        method: "DELETE",
        headers: buildInstructorApiHeaders(),
      })
      if (!res.ok) throw new Error("delete failed")
      toast({ title: "Project setup deleted" })
      setDeleteTarget(null)
      await load()
    } catch {
      toast({ title: "Delete failed", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const selectedPreset = PROJECT_SETUP_PRESETS.find((p) => p.id === presetId)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl space-y-1">
          <h3 className={cn("text-base font-semibold", PORTAL_TEXT)}>Project configuration</h3>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            One setup per project. Link it under Manage Projects → View. Unlinked groups keep 50-pt voting + instructor scoring.
          </p>
        </div>
        <Button type="button" size="sm" className={chrome.solid} onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New project configuration
        </Button>
      </div>

      {loading ? (
        <ProjectFormLoading />
      ) : assignments.length === 0 ? (
        <Card className={cn(chrome.card, "overflow-hidden")}>
          <CardContent className="flex flex-col items-center px-6 py-10 text-center">
            <div className={cn("mb-3 flex size-12 items-center justify-center rounded-2xl", chrome.p.softBg, chrome.p.iconText)}>
              <FileText className="h-5 w-5" />
            </div>
            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>No project configurations yet</p>
            <p className={cn("mt-2 max-w-md text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
              Start with &quot;Structured group report (engineering)&quot; for a nine-section capstone, or &quot;Same as
              current CourseCollab projects&quot; for legacy 50-pt scoring.
            </p>
            <Button type="button" className={cn("mt-5", chrome.solid)} size="sm" onClick={() => setCreateOpen(true)}>
              Create project configuration
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={cn(chrome.card, "divide-y divide-[var(--border)] overflow-hidden")}>
          {assignments.map((a, index) => {
            const stripe = portalListStripe(index, chrome.theme.family)
            return (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:px-5"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", stripe.iconBg, stripe.iconText)}>
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className={cn("truncate font-medium", PORTAL_TEXT)}>{a.title}</p>
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      {formatGradingMethodsSummary(a)} · {a.max_points} pts max
                      {a.session ? ` · Section ${a.session}` : " · All sections"}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <Badge variant="outline" className="text-xs capitalize">
                        {a.status}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {a.project_mode === "group" ? "Group" : "Individual"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" className={chrome.solid} onClick={() => openEditor(a.id)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Configure
                  </Button>
                  <Button type="button" size="sm" className={chrome.quiet} onClick={() => setDeleteTarget(a)}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New project configuration</DialogTitle>
            <DialogDescription>
              Choose how this project is graded and whether students submit a freeform deliverable or a structured
              group report. You can change every setting after creation in the full editor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ProjectFormField label="Configuration name">
              <Input
                id="setup-title"
                className={projectFormInputClass}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. ELEG 4325 Capstone — Spring 2026"
              />
            </ProjectFormField>
            <ProjectFormField label="Starting profile" hint="Pick a grading + report combination; everything is editable after create.">
              <div className="grid max-h-[min(42vh,360px)] gap-2 overflow-y-auto pr-1">
                {PROJECT_SETUP_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={cn(
                      "rounded-2xl border p-3.5 text-left text-sm transition-colors",
                      presetId === p.id
                        ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)] ring-1 ring-[var(--cc-accent)]/30"
                        : "border-[var(--border)] hover:bg-muted/30",
                    )}
                    onClick={() => setPresetId(p.id)}
                  >
                    <span className="font-semibold">{p.title}</span>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--cc-text-muted)]">{p.subtitle}</p>
                    <p className="mt-2 text-[11px] text-[var(--cc-text-muted)]">
                      <span className="font-medium text-[var(--cc-text)]">Report:</span> {p.report}
                      <span className="mx-2">·</span>
                      <span className="font-medium text-[var(--cc-text)]">Grading:</span> {p.grading}
                    </p>
                  </button>
                ))}
              </div>
            </ProjectFormField>
            {selectedPreset ? (
              <ProjectFormCallout>
                Next: four editor tabs — Details &amp; groups, Report &amp; rubrics, Grading &amp; scores, Submission
                &amp; integrity.
              </ProjectFormCallout>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" className={chrome.quiet} onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className={chrome.solid} disabled={creating} onClick={() => void createSetup()}>
              {creating ? "Creating…" : "Create & configure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <>
                  <strong>{deleteTarget.title}</strong> will be removed. Linked group projects will be unlinked.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
