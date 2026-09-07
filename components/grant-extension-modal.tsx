"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { Clock, Loader2 } from "lucide-react"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"

interface GrantExtensionModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  /** Pre-selected assessment ID when opened from assessment results */
  preselectedQuizId?: number | null
  preselectedQuizTitle?: string
  /** Pre-selected session for student list */
  preselectedSessionId?: string | null
  assessments?: { id: number; title: string }[]
  sessions?: { id: number; code: string; description?: string | null }[]
}

export function GrantExtensionModal({
  open,
  onClose,
  onSuccess,
  preselectedQuizId,
  preselectedQuizTitle,
  preselectedSessionId,
  assessments = [],
  sessions = [],
}: GrantExtensionModalProps) {
  const { toast } = useToast()
  const [studentSearch, setStudentSearch] = useState("")
  const [students, setStudents] = useState<{ id: number; full_name: string; email: string | null; student_id: string }[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>("")
  const [selectedQuizId, setSelectedQuizId] = useState<string>(preselectedQuizId?.toString() || "")
  const [hours, setHours] = useState(24)
  const [loading, setLoading] = useState(false)
  const [granting, setGranting] = useState(false)
  const [submittingOnBehalf, setSubmittingOnBehalf] = useState(false)

  useEffect(() => {
    if (preselectedQuizId) setSelectedQuizId(preselectedQuizId.toString())
  }, [preselectedQuizId])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const sessionId = preselectedSessionId && preselectedSessionId !== "all" ? preselectedSessionId : (sessions[0]?.id?.toString())
    const url = sessionId ? `/api/instructor/students?session_id=${sessionId}` : "/api/instructor/students"
    const instructorId = typeof window !== "undefined" ? localStorage.getItem("instructorId") ?? "" : ""
    const headers = buildInstructorAuthorizedApiHeaders({
      "x-instructor-id": instructorId,
    })
    fetch(url, { headers })
      .then((r) => r.json())
      .then((data) => {
        setStudents(data.students || [])
      })
      .catch(() => setStudents([]))
      .finally(() => setLoading(false))
  }, [open, preselectedSessionId, sessions])

  const filteredStudents = studentSearch.trim()
    ? students.filter(
        (s) =>
          s.full_name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
          s.email?.toLowerCase().includes(studentSearch.toLowerCase()) ||
          s.student_id?.includes(studentSearch)
      )
    : students

  const handleGrant = async () => {
    const sid = Number(selectedStudentId)
    const qid = Number(selectedQuizId)
    if (!sid || !qid) {
      toast({ title: "Select student and assessment", variant: "destructive" })
      return
    }
    setGranting(true)
    try {
      const headers = buildInstructorAuthorizedApiHeaders({
        "Content-Type": "application/json",
        "x-instructor-id":
          typeof window !== "undefined" ? localStorage.getItem("instructorId") ?? "" : "",
      })
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
      toast({ title: "Extension granted", description: data.message })
      onSuccess?.()
      onClose()
      setSelectedStudentId("")
      setStudentSearch("")
    } catch {
      toast({ title: "Failed to grant extension", variant: "destructive" })
    } finally {
      setGranting(false)
    }
  }

  const handleSubmitOnBehalf = async () => {
    const sid = Number(selectedStudentId)
    const qid = Number(selectedQuizId)
    if (!sid || !qid) {
      toast({ title: "Select student and assessment", variant: "destructive" })
      return
    }
    setSubmittingOnBehalf(true)
    try {
      const headers = buildInstructorAuthorizedApiHeaders({
        "Content-Type": "application/json",
        "x-instructor-id":
          typeof window !== "undefined" ? localStorage.getItem("instructorId") ?? "" : "",
      })
      const res = await instructorApiFetch("/api/instructor/submit-on-behalf", {
        method: "POST",
        headers,
        body: JSON.stringify({ studentId: sid, quizId: qid }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || "Failed to submit", variant: "destructive" })
        return
      }
      toast({ title: "Submitted on behalf", description: data.message })
      onSuccess?.()
      onClose()
      setSelectedStudentId("")
      setStudentSearch("")
    } catch {
      toast({ title: "Failed to submit on behalf", variant: "destructive" })
    } finally {
      setSubmittingOnBehalf(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Grant Extension
          </DialogTitle>
          <DialogDescription>
            Grant extension (extra time) or finalize on behalf of a student who forgot to click Submit. Finalizing preserves all saved answers; you can then manually grade each question in the results view.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Student</Label>
            <Input
              placeholder="Search by name, email, or ID..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="mb-2"
            />
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Loading..." : "Select student"} />
              </SelectTrigger>
              <SelectContent>
                {filteredStudents.slice(0, 50).map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.full_name} ({s.student_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Assessment</Label>
            <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
              <SelectTrigger>
                <SelectValue placeholder="Select assessment" />
              </SelectTrigger>
              <SelectContent>
                {assessments.map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>
                    {a.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Extension (hours)</Label>
            <Input
              type="number"
              min={1}
              max={72}
              value={hours}
              onChange={(e) => setHours(Math.min(72, Math.max(1, Number(e.target.value) || 24)))}
            />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleSubmitOnBehalf}
            disabled={submittingOnBehalf || granting || !selectedStudentId || !selectedQuizId}
          >
            {submittingOnBehalf ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {submittingOnBehalf ? "Submitting..." : "Submit on behalf"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleGrant} disabled={granting || submittingOnBehalf}>
              {granting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {granting ? "Granting..." : "Grant Extension"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
