"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { buildStudentScopedSearchParams } from "@/lib/student-session-ids"
import type {
  ProjectSectionContentType,
  ProjectSectionRevisionContent,
  SectionContentBlock,
} from "@/lib/projects/project-template-types"
import {
  Activity,
  BookOpen,
  CheckCircle2,
  Circle,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Paperclip,
  Pencil,
  Download,
  Presentation,
  Send,
} from "lucide-react"
import { ProjectSectionEditor } from "@/components/projects/ProjectSectionEditor"
import { ProjectSectionFieldForm } from "@/components/projects/ProjectSectionFieldForm"
import { ProjectWorkspaceFiles } from "@/components/projects/ProjectWorkspaceFiles"
import { compressUploadImageFile } from "@/lib/media/compress-image-client"
import type { ProjectResponseField } from "@/lib/projects/project-template-types"
import { fieldTracksTyping, type ProjectFieldMeta, type ProjectFieldTypingFrame } from "@/lib/projects/project-template-types"
import { blockHasContent, blockStamp, blockWords, claimFieldMeta, summarizeContributions } from "@/lib/projects/project-contribution"

type WorkspacePayload = {
  project: { id: number; title: string; status: string }
  workspace: { id: number; submission_status: string }
  sections: Array<Record<string, unknown>>
  members: Array<{ id: number; full_name: string; student_id: string }>
  classmates?: Array<{ id: number; full_name: string; student_id?: string }>
  activity: Array<{
    id?: number
    summary: string
    created_at: string
    event_type?: string
    actor_name?: string | null
    actor_instructor_id?: number | null
    section_title?: string | null
    metadata?: { revision_number?: number; section_title?: string; file_name?: string; excerpt?: string } | null
  }>
  references: Array<Record<string, unknown>>
  files: Array<Record<string, unknown>>
  checklist: Array<{ id: string; label: string; ok: boolean }>
  confirmations?: Array<{ student_id: number; confirmed_at?: string }>
  leaderId?: number | null
  viewerId?: number | null
  assignment?: {
    submission_mode?: string
    description?: string | null
    instructions?: string | null
    title?: string
    submission_workflow?: { allow_file_upload?: boolean }
  } | null
}

function sectionStatusLabel(status: string) {
  if (status === "COMPLETE") return "Complete"
  if (status === "IN_PROGRESS") return "In progress"
  if (status === "NEEDS_ATTENTION") return "Needs attention"
  return "Not started"
}

function sectionFieldProgress(section: Record<string, unknown>) {
  const fields = ((section.config as { response_fields?: ProjectResponseField[] })?.response_fields ?? []).filter(
    (field) => field.required !== false,
  )
  const blocks =
    ((section.current_revision as { content?: { blocks?: SectionContentBlock[] } } | null)?.content?.blocks ?? [])
  const filled = fields.filter((field) => blockHasContent(blocks.find((block) => block.id === field.id))).length
  const ratio = fields.length ? filled / fields.length : String(section.status) === "COMPLETE" ? 1 : 0
  return { filled, total: fields.length, ratio }
}

function activityKind(type?: string) {
  switch (type) {
    case "SECTION_COMPLETED":
      return { verb: "marked a section complete", Icon: CheckCircle2 }
    case "SECTION_EDITED":
      return { verb: "saved a draft", Icon: Pencil }
    case "COMMENT_ADDED":
      return { verb: "posted a comment", Icon: MessageSquare }
    case "FILE_UPLOADED":
      return { verb: "uploaded a file", Icon: Paperclip }
    case "FILE_DELETED":
      return { verb: "removed a file", Icon: Paperclip }
    case "REFERENCE_ADDED":
      return { verb: "added a reference", Icon: BookOpen }
    case "SUBMISSION_STATUS_CHANGED":
      return { verb: "updated the submission", Icon: Send }
    default:
      return { verb: "updated the project", Icon: Activity }
  }
}

function activityInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
}

function activityDay(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  if (date.toDateString() === now.toDateString()) return { group: "Today", time }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return { group: "Yesterday", time }
  return {
    group: date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }),
    time,
  }
}

function activityDetail(event: WorkspacePayload["activity"][number], section: string | null) {
  const meta = event.metadata && typeof event.metadata === "object" ? event.metadata : {}
  const bits: string[] = []
  if (typeof meta.revision_number === "number") bits.push(`Revision ${meta.revision_number}`)
  if (meta.file_name) bits.push(String(meta.file_name))
  if (meta.excerpt) bits.push(String(meta.excerpt))
  const summary = String(event.summary || "").trim()
  const generic = /saved section draft|updated section content|comment on section/i.test(summary)
  if (summary && !generic && summary !== section) bits.push(summary)
  return bits.join(" · ")
}


const COMMENT_TOPICS = [
  { id: "discussion", label: "Discussion" },
  { id: "assignment", label: "Assign work" },
  { id: "finished", label: "Finished a section" },
  { id: "general", label: "General" },
] as const

function commentTopicLabel(row: Record<string, unknown>) {
  const topic = String(row.topic || "section")
  const section = row.section_title ? String(row.section_title) : ""
  if (topic === "discussion") return "Discussion"
  if (topic === "assignment") return "Assign work"
  if (topic === "finished") return section ? `Finished · ${section}` : "Finished a section"
  if (topic === "general") return "General"
  return section || "Section"
}

const WORKSPACE_TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "report", label: "Report", icon: FileText },
  { id: "files", label: "Files", icon: Paperclip },
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "presentation", label: "Presentation", icon: Presentation },
  { id: "submission", label: "Submission", icon: Send },
] as const

export function ProjectGroupWorkspace({ projectId }: { projectId: number }) {
  const [data, setData] = useState<WorkspacePayload | null>(null)
  const [tab, setTab] = useState("overview")
  const [activityWho, setActivityWho] = useState("all")
  const [previewOpen, setPreviewOpen] = useState(false)
  const [submitGate, setSubmitGate] = useState<null | { missing: string[]; openItems: string[] }>(null)
  const [previewHtml, setPreviewHtml] = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null)
  const [blocks, setBlocks] = useState<SectionContentBlock[]>([{ id: "main-text", type: "text", html: "" }])
  const [sectionComments, setSectionComments] = useState<Array<Record<string, unknown>>>([])
  const [revisions, setRevisions] = useState<Array<Record<string, unknown>>>([])
  const [comment, setComment] = useState("")
  const [commentTopic, setCommentTopic] = useState("")
  const [finishedSectionId, setFinishedSectionId] = useState<number | null>(null)
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [replyBody, setReplyBody] = useState("")
  const [commentFilter, setCommentFilter] = useState<"all" | "open" | "resolved">("all")
  const [refForm, setRefForm] = useState({ title: "", authors: "", year: "", url: "" })
  const [saving, setSaving] = useState(false)
  const [studentDbId, setStudentDbId] = useState<number | null>(null)
  const [studentName, setStudentName] = useState("")
  const typingRef = useRef<Record<string, ProjectFieldTypingFrame[]>>({})
  const metaRef = useRef<Record<string, ProjectFieldMeta>>({})
  const savedBlocksRef = useRef<SectionContentBlock[]>([])
  const typingOrigin = useRef(0)

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" }
    const session = typeof window !== "undefined" ? localStorage.getItem("studentSession") : null
    if (session) {
      try {
        const s = JSON.parse(session)
        if (s.studentId) h["x-student-id"] = String(s.studentId)
        if (s.databaseId) setStudentDbId(Number(s.databaseId))
        if (s.fullName || s.full_name || s.name) setStudentName(String(s.fullName || s.full_name || s.name))
      } catch {
        /* ignore */
      }
    }
    return h
  }, [])

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/workspace/${projectId}`, { headers })
    if (!res.ok) return
    const json = await res.json()
    setData(json)
    const secs = json.sections as Array<Record<string, unknown>>
    if (secs?.length && activeSectionId == null) {
      setActiveSectionId(Number(secs[0].id))
    }
  }, [projectId, headers, activeSectionId])

  useEffect(() => {
    void load()
  }, [load])

  const activeSection = data?.sections.find((s) => Number(s.id) === activeSectionId)

  useEffect(() => {
    if (!activeSection) return
    const rev = activeSection.current_revision as { content?: ProjectSectionRevisionContent } | null
    const fields = ((activeSection.config as { response_fields?: ProjectResponseField[] })?.response_fields ?? [])
    const loaded = (rev?.content?.blocks ?? []).filter(
      (block) => !(fields.length && block.id === "main-text" && block.type === "text" && !("html" in block && block.html)),
    )
    const meta = (rev?.content as { field_meta?: Record<string, ProjectFieldMeta> } | undefined)?.field_meta ?? {}
    typingOrigin.current = Date.now()
    metaRef.current = meta
    savedBlocksRef.current = loaded
    typingRef.current = Object.fromEntries(
      Object.entries(meta).map(([id, row]) => [id, row.typing ?? []]),
    )
    let next = fields.length ? loaded : loaded.length ? loaded : [{ id: "main-text", type: "text" as const, html: "" }]
    const roster = next.find((block) => block.id === "cover-members")
    const rosterText = roster?.type === "text" ? roster.html.trim() : ""
    const groupNames = (data?.members ?? []).map((member) => member.full_name).filter(Boolean)
    if (fields.some((field) => field.id === "cover-members") && !rosterText && groupNames.length) {
      next = [...next.filter((block) => block.id !== "cover-members"), { id: "cover-members", type: "text", html: groupNames.join("\n") }]
    }
    setBlocks(next)
  }, [activeSection])

  const refreshComments = useCallback(async () => {
    const res = await fetch(`/api/projects/workspace/${projectId}/comments`, { headers })
    if (res.ok) {
      const json = await res.json()
      setSectionComments(json.comments ?? [])
    }
  }, [projectId, headers])

  useEffect(() => {
    if (tab !== "comments") return
    void refreshComments()
  }, [tab, refreshComments])

  useEffect(() => {
    if (!activeSectionId) return
    void (async () => {
      const revRes = await fetch(`/api/projects/workspace/sections/${activeSectionId}/revision`, { headers })
      if (revRes.ok) {
        const revJson = await revRes.json()
        setRevisions(revJson.revisions ?? [])
      }
    })()
  }, [activeSectionId, headers, tab])

  const saveSection = async (markComplete?: boolean) => {
    if (!activeSectionId) return
    setSaving(true)
    try {
      const fields = ((activeSection.config as { response_fields?: ProjectResponseField[] })?.response_fields ?? [])
      const field_meta: Record<string, ProjectFieldMeta> = { ...metaRef.current }
      for (const block of blocks) {
        const prev = savedBlocksRef.current.find((item) => item.id === block.id)
        if (blockStamp(block) === blockStamp(prev)) continue
        if (!blockHasContent(block)) continue
        const field = fields.find((item) => item.id === block.id)
        const frames = typingRef.current[block.id]
        field_meta[block.id] = claimFieldMeta(
          metaRef.current[block.id],
          { id: studentDbId, name: studentName },
          blockWords(block),
          field && fieldTracksTyping(field) ? frames : undefined,
        )
      }
      const content: ProjectSectionRevisionContent = {
        blocks,
        collab: { version: 1, provider: "none" },
        field_meta,
      }
      await fetch(`/api/projects/workspace/sections/${activeSectionId}/revision`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          content,
          changeSummary: markComplete ? "Saved and marked complete" : "Saved section draft",
          markComplete,
        }),
      })
      await load()
    } finally {
      setSaving(false)
    }
  }

  const postComment = async (input?: { body: string; parentCommentId?: number; sectionId?: number | null; topic?: string }) => {
    const textBody = (input?.body ?? comment).trim()
    if (!textBody) return
    const selected = commentTopic || (data?.sections[0] ? `section:${data.sections[0].id}` : "topic:general")
    const topic = input?.topic ?? (selected.startsWith("section:") ? "section" : selected.slice("topic:".length))
    const sectionId = input
      ? input.sectionId ?? null
      : selected.startsWith("section:")
        ? Number(selected.slice("section:".length))
        : topic === "finished"
          ? finishedSectionId ?? (data?.sections[0] ? Number(data.sections[0].id) : null)
          : null
    const res = await fetch(`/api/projects/workspace/${projectId}/comments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: textBody, topic, sectionId, parentCommentId: input?.parentCommentId ?? null }),
    })
    if (!res.ok) return
    if (input?.parentCommentId) {
      setReplyBody("")
      setReplyTo(null)
    } else {
      setComment("")
    }
    await refreshComments()
    await load()
  }

  const addReference = async () => {
    if (!refForm.title.trim()) return
    await fetch(`/api/projects/workspace/${projectId}/references`, {
      method: "POST",
      headers,
      body: JSON.stringify(refForm),
    })
    setRefForm({ title: "", authors: "", year: "", url: "" })
    await load()
  }

  const uploadFile = async (file: File) => {
    setSaving(true)
    const prepared = file.type.startsWith("image/") ? await compressUploadImageFile(file) : file
    const fd = new FormData()
    fd.append("file", prepared)
    if (activeSectionId) fd.append("workspaceSectionId", String(activeSectionId))
    const session = localStorage.getItem("studentSession")
    const h: Record<string, string> = {}
    if (session) {
      const s = JSON.parse(session)
      if (s.studentId) h["x-student-id"] = String(s.studentId)
    }
    await fetch(`/api/projects/workspace/${projectId}/files`, { method: "POST", headers: h, body: fd })
    await load()
    setSaving(false)
  }

  const deleteFile = async (fileId: number) => {
    const session = localStorage.getItem("studentSession")
    const h: Record<string, string> = {}
    if (session) {
      const s = JSON.parse(session)
      if (s.studentId) h["x-student-id"] = String(s.studentId)
    }
    const res = await fetch(`/api/projects/workspace/${projectId}/files/${fileId}`, { method: "DELETE", headers: h })
    if (!res.ok) return
    await load()
  }

  const resolveComment = async (commentId: number) => {
    const res = await fetch(`/api/projects/workspace/${projectId}/comments`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ commentId }),
    })
    if (!res.ok) return
    await refreshComments()
  }

  const confirmSubmit = async (action: "confirm" | "submit") => {
    const res = await fetch(`/api/projects/workspace/${projectId}/submission`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action }),
    })
    const json = (await res.json().catch(() => ({}))) as { error?: string; missing?: string[] }
    await load()
    return { ok: res.ok, error: json.error, missing: json.missing ?? [] }
  }

  if (!data) {
    return <p className={cn("p-4 text-sm", PORTAL_TEXT_MUTED)}>Loading workspace…</p>
  }

  const structured = data.assignment?.submission_mode === "STRUCTURED_REPORT"
  const allowFileUpload = data.assignment?.submission_workflow?.allow_file_upload !== false
  const workspaceTabs = WORKSPACE_TABS.filter((item) => allowFileUpload || item.id !== "files")
  const contributions = summarizeContributions(
    data.sections.map((section) => ({
      id: Number(section.id),
      current_revision: section.current_revision as {
        content?: { blocks?: SectionContentBlock[]; field_meta?: Record<string, ProjectFieldMeta> }
        created_by_student_id?: number | null
        author_name?: string | null
      } | null,
    })),
    data.members,
  )
  const sectionProgress = data.sections.map((section) => ({ section, progress: sectionFieldProgress(section) }))
  const requiredFilled = sectionProgress.reduce((sum, row) => sum + row.progress.filled, 0)
  const requiredTotal = sectionProgress.reduce((sum, row) => sum + row.progress.total, 0)
  const completeCount = data.sections.filter((section) => String(section.status) === "COMPLETE").length
  const readyToSubmit = data.checklist.every((item) => item.ok)
  const confirmedIds = new Set((data.confirmations ?? []).map((row) => Number(row.student_id)))
  const viewerId = data.viewerId ?? studentDbId
  const isLeader = data.leaderId != null && viewerId != null && Number(data.leaderId) === Number(viewerId)
  const missingConfirmations = data.members.filter((member) => !confirmedIds.has(Number(member.id)))
  const allConfirmed = data.members.length > 0 && missingConfirmations.length === 0
  const iConfirmed = viewerId != null && confirmedIds.has(Number(viewerId))
  const openChecklist = data.checklist.filter((item) => !item.ok).map((item) => item.label)
  const canSubmit = isLeader && allConfirmed && readyToSubmit

  const openSubmissionPreview = async () => {
    setPreviewOpen(true)
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/projects/workspace/${projectId}/preview?format=html&view=submission`, { headers })
      setPreviewHtml(res.ok ? await res.text() : "")
    } finally {
      setPreviewLoading(false)
    }
  }

  const downloadSubmissionPdf = async () => {
    const res = await fetch(`/api/projects/workspace/${projectId}/preview?format=pdf&view=submission`, { headers })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${data.project.title.replace(/[^\w.-]+/g, "-").slice(0, 80) || "project-report"}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className={cn("text-xl font-semibold", PORTAL_TEXT)}>{data.project.title}</h1>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Shared group workspace · Status: {data.workspace.submission_status.replace(/_/g, " ")}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/student/dashboard-v2/projects">Back to projects</Link>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-[var(--border)] bg-transparent p-1">
          {workspaceTabs.map((item) => (
            <TabsTrigger
              key={item.id}
              value={item.id}
              className="h-9 flex-none gap-1.5 rounded-lg px-3 text-xs data-[state=active]:border-transparent data-[state=active]:bg-[var(--cc-accent)] data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {data.assignment?.description ? (
            <p className={cn("text-sm leading-relaxed", PORTAL_TEXT)}>{data.assignment.description}</p>
          ) : null}
          {data.assignment?.instructions ? (
            <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{data.assignment.instructions}</p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] p-3">
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Sections complete</p>
              <p className={cn("mt-1 text-2xl font-semibold tabular-nums", PORTAL_TEXT)}>
                {data.sections.filter((section) => String(section.status) === "COMPLETE").length}
                <span className="text-base font-medium text-[var(--cc-text-muted)]"> / {data.sections.length}</span>
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-3">
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Required fields filled</p>
              <p className={cn("mt-1 text-2xl font-semibold tabular-nums", PORTAL_TEXT)}>
                {data.sections.reduce((sum, section) => sum + sectionFieldProgress(section).filled, 0)}
                <span className="text-base font-medium text-[var(--cc-text-muted)]">
                  {" "}/ {data.sections.reduce((sum, section) => sum + sectionFieldProgress(section).total, 0)}
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] p-3">
              <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Group</p>
              <p className={cn("mt-1 text-sm font-medium", PORTAL_TEXT)}>
                {data.members.map((member) => member.full_name).join(", ") || "No members"}
              </p>
            </div>
          </div>
          {structured && data.sections.length ? (
            <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
              {data.sections.map((section) => {
                const progress = sectionFieldProgress(section)
                const status = String(section.status)
                return (
                  <button
                    key={String(section.id)}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40"
                    onClick={() => {
                      setActiveSectionId(Number(section.id))
                      setTab("report")
                    }}
                  >
                    {status === "COMPLETE" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--cc-sem-success,#16a34a)]" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm font-medium", PORTAL_TEXT)}>{String(section.title)}</span>
                      <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                        {sectionStatusLabel(status)}
                        {progress.total ? ` · ${progress.filled}/${progress.total} required` : ""}
                      </span>
                    </span>
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
                      <span className="block h-full bg-[var(--cc-accent)]" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
              This project uses freeform submission. Use the projects page for the legacy fields.
            </p>
          )}
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          {!structured || data.sections.length === 0 ? (
            <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No structured report template linked to this project yet.</p>
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <nav className="max-h-[min(70vh,720px)] space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
                {data.sections.map((s) => {
                  const progress = sectionFieldProgress(s)
                  const status = String(s.status)
                  const selected = Number(s.id) === activeSectionId
                  return (
                    <button
                      key={String(s.id)}
                      type="button"
                      className={cn(
                        "w-full rounded-lg px-2.5 py-2 text-left",
                        selected ? "bg-[var(--cc-accent-soft)]" : "hover:bg-muted/40",
                      )}
                      onClick={() => setActiveSectionId(Number(s.id))}
                    >
                      <span className="flex items-start gap-2">
                        {status === "COMPLETE" ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cc-sem-success,#16a34a)]" />
                        ) : progress.ratio > 0 ? (
                          <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-[var(--cc-accent)] text-[var(--cc-accent)]" />
                        ) : (
                          <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cc-text-muted)]" />
                        )}
                        <span className="min-w-0">
                          <span className={cn("block text-sm font-medium leading-snug", PORTAL_TEXT)}>{String(s.title)}</span>
                          <span className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>
                            {sectionStatusLabel(status)}
                            {progress.total ? ` · ${progress.filled}/${progress.total}` : ""}
                          </span>
                        </span>
                      </span>
                    </button>
                  )
                })}
              </nav>
              <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
                {activeSection ? (
                  <>
                    <h2 className={cn("text-lg font-semibold", PORTAL_TEXT)}>{String(activeSection.title)}</h2>
                    {activeSection.instructions ? (
                      <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{String(activeSection.instructions)}</p>
                    ) : null}
                    {(() => {
                      const cfg = (activeSection.config ?? {}) as {
                        points?: number
                        required?: boolean
                        expected_content?: string
                        allowed_content_types?: ProjectSectionContentType[]
                      }
                      return (
                        <div className="space-y-2 text-sm text-[var(--cc-text-muted)]">
                          {cfg.required === false ? <p>Optional section</p> : <p>Required section</p>}
                          {cfg.points ? <p>Points: {cfg.points}</p> : null}
                          {cfg.expected_content ? <p>Expected: {cfg.expected_content}</p> : null}
                        </div>
                      )
                    })()}
                    {(() => {
                      const fields = ((activeSection.config as { response_fields?: ProjectResponseField[] })?.response_fields ?? [])
                      if (fields.length > 0) {
                        return (
                          <ProjectSectionFieldForm
                            fields={fields}
                            blocks={blocks}
                            blockPaste={Boolean((activeSection.config as { block_paste?: boolean })?.block_paste)}
                            classmates={data?.classmates?.length ? data.classmates : data?.members ?? []}
                            onChange={(next) => {
                              const fields = ((activeSection.config as { response_fields?: ProjectResponseField[] })?.response_fields ?? [])
                              const now = Date.now()
                              if (!typingOrigin.current) typingOrigin.current = now
                              for (const block of next) {
                                if (block.type !== "text") continue
                                const field = fields.find((item) => item.id === block.id)
                                if (!fieldTracksTyping(field)) continue
                                const frames = typingRef.current[block.id] ?? []
                                const last = frames[frames.length - 1]
                                if (last?.v === block.html) continue
                                frames.push({ t: now - typingOrigin.current, v: block.html.slice(0, 8000) })
                                typingRef.current[block.id] = frames.slice(-120)
                              }
                              setBlocks(next)
                            }}
                            onUpload={async (file) => {
                              const prepared = file.type.startsWith("image/") ? await compressUploadImageFile(file) : file
                              const fd = new FormData()
                              fd.append("file", prepared)
                              if (activeSectionId) fd.append("workspaceSectionId", String(activeSectionId))
                              const session = localStorage.getItem("studentSession")
                              const h: Record<string, string> = {}
                              if (session) {
                                const parsed = JSON.parse(session)
                                if (parsed.studentId) h["x-student-id"] = String(parsed.studentId)
                              }
                              const up = await fetch(`/api/projects/workspace/${projectId}/files`, { method: "POST", headers: h, body: fd })
                              if (!up.ok) return null
                              const uploaded = await up.json()
                              const url = uploaded?.file?.storage_url || uploaded?.storage_url
                              return url ? String(url) : null
                            }}
                          />
                        )
                      }
                      const blockPaste = Boolean((activeSection.config as { block_paste?: boolean })?.block_paste)
                      return (
                    <div
                      onPaste={blockPaste ? (event) => event.preventDefault() : undefined}
                      onCopy={blockPaste ? (event) => event.preventDefault() : undefined}
                      onCut={blockPaste ? (event) => event.preventDefault() : undefined}
                      onDrop={blockPaste ? (event) => event.preventDefault() : undefined}
                      onDragOver={blockPaste ? (event) => event.preventDefault() : undefined}
                      onKeyDown={
                        blockPaste
                          ? (event) => {
                              if ((event.metaKey || event.ctrlKey) && ["v", "c", "x"].includes(event.key.toLowerCase())) event.preventDefault()
                            }
                          : undefined
                      }
                    >
                      {blockPaste ? (
                        <p className={cn("mb-2 text-xs", PORTAL_TEXT_MUTED)}>Copy and paste is off for this section. Type the answer.</p>
                      ) : null}
                    <ProjectSectionEditor
                      blocks={blocks}
                      allowedTypes={
                        ((activeSection.config as { allowed_content_types?: ProjectSectionContentType[] })?.allowed_content_types ??
                          ["text", "figure", "table", "code", "equation", "link"]) as ProjectSectionContentType[]
                      }
                      onChange={setBlocks}
                      onAttachFigure={async (file) => {
                        const prepared = file.type.startsWith("image/") ? await compressUploadImageFile(file) : file
                        const fd = new FormData()
                        fd.append("file", prepared)
                        if (activeSectionId) fd.append("workspaceSectionId", String(activeSectionId))
                        const session = localStorage.getItem("studentSession")
                        const h: Record<string, string> = {}
                        if (session) {
                          const parsed = JSON.parse(session)
                          if (parsed.studentId) h["x-student-id"] = String(parsed.studentId)
                        }
                        const up = await fetch(`/api/projects/workspace/${projectId}/files`, { method: "POST", headers: h, body: fd })
                        if (!up.ok) return null
                        await load()
                        const latest = data?.files?.[0] as { storage_url?: string } | undefined
                        return latest?.storage_url ? { url: String(latest.storage_url) } : null
                      }}
                    />
                    </div>
                      )
                    })()}

                    {revisions.length ? (
                      <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1">
                        <p className="font-medium">Recent revisions</p>
                        {revisions.slice(0, 5).map((r) => (
                          <p key={String(r.id)}>
                            v{String(r.revision_number)} — {String(r.author_name || "Member")}: {String(r.change_summary || "edit")}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" disabled={saving} onClick={() => void saveSection(false)}>
                        {saving ? "Saving…" : "Save draft"}
                      </Button>
                      <Button type="button" variant="secondary" disabled={saving} onClick={() => void saveSection(true)}>
                        Mark complete
                      </Button>
                      <Button type="button" variant="outline" asChild>
                        <a href={`/api/projects/workspace/${projectId}/preview?format=html`} target="_blank" rel="noreferrer">
                          Preview full report
                        </a>
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="files" className="mt-4 space-y-4">
          {allowFileUpload ? (
            <ProjectWorkspaceFiles
              files={data.files}
              members={data.members}
              busy={saving}
              onUpload={uploadFile}
              onDelete={deleteFile}
            />
          ) : (
            <div className="mx-auto max-w-md rounded-xl border border-[var(--border)] px-5 py-8 text-center">
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>This project uses the report fields</p>
              <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
                File upload is off. Write each section in Report, including any images the template asks for.
              </p>
              <Button type="button" className="mt-4" onClick={() => setTab("report")}>
                Open report
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="comments" className="mt-4">
          {(() => {
            const selectedTopic = commentTopic || (data.sections[0] ? `section:${data.sections[0].id}` : "topic:general")
            const roots = sectionComments
              .filter((row) => !row.parent_comment_id)
              .filter((row) => {
                if (commentFilter === "open") return !row.resolved_at
                if (commentFilter === "resolved") return Boolean(row.resolved_at)
                return true
              })
              .sort((a, b) => +new Date(String(b.created_at || 0)) - +new Date(String(a.created_at || 0)))
            const repliesFor = (id: number) =>
              sectionComments
                .filter((row) => Number(row.parent_comment_id) === id)
                .sort((a, b) => +new Date(String(a.created_at || 0)) - +new Date(String(b.created_at || 0)))
            return (
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-h-[280px] overflow-hidden rounded-xl border border-[var(--border)]">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                    <div>
                      <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Group thread</p>
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Anyone in the group can reply or mark a thread resolved.</p>
                    </div>
                    <div className="flex gap-1">
                      {(["all", "open", "resolved"] as const).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCommentFilter(key)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs capitalize",
                            commentFilter === key ? "bg-[var(--cc-accent)] text-white" : cn("border border-[var(--border)]", PORTAL_TEXT_MUTED),
                          )}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>
                  {roots.length ? (
                    <ul className="max-h-[560px] divide-y divide-[var(--border)] overflow-y-auto">
                      {roots.map((row) => {
                        const id = Number(row.id)
                        const replies = repliesFor(id)
                        const resolved = Boolean(row.resolved_at)
                        return (
                          <li key={id} className={cn("px-4 py-3", resolved && "opacity-70")}>
                            <div className="flex items-start justify-between gap-3">
                              <span className="rounded-full bg-[color-mix(in_srgb,var(--cc-accent)_16%,transparent)] px-2 py-0.5 text-[11px] font-medium text-[var(--cc-accent)]">
                                {commentTopicLabel(row)}
                              </span>
                              {resolved ? (
                                <span className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>Resolved</span>
                              ) : (
                                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void resolveComment(id)}>
                                  Resolve
                                </Button>
                              )}
                            </div>
                            <p className={cn("mt-2 text-sm", PORTAL_TEXT)}>{String(row.body)}</p>
                            <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
                              {String(row.author_name || "Member")}
                              {row.created_at ? ` · ${new Date(String(row.created_at)).toLocaleString()}` : ""}
                            </p>
                            {replies.length ? (
                              <ul className="mt-3 space-y-2 border-l border-[var(--border)] pl-3">
                                {replies.map((reply) => (
                                  <li key={String(reply.id)}>
                                    <p className={cn("text-sm", PORTAL_TEXT)}>{String(reply.body)}</p>
                                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                                      {String(reply.author_name || "Member")}
                                      {reply.created_at ? ` · ${new Date(String(reply.created_at)).toLocaleString()}` : ""}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                            {!resolved ? (
                              replyTo === id ? (
                                <div className="mt-3 space-y-2">
                                  <Textarea
                                    value={replyBody}
                                    onChange={(event) => setReplyBody(event.target.value)}
                                    placeholder="Reply to this thread…"
                                    className="min-h-[72px]"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button type="button" size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyBody("") }}>
                                      Cancel
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={!replyBody.trim()}
                                      onClick={() =>
                                        void postComment({
                                          body: replyBody,
                                          parentCommentId: id,
                                          topic: String(row.topic || "section"),
                                          sectionId: row.workspace_section_id == null ? null : Number(row.workspace_section_id),
                                        })
                                      }
                                    >
                                      Reply
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-2 flex justify-end">
                                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setReplyTo(id); setReplyBody("") }}>
                                    Reply
                                  </Button>
                                </div>
                              )
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className={cn("px-4 py-8 text-sm", PORTAL_TEXT_MUTED)}>No comments in this view yet.</p>
                  )}
                </div>
                <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
                  <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Post a comment</p>
                  <label className={cn("block text-xs", PORTAL_TEXT_MUTED)} htmlFor="comment-section">
                    Topic
                  </label>
                  <select
                    id="comment-section"
                    className="h-9 w-full rounded-lg border border-[var(--border)] bg-transparent px-2 text-sm text-[var(--cc-text)]"
                    value={selectedTopic}
                    onChange={(event) => setCommentTopic(event.target.value)}
                  >
                    <optgroup label="Sections">
                      {data.sections.map((section) => (
                        <option key={String(section.id)} value={`section:${section.id}`}>
                          {String(section.title)}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Other">
                      {COMMENT_TOPICS.map((topic) => (
                        <option key={topic.id} value={`topic:${topic.id}`}>
                          {topic.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  {selectedTopic === "topic:finished" ? (
                    <select
                      aria-label="Finished section"
                      className="h-9 w-full rounded-lg border border-[var(--border)] bg-transparent px-2 text-sm text-[var(--cc-text)]"
                      value={String(finishedSectionId ?? data.sections[0]?.id ?? "")}
                      onChange={(event) => setFinishedSectionId(Number(event.target.value))}
                    >
                      {data.sections.map((section) => (
                        <option key={String(section.id)} value={String(section.id)}>
                          {String(section.title)}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={
                      selectedTopic === "topic:assignment"
                        ? "Ask a teammate to take a section…"
                        : selectedTopic === "topic:finished"
                          ? "Say what you finished…"
                          : selectedTopic === "topic:discussion"
                            ? "Start a discussion…"
                            : selectedTopic.startsWith("topic:")
                              ? "Write a note for the group…"
                              : "Comment on this section…"
                    }
                    className="min-h-[140px]"
                  />
                  <div className="flex justify-end">
                    <Button type="button" disabled={!comment.trim()} onClick={() => void postComment()}>
                      Post comment
                    </Button>
                  </div>
                </div>
              </div>
            )
          })()}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {(() => {
            const people = [...new Set(data.activity.map((event) => event.actor_name || (event.actor_instructor_id ? "Instructor" : "Member")))]
            const visible = data.activity.filter((event) => {
              if (activityWho === "all") return true
              const name = event.actor_name || (event.actor_instructor_id ? "Instructor" : "Member")
              return name === activityWho
            })
            const groups: Array<{ label: string; items: typeof visible }> = []
            for (const event of visible) {
              const { group } = activityDay(event.created_at)
              const last = groups[groups.length - 1]
              if (last?.label === group) last.items.push(event)
              else groups.push({ label: group, items: [event] })
            }
            return (
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
                  <div>
                    <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Activity</p>
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      {visible.length} event{visible.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {people.length > 1 ? (
                    <div className="flex flex-wrap gap-1">
                      {["all", ...people].map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setActivityWho(name)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs",
                            activityWho === name
                              ? "bg-[var(--cc-accent)] text-white"
                              : cn("border border-[var(--border)]", PORTAL_TEXT_MUTED),
                          )}
                        >
                          {name === "all" ? "Everyone" : name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                {groups.length ? (
                  groups.map((group) => (
                    <div key={group.label}>
                      <p className={cn("bg-[color-mix(in_srgb,var(--cc-text)_4%,transparent)] px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                        {group.label}
                      </p>
                      <ul className="divide-y divide-[var(--border)]">
                        {group.items.map((event, index) => {
                          const name = event.actor_name || (event.actor_instructor_id ? "Instructor" : "Member")
                          const kind = activityKind(event.event_type)
                          const section =
                            event.section_title ||
                            (event.metadata && typeof event.metadata === "object" ? event.metadata.section_title : null) ||
                            null
                          const detail = activityDetail(event, section)
                          const { time } = activityDay(event.created_at)
                          return (
                            <li key={String(event.id ?? index)} className="flex gap-3 px-4 py-3 hover:bg-[color-mix(in_srgb,var(--cc-text)_4%,transparent)]">
                              <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cc-accent)_16%,transparent)] text-xs font-semibold text-[var(--cc-accent)]">
                                {activityInitials(name)}
                                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--cc-accent)] text-white">
                                  <kind.Icon className="h-2.5 w-2.5" />
                                </span>
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-3">
                                  <p className={cn("text-sm", PORTAL_TEXT)}>
                                    <span className="font-medium">{name}</span>{" "}
                                    <span className={PORTAL_TEXT_MUTED}>{kind.verb}</span>
                                  </p>
                                  <time className={cn("shrink-0 text-xs tabular-nums", PORTAL_TEXT_MUTED)} dateTime={event.created_at}>
                                    {time}
                                  </time>
                                </div>
                                {section ? <p className={cn("mt-0.5 truncate text-sm", PORTAL_TEXT)}>{section}</p> : null}
                                {detail ? <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>{detail}</p> : null}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))
                ) : (
                  <p className={cn("px-4 py-8 text-sm", PORTAL_TEXT_MUTED)}>
                    No activity yet. Saves, comments, and uploads show up here.
                  </p>
                )}
              </div>
            )
          })()}
        </TabsContent>

        <TabsContent value="presentation" className="mt-4">
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Use the existing Presentations scheduler to book your slot.</p>
        </TabsContent>

        <TabsContent value="submission" className="mt-4">
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border)] p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Report progress</p>
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      {completeCount} of {data.sections.length} sections complete
                      {requiredTotal ? ` · ${requiredFilled}/${requiredTotal} required fields` : ""}
                    </p>
                  </div>
                  <p className={cn("text-2xl font-semibold tabular-nums", PORTAL_TEXT)}>
                    {data.sections.length ? Math.round((completeCount / data.sections.length) * 100) : 0}
                    <span className="text-sm font-medium text-[var(--cc-text-muted)]">%</span>
                  </p>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--cc-text)_10%,transparent)]">
                  <div
                    className="h-full rounded-full bg-[var(--cc-accent)]"
                    style={{ width: `${data.sections.length ? (completeCount / data.sections.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Sections</p>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {sectionProgress.map(({ section, progress }) => {
                    const status = String(section.status || "")
                    const done = status === "COMPLETE"
                    return (
                      <li key={String(section.id)}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[color-mix(in_srgb,var(--cc-text)_4%,transparent)]"
                          onClick={() => {
                            setActiveSectionId(Number(section.id))
                            setTab("report")
                          }}
                        >
                          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", done ? "bg-[var(--cc-accent)] text-white" : "bg-[color-mix(in_srgb,var(--cc-accent)_16%,transparent)] text-[var(--cc-accent)]")}>
                            {done ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-sm font-medium", PORTAL_TEXT)}>{String(section.title)}</span>
                            <span className={cn("mt-1 flex items-center gap-2 text-xs", PORTAL_TEXT_MUTED)}>
                              <span>{sectionStatusLabel(status)}</span>
                              {progress.total ? <span>{progress.filled}/{progress.total} required</span> : null}
                            </span>
                            {progress.total ? (
                              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--cc-text)_10%,transparent)]">
                                <span className="block h-full rounded-full bg-[var(--cc-accent)]" style={{ width: `${progress.ratio * 100}%` }} />
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Effort</p>
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Share of the saved writing, by the person who last edited each field.</p>
                </div>
                {contributions.length ? (
                  <ul className="divide-y divide-[var(--border)]">
                    {contributions.map((row) => (
                      <li key={row.id} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cc-accent)_16%,transparent)] text-xs font-semibold text-[var(--cc-accent)]">
                            {activityInitials(row.name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>{row.name}</p>
                              <p className={cn("text-sm font-semibold tabular-nums", PORTAL_TEXT)}>{row.pct}%</p>
                            </div>
                            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                              {row.words} word{row.words === 1 ? "" : "s"} · {row.items} field{row.items === 1 ? "" : "s"} · {row.sections} section{row.sections === 1 ? "" : "s"}
                            </p>
                            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--cc-text)_10%,transparent)]">
                              <div className="h-full rounded-full bg-[var(--cc-accent)]" style={{ width: `${row.pct}%` }} />
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={cn("px-4 py-6 text-sm", PORTAL_TEXT_MUTED)}>No saved writing yet.</p>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Before you submit</p>
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{readyToSubmit ? "Checklist is complete." : "Finish the open items, then preview the report."}</p>
                </div>
                <ul className="divide-y divide-[var(--border)]">
                  {data.checklist.map((item) => (
                    <li key={item.id} className="flex items-start gap-2 px-4 py-2.5 text-sm">
                      {item.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cc-accent)]" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" />}
                      <span className={PORTAL_TEXT}>{item.label}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-[var(--border)] px-4 py-3">
                  <p className={cn("mb-2 text-xs", PORTAL_TEXT_MUTED)}>Each member confirms their part</p>
                  <ul className="space-y-1">
                    {data.members.map((member) => {
                      const leader = Number(member.id) === Number(data.leaderId)
                      return (
                        <li key={member.id} className={cn("flex items-center justify-between gap-2 text-sm", PORTAL_TEXT)}>
                          <span className="min-w-0 truncate">
                            {member.full_name}
                            {leader ? <span className={cn("ml-1 text-xs", PORTAL_TEXT_MUTED)}>Leader</span> : null}
                          </span>
                          <span className={cn("shrink-0 text-xs", confirmedIds.has(Number(member.id)) ? "text-[var(--cc-accent)]" : PORTAL_TEXT_MUTED)}>
                            {confirmedIds.has(Number(member.id)) ? "Confirmed" : "Not yet"}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
                <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Submission preview</p>
                <p className={cn("text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
                  The report uses the school seal, the project title, and the answers saved in each field.
                </p>
                <Button type="button" className="w-full" onClick={() => void openSubmissionPreview()}>
                  Preview submission
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => void downloadSubmissionPdf()}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download PDF
                </Button>
                <Button type="button" variant="outline" className="w-full" disabled={iConfirmed} onClick={() => void confirmSubmit("confirm")}>
                  {iConfirmed ? "Part confirmed" : "Confirm my part"}
                </Button>
                {isLeader ? (
                  <>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => setSubmitGate({ missing: missingConfirmations.map((member) => member.full_name), openItems: openChecklist })}
                    >
                      Submit group project
                    </Button>
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      {canSubmit
                        ? "Everyone has confirmed. Submit asks you once more before the report is sent."
                        : missingConfirmations.length
                          ? `Waiting on ${missingConfirmations.map((member) => member.full_name).join(", ")}. Submit lists what is still missing.`
                          : "The checklist is still open. Submit lists what to finish first."}
                    </p>
                  </>
                ) : (
                  <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                    Only the group leader can submit, after every member confirms their part.
                  </p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="grid h-[min(85vh,860px)] max-w-[calc(100%-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b border-[var(--border)] px-5 py-4 pr-12">
            <DialogTitle>{data.project.title}</DialogTitle>
            <DialogDescription>Saved answers only. Empty fields stay blank until someone fills them in.</DialogDescription>
          </DialogHeader>
          {previewLoading ? (
            <p className={cn("px-5 py-8 text-sm", PORTAL_TEXT_MUTED)}>Building the report…</p>
          ) : previewHtml ? (
            <iframe title="Submission preview" className="h-full min-h-0 w-full bg-white" srcDoc={previewHtml} />
          ) : (
            <p className={cn("px-5 py-8 text-sm", PORTAL_TEXT_MUTED)}>The preview could not be built.</p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={submitGate != null} onOpenChange={(open) => { if (!open) setSubmitGate(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {submitGate && submitGate.missing.length === 0 && submitGate.openItems.length === 0
                ? "Clear to submit"
                : "Not ready to submit"}
            </DialogTitle>
            <DialogDescription>
              {submitGate && submitGate.missing.length === 0 && submitGate.openItems.length === 0
                ? "Every group member has confirmed their part. Submit the report now?"
                : "Fix the items below, then come back to submit."}
            </DialogDescription>
          </DialogHeader>
          {submitGate && (submitGate.missing.length > 0 || submitGate.openItems.length > 0) ? (
            <div className="space-y-3 text-sm">
              {submitGate.missing.length ? (
                <div>
                  <p className={cn("font-medium", PORTAL_TEXT)}>Still need a confirmation</p>
                  <ul className={cn("mt-1 list-disc pl-5", PORTAL_TEXT_MUTED)}>
                    {submitGate.missing.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {submitGate.openItems.length ? (
                <div>
                  <p className={cn("font-medium", PORTAL_TEXT)}>Checklist still open</p>
                  <ul className={cn("mt-1 list-disc pl-5", PORTAL_TEXT_MUTED)}>
                    {submitGate.openItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSubmitGate(null)}>
              {submitGate && submitGate.missing.length === 0 && submitGate.openItems.length === 0 ? "Not yet" : "Close"}
            </Button>
            {submitGate && submitGate.missing.length === 0 && submitGate.openItems.length === 0 ? (
              <Button
                type="button"
                onClick={() => {
                  void (async () => {
                    const result = await confirmSubmit("submit")
                    if (!result.ok) {
                      setSubmitGate({ missing: result.missing.length ? result.missing : ["Submission was blocked"], openItems: [] })
                      return
                    }
                    setSubmitGate(null)
                  })()
                }}
              >
                Submit report
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
