"use client"

import { useEffect, useState } from "react"
import { Users } from "lucide-react"
import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

const LOBBY_PAGE_SIZE = 5

type LobbyStudent = {
  resultId: number
  displayName: string
  studentId: string
  inWaitingRoom: boolean
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
  return (parts[0] ?? "?").slice(0, 2).toUpperCase()
}

export function InstructorPlaygroundLobbyRoster({
  sessionId,
  lobbyOpen,
}: {
  sessionId: number
  lobbyOpen: boolean
}) {
  const [students, setStudents] = useState<LobbyStudent[]>([])
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await instructorApiFetch(`/api/playground/lobby?sessionId=${sessionId}`, {
          headers: getInstructorScopeHeaders(),
        })
        if (!response.ok) {
          if (!cancelled) {
            setFailed(true)
            setLoaded(true)
          }
          return
        }
        const data = (await response.json()) as { participants?: Record<string, unknown>[] }
        if (cancelled) return
        const rows = Array.isArray(data.participants) ? data.participants : []
        setStudents(
          rows.map((row) => ({
            resultId: Number(row.resultId),
            displayName: String(row.displayName || row.studentName || "Student"),
            studentId: String(row.studentId ?? ""),
            inWaitingRoom: Boolean(row.inWaitingRoom),
          })),
        )
        setFailed(false)
        setLoaded(true)
      } catch {
        if (!cancelled) {
          setFailed(true)
          setLoaded(true)
        }
      }
    }

    setLoaded(false)
    setPage(0)
    void load()
    const timer = window.setInterval(() => void load(), 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [sessionId])

  const shown = lobbyOpen ? students.filter((student) => student.inWaitingRoom) : students
  const pageCount = Math.max(1, Math.ceil(shown.length / LOBBY_PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageStart = safePage * LOBBY_PAGE_SIZE
  const pageRows = shown.slice(pageStart, pageStart + LOBBY_PAGE_SIZE)

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--cc-text)]">
          <Users className="h-4 w-4 text-[var(--cc-text-muted)]" />
          {lobbyOpen ? "Waiting in the lobby" : "Students in this session"}
        </span>
        <span className="text-xs font-semibold tabular-nums text-[var(--cc-text-muted)]">{shown.length}</span>
      </div>
      {shown.length === 0 ? (
        <p className="border-t border-[var(--border)] px-3 py-4 text-sm text-[var(--cc-text-muted)]">
          {failed
            ? "The lobby list could not be loaded. It will try again in a moment."
            : loaded
              ? lobbyOpen
                ? "No students have joined yet. Names show up here as soon as they join."
                : "No students in this session."
              : "Loading the lobby…"}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {pageRows.map((student) => (
            <li key={student.resultId} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)] text-[11px] font-semibold text-[var(--cc-text)]">
                {initials(student.displayName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--cc-text)]">
                  {student.displayName}
                </span>
                {student.studentId ? (
                  <span className="block truncate font-mono text-xs text-[var(--cc-text-muted)]">
                    {student.studentId}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "shrink-0 text-[10px] font-semibold uppercase tracking-wide",
                  student.inWaitingRoom
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-emerald-700 dark:text-emerald-300",
                )}
              >
                {student.inWaitingRoom ? "Waiting" : "Playing"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {shown.length > LOBBY_PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-3 py-2">
          <p className="text-xs tabular-nums text-[var(--cc-text-muted)]">
            {pageStart + 1}–{pageStart + pageRows.length} of {shown.length}
          </p>
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  className={cn("h-8 px-2", safePage === 0 && "pointer-events-none opacity-40")}
                  onClick={(event) => {
                    event.preventDefault()
                    setPage((current) => Math.max(0, Math.min(current, pageCount - 1) - 1))
                  }}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  className={cn("h-8 px-2", safePage >= pageCount - 1 && "pointer-events-none opacity-40")}
                  onClick={(event) => {
                    event.preventDefault()
                    setPage((current) => Math.min(pageCount - 1, Math.min(current, pageCount - 1) + 1))
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      ) : null}
    </div>
  )
}
