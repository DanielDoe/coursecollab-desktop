"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  Loader2,
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
  Filter,
  GraduationCap,
  Building2,
  UserCog,
  Library,
  ExternalLink,
  ArrowRight,
  Layers,
} from "lucide-react"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { getAdminData } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { usePersistedState } from "@/hooks/use-persisted-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type CourseRow = {
  id: number
  course_code: string
  course_title: string
  semester: string | null
  university: string | null
  is_active: boolean
  instructor_id: number | null
  instructor_name: string | null
  instructor_username: string | null
  description: string | null
}

type CatalogView = {
  search: string
  status: "active" | "inactive" | "all"
  semester: string
  university: string
  assignment: "all" | "assigned" | "unassigned"
  sortBy: "title" | "code" | "semester" | "university"
  sortDir: "asc" | "desc"
  viewMode: "grid" | "list"
}

const DEFAULT_VIEW: CatalogView = {
  search: "",
  status: "active",
  semester: "all",
  university: "all",
  assignment: "all",
  sortBy: "title",
  sortDir: "asc",
  viewMode: "grid",
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
  const className = cn(
    "rounded-xl border px-4 py-3 text-left transition-colors w-full",
    active
      ? "border-violet-300 bg-violet-50/80 dark:border-violet-500/40 dark:bg-violet-950/30"
      : "border-slate-200/80 bg-background dark:border-white/10",
    onClick && "hover:bg-muted/40 cursor-pointer",
  )
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    )
  }
  return <div className={className}>{inner}</div>
}

export function AdminCourseCatalog() {
  const router = useRouter()
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = usePersistedState<CatalogView>("admin-course-catalog-view", DEFAULT_VIEW)

  const loadCourses = useCallback(async (status: CatalogView["status"]) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/courses?status=${status}`, {
        headers: buildAdminApiHeaders(),
      })
      if (!res.ok) throw new Error("Failed to load courses")
      const data = await res.json()
      setCourses((data.courses ?? []) as CourseRow[])
    } catch {
      setCourses([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const admin = getAdminData()
    if (!admin) {
      router.push("/admin/login")
      return
    }
    void loadCourses(view.status)
  }, [router, view.status, loadCourses])

  const semesters = useMemo(() => {
    const set = new Set<string>()
    for (const c of courses) {
      if (c.semester?.trim()) set.add(c.semester.trim())
    }
    return [...set].sort()
  }, [courses])

  const universities = useMemo(() => {
    const set = new Set<string>()
    for (const c of courses) {
      if (c.university?.trim()) set.add(c.university.trim())
    }
    return [...set].sort()
  }, [courses])

  const stats = useMemo(() => {
    const assigned = courses.filter((c) => c.instructor_id != null).length
    return {
      total: courses.length,
      assigned,
      unassigned: courses.length - assigned,
      active: courses.filter((c) => c.is_active).length,
    }
  }, [courses])

  const displayed = useMemo(() => {
    let items = [...courses]
    const q = view.search.trim().toLowerCase()
    if (q) {
      items = items.filter(
        (c) =>
          c.course_code.toLowerCase().includes(q) ||
          c.course_title.toLowerCase().includes(q) ||
          (c.semester?.toLowerCase().includes(q) ?? false) ||
          (c.university?.toLowerCase().includes(q) ?? false) ||
          (c.instructor_name?.toLowerCase().includes(q) ?? false) ||
          (c.instructor_username?.toLowerCase().includes(q) ?? false),
      )
    }
    if (view.semester !== "all") {
      items = items.filter((c) => c.semester === view.semester)
    }
    if (view.university !== "all") {
      items = items.filter((c) => c.university === view.university)
    }
    if (view.assignment === "assigned") {
      items = items.filter((c) => c.instructor_id != null)
    } else if (view.assignment === "unassigned") {
      items = items.filter((c) => c.instructor_id == null)
    }

    items.sort((a, b) => {
      let cmp = 0
      switch (view.sortBy) {
        case "code":
          cmp = a.course_code.localeCompare(b.course_code)
          break
        case "semester":
          cmp = (a.semester ?? "").localeCompare(b.semester ?? "")
          break
        case "university":
          cmp = (a.university ?? "").localeCompare(b.university ?? "")
          break
        default:
          cmp = a.course_title.localeCompare(b.course_title)
      }
      return view.sortDir === "desc" ? -cmp : cmp
    })
    return items
  }, [courses, view])

  const openInDashboard = (course: CourseRow) => {
    try {
      const raw = localStorage.getItem("adminSession")
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>
        s.selectedCourseId = course.id
        s.selectedCourseCode = course.course_code
        s.selectedCourseTitle = course.course_title
        localStorage.setItem("adminSession", JSON.stringify(s))
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("adminId", String(s.id ?? ""))
        }
        window.dispatchEvent(new Event("admin-course-scope-changed"))
      }
    } catch {
      /* ignore */
    }
    router.push("/admin/dashboard-v2")
  }

  const sortLabel =
    view.sortBy === "code"
      ? "Course code"
      : view.sortBy === "semester"
        ? "Semester"
        : view.sortBy === "university"
          ? "University"
          : "Title"

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1600px]">
      <div className="rounded-2xl border border-slate-200/80 bg-background dark:border-white/10">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground dark:border-white/10">
              <Library className="h-3.5 w-3.5" />
              Institution-wide
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Course Catalog</h1>
            <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
              Browse, search, and open courses in the admin portal. Assign staff and manage sections from
              related modules.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/dashboard-v2/management/sessions">
                <Layers className="h-4 w-4 mr-1.5" />
                Terms & sections
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/dashboard-v2/courses/assignments">
                <UserCog className="h-4 w-4 mr-1.5" />
                Assign instructors
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="In view"
          value={stats.total}
          icon={BookOpen}
          active={view.assignment === "all"}
          onClick={() => setView((v) => ({ ...v, assignment: "all" }))}
        />
        <StatCard
          label="With instructor"
          value={stats.assigned}
          icon={UserCog}
          active={view.assignment === "assigned"}
          onClick={() => setView((v) => ({ ...v, assignment: "assigned" }))}
        />
        <StatCard
          label="Unassigned"
          value={stats.unassigned}
          icon={GraduationCap}
          active={view.assignment === "unassigned"}
          onClick={() => setView((v) => ({ ...v, assignment: "unassigned" }))}
        />
        <StatCard label="Active (loaded)" value={stats.active} icon={Building2} />
      </div>

      <Card className="border-slate-200/80 dark:border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Find courses</CardTitle>
          <CardDescription>
            {displayed.length} of {courses.length} shown
            {view.search.trim() ? ` · matching “${view.search.trim()}”` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search code, title, semester, instructor…"
                value={view.search}
                onChange={(e) => setView((v) => ({ ...v, search: e.target.value }))}
                className="pl-9 h-10"
              />
            </div>

            <Select
              value={view.status}
              onValueChange={(val) =>
                setView((v) => ({ ...v, status: val as CatalogView["status"] }))
              }
            >
              <SelectTrigger className="w-full sm:w-[140px] h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All courses</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={view.semester}
              onValueChange={(val) => setView((v) => ({ ...v, semester: val }))}
            >
              <SelectTrigger className="w-full sm:w-[160px] h-10">
                <Filter className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All semesters</SelectItem>
                {semesters.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={view.university}
              onValueChange={(val) => setView((v) => ({ ...v, university: val }))}
            >
              <SelectTrigger className="w-full sm:w-[180px] h-10">
                <SelectValue placeholder="University" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All universities</SelectItem>
                {universities.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 gap-1.5">
                  <ArrowUpDown className="h-4 w-4" />
                  {sortLabel}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {(["title", "code", "semester", "university"] as const).map((key) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() =>
                      setView((v) => ({
                        ...v,
                        sortBy: key,
                        sortDir: v.sortBy === key && v.sortDir === "asc" ? "desc" : "asc",
                      }))
                    }
                    className="capitalize"
                  >
                    {key === "title" ? "Course title" : key}
                    {view.sortBy === key && (view.sortDir === "asc" ? " ↑" : " ↓")}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex rounded-lg border border-slate-200/80 dark:border-white/10 p-0.5 ml-auto">
              <Button
                type="button"
                variant={view.viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                className="h-9 px-3"
                onClick={() => setView((v) => ({ ...v, viewMode: "grid" }))}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant={view.viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-9 px-3"
                onClick={() => setView((v) => ({ ...v, viewMode: "list" }))}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
              Loading courses…
            </div>
          ) : displayed.length === 0 ? (
            <div className="rounded-xl border border-dashed py-14 text-center text-sm text-muted-foreground">
              {courses.length === 0
                ? "No courses match the current status filter."
                : "No courses match your search or filters."}
            </div>
          ) : view.viewMode === "list" ? (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead>University</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayed.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-sm font-medium">{c.course_code}</TableCell>
                      <TableCell className="max-w-[240px]">
                        <span className="line-clamp-2">{c.course_title}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {c.semester ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {c.university ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.instructor_name ? (
                          <div>
                            <div className="font-medium">{c.instructor_name}</div>
                            {c.instructor_username && (
                              <div className="text-xs text-muted-foreground">
                                @{c.instructor_username}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-200">
                            Unassigned
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.is_active ? "default" : "secondary"}>
                          {c.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openInDashboard(c)}>
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {displayed.map((c) => (
                <Card
                  key={c.id}
                  className="border-slate-200/80 dark:border-white/10 shadow-none hover:border-violet-200/80 dark:hover:border-violet-500/30 transition-colors"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <Badge variant={c.is_active ? "default" : "secondary"}>
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-mono">{c.course_code}</CardTitle>
                    <CardDescription className="line-clamp-2 min-h-[2.5rem]">
                      {c.course_title}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {c.semester && (
                        <p>
                          <span className="font-medium text-foreground/80">Semester:</span>{" "}
                          {c.semester}
                        </p>
                      )}
                      {c.university && <p>{c.university}</p>}
                      {c.instructor_name ? (
                        <p>
                          <span className="font-medium text-foreground/80">Instructor:</span>{" "}
                          {c.instructor_name}
                        </p>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-700">
                          No instructor assigned
                        </Badge>
                      )}
                    </div>
                    <Button
                      className="w-full gap-1.5"
                      variant="outline"
                      size="sm"
                      onClick={() => openInDashboard(c)}
                    >
                      Open in dashboard
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/admin/dashboard-v2/administration/roles-permissions"
          className="inline-flex items-center gap-1.5 text-violet-600 hover:underline dark:text-violet-400"
        >
          Roles & Permissions
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/admin/dashboard-v2/management/sessions"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          Sections & terms
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
