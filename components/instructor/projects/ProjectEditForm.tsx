"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import type { CourseProjectAssignmentRecord } from "@/lib/projects/project-grading-types"
import { validateGradingComponents } from "@/lib/projects/project-grading-config"
import { applyGradingMethodFlags, readGradingMethodFlags } from "@/lib/projects/project-grading-methods"
import { createEmptyProjectAssignment } from "@/lib/projects/default-assignment-form-state"
import { ProjectRubricBuilder } from "@/components/instructor/projects/ProjectRubricBuilder"
import { getProjectModuleSessionsForCourse } from "@/lib/project-module-sessions"
import { useInstructorDashboardV2, INSTRUCTOR_DASHBOARD_V2_BASE } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { FileText, Users, LayoutTemplate, Scale, ShieldCheck, Plus, Trash2, FolderCog } from "lucide-react"
import { ProjectTemplateBuilder } from "@/components/instructor/projects/ProjectTemplateBuilder"
import { ProjectIntegritySettingsForm } from "@/components/instructor/projects/ProjectIntegritySettingsForm"
import { ProjectAiGradingSettingsForm } from "@/components/instructor/projects/ProjectAiGradingSettingsForm"
import { ProjectGradingMethodSelector } from "@/components/instructor/projects/ProjectGradingMethodSelector"
import { getInstructorData } from "@/lib/auth"
import { FacultyModuleSplitLayout } from "@/components/instructor/dashboard-v2/FacultyModuleSplitLayout"
import { FacultyModuleSideMenu } from "@/components/instructor/dashboard-v2/FacultyModuleSideMenu"
import {
  ProjectFormCallout,
  ProjectFormField,
  ProjectFormFieldGrid,
  ProjectFormLoading,
  ProjectFormPageHeader,
  ProjectFormSegmented,
  ProjectFormStickyFooter,
  ProjectFormSwitchPanel,
  ProjectFormSwitchRow,
  projectCardHeaderClass,
  projectCardMutedClass,
  projectCardTitleClass,
  projectFormInputClass,
  projectFormSelectTriggerClass,
  projectFormTextareaClass,
  useProjectFormStyles,
} from "@/components/instructor/projects/project-form-ui"

type TabId = "details" | "report" | "grading" | "submission"

const PROJECT_SETUP_MENU = [
  { id: "details" as const, label: "Details", icon: FileText },
  { id: "report" as const, label: "Report", icon: LayoutTemplate },
  { id: "grading" as const, label: "Grading", icon: Scale },
  { id: "submission" as const, label: "Submission", icon: ShieldCheck },
]

export function ProjectEditForm({
  assignmentId,
  embedInDashboard = true,
  listPath = `${INSTRUCTOR_DASHBOARD_V2_BASE}/management/projects`,
}: {
  assignmentId?: number | "new"
  embedInDashboard?: boolean
  listPath?: string
}) {
  const { chrome } = useProjectFormStyles("projects")
  const { toast } = useToast()
  const router = useRouter()
  const { basePath, courseScopeVersion } = useInstructorDashboardV2()
  const setupBase = `${basePath}/management/projects/setup`
  const courseCode = getInstructorData()?.selectedCourseCode ?? null
  const isNew = assignmentId === "new" || !assignmentId
  const [activeTab, setActiveTab] = useState<TabId>("details")
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<CourseProjectAssignmentRecord>(() => createEmptyProjectAssignment(0, null))

  const sessions = getProjectModuleSessionsForCourse(courseCode)

  const load = useCallback(async () => {
    if (isNew) return
    setLoading(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/project-assignments/${assignmentId}`, {
        headers: buildInstructorApiHeaders(),
      })
      if (!res.ok) throw new Error("Failed to load")
      const json = await res.json()
      setData(json.assignment)
    } catch {
      toast({ title: "Could not load project setup", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [assignmentId, isNew, toast])

  useEffect(() => {
    void load()
  }, [load, courseScopeVersion])

  const patch = (partial: Partial<CourseProjectAssignmentRecord>) => {
    setData((prev) => ({ ...prev, ...partial }))
  }

  const save = async () => {
    const normalized = applyGradingMethodFlags(data, readGradingMethodFlags(data))
    const err = validateGradingComponents(normalized.grading_components)
    if (err) {
      toast({ title: "Grading weights", description: err, variant: "destructive" })
      setActiveTab("grading")
      return
    }
    if (!data.title.trim()) {
      toast({ title: "Title required", variant: "destructive" })
      setActiveTab("details")
      return
    }

    setSaving(true)
    try {
      const url = isNew
        ? "/api/instructor/project-assignments"
        : `/api/instructor/project-assignments/${assignmentId}`
      const res = await instructorApiFetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || "Save failed")
      }
      const json = await res.json()
      toast({ title: "Project setup saved" })
      if (isNew && json.assignment?.id) {
        router.replace(`${setupBase}/${json.assignment.id}/edit`)
      } else {
        setData(json.assignment)
      }
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <ProjectFormLoading />
  }

  const card = chrome.card

  return (
    <div className="w-full min-w-0 space-y-5 pb-6">
      <ProjectFormPageHeader
        chrome={chrome}
        icon={FolderCog}
        status={data.status}
        title={isNew ? "New project configuration" : data.title || "Project configuration"}
        description="Grading sources, report template, integrity, and submission — linked to approved groups under Manage Projects."
        action={
          <Select
            value={data.status}
            onValueChange={(v) => patch({ status: v as CourseProjectAssignmentRecord["status"] })}
          >
            <SelectTrigger className={cn(projectFormSelectTriggerClass, "w-[148px] font-medium")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <FacultyModuleSplitLayout
        scrollMode="page"
        menuWidthClass="lg:w-52 xl:w-56"
        menu={
          <FacultyModuleSideMenu
            moduleId="projects"
            title="Project setup"
            activeId={activeTab}
            onSelect={(id) => setActiveTab(id as TabId)}
            items={PROJECT_SETUP_MENU.map(({ id, label, icon }) => ({ id, label, icon }))}
            accent="theme"
          />
        }
      >
        <div className="min-w-0 space-y-6">
        {activeTab === "details" ? (
          <div className="space-y-6">
          <Card className={card}>
            <CardHeader className={projectCardHeaderClass}>
              <CardTitle className={projectCardTitleClass}>Basic information</CardTitle>
              <p className={projectCardMutedClass}>Title, instructions, availability, and gradebook points</p>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <ProjectFormField label="Title" htmlFor="project-title">
                <Input
                  id="project-title"
                  className={projectFormInputClass}
                  value={data.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="e.g. ELEG 4325 Capstone Report"
                />
              </ProjectFormField>
              <ProjectFormField label="Description">
                <Textarea
                  className={projectFormTextareaClass}
                  rows={3}
                  value={data.description || ""}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="Brief description shown to students before they start…"
                />
              </ProjectFormField>
              <ProjectFormField label="Instructions for students" hint="Shown at the top of the project workspace.">
                <Textarea
                  className={projectFormTextareaClass}
                  rows={4}
                  value={data.instructions || ""}
                  onChange={(e) => patch({ instructions: e.target.value })}
                />
              </ProjectFormField>
              <ProjectFormFieldGrid>
                <ProjectFormField label="Course section">
                  <Select value={data.session || "__all"} onValueChange={(v) => patch({ session: v === "__all" ? null : v })}>
                    <SelectTrigger className={projectFormSelectTriggerClass}>
                      <SelectValue placeholder="All sections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">All sections in course</SelectItem>
                      {sessions.map((s) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ProjectFormField>
                <ProjectFormField label="Project mode">
                  <Select
                    value={data.project_mode}
                    onValueChange={(v) => patch({ project_mode: v as "individual" | "group" })}
                  >
                    <SelectTrigger className={projectFormSelectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="group">Group project</SelectItem>
                      <SelectItem value="individual">Individual project</SelectItem>
                    </SelectContent>
                  </Select>
                </ProjectFormField>
                <ProjectFormField label="Who proposes the project" span={2} hint="Student proposed keeps group proposals and custom titles. Instructor proposed uses this title and the report template for every team.">
                  <ProjectFormSegmented
                    chrome={chrome}
                    value={data.submission.proposal_mode || "student"}
                    onChange={(v) =>
                      patch({
                        submission: {
                          ...data.submission,
                          proposal_mode: v as "student" | "instructor",
                        },
                      })
                    }
                    options={[
                      { value: "student", label: "Student proposed" },
                      { value: "instructor", label: "Instructor proposed" },
                    ]}
                  />
                </ProjectFormField>
                <ProjectFormField label="Available from">
                  <Input
                    type="datetime-local"
                    className={projectFormInputClass}
                    value={data.available_from?.slice(0, 16) || ""}
                    onChange={(e) => patch({ available_from: e.target.value || null })}
                  />
                </ProjectFormField>
                <ProjectFormField label="Due date">
                  <Input
                    type="datetime-local"
                    className={projectFormInputClass}
                    value={data.due_at?.slice(0, 16) || ""}
                    onChange={(e) => patch({ due_at: e.target.value || null })}
                  />
                </ProjectFormField>
                <ProjectFormField label="Available until">
                  <Input
                    type="datetime-local"
                    className={projectFormInputClass}
                    value={data.available_until?.slice(0, 16) || ""}
                    onChange={(e) => patch({ available_until: e.target.value || null })}
                  />
                </ProjectFormField>
                <ProjectFormField label="Maximum points">
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    className={projectFormInputClass}
                    value={data.max_points}
                    onChange={(e) => patch({ max_points: Number(e.target.value) || 50 })}
                  />
                </ProjectFormField>
              </ProjectFormFieldGrid>
              <ProjectFormSwitchPanel>
                <ProjectFormSwitchRow
                  chrome={chrome}
                  label="Count toward course grade"
                  description="When off, scores are tracked but not pushed to the gradebook."
                  checked={data.counts_toward_course_grade}
                  onCheckedChange={(c) => patch({ counts_toward_course_grade: c })}
                />
              </ProjectFormSwitchPanel>
            </CardContent>
          </Card>

          <Card className={card}>
            <CardHeader className={projectCardHeaderClass}>
              <CardTitle className={cn(projectCardTitleClass, "flex items-center gap-2")}>
                <Users className="h-4 w-4" />
                Groups &amp; collaboration
              </CardTitle>
              <p className={projectCardMutedClass}>One shared workspace and submission per approved group</p>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <ProjectFormFieldGrid>
                <ProjectFormField label="Minimum group size">
                  <Input
                    type="number"
                    min={1}
                    className={projectFormInputClass}
                    value={data.min_group_size ?? ""}
                    onChange={(e) => patch({ min_group_size: Number(e.target.value) || null })}
                  />
                </ProjectFormField>
                <ProjectFormField label="Maximum group size">
                  <Input
                    type="number"
                    min={1}
                    className={projectFormInputClass}
                    value={data.max_group_size ?? ""}
                    onChange={(e) => patch({ max_group_size: Number(e.target.value) || null })}
                  />
                </ProjectFormField>
              </ProjectFormFieldGrid>
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                Membership and approvals still flow through Manage Projects → Groups. Contribution history is available
                when adjusting individual grades.
              </p>
            </CardContent>
          </Card>
          </div>
        ) : null}

        {activeTab === "report" ? (
          <div className="space-y-6">
          <Card className={card}>
            <CardHeader className={projectCardHeaderClass}>
              <CardTitle className={projectCardTitleClass}>Report template</CardTitle>
              <p className={projectCardMutedClass}>Freeform deliverables or a structured multi-section group report</p>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              {!isNew && data.id ? (
                <ProjectTemplateBuilder assignmentId={data.id} disabled={saving} chrome={chrome} />
              ) : (
                <ProjectFormCallout>
                  Save this configuration once, then add structured sections or import an engineering template.
                </ProjectFormCallout>
              )}
              <ProjectFormField label="Required deliverables" hint="One item per line (freeform mode).">
                <Textarea
                  className={projectFormTextareaClass}
                  rows={4}
                  value={data.required_deliverables.join("\n")}
                  onChange={(e) =>
                    patch({
                      required_deliverables: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </ProjectFormField>
            </CardContent>
          </Card>

          <Card className={card}>
            <CardHeader className={projectCardHeaderClass}>
              <CardTitle className={projectCardTitleClass}>Master rubric</CardTitle>
              <p className={projectCardMutedClass}>Default rubric for instructor grading</p>
            </CardHeader>
            <CardContent className="p-6">
              <ProjectRubricBuilder value={data.rubric} onChange={(rubric) => patch({ rubric })} disabled={saving} chrome={chrome} />
            </CardContent>
          </Card>
          </div>
        ) : null}

        {activeTab === "grading" ? (
          <div className="space-y-6">
          <Card className={card}>
            <CardHeader className={projectCardHeaderClass}>
              <CardTitle className={projectCardTitleClass}>Grading sources</CardTitle>
              <p className={projectCardMutedClass}>
                Enable student voting, instructor grading, and/or AI grading. Weights must total 100% when more than one
                is on.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="max-w-xs">
                <ProjectFormField label="Project maximum points">
                  <Input
                    type="number"
                    className={projectFormInputClass}
                    value={data.max_points}
                    onChange={(e) => patch({ max_points: Math.max(1, Number(e.target.value) || 50) })}
                  />
                </ProjectFormField>
              </div>
              <ProjectGradingMethodSelector value={data} onChange={setData} disabled={saving} chrome={chrome} />
            </CardContent>
          </Card>

          <Card className={card}>
            <CardHeader className={projectCardHeaderClass}>
              <CardTitle className={projectCardTitleClass}>Resources</CardTitle>
              <p className={projectCardMutedClass}>Links for students; score breakdowns appear on Project Overview</p>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              {data.resources.map((r, i) => (
                <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    placeholder="Resource title"
                    className={cn(projectFormInputClass, "sm:flex-1")}
                    value={r.title}
                    onChange={(e) => {
                      const resources = [...data.resources]
                      resources[i] = { ...resources[i], title: e.target.value }
                      patch({ resources })
                    }}
                  />
                  <Input
                    placeholder="https://…"
                    className={cn(projectFormInputClass, "sm:flex-[1.4]")}
                    value={r.url}
                    onChange={(e) => {
                      const resources = [...data.resources]
                      resources[i] = { ...resources[i], url: e.target.value }
                      patch({ resources })
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-[var(--cc-sem-danger)]"
                    onClick={() => patch({ resources: data.resources.filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                className={chrome.quiet}
                onClick={() => patch({ resources: [...data.resources, { title: "", url: "" }] })}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add resource link
              </Button>
            </CardContent>
          </Card>
          </div>
        ) : null}

        {activeTab === "submission" ? (
          <div className="space-y-6">
          <Card className={card}>
            <CardHeader className={projectCardHeaderClass}>
              <CardTitle className={projectCardTitleClass}>Integrity &amp; workspace policy</CardTitle>
              <p className={projectCardMutedClass}>Strict mode, paste, Cora, and submission controls</p>
            </CardHeader>
            <CardContent className="p-6">
              <ProjectIntegritySettingsForm
                value={data.integrity_settings}
                onChange={(integrity_settings) => patch({ integrity_settings })}
                disabled={saving}
                chrome={chrome}
              />
            </CardContent>
          </Card>

          <Card className={card}>
            <CardHeader className={projectCardHeaderClass}>
              <CardTitle className={projectCardTitleClass}>AI grading model</CardTitle>
              <p className={projectCardMutedClass}>Model, fallback, and how strictly the rubric is scored</p>
            </CardHeader>
            <CardContent className="p-6">
              <ProjectAiGradingSettingsForm
                value={data.ai_grading_settings}
                onChange={(ai_grading_settings) => patch({ ai_grading_settings })}
                disabled={saving}
                chrome={chrome}
              />
            </CardContent>
          </Card>

          <Card className={card}>
            <CardHeader className={projectCardHeaderClass}>
              <CardTitle className={projectCardTitleClass}>Submission rules</CardTitle>
              <p className={projectCardMutedClass}>Resubmissions, approval workflow, and late penalties</p>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <ProjectFormSwitchPanel>
                <ProjectFormSwitchRow
                  chrome={chrome}
                  label="Allow resubmissions"
                  checked={data.resubmissions.allow_resubmissions}
                  onCheckedChange={(c) => patch({ resubmissions: { ...data.resubmissions, allow_resubmissions: c } })}
                  disabled={saving}
                />
                <ProjectFormSwitchRow
                  chrome={chrome}
                  label="Require instructor approval on submit"
                  checked={data.submission.require_instructor_approval}
                  onCheckedChange={(c) => patch({ submission: { ...data.submission, require_instructor_approval: c } })}
                  disabled={saving}
                />
              </ProjectFormSwitchPanel>
              <div className="max-w-xs">
                <ProjectFormField label="Late penalty (% per day)">
                  <Input
                    type="number"
                    className={projectFormInputClass}
                    value={data.late_policy.penalty_percent_per_day}
                    onChange={(e) =>
                      patch({
                        late_policy: {
                          ...data.late_policy,
                          penalty_percent_per_day: Number(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </ProjectFormField>
              </div>
            </CardContent>
          </Card>

          <Card className={card}>
            <CardHeader className={projectCardHeaderClass}>
              <CardTitle className={projectCardTitleClass}>Presentation &amp; demo</CardTitle>
              <p className={projectCardMutedClass}>
                Requirements feed scoring when presentation grades are recorded; schedules stay in Presentations
              </p>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <ProjectFormSwitchPanel>
                <ProjectFormSwitchRow
                  chrome={chrome}
                  label="Presentation required"
                  checked={data.presentation.required}
                  onCheckedChange={(c) => patch({ presentation: { ...data.presentation, required: c } })}
                  disabled={saving}
                />
              </ProjectFormSwitchPanel>
              <ProjectFormFieldGrid>
                <ProjectFormField label="Location">
                  <Input
                    placeholder="Room or venue"
                    className={projectFormInputClass}
                    value={data.presentation.location || ""}
                    onChange={(e) => patch({ presentation: { ...data.presentation, location: e.target.value || null } })}
                  />
                </ProjectFormField>
                <ProjectFormField label="Duration (minutes)">
                  <Input
                    type="number"
                    className={projectFormInputClass}
                    value={data.presentation.duration_minutes ?? ""}
                    onChange={(e) =>
                      patch({
                        presentation: {
                          ...data.presentation,
                          duration_minutes: e.target.value === "" ? null : Number(e.target.value),
                        },
                      })
                    }
                  />
                </ProjectFormField>
                <ProjectFormField label="Presentation weight (% of final grade)" span={2}>
                  <Input
                    type="number"
                    className={projectFormInputClass}
                    value={data.presentation.points_weight_percent}
                    onChange={(e) =>
                      patch({
                        presentation: {
                          ...data.presentation,
                          points_weight_percent: Number(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </ProjectFormField>
              </ProjectFormFieldGrid>
            </CardContent>
          </Card>
          </div>
        ) : null}
        </div>
      </FacultyModuleSplitLayout>

      <ProjectFormStickyFooter chrome={chrome}>
        <Button
          type="button"
          className={chrome.quiet}
          onClick={() => {
            if (typeof window !== "undefined") sessionStorage.setItem("cc-projects-menu", "project-setup")
            router.push(listPath)
          }}
        >
          Cancel
        </Button>
        <Button type="button" className={chrome.solid} disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save configuration"}
        </Button>
      </ProjectFormStickyFooter>
    </div>
  )
}
