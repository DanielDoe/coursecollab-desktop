"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { INSTRUCTOR_DASHBOARD_V2_BASE } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import { ChevronLeft, ChevronRight, FileSearch, History, Loader2, Mail, Pencil, Printer, RefreshCw, ShieldCheck, Sparkles, Trophy, XCircle } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/app-toast"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import confetti from "canvas-confetti"
import {
  fieldTracksTyping,
  type ProjectFieldTypingFrame,
  type ProjectResponseField,
  type ProjectSectionRevisionContent,
  type ProjectTemplateSectionConfig,
  type SectionContentBlock,
} from "@/lib/projects/project-template-types"
import {
  blockHasContent,
  creditsForBlock,
  inkForMember,
  summarizeContributions,
  type FieldCredit,
  type MemberInk,
} from "@/lib/projects/project-contribution"
import { collectFiguresFromSections, figureHeading, figuresForBlock, type CataloguedFigure } from "@/lib/projects/project-report-figures"
import { ReportFigureGallery } from "@/components/projects/ReportFigureGallery"
import { ProjectEvaluationPanel } from "@/components/projects/ProjectEvaluationPanel"

type WorkspaceSection = {
  id: number
  title: string
  instructions?: string | null
  status?: string
  config?: ProjectTemplateSectionConfig
  current_revision?: {
    content?: ProjectSectionRevisionContent
    created_by_student_id?: number | null
    author_name?: string | null
  } | null
}

type GradeEntry = {
  workspace_section_id: number | null
  score: number
  max_score: number
  feedback?: string | null
}

type Draft = { score: string; feedback: string; ai: boolean }

const chrome = facultyEmbedChrome("projects")
const fp = chrome.p

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function scoreTone(pct: number, graded: boolean) {
  if (!graded) {
    return {
      card: "border-[var(--border)] bg-[var(--card)]",
      pct: PORTAL_TEXT_MUTED,
      bar: "bg-muted-foreground/40",
    }
  }
  if (pct >= 80) {
    return {
      card: "border-emerald-500/30 bg-emerald-500/10",
      pct: "text-emerald-700 dark:text-emerald-300",
      bar: "bg-emerald-500",
    }
  }
  if (pct >= 50) {
    return {
      card: "border-amber-500/30 bg-amber-500/10",
      pct: "text-amber-800 dark:text-amber-200",
      bar: "bg-amber-500",
    }
  }
  return {
    card: "border-rose-500/30 bg-rose-500/10",
    pct: "text-rose-700 dark:text-rose-300",
    bar: "bg-rose-500",
  }
}

function BlockView({ block, figure }: { block: SectionContentBlock; figure?: CataloguedFigure }) {
  switch (block.type) {
    case "text": {
      const html = block.html || ""
      if (!html.trim()) return null
      if (looksLikeHtml(html)) {
        return (
          <div
            className={cn("prose prose-sm max-w-none dark:prose-invert", PORTAL_TEXT)}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      }
      return <p className={cn("whitespace-pre-wrap text-[15px] leading-7", PORTAL_TEXT)}>{html}</p>
    }
    case "link":
      return (
        <a className="break-all text-sm underline" href={block.url} target="_blank" rel="noreferrer">
          {block.label || block.url}
        </a>
      )
    case "image":
    case "figure":
      return (
        <figure className="space-y-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt={block.alt || block.caption || ""}
            className="max-h-96 rounded-lg border border-[var(--border)] object-contain"
          />
          <figcaption className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {figure ? figureHeading(figure) : block.caption || block.alt || "Figure"}
          </figcaption>
        </figure>
      )
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                {block.headers.map((h) => (
                  <th key={h} className="border border-[var(--border)] px-2 py-1 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="border border-[var(--border)] px-2 py-1">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case "code":
      return (
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
          <code>{block.code}</code>
        </pre>
      )
    case "equation":
      return <p className={cn("font-mono text-sm", PORTAL_TEXT)}>{block.latex}</p>
    case "file":
      return (
        <p className={cn("text-sm", PORTAL_TEXT)}>
          Attachment #{block.file_id}
          {block.label ? ` · ${block.label}` : ""}
        </p>
      )
    case "diagram":
      return (
        <div className="space-y-1">
          {block.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.url} alt="" className="max-h-96 rounded-lg border border-[var(--border)] object-contain" />
          ) : null}
          {block.description ? <p className={cn("text-sm", PORTAL_TEXT)}>{block.description}</p> : null}
        </div>
      )
    default:
      return null
  }
}

function TypingReplay({ frames }: { frames?: ProjectFieldTypingFrame[] }) {
  const [text, setText] = useState("")
  const [playing, setPlaying] = useState(false)
  if (!frames?.length) {
    return <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Typing replay is enabled. No keystrokes have been saved yet.</p>
  }
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-3">
      <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Typing replay</p>
      <Button
        size="sm"
        variant="outline"
        className="mt-2"
        disabled={playing}
        onClick={() => {
          setPlaying(true)
          setText("")
          let i = 0
          const step = () => {
            const frame = frames[i]
            if (!frame) {
              setPlaying(false)
              return
            }
            setText(frame.v)
            i += 1
            const wait = Math.min(180, Math.max(40, (frames[i]?.t ?? frame.t) - frame.t))
            window.setTimeout(step, wait)
          }
          step()
        }}
      >
        {playing ? "Playing…" : "Play typing replay"}
      </Button>
      {text ? <p className={cn("mt-2 whitespace-pre-wrap text-sm", PORTAL_TEXT)}>{text}</p> : null}
    </div>
  )
}

function AuthorChip({ name, ink }: { name: string; ink: MemberInk }) {
  return (
    <span className={cn("inline-flex max-w-[14rem] items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", ink.chip)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", ink.dot)} />
      <span className="truncate">{name}</span>
    </span>
  )
}

function ReportAnswers({
  section,
  members,
  figures,
}: {
  section: WorkspaceSection
  members: Array<{ id?: number; full_name?: string }>
  figures: CataloguedFigure[]
}) {
  const fields = (section.config?.response_fields ?? []) as ProjectResponseField[]
  const blocks = section.current_revision?.content?.blocks ?? []
  const meta = section.current_revision?.content?.field_meta ?? {}
  const used = new Set<string>()

  const rows =
    fields.length > 0
      ? fields.map((field) => {
          used.add(field.id)
          return { key: field.id, label: field.label, field, block: blocks.find((b) => b.id === field.id) }
        })
      : blocks.map((block) => ({ key: block.id, label: "", field: undefined as ProjectResponseField | undefined, block }))

  const extra = blocks.filter((b) => !used.has(b.id) && !(b.type === "text" && !String(b.html || "").trim()))

  if (rows.length === 0 && extra.length === 0) {
    return <p className={cn("text-sm italic", PORTAL_TEXT_MUTED)}>This section has no submission yet.</p>
  }

  return (
    <div className="space-y-5">
      {rows.map((row) => {
        const credits = creditsForBlock(section, row.block)
        const owner = credits.find((credit) => credit.last) ?? credits[0]
        const ink = owner ? inkForMember(members, owner.studentId) : null
        return (
          <div key={row.key} className={cn("space-y-1.5", ink && "border-l-2 pl-3", ink?.edge)}>
            {row.label || credits.length ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {row.label ? (
                  <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", PORTAL_TEXT_MUTED)}>{row.label}</p>
                ) : null}
                {credits.map((credit) => (
                  <AuthorChip key={`${credit.studentId ?? credit.name}`} name={credit.name} ink={inkForMember(members, credit.studentId)} />
                ))}
              </div>
            ) : null}
            {row.field?.id === "cover-members" && !(row.block && blockHasContent(row.block)) && members.some((member) => member.full_name) ? (
              <div>
                <p className={cn("text-[15px] leading-7", PORTAL_TEXT)}>
                  {members.map((member) => member.full_name).filter(Boolean).join(", ")}
                </p>
                <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>From the project group</p>
              </div>
            ) : row.block ? (
              <BlockView block={row.block} figure={figuresForBlock(figures, row.block.id)[0]} />
            ) : (
              <p className={cn("text-sm italic", PORTAL_TEXT_MUTED)}>Not answered.</p>
            )}
            {row.field && fieldTracksTyping(row.field) && meta[row.field.id]?.typing?.length ? (
              <TypingReplay frames={meta[row.field.id]?.typing} />
            ) : null}
          </div>
        )
      })}
      {extra.map((block) => {
        const credits = creditsForBlock(section, block)
        const owner = credits.find((credit) => credit.last) ?? credits[0]
        const ink = owner ? inkForMember(members, owner.studentId) : null
        return (
          <div key={block.id} className={cn(ink && "border-l-2 pl-3", ink?.edge)}>
            {credits.length ? (
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {credits.map((credit) => (
                  <AuthorChip key={`${credit.studentId ?? credit.name}`} name={credit.name} ink={inkForMember(members, credit.studentId)} />
                ))}
              </div>
            ) : null}
            <BlockView block={block} figure={figuresForBlock(figures, block.id)[0]} />
          </div>
        )
      })}
    </div>
  )
}

function sectionCredits(section: WorkspaceSection): FieldCredit[] {
  const seen = new Map<string, FieldCredit>()
  for (const block of section.current_revision?.content?.blocks ?? []) {
    if (!blockHasContent(block)) continue
    for (const credit of creditsForBlock(section, block)) {
      const key = String(credit.studentId ?? credit.name)
      const prev = seen.get(key)
      if (!prev || credit.last) seen.set(key, { ...credit, last: Boolean(prev?.last || credit.last) })
    }
  }
  return [...seen.values()]
}

type ProjectNavItem = { id: number; title: string }

export function InstructorProjectGradingWorkspace({
  projectId,
  projectNav,
  onOpenProject,
}: {
  projectId: number
  projectNav?: ProjectNavItem[]
  onOpenProject?: (project: ProjectNavItem) => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sections, setSections] = useState<WorkspaceSection[]>([])
  const [members, setMembers] = useState<Array<{ id?: number; full_name?: string; student_id?: string }>>([])
  const [groupName, setGroupName] = useState("")
  const [groupSession, setGroupSession] = useState("")
  const [audit, setAudit] = useState<Array<{ event_type: string; comment?: string | null; created_at: string }>>([])
  const [integrityCount, setIntegrityCount] = useState(0)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null)
  const [maxPoints, setMaxPoints] = useState(20)
  const [grades, setGrades] = useState<GradeEntry[]>([])
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [savingId, setSavingId] = useState<number | "all" | null>(null)
  const [aiId, setAiId] = useState<number | "bulk" | null>(null)
  const [evalMode, setEvalMode] = useState<"failed" | "stuck" | "all">("failed")
  const [reportTitle, setReportTitle] = useState("Project report")
  const [emailing, setEmailing] = useState(false)
  const [activeSection, setActiveSection] = useState(0)
  const [fetchedNav, setFetchedNav] = useState<ProjectNavItem[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await instructorApiFetch(`/api/instructor/projects/${projectId}/grading-workspace`, {
        headers: buildInstructorApiHeaders(),
      })
      if (!res.ok) {
        setError("Could not load this report.")
        return
      }
      const data = await res.json()
      const secs = (data.workspace?.sections ?? []) as WorkspaceSection[]
      const saved = (data.instructorGrades ?? []) as GradeEntry[]
      setReportTitle(String(data.project?.title || data.workspace?.project?.title || "Project report"))
      setSections(secs)
      setMembers(data.workspace?.members ?? [])
      setGroupName(String(data.project?.group_name || ""))
      setGroupSession(String(data.project?.session || ""))
      setAudit(data.audit ?? [])
      setIntegrityCount(Number(data.integrityCount) || 0)
      setSubmissionStatus(data.workspace?.workspace?.submission_status ?? null)
      setMaxPoints(Number(data.assignment?.max_points) || 20)
      setGrades(saved)
      setDrafts((prev) => {
        const next = { ...prev }
        for (const s of secs) {
          if (next[s.id]?.ai) continue
          const entry = saved.find((g) => g.workspace_section_id === s.id)
          next[s.id] = {
            score: entry != null ? String(entry.score) : next[s.id]?.score ?? "",
            feedback: entry?.feedback ?? next[s.id]?.feedback ?? "",
            ai: false,
          }
        }
        return next
      })
    } catch {
      setError("Could not load this report.")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    setActiveSection(0)
    void load()
  }, [load])

  useEffect(() => {
    if (projectNav) return
    let cancelled = false
    void (async () => {
      const res = await instructorApiFetch("/api/projects/list", { headers: getInstructorScopeHeaders() })
      const data = await res.json().catch(() => ({}))
      if (cancelled || !res.ok) return
      const rows = (data.projects ?? []) as Array<{ id?: number; title?: string }>
      setFetchedNav(
        rows
          .map((row) => ({ id: Number(row.id), title: String(row.title || "Project") }))
          .filter((row) => Number.isFinite(row.id)),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [projectNav])

  const figures = useMemo(
    () =>
      collectFiguresFromSections(
        sections.map((section) => ({
          title: section.title,
          config: section.config,
          blocks: section.current_revision?.content?.blocks ?? [],
        })),
      ),
    [sections],
  )

  const submittedProjects = useMemo(() => {
    const source = projectNav ?? fetchedNav
    if (source.some((item) => item.id === projectId)) return source
    return [...source, { id: projectId, title: reportTitle }]
  }, [projectNav, fetchedNav, projectId, reportTitle])
  const projectIndex = Math.max(0, submittedProjects.findIndex((item) => item.id === projectId))

  const openSubmittedProject = (project: ProjectNavItem | undefined) => {
    if (!project || project.id === projectId) return
    if (onOpenProject) {
      onOpenProject(project)
      return
    }
    router.push(`${INSTRUCTOR_DASHBOARD_V2_BASE}/management/projects/grade/${project.id}`)
  }

  const totals = useMemo(() => {
    let earned = 0
    let possible = 0
    let graded = 0
    for (const section of sections) {
      const max = Number(section.config?.points) || 0
      possible += max
      const entry = grades.find((g) => g.workspace_section_id === section.id)
      if (entry) {
        earned += Number(entry.score) || 0
        graded += 1
      }
    }
    const cap = maxPoints || possible || 20
    const pct = cap > 0 ? Math.round((earned / cap) * 100) : 0
    return { earned, possible: possible || cap, cap, pct, graded }
  }, [sections, grades, maxPoints])

  const confettiFor = useRef("")
  useEffect(() => {
    if (loading || totals.graded === 0 || totals.pct < 70) return
    const key = `${projectId}:${totals.pct}`
    if (confettiFor.current === key) return
    confettiFor.current = key
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
  }, [loading, projectId, totals.graded, totals.pct])

  const donutRadius = 75
  const donutStroke = 12
  const donutCircumference = 2 * Math.PI * donutRadius
  const donutProgressLength = (Math.min(100, totals.pct) / 100) * donutCircumference

  const patchDraft = (id: number, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { score: "", feedback: "", ai: false, ...prev[id], ...patch },
    }))
  }

  const persist = async (section: WorkspaceSection, draft: Draft) => {
    const maxScore = Number(section.config?.points) || 1
    const value = Number(draft.score)
    if (!Number.isFinite(value) || value < 0 || value > maxScore) {
      toast.error("Check the score", { description: `Enter 0–${maxScore} for ${shortTitle(section.title)}` })
      return false
    }
    const res = await instructorApiFetch(`/api/instructor/projects/${projectId}/instructor-grade`, {
      method: "PUT",
      headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSectionId: section.id,
        score: value,
        maxScore,
        feedback: draft.feedback,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error("Could not save grade", { description: data.error || `Section ${section.id}` })
      return false
    }
    setGrades((prev) => {
      const rest = prev.filter((g) => g.workspace_section_id !== section.id)
      return [...rest, { workspace_section_id: section.id, score: value, max_score: maxScore, feedback: draft.feedback }]
    })
    patchDraft(section.id, { ai: false, score: String(value), feedback: draft.feedback })
    return true
  }

  const saveSection = async (section: WorkspaceSection) => {
    const draft = drafts[section.id] ?? { score: "", feedback: "", ai: false }
    setSavingId(section.id)
    try {
      const ok = await persist(section, draft)
      if (ok) toast.success("Grade saved", { description: `${draft.score} / ${section.config?.points ?? ""}` })
    } finally {
      setSavingId(null)
    }
  }

  const gradeWithAi = async (section: WorkspaceSection) => {
    const res = await instructorApiFetch(`/api/instructor/projects/${projectId}/ai-grade`, {
      method: "POST",
      headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSectionId: section.id,
        runKind: "AI_ASSIST",
        forceAssist: true,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || "AI grading failed")
    const suggested = data.grade?.suggested_score
    const feedback = String(data.grade?.feedback || "")
    const draft: Draft = {
      score: suggested == null ? "" : String(suggested),
      feedback,
      ai: true,
    }
    patchDraft(section.id, draft)
    if (draft.score !== "") await persist(section, draft)
  }

  const gradeSectionAi = async (section: WorkspaceSection) => {
    setAiId(section.id)
    try {
      await gradeWithAi(section)
      toast.success("AI grade applied", { description: shortTitle(section.title) })
    } catch (err) {
      toast.error("AI grading failed", { description: err instanceof Error ? err.message : "Try again" })
    } finally {
      setAiId(null)
    }
  }

  const gradeReportAi = async (mode: "failed" | "stuck" | "all") => {
    const targets = sections.filter((section) => {
      const entry = grades.find((g) => g.workspace_section_id === section.id)
      const zero = !entry || Number(entry.score) === 0
      const stuck = section.status === "IN_PROGRESS" && sectionHasWriting(section)
      if (mode === "failed") return zero
      if (mode === "stuck") return stuck
      return true
    })
    if (targets.length === 0) {
      toast.error("Nothing to re-evaluate", { description: "That set of sections is empty." })
      return
    }
    setEvalMode(mode)
    setAiId("bulk")
    let done = 0
    try {
      for (const section of targets) {
        await gradeWithAi(section)
        done += 1
      }
      toast.success("Re-evaluation finished", { description: `${done} section${done === 1 ? "" : "s"} updated.` })
    } catch (err) {
      toast.error("Re-evaluation stopped", {
        description: `${done} saved. ${err instanceof Error ? err.message : "Try the remaining sections."}`,
      })
    } finally {
      setAiId(null)
    }
  }

  const downloadPdf = async () => {
    const feedbackBySection: Record<number, string> = {}
    for (const section of sections) feedbackBySection[section.id] = drafts[section.id]?.feedback ?? ""
    try {
      const { saveProjectReportPdf } = await import("@/lib/projects/project-report-pdf")
      await saveProjectReportPdf({
        title: reportTitle,
        groupName,
        session: groupSession,
        members,
        statusLabel,
        finalized,
        integrityCount,
        totals,
        contributions,
        sections,
        grades,
        feedbackBySection,
      })
      toast.success("Report downloaded")
    } catch (err) {
      toast.error("Could not build the report", { description: err instanceof Error ? err.message : "Try again" })
    }
  }

  const downloadDiagnostic = async () => {
    const res = await instructorApiFetch(`/api/instructor/projects/${projectId}/diagnostic-report`, {
      headers: buildInstructorApiHeaders(),
    })
    if (!res.ok) {
      toast.error("Could not build the diagnostic report")
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${reportTitle.replace(/[^\w]+/g, "-").slice(0, 60) || "project"}-diagnostic.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Diagnostic report downloaded")
  }

  const emailStudents = async () => {
    setEmailing(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/projects/${projectId}/email-grade`, {
        method: "POST",
        headers: buildInstructorApiHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error("Could not email the group", { description: data.error || "Try again" })
        return
      }
      toast.success("Email sent", { description: `${data.sent ?? 0} group member${data.sent === 1 ? "" : "s"}` })
    } finally {
      setEmailing(false)
    }
  }

  const contributions = useMemo(() => summarizeContributions(sections, members), [members, sections])

  const statusLabel = submissionStatus ? String(submissionStatus).replace(/_/g, " ") : "Draft"
  const finalized = submissionStatus === "FINALIZED"

  if (loading) return <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading submitted report…</p>
  if (error) return <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{error}</p>
  if (sections.length === 0) {
    return (
      <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
        No structured report yet. Students fill the template sections in their project workspace.
      </p>
    )
  }

  const hero = scoreTone(totals.pct, totals.graded > 0)
  const busy = savingId != null || aiId != null
  const answered = sections.filter(sectionHasWriting).length
  const failedSections = sections.filter((section) => {
    const entry = grades.find((g) => g.workspace_section_id === section.id)
    return !entry || Number(entry.score) === 0
  })
  const stuckSections = sections.filter(
    (section) => section.status === "IN_PROGRESS" && sectionHasWriting(section),
  )

  const setFinalized = async (on: boolean) => {
    setFinalizing(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/projects/${projectId}/instructor-grade`, {
        method: "PUT",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ finalize: on }),
      })
      if (!res.ok) throw new Error("Could not update finalized status")
      setSubmissionStatus(on ? "FINALIZED" : "SUBMITTED")
      toast.success(on ? "Score finalized" : "Score reopened")
      await load()
    } catch (err) {
      toast.error("Could not update finalized status", { description: err instanceof Error ? err.message : "Try again" })
    } finally {
      setFinalizing(false)
    }
  }

  const recalculate = async () => {
    setRecalculating(true)
    try {
      const res = await instructorApiFetch(`/api/instructor/projects/${projectId}/instructor-grade`, {
        method: "PUT",
        headers: { ...buildInstructorApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ recalculate: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Recalculate failed")
      toast.success("Score recalculated", {
        description: data.score != null ? `${Number(data.score).toFixed(2)} / ${data.max}` : undefined,
      })
      await load()
    } catch (err) {
      toast.error("Could not recalculate", { description: err instanceof Error ? err.message : "Try again" })
    } finally {
      setRecalculating(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto overscroll-contain pr-1">
      <section className="shrink-0 rounded-2xl bg-[var(--card)] px-4 py-6 text-center sm:px-6">
        <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", PORTAL_TEXT_MUTED)}>Project report summary</p>
        <div className="relative mx-auto mt-4 flex h-44 w-44 items-center justify-center sm:h-48 sm:w-48 md:h-52 md:w-52">
          <svg
            className="h-full w-full drop-shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:drop-shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
            viewBox="0 0 200 200"
            fill="none"
            aria-hidden
          >
            <circle
              cx="100"
              cy="100"
              r="62"
              className={
                totals.pct >= 70 && totals.graded > 0
                  ? "fill-[#E9F5EF] dark:fill-emerald-950/35"
                  : "fill-slate-100 dark:fill-slate-800/90"
              }
            />
            <g transform="rotate(-90 100 100)">
              <circle
                cx="100"
                cy="100"
                r={donutRadius}
                fill="none"
                strokeWidth={donutStroke}
                className="stroke-[#F2F2F2] dark:stroke-slate-600"
              />
              {totals.graded > 0 ? (
                <circle
                  cx="100"
                  cy="100"
                  r={donutRadius}
                  fill="none"
                  strokeWidth={donutStroke}
                  strokeDasharray={`${donutProgressLength} ${donutCircumference}`}
                  className={totals.pct >= 70 ? "stroke-[#76BA81] dark:stroke-emerald-400" : "stroke-amber-500 dark:stroke-amber-400"}
                />
              ) : null}
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <p className={cn("text-4xl font-bold tabular-nums tracking-tight sm:text-5xl", hero.pct)}>
              {totals.pct}
              <span className="text-[0.5em]">%</span>
            </p>
          </div>
        </div>
        <p className={cn("mt-2 text-sm tabular-nums", PORTAL_TEXT)}>
          {totals.earned.toFixed(1)} / {totals.cap} pts
        </p>
        <div className="mx-auto mt-4 max-w-3xl space-y-3 text-left">
          <div className={cn("text-center text-sm", PORTAL_TEXT)}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">Group</p>
            <p className="mt-1 font-semibold">{groupName || "Project group"}</p>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {groupSession || "Section"} · {members.map((member) => member.full_name).filter(Boolean).join(", ") || "No members"}
            </p>
          </div>
          {integrityCount > 0 ? (
            <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
              Minor behavioral flags logged for review ({integrityCount})
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--muted)]/40 px-4 py-2">
              <Trophy className={cn("h-4 w-4", fp.iconText)} />
              <span className={cn("text-sm", PORTAL_TEXT_MUTED)}>Score</span>
              <span className={cn("text-sm font-semibold tabular-nums", PORTAL_TEXT)}>
                {totals.earned.toFixed(2)} / {totals.cap}
              </span>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              <span className={cn("text-sm font-medium", PORTAL_TEXT)}>
                {finalized ? "Finalized" : "Provisional — finalize to approve"}
              </span>
              {finalizing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Switch className={chrome.switchChecked} checked={finalized} onCheckedChange={(on) => void setFinalized(on)} aria-label="Finalize group score" />
              )}
            </label>
            <Button variant="outline" className="rounded-full px-6" disabled={recalculating} onClick={() => void recalculate()}>
              {recalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {recalculating ? "Recalculating…" : "Recalculate Score"}
            </Button>
          </div>
          <div className="rounded-xl border border-[var(--border)]">
            <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setHistoryOpen((open) => !open)}>
              <span className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span>
                  <span className={cn("block text-sm font-semibold", PORTAL_TEXT)}>Grade change history</span>
                  <span className={cn("block text-xs", PORTAL_TEXT_MUTED)}>Re-evaluation, instructor adjustments, and recalculations</span>
                </span>
              </span>
              <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>{historyOpen ? "Hide" : `${audit.length}`}</span>
            </button>
            {historyOpen ? (
              <ul className="space-y-2 border-t border-[var(--border)] px-4 py-3">
                {audit.length === 0 ? (
                  <li className={cn("text-sm", PORTAL_TEXT_MUTED)}>No grade changes yet.</li>
                ) : (
                  audit.map((row, index) => (
                    <li key={`${row.created_at}-${index}`} className={cn("text-sm", PORTAL_TEXT)}>
                      <span className="font-medium">{row.event_type.replace(/_/g, " ").toLowerCase()}</span>
                      {row.comment ? <span className={PORTAL_TEXT_MUTED}> · {row.comment}</span> : null}
                      <span className={cn("block text-xs", PORTAL_TEXT_MUTED)}>{new Date(row.created_at).toLocaleString()}</span>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
          <div className="rounded-xl border border-[var(--border)] px-4 py-3">
            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Who wrote what</p>
            <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
              Word share of the current answers. The same colors mark each field below.
            </p>
            <ul className="mt-3 space-y-2.5">
              {contributions.length === 0 ? (
                <li className={cn("text-sm", PORTAL_TEXT_MUTED)}>No group members on this project yet.</li>
              ) : (
                contributions.map((row) => {
                  const ink = inkForMember(members, row.id > 0 ? row.id : undefined)
                  const detail =
                    row.words > 0
                      ? `${row.words} word${row.words === 1 ? "" : "s"} · ${row.sections} section${row.sections === 1 ? "" : "s"}`
                      : row.sections > 0
                        ? `${row.items} field${row.items === 1 ? "" : "s"} · ${row.sections} section${row.sections === 1 ? "" : "s"}`
                        : "No saved writing yet"
                  return (
                    <li key={row.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", ink.dot)} />
                          <span className={cn("truncate", PORTAL_TEXT)}>{row.name}</span>
                        </span>
                        <span className={cn("shrink-0 tabular-nums text-xs", PORTAL_TEXT_MUTED)}>
                          {detail}
                          {row.pct > 0 ? ` · ${row.pct}%` : ""}
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-[var(--muted)]">
                        <div className={cn("h-full rounded-full", ink.bar)} style={{ width: `${row.pct}%` }} />
                      </div>
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        </div>
        <h3 className="mb-4 mt-8 text-center text-sm font-bold uppercase tracking-widest text-[var(--cc-text)]">
          Section breakdown
        </h3>
        <div className="flex gap-3 overflow-x-auto px-0.5 py-1 text-left [scrollbar-width:thin]">
          {sections.map((section, index) => {
            const max = Number(section.config?.points) || 0
            const entry = grades.find((g) => g.workspace_section_id === section.id)
            const earned = entry ? Number(entry.score) : 0
            const graded = Boolean(entry)
            const pct = graded && max > 0 ? Math.round((earned / max) * 100) : 0
            const weight = totals.possible > 0 ? Math.round((max / totals.possible) * 1000) / 10 : 0
            const contribution = graded && max > 0 ? ((earned / max) * weight).toFixed(1) : "0"
            const tone = scoreTone(pct, graded)
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setActiveSection(index)
                  document.getElementById(`report-section-${section.id}`)?.scrollIntoView({ block: "nearest" })
                }}
                className={cn(
                  "w-52 shrink-0 rounded-2xl border p-3 text-left",
                  tone.card,
                  index === activeSection && "border-[var(--cc-accent)] ring-2 ring-inset ring-[var(--cc-accent)]",
                )}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className={cn("line-clamp-1 text-sm font-bold", PORTAL_TEXT)}>{shortTitle(section.title)}</span>
                  <span className={cn("shrink-0 text-[11px] font-semibold", PORTAL_TEXT_MUTED)}>{weight}%</span>
                </div>
                <p className={cn("text-center text-xl font-extrabold tabular-nums", tone.pct)}>
                  {graded ? `${pct}%` : "—"}
                </p>
                <div className={cn("mt-1 flex justify-between text-xs", PORTAL_TEXT_MUTED)}>
                  <span>Points</span>
                  <span className={cn("font-semibold tabular-nums", PORTAL_TEXT)}>
                    {graded ? earned.toFixed(1) : "—"} / {max}
                  </span>
                </div>
                <div className="flex justify-center">
                  <span className={cn("rounded-lg bg-[var(--muted)]/60 px-2.5 py-1 text-xs font-medium", PORTAL_TEXT)}>
                    +{contribution} to total
                  </span>
                </div>
                <span className="sr-only">Section {index + 1}</span>
              </button>
            )
          })}
        </div>
        <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Sections graded", `${totals.graded} / ${sections.length}`],
            ["Sections answered", `${answered} / ${sections.length}`],
            ["Submission", statusLabel],
            ["Members", String(members.length || 1)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-3">
              <p className={cn("text-[10px] font-semibold uppercase tracking-wider", PORTAL_TEXT_MUTED)}>{label}</p>
              <p className={cn("mt-1 truncate text-sm font-bold capitalize", PORTAL_TEXT)}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Sparkles className={cn("h-4 w-4", fp.iconText)} />
          <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Bulk Re-evaluate</p>
        </div>
        <p className={cn("mt-1 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
          AI grades the selected sections from the submitted writing and saves the score. You can edit any score after.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-[var(--muted)]/50 p-3">
            <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>Re-evaluable</p>
            <p className={cn("text-lg font-bold tabular-nums", PORTAL_TEXT)}>{sections.length}</p>
            <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>{answered} with writing</p>
          </div>
          <div className="rounded-lg bg-rose-500/10 p-3">
            <p className="text-[11px] text-rose-700 dark:text-rose-300">Failed/Zero Score</p>
            <p className="text-lg font-bold tabular-nums text-rose-800 dark:text-rose-200">{failedSections.length}</p>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-3">
            <p className="text-[11px] text-amber-800 dark:text-amber-300">Stuck Processing</p>
            <p className="text-lg font-bold tabular-nums text-amber-900 dark:text-amber-200">{stuckSections.length}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              ["failed", failedSections.length, XCircle, `Failed Only (${failedSections.length})`],
              ["stuck", stuckSections.length, RefreshCw, `Stuck Only (${stuckSections.length})`],
              ["all", sections.length, Sparkles, `All sections (${sections.length})`],
            ] as const
          ).map(([mode, count, Icon, label]) => {
            const running = aiId === "bulk" && evalMode === mode
            return (
              <Button
                key={mode}
                size="sm"
                variant={evalMode === mode ? "default" : "outline"}
                className={cn("w-full", evalMode === mode && fp.cta)}
                disabled={busy || count === 0}
                onClick={() => void gradeReportAi(mode)}
              >
                {running ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Icon className="mr-1.5 h-3.5 w-3.5" />}
                {running ? "Evaluating…" : label}
              </Button>
            )
          })}
        </div>
      </section>

      {sections.map((section, index) => {
        const max = Number(section.config?.points) || 1
        const draft = drafts[section.id] ?? { score: "", feedback: "", ai: false }
        const entry = grades.find((g) => g.workspace_section_id === section.id)
        const earned = entry ? Number(entry.score) : null
        const pct = earned != null ? Math.round((earned / max) * 100) : 0
        const tone = scoreTone(pct, earned != null)
        const saving = savingId === section.id
        const grading = aiId === section.id || aiId === "bulk"
        const credits = sectionCredits(section)
        return (
          <article
            key={section.id}
            id={`report-section-${section.id}`}
            className="shrink-0 scroll-mt-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]"
          >
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", PORTAL_TEXT_MUTED)}>
                  Section {index + 1}
                  {draft.ai ? " · AI suggested" : entry ? " · Saved" : ""}
                </p>
                <h3 className={cn("mt-0.5 text-base font-semibold", PORTAL_TEXT)}>{section.title}</h3>
                {credits.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {credits.map((credit) => (
                      <AuthorChip
                        key={`${credit.studentId ?? credit.name}`}
                        name={credit.name}
                        ink={inkForMember(members, credit.studentId)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", tone.card)}>
                <span className={cn("text-lg font-extrabold tabular-nums", tone.pct)}>{earned == null ? "—" : `${pct}%`}</span>
                <span className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                  {earned == null ? `of ${max}` : `${earned.toFixed(1)} / ${max}`}
                </span>
              </div>
            </header>

            <div className="space-y-4 px-4 py-4 sm:px-5">
              {section.instructions ? (
                <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{section.instructions}</p>
              ) : null}
              <ReportAnswers section={section} members={members} figures={figures} />
              <ProjectEvaluationPanel
                feedback={draft.feedback}
                emptyLabel={earned == null ? "Manual review required." : "No graded feedback yet."}
              />
            </div>

            <footer className="space-y-3 border-t border-[var(--border)] px-4 py-4 sm:px-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium", PORTAL_TEXT)}>Re-evaluate</p>
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Grade from the template and answers.</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0" disabled={busy} onClick={() => void gradeSectionAi(section)}>
                    {grading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                    {grading ? "Working…" : "Re-evaluate"}
                  </Button>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5">
                  <p className={cn("shrink-0 text-sm font-medium", PORTAL_TEXT)}>Score</p>
                  <Input
                    type="number"
                    min={0}
                    max={max}
                    step={0.5}
                    value={draft.score}
                    aria-label="Section score"
                    onChange={(e) => patchDraft(section.id, { score: e.target.value, ai: false })}
                    className="h-8 min-w-0 flex-1 bg-[var(--muted)]/40 text-center"
                  />
                  <span className={cn("shrink-0 text-xs tabular-nums", PORTAL_TEXT_MUTED)}>/ {max}</span>
                  <Button size="sm" className={cn("shrink-0", fp.cta)} disabled={busy} onClick={() => void saveSection(section)}>
                    {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Pencil className="mr-1.5 h-3.5 w-3.5" />}
                    {saving ? "Saving…" : "Update"}
                  </Button>
                </div>
              </div>
              <label className={cn("block text-xs font-medium", PORTAL_TEXT)}>
                Graded feedback
                <Textarea
                  rows={4}
                  className="mt-1 bg-[var(--card)] text-sm"
                  placeholder="Feedback the student will see for this section…"
                  value={draft.feedback}
                  onChange={(e) => patchDraft(section.id, { feedback: e.target.value })}
                />
              </label>
            </footer>
          </article>
        )
      })}
      <ReportFigureGallery figures={figures} />

      <div className="flex shrink-0 flex-col items-center gap-3 pt-2">
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            disabled={projectIndex <= 0}
            onClick={() => openSubmittedProject(submittedProjects[projectIndex - 1])}
            aria-label="Previous project"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className={cn("min-w-[4.5rem] text-center text-sm tabular-nums", PORTAL_TEXT)}>
            {projectIndex + 1} / {submittedProjects.length}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            disabled={projectIndex >= submittedProjects.length - 1}
            onClick={() => openSubmittedProject(submittedProjects[projectIndex + 1])}
            aria-label="Next project"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" className="rounded-full px-6" disabled={busy} onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Button className={cn("rounded-full px-6", fp.cta)} disabled={busy} onClick={() => void downloadPdf()}>
          <Printer className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
        <Button variant="outline" className="rounded-full px-6" disabled={busy} onClick={() => void downloadDiagnostic()}>
          <FileSearch className="mr-2 h-4 w-4" />
          Diagnostic Report
        </Button>
        <Button variant="outline" className="rounded-full px-6" disabled={busy || emailing} onClick={() => void emailStudents()}>
          {emailing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
          {emailing ? "Sending…" : "Email Student"}
        </Button>
        </div>
      </div>
    </div>
  )
}

function shortTitle(title: string) {
  return title.replace(/^Section \d+\.\s*/, "").replace(/\s*\(\d+\s+points?\)\s*$/i, "")
}

function sectionHasWriting(section: WorkspaceSection) {
  const blocks = section.current_revision?.content?.blocks ?? []
  return blocks.some((block) => {
    if (block.type === "text") return Boolean(block.html?.replace(/<[^>]+>/g, "").trim())
    return true
  })
}
