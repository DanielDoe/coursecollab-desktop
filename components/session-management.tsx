"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Plus, Pencil, Trash2, Users, Calendar, ArrowLeft, Filter as FilterIcon } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

interface Session {
  id: number
  code: string
  description: string | null
  created_at: string
  student_count: number
}

export function SessionManagement({ userType = "admin" }: { userType?: "admin" | "instructor" }) {
  const { toast } = useToast()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [formData, setFormData] = useState({ code: "", description: "" })
  const [submitting, setSubmitting] = useState(false)

  const getApiPrefix = () => userType === "admin" ? "/api/admin" : "/api/instructor"

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const response = await fetch(`${getApiPrefix()}/sessions`)
      const data = await response.json()
      setSessions(data.sessions)
    } catch (error) {
      console.error("[v0] Failed to fetch sessions:", error)
      toast({
        title: "Error",
        description: "Failed to load sessions",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!formData.code.trim()) {
      toast({
        title: "Validation Error",
        description: "Session code is required",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${getApiPrefix()}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create session")
      }

      toast({
        title: "Success",
        description: "Session created successfully",
      })

      setShowAddDialog(false)
      setFormData({ code: "", description: "" })
      fetchSessions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!selectedSession || !formData.code.trim()) {
      toast({
        title: "Validation Error",
        description: "Session code is required",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${getApiPrefix()}/sessions/${selectedSession.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update session")
      }

      toast({
        title: "Success",
        description: "Session updated successfully",
      })

      setShowEditDialog(false)
      setSelectedSession(null)
      setFormData({ code: "", description: "" })
      fetchSessions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedSession) return

    setSubmitting(true)
    try {
      const response = await fetch(`${getApiPrefix()}/sessions/${selectedSession.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete session")
      }

      const data = await response.json()

      toast({
        title: "Success",
        description: `Session deleted. ${data.deletedStudents} student(s) removed.`,
      })

      setShowDeleteDialog(false)
      setSelectedSession(null)
      fetchSessions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const openEditDialog = (session: Session) => {
    setSelectedSession(session)
    setFormData({ code: session.code, description: session.description || "" })
    setShowEditDialog(true)
  }

  const openDeleteDialog = (session: Session) => {
    setSelectedSession(session)
    setShowDeleteDialog(true)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-20">
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <p className="text-slate-600">Loading sessions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-6">
      {/* Modern Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Manage Sessions
            </h1>
            <p className="text-sm text-slate-600 mt-1">Create and manage course sections</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href={userType === "admin" ? "/admin/dashboard" : "/instructor/dashboard"}>
            <Button 
              variant="outline"
              className="border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <Button 
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all rounded-xl"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Session
          </Button>
        </div>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm p-12 text-center">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <Calendar className="h-10 w-10 text-blue-600" />
          </div>
          <p className="text-slate-600 mb-4">No sessions found. Create your first session to get started.</p>
          <Button 
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 rounded-xl"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create First Session
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <div key={session.id} className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all group">
              <div className="p-6">
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Session Code */}
                  <div className="col-span-7 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 group-hover:from-blue-500 group-hover:to-indigo-600 transition-all">
                      <Calendar className="h-5 w-5 text-blue-600 group-hover:text-white transition-all" />
                    </div>
                    <div>
                      <p className="font-mono font-bold text-lg text-slate-800">{session.code}</p>
                    </div>
                  </div>

                  {/* Student Count */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-blue-700">{session.student_count}</span>
                      <span className="text-xs text-slate-600">students</span>
                    </div>
                  </div>

                  {/* Created Date */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="h-4 w-4 text-indigo-500" />
                      <span>{new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => openEditDialog(session)}
                      className="h-9 w-9 p-0 hover:bg-blue-100 hover:text-blue-600 transition-all rounded-lg"
                      title="Edit Session"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteDialog(session)}
                      className="h-9 w-9 p-0 hover:bg-red-100 text-red-600 hover:text-red-700 transition-all rounded-lg"
                      title="Delete Session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Session Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100">
                <Plus className="h-5 w-5 text-blue-600" />
              </div>
              <DialogTitle className="text-xl font-semibold text-slate-800">Add New Session</DialogTitle>
            </div>
            <DialogDescription className="text-slate-600">Create a new course section</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-code" className="text-sm font-medium text-slate-700">Session Code *</Label>
              <Input
                id="add-code"
                placeholder="e.g., P06"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="border-slate-200 rounded-xl bg-white h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-description" className="text-sm font-medium text-slate-700">Description</Label>
              <Textarea
                id="add-description"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="border-slate-200 rounded-xl bg-white min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAddDialog(false)}
              className="border-slate-200 hover:bg-slate-50 rounded-xl"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAdd} 
              disabled={submitting}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 rounded-xl"
            >
              {submitting ? "Creating..." : "Create Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Session Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100">
                <Pencil className="h-5 w-5 text-blue-600" />
              </div>
              <DialogTitle className="text-xl font-semibold text-slate-800">Edit Session</DialogTitle>
            </div>
            <DialogDescription className="text-slate-600">Update session details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code" className="text-sm font-medium text-slate-700">Session Code *</Label>
              <Input
                id="edit-code"
                placeholder="e.g., P06"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="border-slate-200 rounded-xl bg-white h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description" className="text-sm font-medium text-slate-700">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="border-slate-200 rounded-xl bg-white min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEditDialog(false)}
              className="border-slate-200 hover:bg-slate-50 rounded-xl"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEdit} 
              disabled={submitting}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 rounded-xl"
            >
              {submitting ? "Updating..." : "Update Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Session Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-100 to-pink-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-800">Delete Session?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600">
              This will permanently delete session <strong className="text-slate-800">{selectedSession?.code}</strong> and all{" "}
              <strong className="text-slate-800">{selectedSession?.student_count}</strong> student(s) in this section. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 hover:bg-slate-50 rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg shadow-red-500/25 rounded-xl"
            >
              {submitting ? "Deleting..." : "Delete Session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
