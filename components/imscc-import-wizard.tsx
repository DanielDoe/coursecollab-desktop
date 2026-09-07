"use client"

import { useMemo, useRef, useState } from "react"
import {
  Check,
  FileArchive,
  Loader2,
  Upload,
  AlertTriangle,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { parseImsccFromBlob } from "@/lib/imscc/parse"
import type { ImsccCatalog, ImsccCommitCounts, ImsccItem, ImsccReview } from "@/lib/imscc/types"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED, PORTAL_CTA } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type FacultyOption = { instructorId: number; name: string | null; email: string }

type ImportResult = {
  course: {
    id: number
    course_code: string
    course_title: string
    university: string | null
    semester: string | null
    academic_term_id: number | null
    module_settings: unknown
  }
  counts: ImsccCommitCounts
  review: ImsccReview
}

type Props = {
  portal: "faculty" | "institution"
  facultyOptions?: FacultyOption[]
  onImported: (result: ImportResult) => void
  onOpenCourse?: (result: ImportResult) => void
  commit: (payload: {
    catalog: ImsccCatalog
    selectedIds: string[]
    courseCode: string
    courseTitle: string
    instructorId?: number
  }) => Promise<ImportResult>
}

const GROUP_ORDER: { target: ImsccItem["mapping"]["target"]; heading: string }[] = [
  { target: "syllabus", heading: "Syllabus" },
  { target: "lectures", heading: "Lectures / course content" },
  { target: "course_notes", heading: "Pages, notes, announcements" },
  { target: "homework", heading: "Homework / projects" },
  { target: "quizzes", heading: "Quizzes" },
  { target: "mid_semester", heading: "Mid-semester" },
  { target: "final", heading: "Finals" },
  { target: "question_bank", heading: "Question bank" },
  { target: "resource_links", heading: "External links" },
  { target: "course_files", heading: "Files" },
  { target: "attendance", heading: "No direct equivalent" },
  { target: "classroom_points", heading: "No direct equivalent" },
  { target: "none", heading: "Skipped" },
]

function defaultSelected(catalog: ImsccCatalog): Set<string> {
  return new Set(
    catalog.items.filter((i) => i.mapping.selectedDefault && !i.mapping.blocked).map((i) => i.identifier),
  )
}

export function ImsccImportWizard({ portal, facultyOptions, onImported, onOpenCourse, commit }: Props) {
  const chrome = portal === "faculty" ? facultyEmbedChrome("my-courses") : null
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState<"parse" | "commit" | null>(null)
  const [error, setError] = useState("")
  const [catalog, setCatalog] = useState<ImsccCatalog | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [courseCode, setCourseCode] = useState("")
  const [courseTitle, setCourseTitle] = useState("")
  const [instructorId, setInstructorId] = useState<string>(
    facultyOptions?.find((f) => f.instructorId)?.instructorId?.toString() ?? "",
  )
  const [done, setDone] = useState<ImportResult | null>(null)
  const [showIssues, setShowIssues] = useState(false)

  const fieldClass = cn("h-10 rounded-lg border shadow-none", CC_FIELD.base, CC_FIELD.focus)
  const cta = chrome?.cta ?? PORTAL_CTA

  const grouped = useMemo(() => {
    if (!catalog) return []
    return GROUP_ORDER.map((g) => ({
      ...g,
      items: catalog.items.filter((i) => i.mapping.target === g.target && i.kind !== "assignment_group"),
    })).filter((g) => g.items.length > 0)
  }, [catalog])

  const parseFile = async (file: File) => {
    setError("")
    setDone(null)
    setBusy("parse")
    try {
      const parsed = await parseImsccFromBlob(file)
      setCatalog(parsed)
      setSelected(defaultSelected(parsed))
      setCourseCode(parsed.info.suggestedCode)
      setCourseTitle(parsed.info.suggestedTitle)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read this package")
      setCatalog(null)
    } finally {
      setBusy(null)
    }
  }

  const toggle = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleGroup = (items: ImsccItem[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const item of items) {
        if (item.mapping.blocked) continue
        if (on) next.add(item.identifier)
        else next.delete(item.identifier)
      }
      return next
    })
  }

  const onCommit = async () => {
    if (!catalog) return
    setError("")
    setBusy("commit")
    try {
      const result = await commit({
        catalog,
        selectedIds: [...selected],
        courseCode,
        courseTitle,
        instructorId: instructorId ? Number(instructorId) : undefined,
      })
      setDone(result)
      setShowIssues(false)
      onImported(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setBusy(null)
    }
  }

  if (done) {
    const c = done.counts
    const issues = done.review?.issues ?? []
    const checks = done.review?.checks ?? []
    const summary = [
      c.lectures ? `${c.lectures} Lectures` : null,
      c.quizzes ? `${c.quizzes} Quizzes` : null,
      c.homework ? `${c.homework} Homework Assignments` : null,
      c.questions ? `${c.questions} Questions` : null,
      c.files ? `${c.files} Files` : null,
      c.syllabus ? "Syllabus" : null,
      c.notes ? `${c.notes} Course pages` : null,
    ].filter(Boolean) as string[]

    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", chrome?.p.softBg ?? "bg-[var(--cc-accent-soft)]")}>
            <Sparkles className={cn("h-5 w-5", chrome?.p.iconText ?? "text-[var(--cc-accent)]")} />
          </div>
          <div>
            <p className={cn("text-[11px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Course Ready</p>
            <h4 className={cn("text-sm font-semibold", PORTAL_TEXT)}>
              Cora finished setting up {done.course.course_code}.
            </h4>
            <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
              {c.total} items imported as drafts. Nothing is visible to students yet.
            </p>
          </div>
        </div>

        <ul className="space-y-1.5 text-sm">
          {summary.map((line) => (
            <li key={line} className={cn("flex items-center gap-2", PORTAL_TEXT)}>
              <Check className="h-3.5 w-3.5 text-[var(--cc-success)]" />
              {line}
            </li>
          ))}
        </ul>

        {checks.length > 0 ? (
          <div className="space-y-2">
            <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>Cora&apos;s Review</p>
            <ul className="space-y-1.5 text-sm">
              {checks.map((check) => (
                <li key={check.label} className={cn("flex items-start gap-2", PORTAL_TEXT)}>
                  {check.ok ? (
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cc-success)]" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  )}
                  {check.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {issues.length > 0 ? (
          <div id="imscc-import-issues" className="space-y-2">
            <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>
              {issues.length} thing{issues.length === 1 ? "" : "s"} need{issues.length === 1 ? "s" : ""} your attention
            </p>
            <ul className="space-y-1.5 text-sm">
              {issues.map((issue) => (
                <li key={issue.id} className={cn("flex items-start gap-2", PORTAL_TEXT)}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>
                    {issue.title}
                    {showIssues && issue.detail ? (
                      <span className={cn("mt-0.5 block text-xs", PORTAL_TEXT_MUTED)}>{issue.detail}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {issues.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => {
                setShowIssues(true)
                document.getElementById("imscc-import-issues")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
              }}
            >
              Review Issues
            </Button>
          ) : null}
          {onOpenCourse ? (
            <Button type="button" className={cn("rounded-lg", cta)} onClick={() => onOpenCourse(done)}>
              Open Course
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  if (!catalog) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/15 px-3 py-3">
          <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>How to export from Canvas</p>
          <ol className={cn("mt-2 list-decimal space-y-1.5 pl-4 text-xs leading-relaxed", PORTAL_TEXT)}>
            <li>Open the Canvas course you want to bring over.</li>
            <li>Open <span className="font-medium">Settings</span> in the course menu.</li>
            <li>
              On <span className="font-medium">Course Details</span>, use{" "}
              <span className="font-medium">Export Course Content</span> in the right sidebar.
            </li>
            <li>
              Choose <span className="font-medium">Common Cartridge</span>, then create the export. Wait until Canvas finishes — large courses can take several minutes.
            </li>
            <li>
              Download the <span className="font-medium">.imscc</span> file and drop it below. Content imports as drafts; videos are cataloged, not uploaded.
            </li>
          </ol>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".imscc,.zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void parseFile(file)
          }}
        />
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            const file = e.dataTransfer.files[0]
            if (file) void parseFile(file)
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
            drag ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]/40" : "border-[var(--border)] bg-[var(--muted)]/20",
          )}
        >
          {busy === "parse" ? (
            <Loader2 className="mb-2 h-6 w-6 animate-spin text-[var(--cc-accent)]" />
          ) : (
            <FileArchive className="mb-2 h-6 w-6 text-[var(--cc-text-muted)]" />
          )}
          <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
            {busy === "parse" ? "Reading Canvas package…" : "Drop a Canvas export here"}
          </p>
          <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>Canvas Common Cartridge (.imscc). Parsed in your browser — large videos are not uploaded.</p>
          <Button
            type="button"
            className={cn("mt-4 rounded-lg", cta)}
            onClick={(e) => {
              e.stopPropagation()
              inputRef.current?.click()
            }}
            disabled={busy === "parse"}
          >
            <Upload className="mr-2 h-4 w-4" />
            Choose file
          </Button>
        </div>
        {error ? <p className="text-sm text-[var(--cc-danger)]">{error}</p> : null}
      </div>
    )
  }

  if (busy === "commit") {
    return (
      <div className="flex flex-col items-center px-4 py-8 text-center">
        <div className={cn("mb-3 flex size-12 items-center justify-center rounded-2xl", chrome?.p.softBg ?? "bg-[var(--cc-accent-soft)]")}>
          <Sparkles className={cn("h-5 w-5", chrome?.p.iconText ?? "text-[var(--cc-accent)]")} />
        </div>
        <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Cora is setting up {courseCode || "your course"}…</p>
        <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>Importing selected items as drafts and reviewing the package.</p>
        <Loader2 className="mt-4 h-5 w-5 animate-spin text-[var(--cc-accent)]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>Canvas course detected</p>
        <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
          {catalog.info.title}
          {catalog.info.termLabel ? ` · ${catalog.info.termLabel}` : ""}
          {` · ${catalog.info.schema} ${catalog.info.schemaVersion}`}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {catalog.found.map((f) => (
          <span
            key={f.id}
            className="inline-flex items-center rounded-full bg-[var(--cc-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--cc-accent-dark)]"
          >
            {f.label}
            {f.id !== "course" ? ` · ${f.count}` : ""}
          </span>
        ))}
      </div>

      {catalog.warnings.length > 0 ? (
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="space-y-1">
            {catalog.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Course code</Label>
          <Input className={fieldClass} value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Course title</Label>
          <Input className={fieldClass} value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} />
        </div>
        {portal === "institution" && facultyOptions && facultyOptions.length > 0 ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label className={cn("text-xs font-medium", PORTAL_TEXT_MUTED)}>Faculty owner</Label>
            <select
              className={fieldClass}
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
            >
              <option value="">Select faculty…</option>
              {facultyOptions
                .filter((f) => f.instructorId)
                .map((f) => (
                  <option key={f.instructorId} value={f.instructorId}>
                    {f.name || f.email}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="max-h-[22rem] space-y-4 overflow-y-auto pr-1">
        {grouped.map((group) => {
          const enabled = group.items.filter((i) => !i.mapping.blocked)
          const allOn = enabled.length > 0 && enabled.every((i) => selected.has(i.identifier))
          return (
            <div key={group.target}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className={cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                  {group.heading}
                </p>
                {enabled.length > 0 ? (
                  <button
                    type="button"
                    className="text-[11px] font-medium text-[var(--cc-accent)]"
                    onClick={() => toggleGroup(enabled, !allOn)}
                  >
                    {allOn ? "Deselect" : "Select all"}
                  </button>
                ) : null}
              </div>
              <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                {group.items.map((item) => (
                  <li key={item.identifier} className="flex items-start gap-2 px-3 py-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled={item.mapping.blocked}
                      checked={selected.has(item.identifier)}
                      onChange={(e) => toggle(item.identifier, e.target.checked)}
                    />
                    <div className="min-w-0">
                      <p className={cn("truncate text-sm font-medium", PORTAL_TEXT)}>{item.title}</p>
                      <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                        {item.mapping.label}
                        {item.moduleTitle ? ` · ${item.moduleTitle}` : ""}
                        {item.bytes != null ? ` · ${Math.max(1, Math.round(item.bytes / 1024))} KB` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {error ? <p className="text-sm text-[var(--cc-danger)]">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" className={cn("rounded-lg", cta)} onClick={() => void onCommit()} disabled={busy === "commit" || selected.size === 0}>
          {busy === "commit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Import as drafts
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-lg"
          onClick={() => {
            setCatalog(null)
            setSelected(new Set())
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
