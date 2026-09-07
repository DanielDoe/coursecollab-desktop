"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Edit,
  Trash2,
  Search,
  UserCog,
  Users,
  Eye,
  KeyRound,
  Loader2,
  LayoutGrid,
  List,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { usePreventBack } from "@/hooks/use-prevent-back"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { getAdminData } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { FACULTY_DEFAULT_PASSWORD } from "@/lib/faculty-default-password"
import { FacultyMemberDetailModal, ROLE_LABELS } from "@/components/admin/FacultyMemberDetailModal"

type StaffRow = {
  id: number
  username: string
  email: string
  name: string
  role: string
  is_active: boolean
  assigned_instructor_id: number | null
  assigned_instructor_name: string | null
  created_at: string
  last_login: string | null
  course_count: number
  course_codes: string[]
  assigned_course_ids?: number[]
}

type SupervisorCourse = {
  id: number
  course_code: string
  course_title: string
  semester: string | null
}

type FormState = {
  username: string
  email: string
  name: string
  password: string
  role: string
  is_active: boolean
  assigned_instructor_id: string
  course_ids: string[]
}

const emptyForm: FormState = {
  username: "",
  email: "",
  name: "",
  password: "",
  role: "instructor",
  is_active: true,
  assigned_instructor_id: "",
  course_ids: [],
}

type SupervisorOption = { id: number; name: string; username: string; course_count: number }

export function AdminInstructorManagement({
  embedInDashboard,
  mode = "faculty",
}: {
  embedInDashboard?: boolean
  mode?: "instructor" | "ta" | "faculty"
}) {
  const router = useRouter()
  const { toast } = useToast()
  usePreventBack("/admin/login")

  const isFacultyMode = mode === "faculty"
  const isTaMode = mode === "ta"
  const isInstructorMode = mode === "instructor"
  const fixedRole = isTaMode ? "ta" : isInstructorMode ? "instructor" : undefined
  const pageTitle = isFacultyMode
    ? "Faculty Management"
    : isTaMode
      ? "Teaching Assistant Management"
      : "Instructor Management"
  const addLabel = isFacultyMode ? "Add faculty member" : isTaMode ? "Add teaching assistant" : "Add instructor"

  const [rows, setRows] = useState<StaffRow[]>([])
  const [supervisors, setSupervisors] = useState<SupervisorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [roleFilter, setRoleFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StaffRow | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<StaffRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewing, setViewing] = useState<StaffRow | null>(null)
  const [supervisorCourses, setSupervisorCourses] = useState<SupervisorCourse[]>([])
  const [loadingSupervisorCourses, setLoadingSupervisorCourses] = useState(false)

  const fetchSupervisors = useCallback(async () => {
    const admin = getAdminData()
    if (!admin) return
    try {
      const params = new URLSearchParams({ adminId: admin.id, role: "instructor", status: "active" })
      const res = await fetch(`/api/admin/instructors?${params}`, { headers: buildAdminApiHeaders() })
      const data = await res.json()
      if (res.ok) {
        setSupervisors(
          (data.instructors || []).map((i: StaffRow) => ({
            id: i.id,
            name: i.name,
            username: i.username,
            course_count: i.course_count,
          })),
        )
      }
    } catch {
      setSupervisors([])
    }
  }, [])

  const fetchRows = useCallback(async () => {
    const admin = getAdminData()
    if (!admin) {
      router.push("/admin/login")
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({ adminId: admin.id })
      const roleParam = isFacultyMode ? roleFilter : fixedRole
      if (roleParam && roleParam !== "all") params.set("role", roleParam)
      if (statusFilter !== "all") params.set("status", statusFilter)
      if (search.trim()) params.set("search", search.trim())

      const res = await fetch(`/api/admin/instructors?${params}`, {
        headers: buildAdminApiHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setRows(data.instructors || [])
    } catch (e) {
      toast({
        title: isFacultyMode ? "Could not load faculty" : isTaMode ? "Could not load teaching assistants" : "Could not load instructors",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [router, fixedRole, roleFilter, statusFilter, search, toast, isTaMode, isFacultyMode])

  useEffect(() => {
    void fetchRows()
    if (isTaMode || isFacultyMode) void fetchSupervisors()
  }, [fetchRows, fetchSupervisors, isTaMode, isFacultyMode])

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.is_active).length
    const instructors = rows.filter((r) => r.role === "instructor" || r.role === "department_admin").length
    const tas = rows.filter((r) => r.role === "ta").length
    return { total: rows.length, active, instructors, tas }
  }, [rows])

  const showTaFields = isTaMode || (isFacultyMode && form.role === "ta")

  const selectedSupervisor = useMemo(
    () => supervisors.find((s) => String(s.id) === form.assigned_instructor_id),
    [supervisors, form.assigned_instructor_id],
  )

  const loadSupervisorCourses = useCallback(async (supervisorId: string) => {
    if (!supervisorId) {
      setSupervisorCourses([])
      return
    }
    const admin = getAdminData()
    if (!admin) return
    setLoadingSupervisorCourses(true)
    try {
      const res = await fetch("/api/admin/courses?status=active", {
        headers: buildAdminApiHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load courses")
      const ownerId = Number(supervisorId)
      const list = (data.courses || []).filter(
        (c: { instructor_id: number | null }) => Number(c.instructor_id) === ownerId,
      ) as SupervisorCourse[]
      setSupervisorCourses(list)
    } catch {
      setSupervisorCourses([])
    } finally {
      setLoadingSupervisorCourses(false)
    }
  }, [])

  useEffect(() => {
    if (!showTaFields || !dialogOpen) return
    void loadSupervisorCourses(form.assigned_instructor_id)
  }, [showTaFields, dialogOpen, form.assigned_instructor_id, loadSupervisorCourses])

  const openCreate = () => {
    setEditing(null)
    setSupervisorCourses([])
    setForm({
      ...emptyForm,
      role: isTaMode ? "ta" : "instructor",
      password: FACULTY_DEFAULT_PASSWORD,
    })
    setDialogOpen(true)
  }

  const openEdit = (row: StaffRow) => {
    setEditing(row)
    setForm({
      username: row.username,
      email: row.email,
      name: row.name,
      password: "",
      role: row.role || "instructor",
      is_active: row.is_active,
      assigned_instructor_id: row.assigned_instructor_id ? String(row.assigned_instructor_id) : "",
      course_ids: (row.assigned_course_ids ?? []).map(String),
    })
    setDialogOpen(true)
  }

  const openView = (row: StaffRow) => {
    setViewing(row)
    setViewOpen(true)
  }

  const toggleCourseId = (courseId: string) => {
    setForm((f) => {
      const set = new Set(f.course_ids)
      if (set.has(courseId)) set.delete(courseId)
      else set.add(courseId)
      return { ...f, course_ids: [...set] }
    })
  }

  const handleSave = async () => {
    if (!form.username.trim() || !form.email.trim() || !form.name.trim()) {
      toast({ title: "Missing fields", description: "Username, email, and name are required.", variant: "destructive" })
      return
    }
    if (!editing && !form.password.trim()) {
      toast({ title: "Password required", description: "Set an initial password for new accounts.", variant: "destructive" })
      return
    }
    if (showTaFields && !form.assigned_instructor_id) {
      toast({
        title: "Supervisor required",
        description: "Assign this TA to an instructor who owns the course(s) they will support.",
        variant: "destructive",
      })
      return
    }
    if (showTaFields && form.course_ids.length === 0) {
      toast({
        title: "Course required",
        description: "Select at least one course this TA can access.",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const url = editing ? `/api/admin/instructors/${editing.id}` : "/api/admin/instructors"
      const method = editing ? "PATCH" : "POST"
      const accountRole = isFacultyMode ? form.role : fixedRole!
      const body: Record<string, unknown> = {
        username: form.username.trim(),
        email: form.email.trim(),
        name: form.name.trim(),
        role: accountRole,
        is_active: form.is_active,
      }
      if (form.password.trim()) body.password = form.password
      if (showTaFields) {
        body.assigned_instructor_id = Number(form.assigned_instructor_id)
        body.course_ids = form.course_ids.map(Number)
      } else {
        body.assigned_instructor_id = null
      }

      const res = await fetch(url, {
        method,
        headers: { ...buildAdminApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")

      toast({
        title: editing
          ? "Account updated"
          : isFacultyMode
            ? "Faculty member created"
            : isTaMode
              ? "Teaching assistant created"
              : "Instructor created",
        description: form.name,
      })
      setDialogOpen(false)
      void fetchRows()
      if (isTaMode || isFacultyMode) void fetchSupervisors()
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      const canHardDelete = toDelete.role === "ta" || toDelete.course_count === 0
      const res = await fetch(`/api/admin/instructors/${toDelete.id}?hard=${canHardDelete}`, {
        method: "DELETE",
        headers: buildAdminApiHeaders(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")

      toast({
        title: data.deleted ? "Account removed" : "Account deactivated",
        description: toDelete.name,
      })
      setDeleteOpen(false)
      setToDelete(null)
      void fetchRows()
    } catch (e) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const shellClass = embedInDashboard ? "" : "min-h-screen bg-slate-50 dark:bg-slate-950 p-6"

  return (
    <div className={cn(shellClass, "w-full min-w-0 space-y-6")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <UserCog className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            {pageTitle}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {isFacultyMode
              ? "Manage all faculty accounts — instructors, teaching assistants, and department administrators — in one place."
              : isTaMode
                ? "Create and manage TAs. Link each TA to a supervising instructor, then choose which of that instructor's courses they can access."
                : "Create and manage instructor accounts and their course ownership."}
          </p>
        </div>
        <Button onClick={openCreate} className="rounded-xl bg-violet-600 hover:bg-violet-700 shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {addLabel}
        </Button>
      </div>

      <div className={cn("grid gap-3", isFacultyMode ? "grid-cols-2 sm:grid-cols-4 max-w-3xl" : "grid-cols-2 sm:grid-cols-2 max-w-md")}>
        {[
          { label: "Total", value: stats.total, icon: Users },
          { label: "Active", value: stats.active, icon: UserCog },
          ...(isFacultyMode
            ? [
                { label: "Instructors", value: stats.instructors, icon: UserCog },
                { label: "TAs", value: stats.tas, icon: Users },
              ]
            : []),
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 p-4"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{s.label}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search name, username, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {isFacultyMode && (
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px] rounded-xl">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="instructor">Instructors</SelectItem>
                <SelectItem value="ta">Teaching assistants</SelectItem>
                <SelectItem value="department_admin">Department admins</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <Button
              type="button"
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              className="rounded-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              className="rounded-none"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/15 p-12 text-center">
          <UserCog className="h-10 w-10 mx-auto text-slate-400 mb-3" />
          <p className="font-medium text-slate-800 dark:text-slate-200">
            {isFacultyMode ? "No faculty found" : isTaMode ? "No teaching assistants found" : "No instructors found"}
          </p>
          <p className="text-sm text-slate-500 mt-1">{addLabel} to get started.</p>
        </div>
      ) : viewMode === "list" ? (
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden bg-white/80 dark:bg-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 text-left">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  {isFacultyMode && <th className="px-4 py-3 font-semibold">Role</th>}
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 dark:border-white/5 last:border-0 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
                    onClick={() => openView(row)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-white">{row.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">@{row.username}</p>
                    </td>
                    {isFacultyMode && (
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{ROLE_LABELS[row.role] ?? row.role}</Badge>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Badge variant={row.is_active ? "outline" : "destructive"}>
                        {row.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="View details"
                        onClick={(e) => {
                          e.stopPropagation()
                          openView(row)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(row)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          setToDelete(row)
                          setDeleteOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/5 p-4 space-y-3 cursor-pointer hover:border-violet-300/60 dark:hover:border-violet-500/30 transition-colors"
              onClick={() => openView(row)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{row.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">@{row.username}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {isFacultyMode && (
                    <Badge variant="secondary">{ROLE_LABELS[row.role] ?? row.role}</Badge>
                  )}
                  <Badge variant={row.is_active ? "outline" : "destructive"}>
                    {row.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl"
                  onClick={(e) => {
                    e.stopPropagation()
                    openView(row)
                  }}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 rounded-xl"
                  onClick={(e) => {
                    e.stopPropagation()
                    openEdit(row)
                  }}
                >
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-red-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    setToDelete(row)
                    setDeleteOpen(true)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <FacultyMemberDetailModal
        row={viewing}
        open={viewOpen}
        onOpenChange={setViewOpen}
        onEdit={(row) => openEdit(row as StaffRow)}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? isFacultyMode
                  ? "Edit faculty member"
                  : isTaMode
                    ? "Edit teaching assistant"
                    : "Edit instructor"
                : addLabel}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update profile details. Leave password blank to keep the current password."
                : isFacultyMode
                  ? "Choose the faculty role, then complete the profile. TAs must be linked to a supervising instructor and assigned courses."
                  : isTaMode
                    ? "Pick the supervising instructor, then select only the courses this TA should access."
                    : "New instructors can sign in at the faculty portal with these credentials."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isFacultyMode && (
              <div className="space-y-2">
                <Label>Faculty role *</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      role: v,
                      assigned_instructor_id: v === "ta" ? f.assigned_instructor_id : "",
                      course_ids: v === "ta" ? f.course_ids : [],
                    }))
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instructor">Instructor</SelectItem>
                    <SelectItem value="ta">Teaching Assistant</SelectItem>
                    <SelectItem value="department_admin">Department Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {showTaFields && (
              <div className="space-y-2">
                <Label>Supervising instructor *</Label>
                <Select
                  value={form.assigned_instructor_id}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      assigned_instructor_id: v,
                      course_ids: [],
                    }))
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select instructor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No instructors available — create an instructor first
                      </SelectItem>
                    ) : (
                      supervisors.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name} (@{s.username}) — {s.course_count} course{s.course_count === 1 ? "" : "s"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedSupervisor && selectedSupervisor.course_count === 0 && (
                  <p className="text-xs text-amber-600">
                    This instructor has no courses yet. Assign courses to them before the TA can access course content.
                  </p>
                )}
              </div>
            )}
            {showTaFields && form.assigned_instructor_id && (
              <div className="space-y-2">
                <Label>Assigned courses *</Label>
                {loadingSupervisorCourses ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading courses…
                  </div>
                ) : supervisorCourses.length === 0 ? (
                  <p className="text-xs text-amber-600">No active courses for this instructor.</p>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5 max-h-48 overflow-y-auto">
                    {supervisorCourses.map((course) => {
                      const id = String(course.id)
                      const checked = form.course_ids.includes(id)
                      return (
                        <label
                          key={course.id}
                          className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCourseId(id)}
                            className="mt-1 rounded"
                          />
                          <span className="min-w-0">
                            <span className="font-medium text-slate-900 dark:text-white block">
                              {course.course_title}
                            </span>
                            <span className="text-xs text-slate-500">
                              {course.course_code}
                              {course.semester ? ` · ${course.semester}` : ""}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  TAs only see lectures, quizzes, and other modules for the courses you select here.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Full name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={isFacultyMode ? "Dr. Jane Smith" : isTaMode ? "Alex Johnson" : "Dr. Jane Smith"}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="jsmith"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="jsmith@university.edu"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                {editing ? "New password (optional)" : "Password"}
              </Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editing ? "Leave blank to unchanged" : FACULTY_DEFAULT_PASSWORD}
                className="rounded-xl"
              />
              {!editing && (
                <p className="text-xs text-slate-500">
                  Default for new faculty: <span className="font-mono">{FACULTY_DEFAULT_PASSWORD}</span> — they must
                  change it on first login.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="is_active" className="font-normal cursor-pointer">
                Account is active (can sign in)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-violet-600 hover:bg-violet-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Create account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toDelete && toDelete.role !== "ta" && toDelete.course_count > 0 ? "Deactivate account?" : "Remove account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && toDelete.role !== "ta" && toDelete.course_count > 0
                ? `${toDelete.name} owns ${toDelete.course_count} course(s). They will be deactivated but remain in the system.`
                : `${toDelete?.name} will be permanently deleted. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-xl bg-red-600 hover:bg-red-700"
            >
              {deleting
                ? "Working…"
                : toDelete && toDelete.role !== "ta" && toDelete.course_count > 0
                  ? "Deactivate"
                  : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
