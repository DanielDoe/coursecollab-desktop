"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FacultyIntegratedToolbar, facultyToolbarSelectTriggerClass } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { MEMBER_INKS } from "@/lib/projects/project-contribution"

type LogEntry = { at: string; actor: string; action: string; section: string | null }

function inkForActor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return MEMBER_INKS[hash % MEMBER_INKS.length]
}

function whenLabel(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

function cellSymbol(state: string) {
  if (state === "complete") return "✓"
  if (state === "in_progress") return "◐"
  if (state === "attention") return "!"
  return "○"
}

const LEGEND = [
  { mark: "✓", label: "Complete" },
  { mark: "◐", label: "In progress" },
  { mark: "○", label: "Not started" },
  { mark: "!", label: "Needs attention" },
]

export function ProjectReportProgressMatrix({
  assignments,
}: {
  assignments: Array<{ id: number; title: string }>
}) {
  const [fetchedAssignments, setFetchedAssignments] = useState<Array<{ id: number; title: string }>>([])
  const setupOptions = assignments.length ? assignments : fetchedAssignments
  const [assignmentId, setAssignmentId] = useState<number | null>(assignments[0]?.id ?? null)
  const [matrix, setMatrix] = useState<Array<Record<string, unknown>>>([])
  const [sections, setSections] = useState<Array<{ section_key: string; title: string }>>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedName, setSelectedName] = useState("")
  const [log, setLog] = useState<LogEntry[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (assignments.length > 0) return
    void (async () => {
      const res = await instructorApiFetch("/api/instructor/project-assignments", {
        headers: buildInstructorApiHeaders(),
      })
      if (!res.ok) return
      const data = await res.json()
      const list = (data.assignments ?? []) as Array<{ id: number; title: string }>
      setFetchedAssignments(list)
      if (list.length && assignmentId == null) setAssignmentId(list[0].id)
    })()
  }, [assignments.length, assignmentId])

  useEffect(() => {
    if (!assignmentId) return
    setSelectedId(null)
    setSelectedName("")
    setLog([])
    void (async () => {
      const res = await instructorApiFetch(
        `/api/instructor/projects/report-progress?assignmentId=${assignmentId}`,
        { headers: buildInstructorApiHeaders() },
      )
      if (!res.ok) return
      const data = await res.json()
      setMatrix(data.matrix ?? [])
      setSections(data.templateSections ?? [])
    })()
  }, [assignmentId])

  useEffect(() => {
    if (!selectedId) return
    setLogLoading(true)
    void (async () => {
      const res = await instructorApiFetch(`/api/instructor/projects/${selectedId}/workspace-insights`, {
        headers: buildInstructorApiHeaders(),
      })
      if (!res.ok) {
        setLog([])
        setLogLoading(false)
        return
      }
      const data = await res.json()
      setLog((data.timeline ?? []) as LogEntry[])
      setLogLoading(false)
    })()
  }, [selectedId])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return matrix
    return matrix.filter((row) => String(row.groupName ?? "").toLowerCase().includes(q))
  }, [matrix, query])

  if (setupOptions.length === 0) {
    return (
      <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
        Create a structured report project setup first (Project Setup → Structured report).
      </p>
    )
  }

  const toggleGroup = (projectId: number, name: string) => {
    if (selectedId === projectId) {
      setSelectedId(null)
      setSelectedName("")
      return
    }
    setSelectedId(projectId)
    setSelectedName(name)
  }

  return (
    <div className="space-y-4">
      <FacultyIntegratedToolbar
        moduleId="projects"
        embedded
        search={query}
        onSearchChange={setQuery}
        onSearchClear={() => setQuery("")}
        searchPlaceholder="Find a group…"
        searchResetToken={assignmentId ?? "none"}
        trailing={
          <Select
            value={assignmentId ? String(assignmentId) : undefined}
            onValueChange={(v) => setAssignmentId(Number(v))}
          >
            <SelectTrigger
              className={cn(
                facultyToolbarSelectTriggerClass(),
                "h-9 w-auto min-w-[12rem] max-w-[min(100%,22rem)] sm:min-w-[16rem] sm:w-[22rem]",
              )}
            >
              <SelectValue placeholder="Project setup" />
            </SelectTrigger>
            <SelectContent>
              {setupOptions.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        meta={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {LEGEND.map((item) => (
              <span key={item.label} className={cn("inline-flex items-center gap-1.5 text-xs", PORTAL_TEXT_MUTED)}>
                <span className="tabular-nums text-[var(--cc-text)]">{item.mark}</span>
                {item.label}
              </span>
            ))}
            <span className={cn("ml-auto text-xs", PORTAL_TEXT_MUTED)}>
              {visible.length} of {matrix.length} groups
            </span>
          </div>
        }
      />

      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-muted/30">
                <th className="px-3 py-2 text-left font-medium">Group</th>
                {sections.map((s, i) => (
                  <th key={s.section_key} className="px-2 py-2 text-center font-medium" title={s.title}>
                    S{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(1, sections.length + 1)} className={cn("px-3 py-8 text-center text-sm", PORTAL_TEXT_MUTED)}>
                    {query.trim() ? `No groups match “${query.trim()}”.` : "No groups have started this report yet."}
                  </td>
                </tr>
              ) : (
                visible.map((row) => {
                  const projectId = Number(row.projectId)
                  const selected = selectedId === projectId
                  const name = String(row.groupName ?? "Group")
                  return (
                    <tr key={String(row.projectId)} className={cn("border-b border-[var(--border)] last:border-0", selected && "bg-[var(--cc-accent-soft)]")}>
                      <td className="px-3 py-2 font-medium">
                        <button
                          type="button"
                          aria-expanded={selected}
                          className={cn("inline-flex max-w-full items-center gap-1.5 text-left", selected ? "text-[var(--cc-accent)]" : PORTAL_TEXT)}
                          onClick={() => toggleGroup(projectId, name)}
                        >
                          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", selected ? "rotate-0" : "-rotate-90")} />
                          <span className="truncate">{name}</span>
                        </button>
                      </td>
                      {(row.sections as Array<{ state: string }>).map((c, i) => (
                        <td key={i} className="px-2 py-2 text-center tabular-nums">
                          {cellSymbol(c.state)}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {selectedId ? (
          <div className="border-t border-[var(--border)]">
            <div className="flex items-start justify-between gap-3 px-4 py-3">
              <div>
                <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>{selectedName}</p>
                <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Changes on this report, newest first. Click the group again to hide.</p>
              </div>
              <button
                type="button"
                className={cn("text-xs font-medium", PORTAL_TEXT_MUTED, "hover:text-[var(--cc-text)]")}
                onClick={() => toggleGroup(selectedId, selectedName)}
              >
                Hide
              </button>
            </div>
            {logLoading ? (
              <p className={cn("px-4 py-6 text-sm", PORTAL_TEXT_MUTED)}>Loading the report log…</p>
            ) : log.length === 0 ? (
              <p className={cn("px-4 py-6 text-sm", PORTAL_TEXT_MUTED)}>No changes have been recorded for this report yet.</p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {log.map((entry, index) => {
                  const ink = inkForActor(entry.actor)
                  return (
                    <div key={`${entry.at}-${index}`} className={cn("border-l-2 px-4 py-3", ink.edge)}>
                      <p className={cn("text-sm", PORTAL_TEXT)}>
                        <span className={cn("mr-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1", ink.chip)}>
                          {entry.actor}
                        </span>
                        {entry.action}
                      </p>
                      <p className={cn("mt-1 text-xs", PORTAL_TEXT_MUTED)}>
                        {entry.section ? `${entry.section} · ` : ""}
                        {whenLabel(entry.at)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <p className={cn("border-t border-[var(--border)] px-4 py-3 text-xs", PORTAL_TEXT_MUTED)}>
            Select a group to see who changed the report and when.
          </p>
        )}
      </div>
    </div>
  )
}
