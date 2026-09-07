"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useCallback, useEffect, useState } from "react"
import { ArrowDownToLine, BookCopy, Loader2, Search } from "lucide-react"
import { toast } from "@/lib/app-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { FacultyIntegratedToolbar } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { portalListStripe } from "@/lib/portal-module-themes"
import { PORTAL_CARD, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import type { DiscoverableSyllabusRow } from "@/lib/syllabus-exchange/types"
import type { CourseSyllabus } from "@/lib/syllabus/types"

type SyllabusExchangePanelProps = {
  buildHeaders: () => Record<string, string>
  onApplied: (syllabus: CourseSyllabus) => void
}

export function SyllabusExchangePanel({
  buildHeaders,
  onApplied,
}: SyllabusExchangePanelProps) {
  const chrome = facultyEmbedChrome("syllabus")
  const [query, setQuery] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [rows, setRows] = useState<DiscoverableSyllabusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [applyingId, setApplyingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set("q", query.trim())
      params.set("limit", "50")
      const res = await instructorApiFetch(`/api/instructor/syllabus-exchange/discover?${params}`, {
        headers: buildHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to search syllabi")
      setRows((data.syllabi as DiscoverableSyllabusRow[]) ?? [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to search syllabi")
    } finally {
      setLoading(false)
    }
  }, [buildHeaders, query])

  useEffect(() => {
    void load()
  }, [load])

  const applyTemplate = async (row: DiscoverableSyllabusRow) => {
    if (
      !confirm(
        `Apply syllabus template from ${row.instructorName} · ${row.courseCode}${row.sessionCode ? ` ${row.sessionCode}` : ""}? Your current draft will be replaced.`,
      )
    ) {
      return
    }

    setApplyingId(row.syllabusId)
    try {
      const res = await instructorApiFetch("/api/instructor/syllabus-exchange/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildHeaders() },
        body: JSON.stringify({ sourceSyllabusId: row.syllabusId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to apply template")
      toast.success("Syllabus template applied", {
        description: "Review sections, edit for your course, then save or publish.",
      })
      onApplied(data.syllabus as CourseSyllabus)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to apply template")
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <>
      <FacultyIntegratedToolbar
        moduleId="syllabus"
        meta={<span className={PORTAL_TEXT_MUTED}>Public syllabus templates — no permission required</span>}
      />

      <div className={cn(PORTAL_CARD, "space-y-3 p-3 sm:p-4")}>
        <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
          Search syllabi from any instructor on CourseCollab. Applying a template copies content into your
          course as a draft. Provenance is recorded automatically.
        </p>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            setQuery(searchInput)
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Course code, title, instructor, term…"
              className="h-9 rounded-lg border-0 bg-[var(--muted)] pl-9 shadow-none"
            />
          </div>
          <Button type="submit" size="sm" className={cn("rounded-lg shrink-0", chrome.solid)}>
            Search
          </Button>
        </form>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border)] px-6 py-14 text-center",
            chrome.card,
          )}
        >
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", chrome.p.softBg, chrome.p.iconText)}>
            <BookCopy className="h-5 w-5" />
          </div>
          <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>No syllabi found</p>
          <p className={cn("max-w-sm text-sm", PORTAL_TEXT_MUTED)}>
            Try a different search, or publish a syllabus so others can discover it.
          </p>
        </div>
      ) : (
        <div className={cn(PORTAL_CARD, "divide-y divide-[var(--border)] overflow-hidden")}>
          {rows.map((row, index) => {
            const stripe = portalListStripe(index)
            return (
              <div
                key={row.syllabusId}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4 hover:bg-muted/40"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      stripe.iconWell,
                    )}
                  >
                    <BookCopy className={cn("h-4 w-4", stripe.iconText)} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>
                        {row.courseCode}
                        {row.sessionCode ? ` · ${row.sessionCode}` : ""}
                      </p>
                      <Badge variant="outline" className="rounded-md text-[10px] font-medium">
                        {row.status === "published" ? "Published" : "Draft"}
                      </Badge>
                      {row.isOwnCourse ? (
                        <Badge variant="secondary" className="rounded-md text-[10px] font-medium">
                          Your course
                        </Badge>
                      ) : null}
                    </div>
                    <p className={cn("truncate text-xs", PORTAL_TEXT_MUTED)}>
                      {row.courseTitle}
                      {row.term ? ` · ${row.term}` : ""}
                    </p>
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      {row.instructorName}
                      {row.university ? ` · ${row.university}` : ""}
                      {" · "}
                      {row.contentMode === "pdf"
                        ? "PDF syllabus"
                        : `${row.sectionCount} section${row.sectionCount === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={applyingId != null}
                  className={cn("rounded-lg shrink-0", chrome.solid)}
                  onClick={() => void applyTemplate(row)}
                >
                  {applyingId === row.syllabusId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                  )}
                  Use template
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
