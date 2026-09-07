"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, PlusCircle, X, AlertCircle, Search } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { buildInstructorAuthorizedApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"

interface Override {
  id: number
  student_id: number
  student_name: string
  student_code: string
  additional_attempts: number
  reason: string | null
  expires_at: string | null
  granted_at: string
  is_active: boolean
}

interface AttemptOverrideManagerProps {
  quizId: string
  userType?: "admin" | "instructor"
}

export function AttemptOverrideManager({ quizId, userType = "instructor" }: AttemptOverrideManagerProps) {
  const { toast } = useToast()
  const [overrides, setOverrides] = useState<Override[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; code: string } | null>(null)
  const [additionalAttempts, setAdditionalAttempts] = useState(1)
  const [reason, setReason] = useState("")
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [students, setStudents] = useState<Array<{ id: number; name: string; code: string; session_code?: string }>>([])
  const [sessions, setSessions] = useState<Array<{ id: number; code: string; description: string }>>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSession, setSelectedSession] = useState<string>("all")
  const [studentsLoading, setStudentsLoading] = useState(false)

  const buildAuthHeaders = (extra: Record<string, string> = {}): Record<string, string> => {
    const base: Record<string, string> = { ...extra }
    if (userType === "instructor") {
      const instructorId = localStorage.getItem("instructorId") ?? ""
      return { ...buildInstructorAuthorizedApiHeaders({ "x-instructor-id": instructorId }), ...extra }
    }
    const adminId = sessionStorage.getItem("adminId")
    if (!base["Content-Type"]) base["Content-Type"] = "application/json"
    if (adminId) base["x-admin-id"] = adminId
    return base
  }

  useEffect(() => {
    if (quizId) {
      fetchOverrides()
      fetchSessions()
      fetchStudents()
    }
  }, [quizId])

  useEffect(() => {
    // Reset selected student when dialog closes
    if (!dialogOpen) {
      setSelectedStudent(null)
      setAdditionalAttempts(1)
      setReason("")
      setExpiresAt(undefined)
      setSearchTerm("")
      setSelectedSession("all")
    }
  }, [dialogOpen])

  const fetchOverrides = async () => {
    try {
      setLoading(true)
      const response = await instructorApiFetch(`/api/instructor/attempt-overrides?quizId=${quizId}`, {
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
      })
      if (response.ok) {
        const data = await response.json()
        setOverrides(data.overrides || [])
      }
    } catch (error) {
      console.error("Error fetching overrides:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSessions = async () => {
    try {
      let headers: Record<string, string> = {}

      if (userType === "instructor") {
        const instructorId = localStorage.getItem("instructorId") ?? ""
        headers = buildInstructorAuthorizedApiHeaders({ "x-instructor-id": instructorId })
      } else {
        const adminId = sessionStorage.getItem("adminId")
        headers["Content-Type"] = "application/json"
        if (adminId) headers["x-admin-id"] = adminId
      }

      const response = await instructorApiFetch("/api/instructor/sessions", { headers })
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      }
    } catch (error) {
      console.error("Error fetching sessions:", error)
    }
  }

  const fetchStudents = async (sessionCode?: string) => {
    try {
      setStudentsLoading(true)
      let headers: Record<string, string> = {}

      if (userType === "instructor") {
        const instructorId = localStorage.getItem("instructorId") ?? ""
        headers = buildInstructorAuthorizedApiHeaders({ "x-instructor-id": instructorId })
      } else {
        const adminId = sessionStorage.getItem("adminId")
        headers["Content-Type"] = "application/json"
        if (adminId) headers["x-admin-id"] = adminId
      }

      const url =
        sessionCode && sessionCode !== "all"
          ? `/api/instructor/students?sessionCode=${encodeURIComponent(sessionCode)}`
          : "/api/instructor/students"

      const response = await fetch(url, { headers })
      if (response.ok) {
        const data = await response.json()
        setStudents((data.students || []).map((s: any) => ({
          id: s.id,
          name: s.full_name,
          code: s.student_id,
          session_code: s.session_code,
        })))
      }
    } catch (error) {
      console.error("Error fetching students:", error)
    } finally {
      setStudentsLoading(false)
    }
  }

  const handleGrantOverride = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    if (!selectedStudent) return

    setIsSubmitting(true)
    try {
      const response = await instructorApiFetch("/api/instructor/attempt-overrides", {
        method: "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          quizId: parseInt(quizId),
          studentId: parseInt(selectedStudent.id),
          additionalAttempts,
          reason: reason || undefined,
          expiresAt: expiresAt?.toISOString(),
          instructorId: userType === "instructor" ? localStorage.getItem("instructorId") : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to grant override")
      }

      const responseData = await response.json()
      
      // Show success notification
      toast({
        title: "✅ Override Granted Successfully",
        description: `Granted ${additionalAttempts} extra attempt(s) to ${selectedStudent.name} (${selectedStudent.code}). The override is now active.`,
        duration: 5000,
      })

      // Close dialog and reset form
      setSelectedStudent(null)
      setAdditionalAttempts(1)
      setReason("")
      setExpiresAt(undefined)
      setDialogOpen(false)
      
      // Refresh the overrides list
      await fetchOverrides()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to grant override",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRevokeOverride = async (overrideId: number) => {
    try {
      const response = await instructorApiFetch(`/api/instructor/attempt-overrides?overrideId=${overrideId}`, {
        method: "DELETE",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
      })

      if (!response.ok) {
        throw new Error("Failed to revoke override")
      }

      toast({
        title: "✅ Override Revoked",
        description: "The override has been successfully revoked and is no longer active.",
        duration: 4000,
      })

      fetchOverrides()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke override",
        variant: "destructive",
      })
    }
  }

  const filteredStudents = students.filter(
    s => {
      const matchesSearch = !searchTerm || 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.code.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesSession = selectedSession === "all" || s.session_code === selectedSession
      return matchesSearch && matchesSession
    }
  )

  const activeOverrides = overrides.filter(o => o.is_active && (!o.expires_at || new Date(o.expires_at) > new Date()))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Attempt Overrides</CardTitle>
            <CardDescription>
              Grant extra attempts to students beyond their membership limits. Overrides work alongside assessment retake settings.
            </CardDescription>
          </div>
          <Button 
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDialogOpen(true)
            }} 
            size="sm" 
            className="gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            Grant Override
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading overrides...</div>
        ) : activeOverrides.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>No active overrides for this assessment.</p>
            <p className="text-sm mt-2">Click "Grant Override" to give a student extra attempts.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {activeOverrides.length} active override(s)
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Extra Attempts</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeOverrides.map((override) => (
                  <TableRow key={override.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{override.student_name}</p>
                        <p className="text-sm text-muted-foreground">{override.student_code}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">+{override.additional_attempts}</Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{override.reason || "No reason provided"}</p>
                    </TableCell>
                    <TableCell>
                      {override.expires_at ? (
                        <span className="text-sm">{format(new Date(override.expires_at), "MMM d, yyyy")}</span>
                      ) : (
                        <Badge variant="secondary">No expiration</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleRevokeOverride(override.id)
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Grant Override Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setSelectedStudent(null)
            setAdditionalAttempts(1)
            setReason("")
            setExpiresAt(undefined)
            setSearchTerm("")
            setSelectedSession("all")
          }
        }}>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Grant Extra Attempts</DialogTitle>
              <DialogDescription>
                Grant additional attempts to a student beyond their membership limit.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {!selectedStudent ? (
                <>
                  {/* Filters */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Filter by Session</Label>
                      <Select 
                        value={selectedSession} 
                        onValueChange={(value) => {
                          setSelectedSession(value)
                          fetchStudents(value !== "all" ? value : undefined)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Sessions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sessions</SelectItem>
                          {sessions.map((session) => (
                            <SelectItem key={session.id} value={session.code}>
                              {session.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Search Student</Label>
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or ID..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Students List */}
                  <div className="space-y-2">
                    <Label>Select Student</Label>
                    <div className="border rounded-md max-h-[300px] overflow-y-auto">
                      {studentsLoading ? (
                        <div className="px-3 py-8 text-center text-sm text-muted-foreground">Loading students...</div>
                      ) : filteredStudents.length > 0 ? (
                        filteredStudents.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setSelectedStudent({ id: student.id.toString(), name: student.name, code: student.code })
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-b-0 transition-colors"
                          >
                            <p className="font-medium">{student.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-muted-foreground">{student.code}</p>
                              {student.session_code && (
                                <Badge variant="outline" className="text-xs">
                                  {student.session_code}
                                </Badge>
                              )}
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                          {searchTerm || selectedSession !== "all" 
                            ? "No students found matching filters" 
                            : "No students available"}
                        </div>
                      )}
                    </div>
                    {filteredStudents.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Showing {filteredStudents.length} student(s)
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2 p-3 bg-muted rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Selected Student</p>
                        <p className="text-sm">{selectedStudent.name} ({selectedStudent.code})</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setSelectedStudent(null)
                        }}
                        className="text-muted-foreground"
                      >
                        Change
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="additionalAttempts">Additional Attempts</Label>
                    <Input
                      id="additionalAttempts"
                      type="number"
                      min="1"
                      max="10"
                      value={additionalAttempts}
                      onChange={(e) => setAdditionalAttempts(parseInt(e.target.value) || 1)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of extra attempts to grant (beyond membership limit)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason (Optional)</Label>
                    <Textarea
                      id="reason"
                      placeholder="e.g., Technical difficulties, internet issues, etc."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Expiration Date (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !expiresAt && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {expiresAt ? format(expiresAt, "PPP") : "No expiration"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={expiresAt}
                          onSelect={setExpiresAt}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button 
                type="button"
                variant="outline" 
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDialogOpen(false)
                }} 
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                type="button"
                onClick={handleGrantOverride} 
                disabled={isSubmitting || !selectedStudent}
              >
                {isSubmitting ? "Granting..." : "Grant Override"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

