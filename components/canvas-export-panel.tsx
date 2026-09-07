"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Download, Loader2, RefreshCw, Search, UserMinus, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  CANVAS_GRADEBOOK_FIXED_HEADERS,
  clipCanvasGradebookMatrixToHeaderWidth,
  downloadCanvasCSV,
  isCanvasGradebookMatrix,
  type CanvasExportMissingScoreDisplay,
} from "@/lib/canvas-gradebook-export"
import type { CanvasExportRosterStudent } from "@/lib/canvas-export-exclusions"
import { buildInstructorAuthorizedApiHeaders } from "@/lib/instructor-api-headers"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
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
import { useToast } from "@/components/ui/use-toast"
import {
  AN_DESC,
  AN_META,
  AN_PANEL,
  AN_PANEL_INNER,
  AN_SPINNER,
  AN_TITLE,
  anCtaClass,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/analytics/analytics-instructor-ui"
import { CC_FIELD } from "@/lib/appearance/ui-primitives"
import { facultyToolbarIconButtonClass } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"

const CANVAS_SELECT = cn("h-9 w-full rounded-lg shadow-none text-sm", CC_FIELD.base, CC_FIELD.focus)
const CANVAS_RADIO_ITEM =
  "border-[var(--border)] bg-[var(--card)] text-[var(--cc-accent)] shadow-none data-[state=checked]:border-[var(--cc-accent)] data-[state=checked]:bg-[var(--cc-accent-soft)]"
const CANVAS_FIELD_LABEL = cn("text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)
const CANVAS_ASSIGNMENT_CELL = "bg-[var(--sidebar-accent)]/20 text-center"
const EXCLUDED_STORAGE_KEY = "cc-canvas-export-excluded-v1"

export type CanvasExportQuizOption = {
  id: number
  title: string
}

export type CanvasExportSessionRef = {
  id: number
  code: string
}

type AssignmentMode = "single" | "multiple" | "entire"

function sanitizeFilenamePart(raw: string): string {
  const t = raw
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return t.slice(0, 72) || "export"
}

export function buildCanvasDownloadFilename(
  mode: AssignmentMode,
  assignmentIds: number[],
  quizzes: CanvasExportQuizOption[],
  sectionFilter: string,
): string {
  const sectionPart =
    sectionFilter.trim().toLowerCase() === "all"
      ? "all-sections"
      : sanitizeFilenamePart(sectionFilter)

  let assignmentPart: string
  if (mode === "entire") {
    assignmentPart = "all-assignments"
  } else {
    const titles = assignmentIds
      .map((id) => quizzes.find((q) => q.id === id)?.title)
      .filter((t): t is string => Boolean(t))
    const sortedTitles = [...titles].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    if (sortedTitles.length === 1) {
      assignmentPart = sanitizeFilenamePart(sortedTitles[0])
    } else if (sortedTitles.length <= 3) {
      assignmentPart = sortedTitles.map(sanitizeFilenamePart).join("-")
    } else {
      assignmentPart = `${sortedTitles.length}-assignments`
    }
  }

  return `${assignmentPart}-${sectionPart}.csv`
}

type ExportParams = { ready: true; assignmentIds: number[] } | { ready: false; assignmentIds: number[] }

function getExportParams(
  mode: AssignmentMode,
  singleId: string,
  multiIds: Set<number>,
): ExportParams {
  if (mode === "entire") return { ready: true, assignmentIds: [] }
  if (mode === "single") {
    const n = Number(singleId)
    if (!singleId || Number.isNaN(n)) return { ready: false, assignmentIds: [] }
    return { ready: true, assignmentIds: [n] }
  }
  const ids = Array.from(multiIds)
  if (ids.length === 0) return { ready: false, assignmentIds: [] }
  return { ready: true, assignmentIds: ids }
}

function readStoredExcluded(sectionKey: string): number[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(EXCLUDED_STORAGE_KEY)
    if (!raw) return []
    const map = JSON.parse(raw) as Record<string, number[]>
    const list = map[sectionKey]
    return Array.isArray(list) ? list.filter((n) => Number.isFinite(n)) : []
  } catch {
    return []
  }
}

function writeStoredExcluded(sectionKey: string, ids: number[]) {
  if (typeof window === "undefined") return
  try {
    const raw = localStorage.getItem(EXCLUDED_STORAGE_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, number[]>) : {}
    map[sectionKey] = ids
    localStorage.setItem(EXCLUDED_STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function CanvasExportPanel({
  quizzes,
  sections,
  sessionCatalog,
  syncSectionFilter,
  refreshKey = 0,
  onRefresh,
  isRefreshing = false,
}: {
  quizzes: CanvasExportQuizOption[]
  sections: string[]
  sessionCatalog?: CanvasExportSessionRef[]
  syncSectionFilter?: string
  refreshKey?: number
  onRefresh?: () => void | Promise<void>
  isRefreshing?: boolean
}) {
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [mode, setMode] = useState<AssignmentMode>("entire")
  const [singleId, setSingleId] = useState<string>("")
  const [multiIds, setMultiIds] = useState<Set<number>>(new Set())
  const [sectionFilter, setSectionFilter] = useState<string>("All")
  const [loading, setLoading] = useState(false)
  const [previewRows, setPreviewRows] = useState<string[][] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [missingGradeCells, setMissingGradeCells] = useState<CanvasExportMissingScoreDisplay>("zero")
  const [confirmBlankDownloadOpen, setConfirmBlankDownloadOpen] = useState(false)
  const [rosterAllowlistCsv, setRosterAllowlistCsv] = useState("")
  const [rosterStudents, setRosterStudents] = useState<CanvasExportRosterStudent[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set())
  const [studentSearch, setStudentSearch] = useState("")
  const [exclusionsInitialized, setExclusionsInitialized] = useState(false)

  const sectionOptions = useMemo(() => {
    const base = ["All", ...sections.filter(Boolean).sort((a, b) => a.localeCompare(b))]
    return Array.from(new Set(base))
  }, [sections])

  useEffect(() => {
    if (syncSectionFilter === undefined) return
    const t = syncSectionFilter.trim()
    if (!t || t.toLowerCase() === "all") {
      setSectionFilter("All")
      return
    }
    if (sectionOptions.includes(t)) setSectionFilter(t)
  }, [syncSectionFilter, sectionOptions])

  const resolvedSessionId = useMemo(() => {
    if (sectionFilter.toLowerCase() === "all") return null
    const hit = sessionCatalog?.find((e) => e.code === sectionFilter)
    return hit != null && Number.isFinite(hit.id) && hit.id > 0 ? hit.id : null
  }, [sectionFilter, sessionCatalog])

  const sortedQuizzes = useMemo(
    () => [...quizzes].sort((a, b) => a.title.localeCompare(b.title)),
    [quizzes],
  )

  const [assignmentOptions, setAssignmentOptions] = useState<CanvasExportQuizOption[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)

  const sortedAssignmentOptions = useMemo(
    () => [...assignmentOptions].sort((a, b) => a.title.localeCompare(b.title)),
    [assignmentOptions],
  )

  const quizzesForFilename = mode === "entire" ? sortedQuizzes : sortedAssignmentOptions

  const previewScopeKey = useMemo(() => {
    if (mode === "entire") {
      return sortedQuizzes.map((q) => q.id).sort((a, b) => a - b).join(",")
    }
    return sortedAssignmentOptions.map((q) => q.id).sort((a, b) => a - b).join(",")
  }, [mode, sortedQuizzes, sortedAssignmentOptions])

  const sectionStorageKey = sectionFilter.trim().toLowerCase() || "all"

  useEffect(() => {
    setExclusionsInitialized(false)
    setExcludedIds(new Set())
  }, [sectionStorageKey, refreshKey])

  useEffect(() => {
    const ac = new AbortController()
    ;(async () => {
      setRosterLoading(true)
      try {
        const headers = buildInstructorAuthorizedApiHeaders()
        const q = new URLSearchParams({ section: sectionFilter })
        const res = await fetch(`/api/export/canvas/roster?${q}`, {
          cache: "no-store",
          headers,
          signal: ac.signal,
        })
        if (!res.ok) throw new Error("Could not load roster")
        const data = (await res.json()) as { students?: CanvasExportRosterStudent[] }
        setRosterStudents(Array.isArray(data.students) ? data.students : [])
      } catch {
        if (!ac.signal.aborted) setRosterStudents([])
      } finally {
        if (!ac.signal.aborted) setRosterLoading(false)
      }
    })()
    return () => ac.abort()
  }, [sectionFilter, refreshKey, courseScopeVersion])

  useEffect(() => {
    if (exclusionsInitialized || rosterStudents.length === 0) return
    const stored = readStoredExcluded(sectionStorageKey)
    const defaults = rosterStudents.filter((s) => s.suggestedExclude).map((s) => s.internalId)
    setExcludedIds(new Set(stored.length > 0 ? stored : defaults))
    setExclusionsInitialized(true)
  }, [rosterStudents, sectionStorageKey, exclusionsInitialized])

  useEffect(() => {
    if (!exclusionsInitialized) return
    writeStoredExcluded(sectionStorageKey, Array.from(excludedIds))
  }, [excludedIds, sectionStorageKey, exclusionsInitialized])

  useEffect(() => {
    if (mode === "entire") {
      setAssignmentOptions([])
      setAssignmentsLoading(false)
      return
    }

    const ac = new AbortController()
    ;(async () => {
      setAssignmentsLoading(true)
      try {
        const headers = buildInstructorAuthorizedApiHeaders()
        const aq = new URLSearchParams({ section: sectionFilter })
        if (resolvedSessionId != null) aq.set("sessionId", String(resolvedSessionId))
        const res = await fetch(`/api/export/canvas/assignments?${aq}`, {
          cache: "no-store",
          headers,
          signal: ac.signal,
        })
        if (!res.ok) throw new Error("Failed to load columns")
        const data = (await res.json()) as { quizzes?: CanvasExportQuizOption[] }
        setAssignmentOptions(Array.isArray(data.quizzes) ? data.quizzes : [])
      } catch {
        if (!ac.signal.aborted) setAssignmentOptions([])
      } finally {
        if (!ac.signal.aborted) setAssignmentsLoading(false)
      }
    })()
    return () => ac.abort()
  }, [mode, sectionFilter, refreshKey, resolvedSessionId, courseScopeVersion])

  useEffect(() => {
    if (mode !== "single" || !singleId) return
    const ok = sortedAssignmentOptions.some((q) => String(q.id) === singleId)
    if (!ok) setSingleId("")
  }, [mode, singleId, sortedAssignmentOptions])

  useEffect(() => {
    if (mode !== "multiple") return
    setMultiIds((prev) => {
      const allowed = new Set(sortedAssignmentOptions.map((q) => q.id))
      const next = new Set([...prev].filter((id) => allowed.has(id)))
      return next.size === prev.size && [...next].every((id) => prev.has(id)) ? prev : next
    })
  }, [mode, sortedAssignmentOptions])

  const exportParams = useMemo(
    () => getExportParams(mode, singleId, multiIds),
    [mode, singleId, multiIds],
  )

  const excludeList = useMemo(() => Array.from(excludedIds), [excludedIds])

  const assignmentIdsKey = useMemo(
    () =>
      exportParams.ready
        ? exportParams.assignmentIds.slice().sort((a, b) => a - b).join(",")
        : "",
    [exportParams],
  )

  const suggestedExcludeCount = useMemo(
    () => rosterStudents.filter((s) => s.suggestedExclude).length,
    [rosterStudents],
  )

  const filteredRosterStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase()
    if (!q) return rosterStudents
    return rosterStudents.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.sisUserId.toLowerCase().includes(q),
    )
  }, [rosterStudents, studentSearch])

  const exportStudentCount = useMemo(() => {
    if (previewRows && previewRows.length > 2) return previewRows.length - 2
    return Math.max(0, rosterStudents.length - excludedIds.size)
  }, [previewRows, rosterStudents.length, excludedIds.size])

  const suggestedFilename = useMemo(
    () =>
      exportParams.ready
        ? buildCanvasDownloadFilename(mode, exportParams.assignmentIds, quizzesForFilename, sectionFilter)
        : "canvas_gradebook.csv",
    [exportParams.ready, exportParams.assignmentIds, mode, quizzesForFilename, sectionFilter],
  )

  const buildExportBody = useCallback(
    (preview: boolean) => ({
      assignmentIds: exportParams.ready ? exportParams.assignmentIds : [],
      sectionFilter,
      ...(resolvedSessionId != null ? { sessionId: resolvedSessionId } : {}),
      missingScoreDisplay: missingGradeCells,
      ...(rosterAllowlistCsv.trim() !== "" ? { rosterAllowlistCsv: rosterAllowlistCsv } : {}),
      ...(excludeList.length > 0 ? { excludeStudentIds: excludeList } : {}),
      preview,
    }),
    [
      exportParams,
      sectionFilter,
      resolvedSessionId,
      missingGradeCells,
      rosterAllowlistCsv,
      excludeList,
    ],
  )

  useEffect(() => {
    if (!exportParams.ready) {
      setPreviewRows(null)
      setPreviewError(null)
      setPreviewLoading(false)
      return
    }

    const ac = new AbortController()
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true)
      setPreviewError(null)
      try {
        const headers = buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })
        const res = await fetch("/api/export/canvas", {
          method: "POST",
          cache: "no-store",
          headers,
          signal: ac.signal,
          body: JSON.stringify(buildExportBody(true)),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error || res.statusText)
        }
        const data = (await res.json()) as { rows?: unknown }
        if (!Array.isArray(data.rows) || !data.rows.every((r) => Array.isArray(r))) {
          throw new Error("Invalid preview response")
        }
        const clipped = clipCanvasGradebookMatrixToHeaderWidth(data.rows as string[][])
        if (!isCanvasGradebookMatrix(clipped)) {
          throw new Error("Preview data is not in Canvas Gradebook format")
        }
        setPreviewRows(clipped)
      } catch (e) {
        if (ac.signal.aborted) return
        setPreviewRows(null)
        setPreviewError(e instanceof Error ? e.message : "Could not load preview")
      } finally {
        if (!ac.signal.aborted) setPreviewLoading(false)
      }
    }, 320)

    return () => {
      ac.abort()
      window.clearTimeout(timer)
    }
  }, [
    exportParams.ready,
    assignmentIdsKey,
    sectionFilter,
    resolvedSessionId,
    refreshKey,
    previewScopeKey,
    mode,
    missingGradeCells,
    rosterAllowlistCsv,
    excludeList.join(","),
    buildExportBody,
    courseScopeVersion,
  ])

  const toggleMulti = (id: number, checked: boolean) => {
    setMultiIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleExcluded = (id: number, exclude: boolean) => {
    setExcludedIds((prev) => {
      const next = new Set(prev)
      if (exclude) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const excludeAllSuggested = () => {
    setExcludedIds(new Set(rosterStudents.filter((s) => s.suggestedExclude).map((s) => s.internalId)))
  }

  const includeAllStudents = () => setExcludedIds(new Set())

  const runDownload = async () => {
    if (!exportParams.ready) {
      if (mode === "single") {
        toast({ title: "Select an assignment", variant: "destructive" })
        return
      }
      if (mode === "multiple") {
        toast({ title: "Select at least one assignment", variant: "destructive" })
        return
      }
      toast({ title: "Export not ready", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const headers = buildInstructorAuthorizedApiHeaders({ "Content-Type": "application/json" })
      const res = await fetch("/api/export/canvas", {
        method: "POST",
        cache: "no-store",
        headers,
        body: JSON.stringify(buildExportBody(false)),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || res.statusText)
      }
      downloadCanvasCSV(await res.text(), suggestedFilename)
      toast({ title: "Download started", description: `${suggestedFilename} is ready for Canvas.` })
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : "Could not generate CSV",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (missingGradeCells === "blank") {
      setConfirmBlankDownloadOpen(true)
      return
    }
    void runDownload()
  }

  if (quizzes.length === 0) return null

  const pickerBusy = (mode === "single" || mode === "multiple") && assignmentsLoading
  const previewHeader = previewRows?.[0] ?? null
  const previewPoints = previewRows && previewRows.length > 1 ? previewRows[1] : null
  const previewDataRows = previewRows && previewRows.length > 2 ? previewRows.slice(2) : []
  const assignmentColumnCount =
    previewHeader && previewHeader.length > CANVAS_GRADEBOOK_FIXED_HEADERS.length
      ? previewHeader.length - CANVAS_GRADEBOOK_FIXED_HEADERS.length
      : 0
  const previewBusy = previewLoading || isRefreshing || pickerBusy

  return (
    <>
      <AlertDialog open={confirmBlankDownloadOpen} onOpenChange={setConfirmBlankDownloadOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave blank for missing grades?</AlertDialogTitle>
            <AlertDialogDescription>
              Blanks mean “no grade” in Canvas, not 0%. Use 0% under Missing grades if you want zeros instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn("rounded-xl", anCtaClass())}
              onClick={() => {
                setConfirmBlankDownloadOpen(false)
                void runDownload()
              }}
            >
              Download with blanks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className={cn(AN_PANEL, "overflow-hidden")}>
        <div className={cn(AN_PANEL_INNER, "space-y-5")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h2 className={AN_TITLE}>Export to Canvas</h2>
              <p className={AN_DESC}>
                Build a Canvas gradebook CSV. Exclude test accounts before your final upload.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {onRefresh ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={facultyToolbarIconButtonClass()}
                  onClick={() => void onRefresh()}
                  disabled={previewBusy}
                  aria-label="Refresh"
                >
                  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                className={cn("rounded-lg gap-1.5 px-4", anCtaClass())}
                onClick={handleDownload}
                disabled={loading || !exportParams.ready}
              >
                {loading ? (
                  <Loader2 className={cn("h-4 w-4 animate-spin", AN_SPINNER)} />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download CSV
              </Button>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(280px,340px)_1fr]">
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--card)]/50 p-4 space-y-3">
                <p className={CANVAS_FIELD_LABEL}>Scope</p>
                <div className="space-y-2">
                  <Label className={cn("text-sm", PORTAL_TEXT)}>Section</Label>
                  <Select value={sectionFilter} onValueChange={setSectionFilter}>
                    <SelectTrigger className={CANVAS_SELECT}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sectionOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className={cn("text-sm", PORTAL_TEXT)}>Export type</Label>
                  <RadioGroup
                    value={mode}
                    onValueChange={(v) => setMode(v as AssignmentMode)}
                    className="flex flex-wrap gap-x-4 gap-y-2"
                  >
                    {(
                      [
                        ["entire", "All assignments"],
                        ["single", "Single"],
                        ["multiple", "Multiple"],
                      ] as const
                    ).map(([value, label]) => (
                      <div key={value} className="flex items-center gap-2">
                        <RadioGroupItem value={value} id={`canvas-${value}`} className={CANVAS_RADIO_ITEM} />
                        <Label
                          htmlFor={`canvas-${value}`}
                          className={cn("cursor-pointer text-sm font-normal", PORTAL_TEXT)}
                        >
                          {label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                {mode !== "entire" ? (
                  <div className="space-y-2">
                    <Label className={cn("text-sm", PORTAL_TEXT)}>
                      Assignment{mode === "multiple" ? "s" : ""}
                    </Label>
                    {mode === "single" ? (
                      <Select value={singleId} onValueChange={setSingleId} disabled={pickerBusy}>
                        <SelectTrigger className={CANVAS_SELECT}>
                          <SelectValue
                            placeholder={
                              pickerBusy
                                ? "Loading…"
                                : sortedAssignmentOptions.length === 0
                                  ? "None for section"
                                  : "Choose assignment"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedAssignmentOptions.map((q) => (
                            <SelectItem key={q.id} value={String(q.id)}>
                              {q.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <ScrollArea className="h-40 rounded-lg border border-[var(--border)]/50 bg-[var(--sidebar-accent)]/10">
                        <div className="space-y-2 p-2.5">
                          {pickerBusy ? (
                            <p className={cn(AN_DESC, "flex items-center gap-2 px-1")}>
                              <Loader2 className={cn("h-4 w-4 animate-spin", AN_SPINNER)} />
                              Loading…
                            </p>
                          ) : sortedAssignmentOptions.length === 0 ? (
                            <p className={cn(AN_DESC, "px-1")}>No assessments for this section.</p>
                          ) : (
                            sortedAssignmentOptions.map((q) => (
                              <div key={q.id} className="flex items-start gap-2">
                                <Checkbox
                                  id={`canvas-q-${q.id}`}
                                  checked={multiIds.has(q.id)}
                                  onCheckedChange={(c) => toggleMulti(q.id, c === true)}
                                  className="mt-0.5"
                                />
                                <Label
                                  htmlFor={`canvas-q-${q.id}`}
                                  className={cn("cursor-pointer text-sm font-normal leading-snug", PORTAL_TEXT)}
                                >
                                  {q.title}
                                </Label>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label className={cn("text-sm", PORTAL_TEXT)}>Missing grades</Label>
                  <Select
                    value={missingGradeCells}
                    onValueChange={(v) => setMissingGradeCells(v as CanvasExportMissingScoreDisplay)}
                  >
                    <SelectTrigger className={CANVAS_SELECT}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zero">Export as 0%</SelectItem>
                      <SelectItem value="blank">Leave blank</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--card)]/50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserMinus className="h-4 w-4 shrink-0 text-[var(--cc-accent)]" />
                    <p className={cn("text-sm font-semibold truncate", PORTAL_TEXT)}>Exclude students</p>
                  </div>
                  <span className={cn("text-xs tabular-nums shrink-0", PORTAL_TEXT_MUTED)}>
                    {excludedIds.size} excluded
                  </span>
                </div>
                <p className={AN_DESC}>
                  Beta testers and instructor dummy rows are excluded by default. Uncheck to include them.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={excludeAllSuggested}
                    disabled={rosterLoading || suggestedExcludeCount === 0}
                  >
                    Exclude test accounts ({suggestedExcludeCount})
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={includeAllStudents}
                    disabled={excludedIds.size === 0}
                  >
                    Include all
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--cc-text-muted)]" />
                  <Input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search name or ID…"
                    className={cn("h-9 pl-8 text-sm rounded-lg shadow-none", CC_FIELD.base, CC_FIELD.focus)}
                  />
                </div>
                <ScrollArea className="h-52 rounded-lg border border-[var(--border)]/50 bg-[var(--sidebar-accent)]/10">
                  <div className="p-2 space-y-1">
                    {rosterLoading ? (
                      <p className={cn(AN_DESC, "flex items-center gap-2 p-2")}>
                        <Loader2 className={cn("h-4 w-4 animate-spin", AN_SPINNER)} />
                        Loading roster…
                      </p>
                    ) : filteredRosterStudents.length === 0 ? (
                      <p className={cn(AN_DESC, "p-2")}>No students in this section.</p>
                    ) : (
                      filteredRosterStudents.map((s) => {
                        const excluded = excludedIds.has(s.internalId)
                        return (
                          <label
                            key={s.internalId}
                            className={cn(
                              "flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-[var(--sidebar-accent)]/20",
                              excluded && "opacity-80",
                            )}
                          >
                            <Checkbox
                              checked={excluded}
                              onCheckedChange={(c) => toggleExcluded(s.internalId, c === true)}
                              className="mt-0.5"
                              aria-label={`Exclude ${s.name}`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className={cn("block text-sm font-medium leading-tight", PORTAL_TEXT)}>
                                {s.name}
                              </span>
                              <span className={cn("block text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                                {s.studentId}
                                {s.excludeReason && excluded ? ` · ${s.excludeReason}` : ""}
                              </span>
                            </span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>

              <details className="rounded-xl border border-[var(--border)]/60 bg-[var(--card)]/30 px-4 py-3">
                <summary className={cn("cursor-pointer text-sm font-medium list-none", PORTAL_TEXT)}>
                  Canvas roster CSV (optional)
                </summary>
                <p className={cn("mt-2 text-xs", AN_DESC)}>
                  Paste a Canvas gradebook export to filter rows and copy Section / SIS columns for import.
                </p>
                <Textarea
                  value={rosterAllowlistCsv}
                  onChange={(e) => setRosterAllowlistCsv(e.target.value)}
                  placeholder="Student, ID, SIS User ID, SIS Login ID, Section…"
                  className={cn("mt-2 min-h-[4.5rem] rounded-lg font-mono text-xs shadow-none", CC_FIELD.base, CC_FIELD.focus)}
                  spellCheck={false}
                />
              </details>
            </div>

            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[var(--cc-accent)]" />
                  <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Preview</h3>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {exportParams.ready && !previewError && previewRows ? (
                    <span className={AN_META}>
                      {exportStudentCount} students · {assignmentColumnCount} grade columns
                    </span>
                  ) : null}
                  {previewBusy ? (
                    <span className={cn("flex items-center gap-1.5 text-xs", PORTAL_TEXT_MUTED)}>
                      <Loader2 className={cn("h-3.5 w-3.5 animate-spin", AN_SPINNER)} />
                      Updating…
                    </span>
                  ) : null}
                </div>
              </div>

              {!exportParams.ready ? (
                <p className={AN_DESC}>
                  {pickerBusy
                    ? "Loading assignments…"
                    : mode === "single"
                      ? sortedAssignmentOptions.length === 0
                        ? "No assessments for this section."
                        : "Choose an assignment."
                      : mode === "multiple"
                        ? sortedAssignmentOptions.length === 0
                          ? "No assessments for this section."
                          : "Select at least one assignment."
                        : "Preview loads automatically."}
                </p>
              ) : null}

              {exportParams.ready && previewError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{previewError}</p>
              ) : null}

              {exportParams.ready && !previewLoading && !previewError && previewHeader ? (
                <div className="overflow-auto max-h-[min(560px,70vh)] w-full rounded-xl border border-[var(--border)]/50 bg-[var(--sidebar-accent)]/10">
                  <table className="w-max min-w-full border-collapse text-[13px] leading-tight">
                    <thead>
                      <tr>
                        {previewHeader.map((cell, i) => (
                          <th
                            key={`h-${i}`}
                            className={cn(
                              "whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold",
                              PORTAL_TEXT,
                              i < CANVAS_GRADEBOOK_FIXED_HEADERS.length ? "bg-[var(--card)]" : CANVAS_ASSIGNMENT_CELL,
                              i === 0 && "sticky left-0 z-20 bg-[var(--card)]",
                            )}
                          >
                            {cell}
                          </th>
                        ))}
                      </tr>
                      {previewPoints ? (
                        <tr>
                          {previewPoints.map((cell, i) => (
                            <th
                              key={`p-${i}`}
                              className={cn(
                                "whitespace-nowrap px-3 py-2 text-[11px] font-medium tabular-nums",
                                PORTAL_TEXT_MUTED,
                                i >= CANVAS_GRADEBOOK_FIXED_HEADERS.length && CANVAS_ASSIGNMENT_CELL,
                                i === 0 && "sticky left-0 z-20 bg-[var(--card)] text-left",
                              )}
                            >
                              {cell}
                            </th>
                          ))}
                        </tr>
                      ) : null}
                    </thead>
                    <tbody>
                      {previewDataRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={previewHeader.length}
                            className={cn("px-4 py-12 text-center text-sm", PORTAL_TEXT_MUTED)}
                          >
                            No students in export (check exclusions or section).
                          </td>
                        </tr>
                      ) : (
                        previewDataRows.map((row, ri) => (
                          <tr
                            key={`r-${ri}`}
                            className={cn(
                              "group transition-colors hover:bg-[var(--sidebar-accent)]/25",
                              ri % 2 === 1 && "bg-[var(--sidebar-accent)]/10",
                            )}
                          >
                            {row.map((cell, ci) => (
                              <td
                                key={`c-${ri}-${ci}`}
                                className={cn(
                                  "whitespace-nowrap px-3 py-2 align-middle",
                                  ci < CANVAS_GRADEBOOK_FIXED_HEADERS.length
                                    ? cn("text-left", PORTAL_TEXT)
                                    : cn("text-center tabular-nums text-sm", PORTAL_TEXT),
                                  ci === 0 &&
                                    cn(
                                      "sticky left-0 z-10 font-medium bg-[var(--card)] group-hover:bg-[var(--sidebar-accent)]/20",
                                      ri % 2 === 1 && "bg-[var(--sidebar-accent)]/10",
                                    ),
                                )}
                              >
                                {cell === "" && ci >= CANVAS_GRADEBOOK_FIXED_HEADERS.length ? (
                                  <span className="text-[var(--cc-text-muted)]/40">—</span>
                                ) : (
                                  cell
                                )}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {exportParams.ready ? (
                <p className={AN_META}>
                  File: <span className={cn("font-mono text-xs", PORTAL_TEXT)}>{suggestedFilename}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
