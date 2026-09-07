"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Shield,
  Users,
  Search,
  Plus,
  Loader2,
  ChevronRight,
  Sparkles,
  UserCog,
  GraduationCap,
  Building2,
  Eye,
  Settings2,
  Layers,
  Filter,
  Mail,
  SlidersHorizontal,
  CheckCircle2,
  Info,
  BookOpen,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { ROLE_HIERARCHY } from "@/lib/roles"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import type { PermissionCatalogEntry } from "@/lib/permission-grants"
import { useToast } from "@/components/ui/use-toast"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { getAdminData } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { initialsFromName } from "@/lib/initials-from-name"
import {
  ADDABLE_PRIMARY_ROLES,
  primaryRoleLabel,
  type DirectoryPrimaryRole,
} from "@/lib/user-directory"
import type { DirectoryUserRow } from "@/app/api/admin/users/directory/route"
import {
  TA_PERMISSION_KEYS,
  type TaPermissionKey,
  type TaPermissionSet,
} from "@/lib/ta-permissions"

const ROLE_BADGE: Record<string, string> = {
  PLATFORM_ADMIN: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  DEPARTMENT_ADMIN: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  INSTRUCTOR: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  TA: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  COURSE_OBSERVER: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  STUDENT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
}

const ROLE_META: Record<
  string,
  { icon: LucideIcon; accent: string; iconBg: string; filterKey: string }
> = {
  PLATFORM_ADMIN: {
    icon: Shield,
    accent: "border-violet-500/40 bg-violet-500/5",
    iconBg: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    filterKey: "PLATFORM_ADMIN",
  },
  DEPARTMENT_ADMIN: {
    icon: Building2,
    accent: "border-indigo-500/40 bg-indigo-500/5",
    iconBg: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    filterKey: "DEPARTMENT_ADMIN",
  },
  INSTRUCTOR: {
    icon: UserCog,
    accent: "border-emerald-500/40 bg-emerald-500/5",
    iconBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    filterKey: "INSTRUCTOR",
  },
  TA: {
    icon: Sparkles,
    accent: "border-sky-500/40 bg-sky-500/5",
    iconBg: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    filterKey: "TA",
  },
  COURSE_OBSERVER: {
    icon: Eye,
    accent: "border-amber-500/40 bg-amber-500/5",
    iconBg: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    filterKey: "COURSE_OBSERVER",
  },
  STUDENT: {
    icon: GraduationCap,
    accent: "border-slate-400/40 bg-slate-500/5",
    iconBg: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    filterKey: "STUDENT",
  },
}

const KIND_LABEL: Record<string, string> = {
  platform: "Platform account",
  faculty: "Faculty account",
  student: "Student account",
}

const PERMISSION_LABELS: Record<TaPermissionKey, string> = {
  canPublishAnnouncements: "Publish announcements",
  canPublishQuizzes: "Publish quizzes",
  canPublishHomework: "Publish homework",
  canGradeAssignments: "Grade assignments",
  canGradeExams: "Grade exams",
  canManageGroups: "Manage groups",
  canManageAttendance: "Manage attendance",
  canHoldOfficeHours: "Office hours",
  canViewAnalytics: "View analytics",
  canManagePracticeContent: "Practice content",
  canDraftAnnouncements: "Draft announcements",
  canTakeAttendance: "Take attendance",
  canModerateDiscussions: "Moderate discussions",
  canViewAssessments: "View assessments & question bank",
  canManageLectures: "Manage lectures",
  canManagePlayground: "Manage playground",
  canManageProjects: "Manage projects",
  canManageClassroomPoints: "Classroom points",
  canManageSyllabus: "Manage syllabus",
}

type RoleCatalogEntry = {
  code: string
  description: string
  uiLabel?: string
  permissions: string[]
}

type CourseOption = { id: number; course_code: string; course_title: string }

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", ROLE_BADGE[role])}>
      {primaryRoleLabel(role)}
    </Badge>
  )
}

function initials(name: string): string {
  return initialsFromName(name)
}

function UserAvatar({ user }: { user: DirectoryUserRow }) {
  const meta = ROLE_META[user.primaryRole] ?? ROLE_META.STUDENT
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white/80 dark:border-white/10 shadow-sm text-xs font-semibold tracking-tight",
        meta.iconBg,
      )}
    >
      {initials(user.displayName)}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  value: number
  icon: LucideIcon
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "text-left rounded-xl border bg-card/80 p-4 transition-all",
        "border-slate-200/80 dark:border-white/10",
        onClick && "hover:border-violet-300/60 hover:shadow-md dark:hover:border-violet-500/30 cursor-pointer",
        active && "ring-2 ring-violet-500/50 border-violet-400/50 shadow-md",
        !onClick && "cursor-default",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        </div>
      </div>
    </button>
  )
}

export function AdminRolesPermissionsHub() {
  const { toast } = useToast()
  const [users, setUsers] = useState<DirectoryUserRow[]>([])
  const [stats, setStats] = useState<{
    total: number
    filtered: number
    studentTotal: number
    byRole: Record<string, number>
  } | null>(null)
  const [catalog, setCatalog] = useState<RoleCatalogEntry[]>([])
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [instructors, setInstructors] = useState<{ id: number; name: string; username: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [kindFilter, setKindFilter] = useState("all")
  const [catalogFocus, setCatalogFocus] = useState<string>(ROLE_HIERARCHY[0])
  const [activeTab, setActiveTab] = useState("users")

  const [selected, setSelected] = useState<DirectoryUserRow | null>(null)
  const [editPrimaryRole, setEditPrimaryRole] = useState<DirectoryPrimaryRole>("INSTRUCTOR")
  const [editSupervisorId, setEditSupervisorId] = useState("")
  const [savingRole, setSavingRole] = useState(false)
  const [permCourseId, setPermCourseId] = useState("")
  const [taPerms, setTaPerms] = useState<TaPermissionSet | null>(null)
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [savingPerm, setSavingPerm] = useState(false)

  const [allPermissions, setAllPermissions] = useState<PermissionCatalogEntry[]>([])
  const [permState, setPermState] = useState<{
    inherited: string[]
    additional: string[]
    effective: string[]
  } | null>(null)
  const [loadingGrantState, setLoadingGrantState] = useState(false)
  const [permPickerOpen, setPermPickerOpen] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addRole, setAddRole] = useState<DirectoryPrimaryRole>("INSTRUCTOR")
  const [addForm, setAddForm] = useState({
    username: "",
    email: "",
    name: "",
    password: "",
    supervisorId: "",
  })
  const [adding, setAdding] = useState(false)

  const [newCourseId, setNewCourseId] = useState("")
  const [newStaffRole, setNewStaffRole] = useState("TA")

  const headers = useMemo(() => buildAdminApiHeaders(), [])

  const loadDirectory = useCallback(async () => {
    const admin = getAdminData()
    if (!admin) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        search: search.trim(),
        role: roleFilter,
        kind: kindFilter,
        includeStudents:
          kindFilter === "student" ||
          (kindFilter === "all" && (roleFilter === "ALL" || roleFilter === "STUDENT"))
            ? "1"
            : "0",
      })
      const res = await fetch(`/api/admin/users/directory?${params}`, { headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load users")
      setUsers(data.users ?? [])
      setStats(data.stats ?? null)
    } catch (e) {
      toast({
        title: "Could not load users",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, kindFilter, headers, toast])

  useEffect(() => {
    void loadDirectory()
  }, [loadDirectory])

  useEffect(() => {
    void fetch("/api/admin/users/role-catalog", { headers })
      .then((r) => r.json())
      .then((d) => setCatalog(d.roles ?? []))
      .catch(() => setCatalog([]))
    void fetch("/api/admin/courses", { headers })
      .then((r) => r.json())
      .then((d) => setCourses(d.courses ?? []))
      .catch(() => setCourses([]))
    void fetch("/api/admin/permissions", { headers })
      .then((r) => r.json())
      .then((d) => setAllPermissions(d.permissions ?? []))
      .catch(() => setAllPermissions([]))
    void fetch("/api/admin/instructors?role=instructor&status=active", { headers })
      .then((r) => r.json())
      .then((d) =>
        setInstructors(
          (d.instructors ?? []).map((i: { id: number; name: string; username: string }) => ({
            id: i.id,
            name: i.name,
            username: i.username,
          })),
        ),
      )
      .catch(() => setInstructors([]))
  }, [headers])

  const openUser = (user: DirectoryUserRow) => {
    setAddOpen(false)
    setSelected(user)
    setEditPrimaryRole(user.primaryRole)
    setEditSupervisorId("")
    setPermCourseId(user.courseAssignments[0]?.courseId ? String(user.courseAssignments[0].courseId) : "")
    setTaPerms(null)
    setPermState(null)
    setPermPickerOpen(false)
  }

  const loadPermissionGrants = useCallback(async () => {
    if (!selected || selected.userKind === "student") return
    if (selected.userKind === "faculty" && !permCourseId) {
      setPermState(null)
      return
    }
    setLoadingGrantState(true)
    try {
      const params = new URLSearchParams({
        userKind: selected.userKind,
        id: String(selected.id),
        primaryRole: selected.primaryRole,
      })
      if (selected.userKind === "faculty" && permCourseId) {
        params.set("courseId", permCourseId)
      }
      const res = await fetch(`/api/admin/users/permission-grants?${params}`, { headers })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPermState({
        inherited: data.inherited ?? [],
        additional: data.additional ?? [],
        effective: data.effective ?? [],
      })
    } catch {
      setPermState(null)
    } finally {
      setLoadingGrantState(false)
    }
  }, [selected, permCourseId, headers])

  const grantPermission = async (permissionCode: string, enabled: boolean) => {
    if (!selected || selected.userKind === "student") return
    if (selected.userKind === "faculty" && !permCourseId) {
      toast({
        title: "Select a course",
        description: "Choose a course before granting permissions.",
        variant: "destructive",
      })
      return
    }
    setSavingPerm(true)
    try {
      const res = await fetch("/api/admin/users/permission-grants", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          userKind: selected.userKind,
          id: selected.id,
          courseId: selected.userKind === "faculty" ? Number(permCourseId) : null,
          permissionCode,
          enabled,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPermState({
        inherited: data.inherited ?? [],
        additional: data.additional ?? [],
        effective: data.effective ?? [],
      })
      setPermPickerOpen(false)
      toast({ title: enabled ? "Permission granted" : "Permission removed" })
      if (selected.primaryRole === "TA" && permCourseId) {
        void loadTaPermissions(selected.id, Number(permCourseId))
      }
    } catch (e) {
      toast({
        title: "Could not update permission",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSavingPerm(false)
    }
  }

  const savePrimaryRole = async () => {
    if (!selected) return
    setSavingRole(true)
    try {
      const res = await fetch("/api/admin/users/update-role", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          userKind: selected.userKind,
          id: selected.id,
          primaryRole: editPrimaryRole,
          assignedInstructorId: editSupervisorId ? Number(editSupervisorId) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update failed")
      toast({ title: "Role updated", description: data.note })
      setSelected(null)
      void loadDirectory()
    } catch (e) {
      toast({
        title: "Could not update role",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSavingRole(false)
    }
  }

  const loadTaPermissions = useCallback(
    async (taId: number, courseId: number) => {
      setLoadingPerms(true)
      try {
        const res = await fetch(
          `/api/admin/users/ta-permissions?taId=${taId}&courseId=${courseId}`,
          { headers },
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setTaPerms(data.effective)
      } catch {
        setTaPerms(null)
      } finally {
        setLoadingPerms(false)
      }
    },
    [headers],
  )

  useEffect(() => {
    if (!selected || selected.primaryRole !== "TA" || !permCourseId) return
    void loadTaPermissions(selected.id, Number(permCourseId))
  }, [selected, permCourseId, loadTaPermissions])

  useEffect(() => {
    if (!selected || selected.userKind === "student") return
    void loadPermissionGrants()
  }, [selected, permCourseId, loadPermissionGrants])

  const toggleTaPerm = async (key: TaPermissionKey, value: boolean) => {
    if (!selected || !permCourseId) return
    setSavingPerm(true)
    try {
      const res = await fetch("/api/admin/users/ta-permissions", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          taId: selected.id,
          courseId: Number(permCourseId),
          permissions: { [key]: value },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTaPerms(data.effective)
      toast({ title: "Permission updated" })
      void loadDirectory()
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSavingPerm(false)
    }
  }

  const addCourseAssignment = async () => {
    if (!selected || selected.userKind !== "faculty" || !newCourseId) return
    try {
      const res = await fetch("/api/admin/users/course-staff", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorId: selected.id,
          courseId: Number(newCourseId),
          staffRole: newStaffRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: "Course assignment saved" })
      void loadDirectory()
      const updated = {
        ...selected,
        courseAssignments: [
          ...selected.courseAssignments,
          {
            courseId: Number(newCourseId),
            courseCode: courses.find((c) => c.id === Number(newCourseId))?.course_code ?? "",
            courseTitle: courses.find((c) => c.id === Number(newCourseId))?.course_title ?? "",
            staffRole: newStaffRole as DirectoryUserRow["courseAssignments"][0]["staffRole"],
          },
        ],
      }
      setSelected(updated)
    } catch (e) {
      toast({
        title: "Assignment failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const addableMeta = ADDABLE_PRIMARY_ROLES.find((r) => r.value === addRole)

  const handleAddUser = async () => {
    if (!addForm.username.trim() || !addForm.password.trim()) {
      toast({ title: "Username and password required", variant: "destructive" })
      return
    }
    setAdding(true)
    try {
      if (addableMeta?.userKind === "platform") {
        const res = await fetch("/api/admin/platform-users", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            username: addForm.username,
            password: addForm.password,
            email: addForm.email,
            primaryRole: addRole,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
      } else if (addableMeta?.userKind === "faculty") {
        const accountRole =
          addRole === "TA" ? "ta" : addRole === "DEPARTMENT_ADMIN" ? "department_admin" : "instructor"
        const res = await fetch("/api/admin/instructors", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            username: addForm.username,
            email: addForm.email,
            name: addForm.name,
            password: addForm.password,
            role: accountRole,
            assigned_instructor_id:
              accountRole === "ta" ? Number(addForm.supervisorId) : undefined,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        if (addRole === "COURSE_OBSERVER") {
          toast({
            title: "Account created",
            description: "Open the user to assign Observer on specific courses.",
          })
        }
      } else {
        toast({
          title: "Create students in Student Management",
          description: "Use the Students module for roster enrollment.",
        })
        setAddOpen(false)
        setAdding(false)
        return
      }
      toast({ title: "User created" })
      setAddOpen(false)
      setAddForm({ username: "", email: "", name: "", password: "", supervisorId: "" })
      void loadDirectory()
    } catch (e) {
      toast({
        title: "Could not create user",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setAdding(false)
    }
  }

  const focusedCatalog = catalog.find((c) => c.code === catalogFocus) ?? catalog[0]

  const applyRoleFilter = (role: string) => {
    setRoleFilter(role)
    setActiveTab("users")
    if (role === "STUDENT") setKindFilter("student")
    else if (role === "ALL") setKindFilter("all")
    else setKindFilter("all")
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1600px]">
      <div className="rounded-2xl border border-slate-200/80 bg-background dark:border-white/10">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50/80 px-3 py-1 text-xs font-medium text-violet-700 dark:border-violet-500/30 dark:bg-violet-950/50 dark:text-violet-300">
              <Layers className="h-3.5 w-3.5" />
              Six-role RBAC model
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Roles & Permissions
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
              Assign platform, faculty, and course roles. TA capabilities are customized per course —
              no Lead TA or Grader role codes.
            </p>
          </div>
          <Button
            onClick={() => {
              setSelected(null)
              setAddOpen(true)
            }}
            size="lg"
            className="shrink-0 gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20"
          >
            <Plus className="h-4 w-4" />
            Add user
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="All accounts"
            value={stats.total}
            icon={Users}
            active={roleFilter === "ALL" && kindFilter === "all"}
            onClick={() => applyRoleFilter("ALL")}
          />
          <StatCard
            label="Students"
            value={stats.studentTotal}
            icon={GraduationCap}
            active={roleFilter === "STUDENT"}
            onClick={() => {
              setKindFilter("student")
              setRoleFilter("STUDENT")
              setActiveTab("users")
            }}
          />
          <StatCard
            label="Platform admins"
            value={stats.byRole.PLATFORM_ADMIN ?? 0}
            icon={Shield}
            active={roleFilter === "PLATFORM_ADMIN"}
            onClick={() => applyRoleFilter("PLATFORM_ADMIN")}
          />
          <StatCard
            label="Instructors"
            value={stats.byRole.INSTRUCTOR ?? 0}
            icon={UserCog}
            active={roleFilter === "INSTRUCTOR"}
            onClick={() => applyRoleFilter("INSTRUCTOR")}
          />
          <StatCard
            label="Teaching assistants"
            value={stats.byRole.TA ?? 0}
            icon={Sparkles}
            active={roleFilter === "TA"}
            onClick={() => applyRoleFilter("TA")}
          />
          <StatCard
            label="Observers"
            value={stats.byRole.COURSE_OBSERVER ?? 0}
            icon={Eye}
            active={roleFilter === "COURSE_OBSERVER"}
            onClick={() => applyRoleFilter("COURSE_OBSERVER")}
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/50 p-1.5">
          <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-background">
            <Users className="h-4 w-4" />
            User directory
            {stats && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {stats.filtered}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="catalog" className="gap-2 data-[state=active]:bg-background">
            <BookOpen className="h-4 w-4" />
            Role reference
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card className="border-slate-200/80 dark:border-white/10 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-white/5 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">User directory</CardTitle>
                  <CardDescription className="mt-1">
                    {stats
                      ? `${stats.filtered} shown · ${stats.total} accounts in scope`
                      : "Search and manage roles"}
                  </CardDescription>
                </div>
                {(roleFilter !== "ALL" || kindFilter !== "all" || search) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRoleFilter("ALL")
                      setKindFilter("all")
                      setSearch("")
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search name, username, email…"
                    className="pl-9 h-10 rounded-lg bg-muted/30"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-[190px] h-10">
                      <Filter className="h-3.5 w-3.5 mr-2 opacity-60" />
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All roles</SelectItem>
                      <SelectItem value="PLATFORM_ADMIN">Platform Admin</SelectItem>
                      <SelectItem value="DEPARTMENT_ADMIN">Department Admin</SelectItem>
                      <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                      <SelectItem value="TA">Teaching Assistant</SelectItem>
                      <SelectItem value="COURSE_OBSERVER">Observer</SelectItem>
                      <SelectItem value="STUDENT">Student</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={kindFilter} onValueChange={setKindFilter}>
                    <SelectTrigger className="w-full sm:w-[170px] h-10">
                      <SlidersHorizontal className="h-3.5 w-3.5 mr-2 opacity-60" />
                      <SelectValue placeholder="Account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="platform">Platform</SelectItem>
                      <SelectItem value="faculty">Faculty</SelectItem>
                      <SelectItem value="student">Students</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {kindFilter === "all" && stats && stats.studentTotal > 50 && roleFilter === "ALL" && (
                <div className="flex gap-2 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Student roster is large ({stats.studentTotal}). Use account type{" "}
                    <strong>Students</strong> or click the Students stat card to load the paginated list.
                  </span>
                </div>
              )}

              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20">
                  <Loader2 className="h-9 w-9 animate-spin text-violet-500" />
                  <p className="text-sm text-muted-foreground">Loading directory…</p>
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <Users className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="font-medium">No users match your filters</p>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Try clearing filters or add a new user with the button above.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200/80 dark:border-white/10 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-[280px]">User</TableHead>
                        <TableHead>Primary role</TableHead>
                        <TableHead>Courses</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow
                          key={u.key}
                          className="group cursor-pointer hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
                          onClick={() => openUser(u)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <UserAvatar user={u} />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{u.displayName}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  @{u.username}
                                </div>
                                {u.email && (
                                  <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                    <Mail className="h-3 w-3 shrink-0" />
                                    {u.email}
                                  </div>
                                )}
                                <span className="text-[10px] text-muted-foreground mt-1 inline-block">
                                  {KIND_LABEL[u.userKind] ?? u.userKind}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <RoleBadge role={u.primaryRole} />
                              {u.hasPermissionOverrides && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-violet-300 text-violet-700 dark:text-violet-300"
                                >
                                  Customized
                                </Badge>
                              )}
                            </div>
                            {u.supervisorName && (
                              <p className="text-xs text-muted-foreground mt-1.5">
                                Supervisor: {u.supervisorName}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[220px]">
                            {u.courseAssignments.length === 0 ? (
                              <span className="text-xs text-muted-foreground">No course staff rows</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {u.courseAssignments.slice(0, 3).map((c) => (
                                  <Badge key={c.courseId} variant="outline" className="text-[10px] font-normal">
                                    {c.courseCode}
                                  </Badge>
                                ))}
                                {u.courseAssignments.length > 3 && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    +{u.courseAssignments.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={u.isActive ? "default" : "secondary"}
                              className={cn(
                                u.isActive &&
                                  "bg-emerald-600/90 hover:bg-emerald-600/90 dark:bg-emerald-700",
                              )}
                            >
                              {u.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="gap-1 opacity-80 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation()
                                openUser(u)
                              }}
                            >
                              Manage
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catalog" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
            <Card className="border-slate-200/80 dark:border-white/10 h-fit lg:sticky lg:top-4">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-600" />
                  Role hierarchy
                </CardTitle>
                <CardDescription>Highest privilege at top</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 pb-4">
                {ROLE_HIERARCHY.map((code, index) => {
                  const meta = ROLE_META[code]
                  const Icon = meta?.icon ?? Shield
                  const entry = catalog.find((c) => c.code === code)
                  const isActive = catalogFocus === code
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setCatalogFocus(code)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all",
                        isActive
                          ? cn("ring-2 ring-violet-500/40 shadow-sm", meta?.accent)
                          : "border-transparent hover:bg-muted/50",
                      )}
                    >
                      <div className="flex flex-col items-center gap-0.5 shrink-0 w-6">
                        <span className="text-[10px] font-mono text-muted-foreground">{index + 1}</span>
                        {index < ROLE_HIERARCHY.length - 1 && (
                          <span className="w-px h-4 bg-border" />
                        )}
                      </div>
                      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", meta?.iconBg)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{primaryRoleLabel(code)}</p>
                        <p className="text-[10px] font-mono text-muted-foreground truncate">{code}</p>
                      </div>
                      {entry && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {entry.permissions.length}
                        </Badge>
                      )}
                    </button>
                  )
                })}
              </CardContent>
            </Card>

            {focusedCatalog && (
              <Card className={cn("border shadow-sm", ROLE_META[focusedCatalog.code]?.accent)}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{primaryRoleLabel(focusedCatalog.code)}</CardTitle>
                      <p className="font-mono text-xs text-muted-foreground">{focusedCatalog.code}</p>
                    </div>
                    {focusedCatalog.uiLabel && (
                      <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                        Displayed as: {focusedCatalog.uiLabel}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-sm leading-relaxed pt-2">
                    {focusedCatalog.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
                    <span className="text-sm font-medium">Inherited permissions</span>
                    <Badge variant="secondary">{focusedCatalog.permissions.length} codes</Badge>
                  </div>
                  <ScrollArea className="h-[min(420px,50vh)] pr-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {focusedCatalog.permissions.map((p) => (
                        <div
                          key={p}
                          className="flex items-start gap-2 rounded-lg border border-slate-200/60 bg-background/60 px-3 py-2 dark:border-white/10"
                        >
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                          <code className="text-[11px] leading-snug break-all">{p}</code>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  {focusedCatalog.code === "TA" && (
                    <div className="rounded-lg border border-sky-200/80 bg-sky-50/50 px-4 py-3 text-xs text-sky-900 dark:border-sky-500/30 dark:bg-sky-950/30 dark:text-sky-200">
                      TAs inherit these defaults; instructors override per course in the user Manage panel.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

        </TabsContent>
      </Tabs>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl max-h-[100dvh]">
          {selected && (
            <>
              <div className="shrink-0 border-b bg-muted/30 px-6 py-6 pr-14">
                <div className="flex items-start gap-4">
                  <UserAvatar user={selected} />
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-xl">{selected.displayName}</SheetTitle>
                    <SheetDescription className="mt-1">
                      @{selected.username} · {KIND_LABEL[selected.userKind]}
                    </SheetDescription>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <RoleBadge role={selected.primaryRole} />
                      <Badge variant={selected.isActive ? "default" : "secondary"}>
                        {selected.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-6">
                <Card className="border-slate-200/80 dark:border-white/10 shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Primary role</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                  <Select
                    value={editPrimaryRole}
                    onValueChange={(v) => setEditPrimaryRole(v as DirectoryPrimaryRole)}
                    disabled={selected.userKind === "student"}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selected.userKind === "platform" && (
                        <>
                          <SelectItem value="PLATFORM_ADMIN">Platform Administrator</SelectItem>
                          <SelectItem value="DEPARTMENT_ADMIN">Department Administrator</SelectItem>
                        </>
                      )}
                      {selected.userKind === "faculty" && (
                        <>
                          <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                          <SelectItem value="TA">Teaching Assistant</SelectItem>
                          <SelectItem value="COURSE_OBSERVER">Observer (course-scoped)</SelectItem>
                        </>
                      )}
                      {selected.userKind === "student" && (
                        <SelectItem value="STUDENT">Student</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {editPrimaryRole === "TA" && selected.userKind === "faculty" && (
                    <div>
                      <Label className="text-xs">Supervising instructor</Label>
                      <Select value={editSupervisorId} onValueChange={setEditSupervisorId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select instructor" />
                        </SelectTrigger>
                        <SelectContent>
                          {instructors.map((i) => (
                            <SelectItem key={i.id} value={String(i.id)}>
                              {i.name} ({i.username})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                    <Button
                      className="w-full bg-violet-600 hover:bg-violet-700"
                      onClick={() => void savePrimaryRole()}
                      disabled={savingRole}
                    >
                      {savingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save role"}
                    </Button>
                  </CardContent>
                </Card>

                {selected.userKind !== "student" && (
                  <Card className="border-slate-200/80 dark:border-white/10 shadow-none">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-sm font-medium">Permissions</CardTitle>
                          <CardDescription>
                            Inherited from role defaults; add extras from the system catalog.
                          </CardDescription>
                        </div>
                        {permState && (
                          <Popover open={permPickerOpen} onOpenChange={setPermPickerOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="shrink-0 gap-1"
                                disabled={
                                  savingPerm ||
                                  loadingGrantState ||
                                  (selected.userKind === "faculty" && !permCourseId)
                                }
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Add
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[min(360px,calc(100vw-2rem))] p-0 z-[70]"
                              align="end"
                            >
                              <Command>
                                <CommandInput placeholder="Search permissions…" />
                                <CommandList className="max-h-64">
                                  <CommandEmpty>No permissions available to add.</CommandEmpty>
                                  <CommandGroup>
                                    {allPermissions
                                      .filter(
                                        (p) => !permState.effective.includes(p.code),
                                      )
                                      .map((p) => (
                                        <CommandItem
                                          key={p.code}
                                          value={`${p.code} ${p.description ?? ""}`}
                                          onSelect={() => void grantPermission(p.code, true)}
                                        >
                                          <div className="flex flex-col gap-0.5 min-w-0">
                                            <code className="text-xs font-medium">{p.code}</code>
                                            {p.description && (
                                              <span className="text-[11px] text-muted-foreground line-clamp-2">
                                                {p.description}
                                              </span>
                                            )}
                                          </div>
                                        </CommandItem>
                                      ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selected.userKind === "faculty" && selected.courseAssignments.length > 0 && (
                        <div>
                          <Label className="text-xs">Course scope</Label>
                          <Select value={permCourseId} onValueChange={setPermCourseId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select course" />
                            </SelectTrigger>
                            <SelectContent>
                              {selected.courseAssignments.map((c) => (
                                <SelectItem key={c.courseId} value={String(c.courseId)}>
                                  {c.courseCode}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {selected.userKind === "faculty" &&
                        selected.courseAssignments.length === 0 && (
                          <p className="text-xs text-muted-foreground rounded-lg border border-dashed px-3 py-2">
                            Assign this user to a course before granting extra permissions.
                          </p>
                        )}
                      {loadingGrantState ? (
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-violet-500" />
                      ) : permState ? (
                        <>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Inherited ({permState.inherited.length})
                            </p>
                            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                              {permState.inherited.length === 0 ? (
                                <span className="text-xs text-muted-foreground">None</span>
                              ) : (
                                permState.inherited.map((p) => (
                                  <Badge
                                    key={p}
                                    variant="outline"
                                    className="text-[10px] font-normal"
                                  >
                                    {p}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Additional grants ({permState.additional.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {permState.additional.length === 0 ? (
                                <span className="text-xs text-muted-foreground">
                                  None — use Add to grant permissions beyond the role.
                                </span>
                              ) : (
                                permState.additional.map((p) => (
                                  <Badge
                                    key={p}
                                    variant="secondary"
                                    className="text-[10px] font-normal gap-1 pr-1"
                                  >
                                    {p}
                                    <button
                                      type="button"
                                      className="rounded-full p-0.5 hover:bg-muted"
                                      aria-label={`Remove ${p}`}
                                      disabled={savingPerm}
                                      onClick={() => void grantPermission(p, false)}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {permState.effective.length} effective permission
                            {permState.effective.length === 1 ? "" : "s"} ·{" "}
                            {allPermissions.length} in system catalog
                          </p>
                        </>
                      ) : null}
                    </CardContent>
                  </Card>
                )}

                {selected.userKind === "faculty" && (
                  <Card className="border-slate-200/80 dark:border-white/10 shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Settings2 className="h-4 w-4" />
                        Course assignments
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selected.courseAssignments.map((c) => (
                        <div
                          key={c.courseId}
                          className="flex justify-between items-center text-sm rounded-lg border bg-muted/20 px-3 py-2.5"
                        >
                          <span className="font-medium">{c.courseCode}</span>
                          <RoleBadge role={c.staffRole} />
                        </div>
                      ))}
                      <div className="flex gap-2 flex-wrap pt-1">
                      <Select value={newCourseId} onValueChange={setNewCourseId}>
                        <SelectTrigger className="flex-1 min-w-[140px]">
                          <SelectValue placeholder="Course" />
                        </SelectTrigger>
                        <SelectContent>
                          {courses.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.course_code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={newStaffRole} onValueChange={setNewStaffRole}>
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INSTRUCTOR">Instructor</SelectItem>
                          <SelectItem value="TA">TA</SelectItem>
                          <SelectItem value="COURSE_OBSERVER">Observer</SelectItem>
                        </SelectContent>
                      </Select>
                        <Button type="button" onClick={() => void addCourseAssignment()}>
                          Add assignment
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selected.primaryRole === "TA" && selected.courseAssignments.length > 0 && (
                  <Card className="border-slate-200/80 dark:border-white/10 shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">TA permission overrides</CardTitle>
                      <CardDescription>Per-course toggles beyond role defaults</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                    <Select value={permCourseId} onValueChange={setPermCourseId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Course" />
                      </SelectTrigger>
                      <SelectContent>
                        {selected.courseAssignments.map((c) => (
                          <SelectItem key={c.courseId} value={String(c.courseId)}>
                            {c.courseCode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                      {loadingPerms ? (
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      ) : (
                        taPerms && (
                          <div className="divide-y rounded-xl border overflow-hidden">
                            {TA_PERMISSION_KEYS.map((key) => (
                              <div
                                key={key}
                                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm bg-background"
                              >
                                <span>{PERMISSION_LABELS[key]}</span>
                                <Switch
                                  checked={taPerms[key]}
                                  disabled={savingPerm}
                                  onCheckedChange={(v) => void toggleTaPerm(key, v)}
                                />
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </CardContent>
                  </Card>
                )}

                {selected.userKind === "student" && (
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/admin/dashboard-v2/management/students">
                      Open Student Management
                    </Link>
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (open) setSelected(null)
        }}
      >
        <DialogContent className="z-[60] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Choose a role first — permissions inherit automatically. Customize later from the user
              directory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Role</Label>
              <Select
                value={addRole}
                onValueChange={(v) => setAddRole(v as DirectoryPrimaryRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADDABLE_PRIMARY_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {ADDABLE_PRIMARY_ROLES.find((r) => r.value === addRole)?.description}
              </p>
            </div>
            {addRole !== "STUDENT" && (
              <>
                <div>
                  <Label>Username</Label>
                  <Input
                    value={addForm.username}
                    onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
                  />
                </div>
                {(addRole === "INSTRUCTOR" ||
                  addRole === "TA" ||
                  addRole === "COURSE_OBSERVER") && (
                  <div>
                    <Label>Full name</Label>
                    <Input
                      value={addForm.name}
                      onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                )}
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={addForm.password}
                    onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </div>
                {addRole === "TA" && (
                  <div>
                    <Label>Supervising instructor</Label>
                    <Select
                      value={addForm.supervisorId}
                      onValueChange={(v) => setAddForm((f) => ({ ...f, supervisorId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {instructors.map((i) => (
                          <SelectItem key={i.id} value={String(i.id)}>
                            {i.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleAddUser()} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
