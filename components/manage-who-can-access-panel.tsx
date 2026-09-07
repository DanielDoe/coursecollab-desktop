"use client"

import { useState, useEffect, useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, UserCheck } from "lucide-react"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"

interface Session {
  id: number
  code: string
  description?: string
  student_count?: number
}

interface Student {
  id: number
  student_id: string
  full_name: string
}

interface SelectedStudentMeta extends Student {
  session_id: number
  session_code: string
}

interface ManageWhoCanAccessPanelProps {
  restrictAccessToStudents: boolean
  allowedStudentIds: number[]
  selectedSessionId: number | null
  onRestrictChange: (value: boolean) => void
  onAllowedStudentsChange: (ids: number[]) => void
  onSessionChange: (sessionId: number | null) => void
  assessmentLabel: string
  userType: "instructor" | "admin"
  embedded?: boolean
}

export function ManageWhoCanAccessPanel({
  restrictAccessToStudents,
  allowedStudentIds,
  selectedSessionId,
  onRestrictChange,
  onAllowedStudentsChange,
  onSessionChange,
  assessmentLabel,
  userType,
  embedded = false,
}: ManageWhoCanAccessPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [selectedStudentMetaById, setSelectedStudentMetaById] = useState<Record<number, SelectedStudentMeta>>({})

  useEffect(() => {
    let headers: Record<string, string> = { "Content-Type": "application/json" }
    if (userType === "instructor") {
      const id = typeof localStorage !== "undefined" ? localStorage.getItem("instructorId") ?? "" : ""
      headers = buildInstructorAuthorizedApiHeaders({ ...headers, "x-instructor-id": id })
    } else {
      const id = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("adminId") : null
      if (id) headers["x-admin-id"] = id
    }
    instructorApiFetch("/api/instructor/sessions", { headers })
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions || []))
      .catch(() => setSessions([]))
  }, [userType])

  useEffect(() => {
    if (!selectedSessionId) {
      setStudents([])
      return
    }
    setStudentsLoading(true)
    let headers: Record<string, string> = { "Content-Type": "application/json" }
    if (userType === "instructor") {
      const id = typeof localStorage !== "undefined" ? localStorage.getItem("instructorId") ?? "" : ""
      headers = buildInstructorAuthorizedApiHeaders({ ...headers, "x-instructor-id": id })
    } else {
      const id = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("adminId") : null
      if (id) headers["x-admin-id"] = id
    }
    instructorApiFetch(`/api/instructor/students?session_id=${selectedSessionId}`, { headers })
      .then((r) => r.json())
      .then((d) => {
        const loadedStudents: Student[] = d.students || []
        setStudents(loadedStudents)
        const sessionCode = sessions.find((s) => s.id === selectedSessionId)?.code || `Session ${selectedSessionId}`
        setSelectedStudentMetaById((prev) => {
          const next = { ...prev }
          for (const s of loadedStudents) {
            next[s.id] = {
              ...s,
              session_id: selectedSessionId,
              session_code: sessionCode,
            }
          }
          return next
        })
      })
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoading(false))
  }, [selectedSessionId, userType, sessions])

  const toggleStudent = (id: number) => {
    const idx = allowedStudentIds.indexOf(id)
    const next = idx >= 0 ? allowedStudentIds.filter((_, i) => i !== idx) : [...allowedStudentIds, id]
    onAllowedStudentsChange(next)
  }

  const allSelected = students.length > 0 && students.every((s) => allowedStudentIds.includes(s.id))
  const selectAll = () => {
    const currentSessionStudentIds = students.map((s) => s.id)
    if (allSelected) {
      onAllowedStudentsChange(allowedStudentIds.filter((id) => !currentSessionStudentIds.includes(id)))
    } else {
      const merged = new Set<number>(allowedStudentIds)
      for (const id of currentSessionStudentIds) merged.add(id)
      onAllowedStudentsChange(Array.from(merged))
    }
  }

  const selectedBySession = useMemo(() => {
    const grouped = new Map<string, { sessionId: number; students: SelectedStudentMeta[] }>()
    const uncategorized: number[] = []
    for (const id of allowedStudentIds) {
      const meta = selectedStudentMetaById[id]
      if (!meta) {
        uncategorized.push(id)
        continue
      }
      const existing = grouped.get(meta.session_code)
      if (existing) {
        existing.students.push(meta)
      } else {
        grouped.set(meta.session_code, { sessionId: meta.session_id, students: [meta] })
      }
    }
    return {
      grouped: Array.from(grouped.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([sessionCode, payload]) => ({
          sessionCode,
          sessionId: payload.sessionId,
          students: payload.students.sort((a, b) => a.full_name.localeCompare(b.full_name)),
        })),
      uncategorized,
    }
  }, [allowedStudentIds, selectedStudentMetaById])

  return (
    <div className={`pt-6 mt-6 border-t border-slate-200 dark:border-slate-700 ${!embedded ? "space-y-4" : ""}`}>
      <div className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">Who Can Access</h4>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            For in-class exams (mid-semester, finals): restrict to students who were present. You can save with no students selected yet, then check in students on exam day. Unchecked students will see &quot;You must be in class to take this assessment.&quot;
          </p>
        </div>
        <Switch
          checked={restrictAccessToStudents}
          onCheckedChange={(v) => {
            onRestrictChange(v)
            if (!v) {
              onAllowedStudentsChange([])
              onSessionChange(null)
            }
          }}
          className="data-[state=checked]:bg-amber-600 shrink-0"
        />
      </div>

      {restrictAccessToStudents && (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Session (optional — only for loading the roster)
            </Label>
            <Select
              value={selectedSessionId ? String(selectedSessionId) : "__none__"}
              onValueChange={(v) => {
                onSessionChange(v && v !== "__none__" ? parseInt(v, 10) : null)
              }}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="No session selected (save anytime)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No session — add students later</SelectItem>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.code} {s.student_count != null ? `(${s.student_count} students)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSessionId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Students who can take this {assessmentLabel}</Label>
                {students.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    {allSelected ? "Deselect All" : "Select All"}
                  </button>
                )}
              </div>
              {studentsLoading ? (
                <p className="text-sm text-slate-500">Loading students...</p>
              ) : students.length === 0 ? (
                <p className="text-sm text-slate-500">No students in this session.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                  {students.map((s) => {
                    const isChecked = allowedStudentIds.includes(s.id)
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                          isChecked ? "bg-amber-50 dark:bg-amber-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStudent(s.id)}
                          className="rounded border-slate-300"
                        />
                        <UserCheck className={`h-4 w-4 ${isChecked ? "text-amber-600" : "text-slate-400"}`} />
                        <span className="text-sm">
                          {s.full_name} <span className="text-slate-500">({s.student_id})</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
              {allowedStudentIds.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    {allowedStudentIds.length} student{allowedStudentIds.length !== 1 ? "s" : ""} selected across section
                    {allowedStudentIds.length !== 1 ? "s" : ""}
                  </p>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/60 dark:bg-slate-800/40">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Active access by section</p>
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {selectedBySession.grouped.map((group) => (
                        <div
                          key={`${group.sessionCode}-${group.sessionId}`}
                          className="rounded-md border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/40 p-2.5"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{group.sessionCode}</p>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {group.students.length} student{group.students.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {group.students.map((s) => (
                              <span
                                key={s.id}
                                className="inline-flex items-center rounded-full border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 text-[11px] text-amber-800 dark:text-amber-300"
                              >
                                {s.full_name} ({s.student_id})
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                      {selectedBySession.uncategorized.length > 0 && (
                        <div className="rounded-md border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/40 p-2.5">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">Other / not loaded yet</p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            IDs: {selectedBySession.uncategorized.join(", ")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
