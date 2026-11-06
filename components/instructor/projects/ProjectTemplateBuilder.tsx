"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Copy, GripVertical, Upload, ChevronDown } from "lucide-react"
import type { ProjectResponseField, ProjectResponseFieldKind, ProjectSubmissionMode, ProjectTemplateSection } from "@/lib/projects/project-template-types"
import { DEFAULT_SECTION_CONFIG } from "@/lib/projects/project-template-types"
import { eleg4325FinalProjectSections } from "@/lib/projects/eleg4325-final-project-template"
import { useToast } from "@/hooks/use-toast"
import { slugifySectionKey } from "@/lib/projects/project-template-utils"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import type { FacultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import {
  ProjectFormField,
  ProjectFormFieldGrid,
  projectFormInputClass,
  projectFormSelectTriggerClass,
  projectFormTextareaClass,
} from "@/components/instructor/projects/project-form-ui"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FacultyIntegratedToolbar } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"

function newSection(index: number): ProjectTemplateSection {
  const title = `Section ${index + 1}`
  return {
    section_key: slugifySectionKey(title, index),
    sort_order: index,
    title,
    instructions: "",
    config: {
      ...DEFAULT_SECTION_CONFIG(),
      points: 0,
      response_fields: [
        { id: `response-${index}-${Date.now()}`, label: "Written response", kind: "long_text", required: true },
      ],
    },
  }
}

const FIELD_KINDS: { value: ProjectResponseFieldKind; label: string }[] = [
  { value: "short_text", label: "Short answer" },
  { value: "long_text", label: "Paragraph" },
  { value: "image", label: "Image upload" },
  { value: "file", label: "File upload" },
  { value: "link", label: "Link" },
  { value: "checklist", label: "Checklist" },
  { value: "roster", label: "Class roster" },
]

function withRosterFields(sections: ProjectTemplateSection[]) {
  return sections.map((section) => ({
    ...section,
    config: {
      ...section.config,
      response_fields: (section.config.response_fields ?? []).map((field) =>
        field.id === "cover-members" || field.kind === "roster"
          ? { ...field, kind: "roster" as const, track_typing: false }
          : field,
      ),
    },
  }))
}

export function ProjectTemplateBuilder({
  assignmentId,
  disabled,
  chrome: chromeProp,
}: {
  assignmentId: number
  disabled?: boolean
  chrome?: FacultyEmbedChrome
}) {
  const chrome = chromeProp ?? facultyEmbedChrome("projects")
  const { toast } = useToast()
  const [mode, setMode] = useState<ProjectSubmissionMode>("FREEFORM_SUBMISSION")
  const [allowFileUpload, setAllowFileUpload] = useState(true)
  const [sections, setSections] = useState<ProjectTemplateSection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState("")
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await instructorApiFetch(
        `/api/instructor/project-assignments/${assignmentId}/template-sections`,
        { headers: buildInstructorApiHeaders() },
      )
      if (res.ok) {
        const data = await res.json()
        setMode(data.submission_mode ?? "FREEFORM_SUBMISSION")
        setAllowFileUpload(data.submission_workflow?.allow_file_upload !== false)
        setSections(withRosterFields(data.sections ?? []))
      }
    } finally {
      setLoading(false)
    }
  }, [assignmentId])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await instructorApiFetch(`/api/instructor/project-assignments/${assignmentId}/template-sections`, {
        method: "PUT",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_mode: mode,
          sections: sections.map((s, i) => ({
            ...s,
            sort_order: i,
            section_key: s.section_key || slugifySectionKey(s.title, i),
          })),
          submission_workflow: {
            confirmation_mode: "ALL_MEMBERS",
            require_references: true,
            allow_file_upload: allowFileUpload,
          },
        }),
      })
    } finally {
      setSaving(false)
    }
  }


  const draftFromFile = async (file: File) => {
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await instructorApiFetch("/api/instructor/project-assignments/draft-template", {
        method: "POST",
        headers: buildInstructorApiHeaders(),
        body: fd,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Cora could not draft this file")
      setMode("STRUCTURED_REPORT")
      setSections(withRosterFields(data.sections ?? []))
      toast({ title: "Template drafted", description: "Review sections, fields, and points, then save." })
    } catch (err) {
      toast({
        title: "Draft failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const visibleSections = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sections.map((section, index) => ({ section, index }))
    return sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => {
        const haystack = [
          section.title,
          section.instructions,
          ...(section.config.response_fields ?? []).map((field) => field.label),
        ]
          .join(" ")
          .toLowerCase()
        return haystack.includes(q)
      })
  }, [query, sections])

  const importExample = async () => {
    const res = await fetch("/samples/project-template-example-engineering.json")
    if (!res.ok) return
    const data = await res.json()
    setMode(data.submission_mode === "STRUCTURED_REPORT" ? "STRUCTURED_REPORT" : "FREEFORM_SUBMISSION")
    setSections(
      (data.sections as Array<{ title: string; config?: Partial<ProjectTemplateSection["config"]> }>).map((s, i) => ({
        ...newSection(i),
        title: s.title,
        section_key: slugifySectionKey(s.title, i),
        config: { ...DEFAULT_SECTION_CONFIG(), ...s.config },
      })),
    )
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full max-w-md rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,text/plain"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (file) void draftFromFile(file)
        }}
      />

      <ProjectFormFieldGrid>
        <ProjectFormField
          label="Report format"
          hint="Structured reports use numbered sections in the group workspace. Freeform is a title, summary, and attachments."
        >
          <Select
            value={mode}
            onValueChange={(v) => setMode(v as ProjectSubmissionMode)}
            disabled={disabled}
          >
            <SelectTrigger className={projectFormSelectTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STRUCTURED_REPORT">Structured report</SelectItem>
              <SelectItem value="FREEFORM_SUBMISSION">Freeform</SelectItem>
            </SelectContent>
          </Select>
        </ProjectFormField>
        <ProjectFormField
          label="How students answer"
          hint="Platform fields keep answers in each section. File upload lets the group attach a document instead."
        >
          <Select
            value={allowFileUpload ? "files" : "platform"}
            onValueChange={(v) => setAllowFileUpload(v === "files")}
            disabled={disabled}
          >
            <SelectTrigger className={projectFormSelectTriggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="platform">In-platform fields</SelectItem>
              <SelectItem value="files">Upload a file</SelectItem>
            </SelectContent>
          </Select>
        </ProjectFormField>
      </ProjectFormFieldGrid>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" className={cn(chrome.quiet, "h-9")} disabled={disabled || saving}>
              Start from
              <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              disabled={disabled}
              onSelect={() => {
                setMode("STRUCTURED_REPORT")
                setAllowFileUpload(false)
                setSections(eleg4325FinalProjectSections())
              }}
            >
              ELEG 4325 final project
            </DropdownMenuItem>
            <DropdownMenuItem disabled={disabled} onSelect={() => pdfInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Draft from PDF with Cora
            </DropdownMenuItem>
            <DropdownMenuItem disabled={disabled} onSelect={() => void importExample()}>
              Import engineering example
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button type="button" size="sm" className={cn(chrome.solid, "ml-auto h-9")} disabled={saving || disabled} onClick={() => void save()}>
          {saving ? "Saving…" : "Save template"}
        </Button>
      </div>

      {mode === "STRUCTURED_REPORT" ? (
        <div className="space-y-3">
          <FacultyIntegratedToolbar
            moduleId="projects"
            embedded
            search={query}
            onSearchChange={setQuery}
            onSearchClear={() => setQuery("")}
            searchPlaceholder="Find a section…"
            searchFill
            meta={
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                {query.trim()
                  ? `${visibleSections.length} of ${sections.length} sections`
                  : `${sections.length} sections`}
              </p>
            }
            trailing={
              <Button
                type="button"
                size="sm"
                className={chrome.quiet}
                disabled={disabled}
                onClick={() => setSections([...sections, newSection(sections.length)])}
              >
                <Plus className="mr-1 h-4 w-4" />
                Add section
              </Button>
            }
          />
          {visibleSections.length === 0 ? (
            <p className={cn("rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm", PORTAL_TEXT_MUTED)}>
              No sections match “{query.trim()}”.
            </p>
          ) : null}
          {visibleSections.map(({ section, index: idx }) => (
            <div
              key={section.section_key + idx}
              className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]"
            >
              <div className="flex items-center gap-2 border-b border-[var(--border)] bg-muted/25 px-3 py-2">
                <GripVertical className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" />
                <span className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                  Section {idx + 1}
                </span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Title</Label>
                  <Input
                    className={projectFormInputClass}
                    value={section.title}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...sections]
                      next[idx] = { ...section, title: e.target.value }
                      setSections(next)
                    }}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Instructions</Label>
                  <Textarea
                    className={projectFormTextareaClass}
                    rows={2}
                    value={section.instructions || ""}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...sections]
                      next[idx] = { ...section, instructions: e.target.value }
                      setSections(next)
                    }}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-muted/20 px-3 py-2">
                    <div>
                      <Label className="text-xs">Image upload</Label>
                      <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>Students can attach a figure with their written response.</p>
                    </div>
                    <Switch
                      className={chrome.switchChecked}
                      checked={(section.config.response_fields ?? []).some((field) => field.kind === "image")}
                      disabled={disabled}
                      onCheckedChange={(on) => {
                        const current = section.config.response_fields ?? []
                        const fields = on
                          ? current.some((field) => field.kind === "image")
                            ? current
                            : [
                                ...current,
                                {
                                  id: `image-${section.section_key}`,
                                  label: "Figure or screenshot",
                                  kind: "image" as const,
                                  required: false,
                                },
                              ]
                          : current.filter((field) => field.kind !== "image")
                        const withText = fields.some((field) => field.kind === "long_text" || field.kind === "short_text")
                          ? fields
                          : [
                              { id: `response-${section.section_key}`, label: "Written response", kind: "long_text" as const, required: true },
                              ...fields,
                            ]
                        const next = [...sections]
                        next[idx] = { ...section, config: { ...section.config, response_fields: withText } }
                        setSections(next)
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-muted/20 px-3 py-2">
                    <div>
                      <Label className="text-xs">Block copy and paste</Label>
                      <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>Students type this section. Replay records the keystrokes.</p>
                    </div>
                    <Switch
                      className={chrome.switchChecked}
                      checked={Boolean(section.config.block_paste)}
                      disabled={disabled}
                      onCheckedChange={(on) => {
                        const fields = (section.config.response_fields ?? []).map((field) =>
                          on && (field.kind === "long_text" || field.kind === "short_text") && !field.id.startsWith("cover-")
                            ? { ...field, track_typing: true }
                            : field,
                        )
                        const next = [...sections]
                        next[idx] = { ...section, config: { ...section.config, block_paste: on, response_fields: fields } }
                        setSections(next)
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">Student answer fields</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={disabled}
                      onClick={() => {
                        const field: ProjectResponseField = {
                          id: `field-${idx}-${Date.now()}`,
                          label: "New field",
                          kind: "long_text",
                          required: true,
                        }
                        const next = [...sections]
                        const fields = [...(section.config.response_fields ?? []), field]
                        next[idx] = { ...section, config: { ...section.config, response_fields: fields } }
                        setSections(next)
                      }}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add field
                    </Button>
                  </div>
                  {(section.config.response_fields ?? []).length === 0 ? (
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>No fields yet. Students will use the freeform section editor.</p>
                  ) : (
                    <div className="space-y-2">
                      {(section.config.response_fields ?? []).map((field, fieldIdx) => (
                        <div key={field.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-muted/20 p-2">
                          <Input
                            className={cn(projectFormInputClass, "min-w-0 flex-1")}
                            value={field.label}
                            disabled={disabled}
                            onChange={(e) => {
                              const fields = [...(section.config.response_fields ?? [])]
                              fields[fieldIdx] = { ...field, label: e.target.value }
                              const next = [...sections]
                              next[idx] = { ...section, config: { ...section.config, response_fields: fields } }
                              setSections(next)
                            }}
                          />
                          <Select
                            value={field.kind}
                            disabled={disabled}
                            onValueChange={(kind) => {
                              const fields = [...(section.config.response_fields ?? [])]
                              const nextKind = kind as ProjectResponseFieldKind
                              fields[fieldIdx] = {
                                ...field,
                                kind: nextKind,
                                track_typing: nextKind === "roster" ? false : field.track_typing,
                              }
                              const next = [...sections]
                              next[idx] = { ...section, config: { ...section.config, response_fields: fields } }
                              setSections(next)
                            }}
                          >
                            <SelectTrigger className={cn(projectFormSelectTriggerClass, "w-[11.5rem] shrink-0")}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FIELD_KINDS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <label className={cn("flex shrink-0 items-center gap-1.5 text-[11px]", PORTAL_TEXT_MUTED)}>
                            <input
                              type="checkbox"
                              checked={field.kind === "roster" ? false : (field.track_typing ?? field.kind === "long_text")}
                              disabled={disabled || field.kind === "roster" || (field.kind !== "long_text" && field.kind !== "short_text")}
                              onChange={(e) => {
                                const fields = [...(section.config.response_fields ?? [])]
                                fields[fieldIdx] = { ...field, track_typing: e.target.checked }
                                const next = [...sections]
                                next[idx] = { ...section, config: { ...section.config, response_fields: fields } }
                                setSections(next)
                              }}
                            />
                            Replay
                          </label>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-11 w-11 shrink-0 text-[var(--cc-sem-danger)]"
                            aria-label={`Remove ${field.label || "field"}`}
                            onClick={() => {
                              const fields = (section.config.response_fields ?? []).filter((_, i) => i !== fieldIdx)
                              const next = [...sections]
                              next[idx] = { ...section, config: { ...section.config, response_fields: fields } }
                              setSections(next)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Points</Label>
                  <Input
                    type="number"
                    className={projectFormInputClass}
                    value={section.config.points}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = [...sections]
                      next[idx] = {
                        ...section,
                        config: { ...section.config, points: Number(e.target.value) || 0 },
                      }
                      setSections(next)
                    }}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    className={chrome.switchChecked}
                    checked={section.config.required}
                    disabled={disabled}
                    onCheckedChange={(c) => {
                      const next = [...sections]
                      next[idx] = { ...section, config: { ...section.config, required: c } }
                      setSections(next)
                    }}
                  />
                  <Label className="text-sm">Required</Label>
                </div>
              </div>
              <div className="flex gap-1 border-t border-[var(--border)] px-2 py-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const copy = { ...section, section_key: slugifySectionKey(section.title + " copy", sections.length) }
                    setSections([...sections.slice(0, idx + 1), copy, ...sections.slice(idx + 1)])
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-[var(--cc-sem-danger)]"
                  onClick={() => setSections(sections.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            className={chrome.quiet}
            onClick={() => setSections([...sections, newSection(sections.length)])}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add section
          </Button>
        </div>
      ) : (
        <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
          Freeform mode uses summary, deliverables, and attachments without a built-in section workspace.
        </p>
      )}
    </div>
  )
}
