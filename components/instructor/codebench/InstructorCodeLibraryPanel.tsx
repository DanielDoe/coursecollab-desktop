"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Award,
  BookOpen,
  ChevronRight,
  Code2,
  FolderOpen,
  Loader2,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  INSTRUCTOR_LIBRARY_CATEGORIES,
  INSTRUCTOR_LIBRARY_CATEGORY_LABELS,
  deleteLibraryItem,
  loadInstructorLibrary,
  type InstructorLibraryCategory,
  type InstructorLibraryItem,
} from "@/lib/codebench-instructor-library"
import {
  classroomAssignmentToHandoff,
  classroomAssignmentTopic,
  extractClassroomQuestionText,
  groupClassroomAssignmentsBySession,
  type ClassroomAssignmentRow,
  type InstructorClassroomHandoff,
} from "@/lib/codebench-instructor-classroom"
import { useInstructorClassroomAssignments } from "@/hooks/use-instructor-classroom-assignments"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { defaultFacultySessionFilter } from "@/hooks/use-instructor-scope-key"
import {
  CLASSROOM_SUBMISSION_KIND_CODE,
  CLASSROOM_SUBMISSION_KIND_SOLUTION,
} from "@/lib/classroom-solution-submission"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { InstructorClassroomAssignmentActions } from "@/components/instructor/InstructorClassroomAssignmentActions"
import { InstructorTeachingLibraryItemDialog } from "@/components/instructor/codebench/InstructorTeachingLibraryItemDialog"
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
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const CLASSROOM_POINTS_HREF = "/faculty/dashboard/assessments/classroom-points"

type LibrarySource = "classroom" | "teaching"

type Props = {
  onOpenInIde: (item: InstructorLibraryItem) => void
  onOpenClassroomInIde: (handoff: InstructorClassroomHandoff) => void
}

function questionPreview(text: string, max = 160) {
  const plain = text.replace(/\s+/g, " ").trim()
  if (plain.length <= max) return plain
  return `${plain.slice(0, max).trim()}…`
}

function ClassroomAssignmentCard({
  row,
  onOpen,
  sessions,
  onMutated,
}: {
  row: ClassroomAssignmentRow
  onOpen: (handoff: InstructorClassroomHandoff) => void
  sessions: string[]
  onMutated: () => void
}) {
  const chrome = facultyEmbedChrome("codebench")
  const handoff = classroomAssignmentToHandoff(row)
  const isCode = handoff.submissionKind === CLASSROOM_SUBMISSION_KIND_CODE
  const preview = questionPreview(extractClassroomQuestionText(row))

  return (
    <article className={cn(chrome.card, "instructor-lift-card flex flex-col gap-3 p-4")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className={cn("text-sm font-semibold leading-snug", PORTAL_TEXT)}>{row.title}</p>
          <p className={cn("line-clamp-3 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>{preview}</p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            isCode
              ? "bg-[color-mix(in_srgb,var(--cc-accent)_12%,var(--card))] text-[var(--cc-accent)]"
              : "bg-[color-mix(in_srgb,var(--cc-warning)_14%,var(--card))] text-[var(--cc-warning,#d97706)]",
          )}
        >
          {isCode ? <Code2 className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-[10px]">
          {isCode ? "Coding" : "Solution"}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {classroomAssignmentTopic(row)}
        </Badge>
        {row.session ? (
          <Badge variant="outline" className="text-[10px]">
            {row.session}
          </Badge>
        ) : null}
        <Badge
          variant="outline"
          className={cn(
            "text-[10px]",
            row.is_active ? "border-emerald-500/35 text-emerald-700 dark:text-emerald-300" : "",
          )}
        >
          {row.is_active ? "Active" : "Closed"}
        </Badge>
        {handoff.pointsHint != null ? (
          <Badge variant="outline" className="text-[10px]">
            {handoff.pointsHint} pts
          </Badge>
        ) : null}
      </div>

      <div className="mt-auto flex w-full flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => onOpen(handoff)}>
          <FolderOpen className="mr-1 h-3.5 w-3.5" />
          {isCode ? "Teach in IDE" : "Open prompt in IDE"}
        </Button>
        <InstructorClassroomAssignmentActions
          submission={row}
          sessions={sessions}
          onMutated={onMutated}
          className="ml-auto"
        />
      </div>
    </article>
  )
}

export function InstructorCodeLibraryPanel({ onOpenInIde, onOpenClassroomInIde }: Props) {
  const chrome = facultyEmbedChrome("codebench")
  const { toast } = useToast()
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [source, setSource] = useState<LibrarySource>("classroom")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<InstructorLibraryCategory | "all">("all")
  const [kindFilter, setKindFilter] = useState<"all" | "code" | "solution">("all")
  const [sessionFilter, setSessionFilter] = useState<string>(defaultFacultySessionFilter)
  const [libraryRevision, setLibraryRevision] = useState(0)
  const [editDialogSessions, setEditDialogSessions] = useState<string[]>(["all"])
  const [teachingDialogOpen, setTeachingDialogOpen] = useState(false)
  const [teachingEditItem, setTeachingEditItem] = useState<InstructorLibraryItem | null>(null)
  const [deleteTeachingItem, setDeleteTeachingItem] = useState<InstructorLibraryItem | null>(null)
  const [deletingTeaching, setDeletingTeaching] = useState(false)
  const items = useMemo(() => loadInstructorLibrary().items, [libraryRevision])
  const { submissions, loading, error, reload } = useInstructorClassroomAssignments(sessionFilter)

  const refreshLibrary = useCallback(() => {
    setLibraryRevision((value) => value + 1)
  }, [])

  const handleClassroomMutated = useCallback(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    void (async () => {
      try {
        const response = await instructorApiFetch("/api/instructor/sessions", {
          headers: buildInstructorAuthorizedApiHeaders(),
        })
        if (!response.ok) return
        const data = (await response.json()) as { sessions?: Array<{ code?: string }> }
        const codes = [
          ...new Set((data.sessions?.map((entry) => entry.code).filter(Boolean) as string[]) ?? []),
        ]
        setEditDialogSessions(["all", ...codes])
      } catch {
        setEditDialogSessions(["all"])
      }
    })()
  }, [courseScopeVersion])

  useEffect(() => {
    setSessionFilter(defaultFacultySessionFilter())
  }, [courseScopeVersion])

  const filterSessionOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of submissions) {
      if (row.session?.trim()) set.add(row.session.trim())
    }
    return Array.from(set).sort()
  }, [submissions])

  const filteredClassroom = useMemo(() => {
    const q = query.trim().toLowerCase()
    return submissions.filter((row) => {
      const kind = String(row.submission_kind ?? CLASSROOM_SUBMISSION_KIND_CODE).toLowerCase()
      if (kindFilter === "code" && kind !== CLASSROOM_SUBMISSION_KIND_CODE) return false
      if (kindFilter === "solution" && kind !== CLASSROOM_SUBMISSION_KIND_SOLUTION) return false
      if (!q) return true
      const question = extractClassroomQuestionText(row).toLowerCase()
      return (
        row.title.toLowerCase().includes(q) ||
        question.includes(q) ||
        (row.session ?? "").toLowerCase().includes(q)
      )
    })
  }, [kindFilter, query, submissions])

  const classroomGrouped = useMemo(
    () => groupClassroomAssignmentsBySession(filteredClassroom),
    [filteredClassroom],
  )

  const filteredTeaching = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false
      if (!q) return true
      return (
        item.title.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    })
  }, [category, items, query])

  const teachingGrouped = useMemo(() => {
    const map = new Map<string, InstructorLibraryItem[]>()
    for (const item of filteredTeaching) {
      const key = item.topic || "General"
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredTeaching])

  const confirmDeleteTeachingItem = useCallback(async () => {
    if (!deleteTeachingItem) return
    setDeletingTeaching(true)
    try {
      const removed = deleteLibraryItem(deleteTeachingItem.id)
      if (!removed) throw new Error("Snippet not found")
      toast({ title: "Snippet removed", description: `"${deleteTeachingItem.title}" was deleted from this device.` })
      setDeleteTeachingItem(null)
      refreshLibrary()
    } catch (err) {
      toast({
        title: "Could not delete snippet",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      })
    } finally {
      setDeletingTeaching(false)
    }
  }, [deleteTeachingItem, refreshLibrary, toast])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <div className={cn(chrome.card, "min-w-0 space-y-3 p-4 sm:p-5")}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--cc-accent)]" />
            <h2 className={cn("text-base font-semibold", PORTAL_TEXT)}>Code Library</h2>
          </div>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Classroom Points assignments and teaching snippets — pick a question and teach live in the IDE.
          </p>
        </div>

        <div className="min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
          <div className="flex w-max min-w-full flex-nowrap items-center gap-2">
            <div
              className="inline-flex shrink-0 rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_35%,var(--card))] p-0.5"
              role="tablist"
              aria-label="Library source"
            >
              <Button
                type="button"
                size="sm"
                variant={source === "classroom" ? "default" : "ghost"}
                className={cn(
                  "h-8 shrink-0 rounded-md px-2.5 shadow-none",
                  source !== "classroom" && "hover:bg-[var(--card)]",
                )}
                role="tab"
                aria-selected={source === "classroom"}
                onClick={() => setSource("classroom")}
              >
                <Award className="mr-1 h-3.5 w-3.5 shrink-0" />
                Classroom Points
              </Button>
              <Button
                type="button"
                size="sm"
                variant={source === "teaching" ? "default" : "ghost"}
                className={cn(
                  "h-8 shrink-0 rounded-md px-2.5 shadow-none",
                  source !== "teaching" && "hover:bg-[var(--card)]",
                )}
                role="tab"
                aria-selected={source === "teaching"}
                onClick={() => setSource("teaching")}
              >
                <BookOpen className="mr-1 h-3.5 w-3.5 shrink-0" />
                Teaching Library
              </Button>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2 pl-1">
              {source === "classroom" ? (
                <>
                  <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => void reload()} disabled={loading}>
                    {loading ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    )}
                    Refresh
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="shrink-0" asChild>
                    <Link href={CLASSROOM_POINTS_HREF}>
                      <Plus className="mr-1 h-3.5 w-3.5 shrink-0" />
                      New assignment
                    </Link>
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => {
                    setTeachingEditItem(null)
                    setTeachingDialogOpen(true)
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5 shrink-0" />
                  New snippet
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 @[28rem]/codebench-panel:flex-row @[28rem]/codebench-panel:flex-wrap">
          <div className="relative min-w-0 flex-1 @[28rem]/codebench-panel:min-w-[12rem]">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-[var(--cc-text-muted)]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={source === "classroom" ? "Search assignments, prompts, sections…" : "Search title, topic, or tags"}
              className="pl-8"
            />
          </div>
          {source === "classroom" ? (
            <>
              <select
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value as typeof kindFilter)}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-sm @[28rem]/codebench-panel:w-auto"
              >
                <option value="all">All types</option>
                <option value="code">Coding only</option>
                <option value="solution">Solutions only</option>
              </select>
              <select
                value={sessionFilter}
                onChange={(event) => setSessionFilter(event.target.value)}
                className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-sm @[28rem]/codebench-panel:w-auto"
              >
                <option value="all">All sections</option>
                {filterSessionOptions.map((session) => (
                  <option key={session} value={session}>
                    {session}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as InstructorLibraryCategory | "all")}
              className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-sm @[28rem]/codebench-panel:w-auto"
            >
              <option value="all">All categories</option>
              {INSTRUCTOR_LIBRARY_CATEGORIES.map((entry) => (
                <option key={entry} value={entry}>
                  {INSTRUCTOR_LIBRARY_CATEGORY_LABELS[entry]}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {source === "classroom" ? (
          loading ? (
            <div className={cn(chrome.card, "flex items-center justify-center gap-2 p-8 text-sm", PORTAL_TEXT_MUTED)}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading classroom assignments…
            </div>
          ) : error ? (
            <div className={cn(chrome.card, "space-y-2 p-6 text-sm", PORTAL_TEXT_MUTED)}>
              <p>Could not load classroom assignments.</p>
              <p className="text-xs">{error}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void reload()}>
                Try again
              </Button>
            </div>
          ) : classroomGrouped.length === 0 ? (
            <div className={cn(chrome.card, "p-6 text-center text-sm", PORTAL_TEXT_MUTED)}>
              No classroom assignments match your filters. Create assignments in Classroom Points, then return here to teach live.
            </div>
          ) : (
            classroomGrouped.map(([session, rows]) => (
              <section key={session} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{session}</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {rows.length} assignment{rows.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <div className="instructor-library-grid">
                  {rows.map((row) => (
                    <ClassroomAssignmentCard
                      key={row.id}
                      row={row}
                      onOpen={onOpenClassroomInIde}
                      sessions={editDialogSessions}
                      onMutated={handleClassroomMutated}
                    />
                  ))}
                </div>
              </section>
            ))
          )
        ) : teachingGrouped.length === 0 ? (
          <div className={cn(chrome.card, "space-y-3 p-6 text-center text-sm", PORTAL_TEXT_MUTED)}>
            <p>No teaching library items match your filters.</p>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setTeachingEditItem(null)
                setTeachingDialogOpen(true)
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create your first snippet
            </Button>
          </div>
        ) : (
          teachingGrouped.map(([topic, topicItems]) => (
            <section key={topic} className="space-y-2">
              <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{topic}</h3>
              <div className="instructor-library-grid">
                {topicItems.map((item) => (
                  <article key={item.id} className={cn(chrome.card, "instructor-lift-card flex flex-col gap-3 p-4")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>{item.title}</p>
                        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{item.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {INSTRUCTOR_LIBRARY_CATEGORY_LABELS[item.category]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {item.languageId}
                      </Badge>
                      {item.difficulty ? (
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {item.difficulty}
                        </Badge>
                      ) : null}
                      {item.week ? (
                        <Badge variant="outline" className="text-[10px]">
                          {item.week}
                        </Badge>
                      ) : null}
                    </div>
                    {item.tags.length ? (
                      <div className="flex flex-wrap items-center gap-1 text-[10px] text-[var(--cc-text-muted)]">
                        <Tag className="h-3 w-3" />
                        {item.tags.join(" · ")}
                      </div>
                    ) : null}
                    <div className="mt-auto flex w-full flex-wrap items-center gap-2">
                      <Button type="button" size="sm" onClick={() => onOpenInIde(item)}>
                        <FolderOpen className="mr-1 h-3.5 w-3.5" />
                        Open in IDE
                        <ChevronRight className="ml-0.5 h-3.5 w-3.5 opacity-60" />
                      </Button>
                      <div className="ml-auto flex items-center gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Edit snippet"
                          aria-label="Edit snippet"
                          className="h-8 w-8 text-[var(--cc-text)] hover:bg-muted/60"
                          onClick={() => {
                            setTeachingEditItem(item)
                            setTeachingDialogOpen(true)
                          }}
                        >
                          <PenLine className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Delete snippet"
                          aria-label="Delete snippet"
                          className="h-8 w-8 text-[var(--cc-text)] hover:bg-muted/60 hover:text-[var(--cc-sem-danger,var(--destructive))]"
                          onClick={() => setDeleteTeachingItem(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <InstructorTeachingLibraryItemDialog
        open={teachingDialogOpen}
        onOpenChange={setTeachingDialogOpen}
        item={teachingEditItem}
        onSaved={() => refreshLibrary()}
      />

      <AlertDialog open={Boolean(deleteTeachingItem)} onOpenChange={(open) => !open && setDeleteTeachingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this snippet?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteTeachingItem?.title}</strong> from your teaching library on this device? This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingTeaching}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingTeaching}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void confirmDeleteTeachingItem()
              }}
            >
              {deletingTeaching ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Delete snippet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
