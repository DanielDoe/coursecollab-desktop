"use client"


import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useToast } from "@/components/ui/use-toast"
import { Clock, Loader2, UserPlus, CheckCircle2, ChevronsUpDown, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface GrantRolloverToStudentPanelProps {
  quizId: string
  assessmentLabel: string
  defaultHours: number
  /** Optional reset button to show alongside grant (e.g. Reset all rollovers) */
  resetButton?: React.ReactNode
}

interface Student {
  id: number
  full_name: string
  email: string | null
  student_id: string
}

interface Session {
  id: number
  code: string
  description?: string | null
}

interface RolloverStudent {
  studentId: number
  fullName: string
  studentNumber: string
  section: string | null
  appliedAt: string
  expiresAt: string
  isActive: boolean
  source?: "points" | "instructor"
  hasRetakeOverride?: boolean
  retakeAttempts?: number
}

/**
 * Inline panel for instructors to grant a rollover extension to a selected student.
 * Works for all students (including non-Trailblazer) - one-time rollover access.
 * Used in the edit form for quizzes, homework, mid-semester, and finals.
 */
export function GrantRolloverToStudentPanel({
  quizId,
  assessmentLabel,
  defaultHours,
  resetButton,
}: GrantRolloverToStudentPanelProps) {
  const { toast } = useToast()
  const [students, setStudents] = useState<Student[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>("")
  const [selectedStudentId, setSelectedStudentId] = useState<string>("")
  const [studentComboboxOpen, setStudentComboboxOpen] = useState(false)
  const [hours, setHours] = useState(defaultHours)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [granting, setGranting] = useState(false)
  const [rolloverStudents, setRolloverStudents] = useState<RolloverStudent[]>([])
  const [loadingRollovers, setLoadingRollovers] = useState(false)
  const [grantingRetakeFor, setGrantingRetakeFor] = useState<number | null>(null)

  const fetchRolloverList = useCallback(() => {
    if (!quizId) return
    setLoadingRollovers(true)
    const headers: HeadersInit = {}
    const instructorId = typeof window !== "undefined" ? localStorage.getItem("instructorId") : null
    const instructorSession = typeof window !== "undefined" ? localStorage.getItem("instructorSession") : null
    if (instructorId) headers["x-instructor-id"] = instructorId
    if (instructorSession) headers["Authorization"] = instructorSession
    instructorApiFetch(`/api/instructor/rollover/list?quizId=${quizId}`, { headers })
      .then((r) => r.json())
      .then((data) => setRolloverStudents(data.students || []))
      .catch(() => setRolloverStudents([]))
      .finally(() => setLoadingRollovers(false))
  }, [quizId])

  useEffect(() => {
    fetchRolloverList()
  }, [fetchRolloverList])

  useEffect(() => {
    setHours(defaultHours)
  }, [defaultHours])

  useEffect(() => {
    const headers: HeadersInit = {}
    const instructorId = typeof window !== "undefined" ? localStorage.getItem("instructorId") : null
    const instructorSession = typeof window !== "undefined" ? localStorage.getItem("instructorSession") : null
    if (instructorId) headers["x-instructor-id"] = instructorId
    if (instructorSession) headers["Authorization"] = instructorSession

    instructorApiFetch("/api/instructor/sessions", { headers })
      .then((r) => r.json())
      .then((data) => {
        const sess = data.sessions || []
        setSessions(sess)
        setSelectedSessionId((prev) => {
          if (prev) return prev
          return sess.length > 0 ? sess[0].id.toString() : "all"
        })
      })
      .catch(() => {
        setSessions([])
        setSelectedSessionId("all")
      })
  }, [])

  useEffect(() => {
    if (!selectedSessionId) return
    setLoadingStudents(true)
    const headers: HeadersInit = {}
    const instructorId = typeof window !== "undefined" ? localStorage.getItem("instructorId") : null
    const instructorSession = typeof window !== "undefined" ? localStorage.getItem("instructorSession") : null
    if (instructorId) headers["x-instructor-id"] = instructorId
    if (instructorSession) headers["Authorization"] = instructorSession
    const url =
      selectedSessionId === "all"
        ? "/api/instructor/students"
        : `/api/instructor/students?session_id=${selectedSessionId}`
    fetch(url, { headers })
      .then((r) => r.json())
      .then((data) => setStudents(data.students || []))
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false))
  }, [selectedSessionId])


  const handleGrant = async () => {
    const sid = Number(selectedStudentId)
    const qid = Number(quizId)
    if (!sid || !qid) {
      toast({ title: "Select a student", variant: "destructive" })
      return
    }
    setGranting(true)
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" }
      const instructorId = typeof window !== "undefined" ? localStorage.getItem("instructorId") : null
      const instructorSession = typeof window !== "undefined" ? localStorage.getItem("instructorSession") : null
      if (instructorId) headers["x-instructor-id"] = instructorId
      if (instructorSession) headers["Authorization"] = instructorSession
      const res = await instructorApiFetch("/api/instructor/rollover/grant", {
        method: "POST",
        headers,
        body: JSON.stringify({ studentId: sid, quizId: qid, hours }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || "Failed to grant", variant: "destructive" })
        return
      }
      const studentName = students.find((s) => s.id === sid)?.full_name || "Student"
      toast({
        title: "Rollover granted successfully",
        description: `${studentName} has been granted a ${hours}-hour extension. Works for all students (no membership required).`,
        variant: "success",
      })
      setSelectedStudentId("")
      setStudentComboboxOpen(false)
      fetchRolloverList()
    } catch {
      toast({ title: "Failed to grant extension", variant: "destructive" })
    } finally {
      setGranting(false)
    }
  }

  const selectedStudent = students.find((s) => s.id.toString() === selectedStudentId)

  const handleGrantRetake = async (studentId: number) => {
    setGrantingRetakeFor(studentId)
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" }
      const instructorId = typeof window !== "undefined" ? localStorage.getItem("instructorId") : null
      const instructorSession = typeof window !== "undefined" ? localStorage.getItem("instructorSession") : null
      if (instructorId) headers["x-instructor-id"] = instructorId
      if (instructorSession) headers["Authorization"] = instructorSession
      const res = await instructorApiFetch("/api/instructor/attempt-overrides", {
        method: "POST",
        headers,
        body: JSON.stringify({
          quizId: Number(quizId),
          studentId,
          additionalAttempts: 1,
          reason: "Instructor-granted retake (rollover + retake)",
          instructorId: instructorId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || "Failed to grant retake", variant: "destructive" })
        return
      }
      const studentName = rolloverStudents.find((r) => r.studentId === studentId)?.fullName || "Student"
      toast({
        title: "Retake granted",
        description: `${studentName} has been granted 1 additional attempt.`,
        variant: "default",
      })
      fetchRolloverList()
    } catch {
      toast({ title: "Failed to grant retake", variant: "destructive" })
    } finally {
      setGrantingRetakeFor(null)
    }
  }

  return (
    <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <h4 className="font-semibold text-slate-900 dark:text-slate-100">
            Grant rollover to student (valid excuse)
          </h4>
        </div>
        {resetButton}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Grant a one-time rollover extension to any student (no membership required). They can access the {assessmentLabel.toLowerCase()} past the deadline. Explorer and Trailblazer also have self-service rollovers (limits apply); Scholar may need a manual grant for valid excuses.
      </p>
      <div className={cn("grid gap-x-4 gap-y-2", sessions.length > 0 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
        {/* Labels row */}
        {sessions.length > 0 && (
          <Label className="text-sm flex items-center h-10">Section</Label>
        )}
        <Label className="text-sm flex items-center h-10">Student</Label>
        <Label className="text-sm flex items-center h-10">Hours</Label>
        <Label className="text-sm flex items-center h-10 invisible sm:flex">Actions</Label>
        {/* Controls row - all same baseline */}
        {sessions.length > 0 && (
          <div className="flex items-center">
            <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
              <SelectTrigger className="w-full h-10 min-h-10">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center min-w-0">
          <Popover open={studentComboboxOpen} onOpenChange={setStudentComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={studentComboboxOpen}
                className="w-full min-w-0 justify-between h-10 min-h-10 font-normal overflow-hidden"
              >
                {loadingStudents ? (
                  <span className="truncate min-w-0 text-muted-foreground">Loading...</span>
                ) : selectedStudent ? (
                  <span className="truncate min-w-0">{selectedStudent.full_name} ({selectedStudent.student_id})</span>
                ) : (
                  <span className="truncate min-w-0 text-muted-foreground">Search by name, email, or ID...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search by name, email, or ID..." />
                <CommandList>
                  <CommandEmpty>No student found.</CommandEmpty>
                  <CommandGroup>
                    {students.slice(0, 100).map((s) => (
                      <CommandItem
                        key={s.id}
                        value={`${s.full_name} ${s.student_id} ${s.email || ""}`}
                        onSelect={() => {
                          setSelectedStudentId(s.id.toString())
                          setStudentComboboxOpen(false)
                        }}
                      >
                        <span className="truncate">{s.full_name} ({s.student_id})</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center">
          <Input
            type="number"
            min={1}
            max={72}
            value={hours}
            onChange={(e) =>
              setHours(Math.min(72, Math.max(1, Number(e.target.value) || 24)))
            }
            className="w-full h-10 min-h-10"
          />
        </div>
        <div className="flex items-center gap-2 [&_button]:h-10 [&_button]:min-h-10">
          <Button
            onClick={handleGrant}
            disabled={granting || !selectedStudentId}
            className="h-10 min-h-10 px-4 bg-amber-600 hover:bg-amber-700 text-white shrink-0"
          >
            {granting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
            {granting ? "Granting..." : "Grant extension"}
          </Button>
        </div>
      </div>
      {rolloverStudents.length > 0 && (
        <div className="space-y-2 pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <Label className="text-sm font-medium">Students with rollover exception</Label>
          </div>
          {loadingRollovers ? (
            <p className="text-xs text-slate-500">Loading...</p>
          ) : (
            <div className="rounded-md border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Section / ID</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Retake</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rolloverStudents.map((r) => (
                    <TableRow key={`${r.studentId}-${r.appliedAt}`}>
                      <TableCell className="font-medium">{r.fullName}</TableCell>
                      <TableCell className="text-slate-500 dark:text-slate-400">
                        {r.section || r.studentNumber}
                      </TableCell>
                      <TableCell>
                        {r.source === "points" ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">
                            Points traded
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500 text-xs">
                            Instructor
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.isActive ? (
                          <Badge variant="default" className="bg-emerald-600 text-xs">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Expired
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.hasRetakeOverride ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300 text-xs">
                            +{r.retakeAttempts || 1} retake
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.hasRetakeOverride ? null : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            disabled={grantingRetakeFor === r.studentId}
                            onClick={() => handleGrantRetake(r.studentId)}
                          >
                            {grantingRetakeFor === r.studentId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Grant retake
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
