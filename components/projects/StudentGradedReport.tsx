"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Download, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import type { ProjectResponseField, SectionContentBlock } from "@/lib/projects/project-template-types"
import { collectFiguresFromSections, figureHeading, figuresForBlock, type CataloguedFigure } from "@/lib/projects/project-report-figures"
import { ReportFigureGallery } from "@/components/projects/ReportFigureGallery"
import { ProjectEvaluationPanel } from "@/components/projects/ProjectEvaluationPanel"

type Grade = { workspace_section_id: number | null; score: number; max_score: number; feedback?: string | null }
type Member = { id?: number; full_name?: string; student_id?: string }
type Section = {
  id: number
  title: string
  instructions?: string | null
  status?: string
  config?: { points?: number; response_fields?: ProjectResponseField[] }
  current_revision?: { content?: { blocks?: SectionContentBlock[] } } | null
}
type Payload = {
  title: string
  groupName: string
  session: string
  members: Member[]
  submissionStatus: string
  maxPoints: number
  showScore: boolean
  showSectionScores: boolean
  showFeedback: boolean
  provisional?: boolean
  sections: Section[]
  grades: Grade[]
}

function scoreTone(pct: number, graded: boolean) {
  if (!graded) return { card: "border-[var(--border)]", pct: PORTAL_TEXT_MUTED }
  if (pct >= 80) return { card: "border-emerald-500/30 bg-emerald-500/10", pct: "text-emerald-700 dark:text-emerald-300" }
  if (pct >= 50) return { card: "border-amber-500/30 bg-amber-500/10", pct: "text-amber-800 dark:text-amber-200" }
  return { card: "border-rose-500/30 bg-rose-500/10", pct: "text-rose-700 dark:text-rose-300" }
}

function shortTitle(title: string) {
  return title.replace(/^Section \d+\.\s*/, "").replace(/\s*\(\d+\s+points?\)\s*$/i, "")
}

function hasWriting(section: Section) {
  return (section.current_revision?.content?.blocks ?? []).some((block) => {
    if (block.type === "text") return Boolean(block.html?.replace(/<[^>]+>/g, "").trim())
    return true
  })
}

function Answer({ block, figure }: { block?: SectionContentBlock; figure?: CataloguedFigure }) {
  if (!block) return <p className={cn("text-sm italic", PORTAL_TEXT_MUTED)}>Not answered.</p>
  if (block.type === "text") {
    const html = block.html || ""
    if (!html.trim()) return <p className={cn("text-sm italic", PORTAL_TEXT_MUTED)}>Not answered.</p>
    if (/<\/?[a-z][\s\S]*>/i.test(html)) {
      return <div className={cn("prose prose-sm max-w-none dark:prose-invert", PORTAL_TEXT)} dangerouslySetInnerHTML={{ __html: html }} />
    }
    return <p className={cn("whitespace-pre-wrap text-[15px] leading-7", PORTAL_TEXT)}>{html}</p>
  }
  if (block.type === "image" || block.type === "figure") {
    return (
      <figure className="space-y-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={block.url} alt={block.alt || block.caption || ""} className="max-h-72 rounded-lg border border-[var(--border)] object-contain" />
        <figcaption className={cn("text-xs", PORTAL_TEXT_MUTED)}>
          {figure ? figureHeading(figure) : block.caption || block.alt || "Figure"}
        </figcaption>
      </figure>
    )
  }
  if (block.type === "link") {
    return (
      <a className="break-all text-sm underline" href={block.url} target="_blank" rel="noreferrer">
        {block.label || block.url}
      </a>
    )
  }
  return <p className={cn("text-sm", PORTAL_TEXT)}>Response saved.</p>
}

function ReportActions({
  projectId,
  persistent,
  downloading,
  onDownload,
  onPreview,
}: {
  projectId: number
  persistent: boolean
  downloading: boolean
  onDownload: () => void
  onPreview?: () => void
}) {
  const router = useRouter()
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {persistent ? null : (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (onPreview) {
              onPreview()
              return
            }
            router.push(`/student/dashboard-v2/projects/grade/${projectId}`)
          }}
        >
          <ExternalLink className="mr-1.5 h-4 w-4" />
          Preview result report
        </Button>
      )}
      <Button type="button" disabled={downloading} onClick={onDownload}>
        <Download className="mr-1.5 h-4 w-4" />
        {downloading ? "Preparing…" : "Download result report"}
      </Button>
    </div>
  )
}

export function StudentGradedReport({
  projectId,
  persistent = false,
  onPreview,
  dockActions = false,
}: {
  projectId: number
  persistent?: boolean
  onPreview?: () => void
  dockActions?: boolean
}) {
  const router = useRouter()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let cancel = false
    const session = JSON.parse(localStorage.getItem("studentSession") || "{}") as { studentId?: string }
    const headers: Record<string, string> = {}
    if (session.studentId) headers["x-student-id"] = String(session.studentId)
    void fetch(`/api/projects/${projectId}/graded-report`, { headers })
      .then(async (res) => {
        if (cancel) return
        if (!res.ok) {
          setError("Could not load this grade.")
          return
        }
        setData((await res.json()) as Payload)
      })
      .catch(() => {
        if (!cancel) setError("Could not load this grade.")
      })
    return () => {
      cancel = true
    }
  }, [projectId])

  const totals = useMemo(() => {
    const sections = data?.sections ?? []
    const grades = data?.grades ?? []
    let earned = 0
    let possible = 0
    let graded = 0
    for (const section of sections) {
      const max = Number(section.config?.points) || 0
      possible += max
      const entry = grades.find((grade) => grade.workspace_section_id === section.id)
      if (entry) {
        earned += Number(entry.score) || 0
        graded += 1
      }
    }
    const cap = data?.maxPoints || possible || 20
    const pct = cap > 0 && graded > 0 ? Math.round((earned / cap) * 100) : 0
    return { earned, possible: possible || cap, cap, pct, graded }
  }, [data])

  const figures = useMemo(
    () =>
      collectFiguresFromSections(
        (data?.sections ?? []).map((section) => ({
          title: section.title,
          config: section.config,
          blocks: section.current_revision?.content?.blocks ?? [],
        })),
      ),
    [data],
  )

  const downloadReport = async () => {
    if (!data) return
    setDownloading(true)
    try {
      const { saveProjectReportPdf } = await import("@/lib/projects/project-report-pdf")
      const { summarizeContributions } = await import("@/lib/projects/project-contribution")
      const grades = data.showScore || data.showSectionScores ? data.grades : []
      const feedbackBySection: Record<number, string> = {}
      if (data.showFeedback) {
        for (const grade of grades) {
          if (grade.workspace_section_id != null && grade.feedback) feedbackBySection[grade.workspace_section_id] = grade.feedback
        }
      }
      await saveProjectReportPdf({
        title: data.title,
        groupName: data.groupName,
        session: data.session,
        members: data.members,
        statusLabel: data.provisional ? "Provisional" : data.submissionStatus ? data.submissionStatus.replace(/_/g, " ") : "Draft",
        finalized: data.submissionStatus === "FINALIZED",
        integrityCount: 0,
        totals,
        contributions: summarizeContributions(data.sections, data.members),
        sections: data.sections,
        grades,
        feedbackBySection,
      })
    } finally {
      setDownloading(false)
    }
  }

  const actions = (
    <ReportActions
      projectId={projectId}
      persistent={persistent}
      downloading={downloading}
      onDownload={() => void downloadReport()}
      onPreview={onPreview}
    />
  )

  if (error) {
    return (
      <div className={dockActions ? "flex h-full min-h-0 flex-col" : undefined}>
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>{error}</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className={dockActions ? "flex h-full min-h-0 flex-col" : undefined}>
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading the graded report…</p>
      </div>
    )
  }

  const radius = 75
  const stroke = 12
  const circumference = 2 * Math.PI * radius
  const progress = (Math.min(100, totals.pct) / 100) * circumference
  const answered = data.sections.filter(hasWriting).length
  const status = data.submissionStatus ? data.submissionStatus.replace(/_/g, " ") : "Draft"
  const hero = scoreTone(totals.pct, totals.graded > 0)

  return (
    <div className={dockActions ? "flex h-full min-h-0 flex-col" : "space-y-4"}>
      <div className={dockActions ? "min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5" : "contents"}>
      <section className="rounded-2xl px-2 py-4 text-center sm:px-4">
        <p className={cn("text-xs font-semibold uppercase tracking-[0.16em]", PORTAL_TEXT_MUTED)}>
          {data.provisional ? "Provisional grade" : "Project report summary"}
        </p>
        {data.provisional ? (
          <p className="mx-auto mt-2 max-w-lg text-sm text-amber-800 dark:text-amber-200">
            AI scored this report. Your instructor still needs to approve the grade before it is final.
          </p>
        ) : null}
        <div className="relative mx-auto mt-4 flex h-40 w-40 items-center justify-center">
          <svg className="h-full w-full" viewBox="0 0 200 200" fill="none" aria-hidden>
            <circle cx="100" cy="100" r="62" className={totals.pct >= 70 && totals.graded > 0 ? "fill-emerald-500/15" : "fill-[color-mix(in_srgb,var(--cc-text)_8%,transparent)]"} />
            <g transform="rotate(-90 100 100)">
              <circle cx="100" cy="100" r={radius} fill="none" strokeWidth={stroke} className="stroke-[color-mix(in_srgb,var(--cc-text)_12%,transparent)]" />
              {data.showScore && totals.graded > 0 ? (
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  strokeWidth={stroke}
                  strokeDasharray={`${progress} ${circumference}`}
                  className={totals.pct >= 70 ? "stroke-emerald-500" : "stroke-amber-500"}
                />
              ) : null}
            </g>
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <p className={cn("text-4xl font-bold tabular-nums", data.showScore ? hero.pct : PORTAL_TEXT_MUTED)}>
              {data.showScore && totals.graded > 0 ? totals.pct : "—"}
              {data.showScore && totals.graded > 0 ? <span className="text-[0.5em]">%</span> : null}
            </p>
          </div>
        </div>
        <p className={cn("mt-2 text-sm tabular-nums", PORTAL_TEXT)}>
          {data.showScore && totals.graded > 0 ? `${totals.earned.toFixed(1)} / ${totals.cap} pts` : "Not graded yet"}
        </p>
        <div className="mt-3 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">Group</p>
          <p className={cn("mt-1 font-semibold", PORTAL_TEXT)}>{data.groupName || "Project group"}</p>
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {data.session || "Section"} · {data.members.map((member) => member.full_name).filter(Boolean).join(", ") || "No members"}
          </p>
        </div>
        <h3 className={cn("mb-3 mt-6 text-sm font-bold uppercase tracking-widest", PORTAL_TEXT)}>Section breakdown</h3>
        <div className="flex gap-3 overflow-x-auto pb-1 text-left [scrollbar-width:thin]">
          {data.sections.map((section, index) => {
            const max = Number(section.config?.points) || 0
            const entry = data.grades.find((grade) => grade.workspace_section_id === section.id)
            const graded = Boolean(entry)
            const earned = entry ? Number(entry.score) : 0
            const pct = graded && max > 0 ? Math.round((earned / max) * 100) : 0
            const tone = scoreTone(pct, graded && data.showSectionScores)
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setActive(index)
                  document.getElementById(`student-grade-section-${section.id}`)?.scrollIntoView({ block: "nearest" })
                }}
                className={cn("w-44 shrink-0 rounded-2xl border p-3 text-left", tone.card, index === active && "ring-2 ring-inset ring-[var(--cc-accent)]")}
              >
                <p className={cn("line-clamp-2 text-sm font-bold", PORTAL_TEXT)}>{shortTitle(section.title)}</p>
                <p className={cn("mt-1 text-center text-xl font-extrabold tabular-nums", data.showSectionScores ? tone.pct : PORTAL_TEXT_MUTED)}>
                  {data.showSectionScores && graded ? `${pct}%` : "—"}
                </p>
                <p className={cn("text-center text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                  {data.showSectionScores && graded ? `${earned.toFixed(1)} / ${max}` : `of ${max}`}
                </p>
              </button>
            )
          })}
        </div>
        <div className="mx-auto mt-4 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Sections graded", `${totals.graded} / ${data.sections.length}`],
            ["Sections answered", `${answered} / ${data.sections.length}`],
            ["Submission", status],
            ["Members", String(data.members.length || 1)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-[var(--border)] px-3 py-3 text-left">
              <p className={cn("text-[10px] font-semibold uppercase tracking-wider", PORTAL_TEXT_MUTED)}>{label}</p>
              <p className={cn("mt-1 truncate text-sm font-bold capitalize", PORTAL_TEXT)}>{value}</p>
            </div>
          ))}
        </div>
      </section>

      {data.sections.map((section, index) => {
        const max = Number(section.config?.points) || 0
        const entry = data.grades.find((grade) => grade.workspace_section_id === section.id)
        const earned = entry ? Number(entry.score) : null
        const pct = earned != null && max > 0 ? Math.round((earned / max) * 100) : 0
        const tone = scoreTone(pct, earned != null && data.showSectionScores)
        const fields = section.config?.response_fields ?? []
        const blocks = section.current_revision?.content?.blocks ?? []
        const rows = fields.length
          ? fields.map((field) => ({ key: field.id, label: field.label, block: blocks.find((block) => block.id === field.id) }))
          : blocks.map((block) => ({ key: block.id, label: "", block }))
        return (
          <article key={section.id} id={`student-grade-section-${section.id}`} className="scroll-mt-3 overflow-hidden rounded-2xl border border-[var(--border)]">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <div className="min-w-0 text-left">
                <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em]", PORTAL_TEXT_MUTED)}>Section {index + 1}</p>
                <h3 className={cn("mt-0.5 text-base font-semibold", PORTAL_TEXT)}>{section.title}</h3>
              </div>
              <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", tone.card)}>
                <span className={cn("text-lg font-extrabold tabular-nums", data.showSectionScores ? tone.pct : PORTAL_TEXT_MUTED)}>
                  {data.showSectionScores && earned != null ? `${pct}%` : "—"}
                </span>
                <span className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                  {data.showSectionScores && earned != null ? `${earned.toFixed(1)} / ${max}` : `of ${max}`}
                </span>
              </div>
            </header>
            <div className="space-y-4 px-4 py-4 text-left">
              {rows.length === 0 ? (
                <p className={cn("text-sm italic", PORTAL_TEXT_MUTED)}>This section has no submission yet.</p>
              ) : (
                rows.map((row) => (
                  <div key={row.key} className="space-y-1.5">
                    {row.label ? <p className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", PORTAL_TEXT_MUTED)}>{row.label}</p> : null}
                    <Answer block={row.block} figure={row.block ? figuresForBlock(figures, row.block.id)[0] : undefined} />
                  </div>
                ))
              )}
              {data.showFeedback ? (
                <ProjectEvaluationPanel feedback={entry?.feedback} emptyLabel={earned == null ? "Not graded yet." : "No graded feedback yet."} />
              ) : null}
            </div>
          </article>
        )
      })}
      <ReportFigureGallery figures={figures} />
      {dockActions ? null : <div className="pt-1">{actions}</div>}
      </div>
      {dockActions ? <div className="shrink-0 border-t border-[var(--border)] px-4 py-3 sm:px-5">{actions}</div> : null}
    </div>
  )
}
