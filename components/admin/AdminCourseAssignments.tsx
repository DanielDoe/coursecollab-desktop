"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, Loader2, Save, Search, UserCog } from "lucide-react"
import { buildAdminApiHeaders } from "@/lib/admin-api-headers"
import { getAdminData } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"

type CourseRow = {
  id: number
  course_code: string
  course_title: string
  semester: string | null
  instructor_id: number | null
  instructor_name: string | null
}

type TermRow = {
  id: number
  year: number
  term: string
  courses?: { id: number; course_code: string; course_title: string }[]
}

type OfferingRow = CourseRow & {
  term_label: string
  term_id: number | null
  row_key: string
}

type InstructorOption = { id: number; name: string; username: string }

function formatTermLabel(year: number, term: string) {
  return `${String(term).trim()} ${year}`
}

function buildOfferings(courses: CourseRow[], terms: TermRow[]): OfferingRow[] {
  const courseById = new Map(courses.map((c) => [c.id, c]))
  const offeredCourseIds = new Set<number>()
  const offerings: OfferingRow[] = []

  for (const term of terms) {
    const termLabel = formatTermLabel(term.year, term.term)
    for (const tc of term.courses ?? []) {
      const course = courseById.get(tc.id)
      if (!course) continue
      offeredCourseIds.add(course.id)
      offerings.push({
        ...course,
        term_label: termLabel,
        term_id: term.id,
        row_key: `${course.id}-${term.id}`,
      })
    }
  }

  for (const course of courses) {
    if (offeredCourseIds.has(course.id)) continue
    offerings.push({
      ...course,
      term_label: "Not scheduled",
      term_id: null,
      row_key: `${course.id}-none`,
    })
  }

  return offerings.sort((a, b) => {
    const termCmp = a.term_label.localeCompare(b.term_label)
    if (termCmp !== 0) return termCmp
    return a.course_code.localeCompare(b.course_code)
  })
}

function termBadgeClass(label: string) {
  if (label.includes("Fall"))
    return "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-500/25 dark:bg-amber-950/30 dark:text-amber-200"
  if (label.includes("Spring"))
    return "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-950/30 dark:text-emerald-200"
  if (label.includes("Summer"))
    return "border-sky-200/80 bg-sky-50 text-sky-800 dark:border-sky-500/25 dark:bg-sky-950/30 dark:text-sky-200"
  return "border-slate-200/80 text-muted-foreground dark:border-white/10"
}

export function AdminCourseAssignments({ embedInDashboard }: { embedInDashboard?: boolean }) {
  const router = useRouter()
  const { toast } = useToast()
  const headers = useMemo(() => buildAdminApiHeaders(), [])

  const [courses, setCourses] = useState<CourseRow[]>([])
  const [offerings, setOfferings] = useState<OfferingRow[]>([])
  const [instructors, setInstructors] = useState<InstructorOption[]>([])
  const [draft, setDraft] = useState<Record<number, string>>({})
  const [search, setSearch] = useState("")
  const [termFilter, setTermFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [coursesRes, instRes, termsRes] = await Promise.all([
        fetch("/api/admin/courses?status=active", { headers }),
        fetch("/api/admin/instructors?role=instructor&status=active", { headers }),
        fetch("/api/admin/academic-terms", { headers }),
      ])
      const coursesData = await coursesRes.json()
      const instData = await instRes.json()
      const termsData = await termsRes.json()
      if (!coursesRes.ok) throw new Error(coursesData.error || "Failed to load courses")
      if (!instRes.ok) throw new Error(instData.error || "Failed to load instructors")
      if (!termsRes.ok) throw new Error(termsData.error || "Failed to load academic terms")

      const list = (coursesData.courses ?? []) as CourseRow[]
      const terms = (termsData.terms ?? []) as TermRow[]
      setCourses(list)
      setOfferings(buildOfferings(list, terms))
      setInstructors(
        (instData.instructors ?? []).map((i: InstructorOption) => ({
          id: i.id,
          name: i.name,
          username: i.username,
        })),
      )
      const initial: Record<number, string> = {}
      for (const c of list) {
        initial[c.id] = c.instructor_id != null ? String(c.instructor_id) : "none"
      }
      setDraft(initial)
    } catch (e) {
      toast({
        title: "Could not load assignments",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [headers, toast])

  useEffect(() => {
    const admin = getAdminData()
    if (!admin) {
      router.push("/admin/login")
      return
    }
    void load()
  }, [router, load])

  const termOptions = useMemo(
    () => [...new Set(offerings.map((o) => o.term_label))].sort(),
    [offerings],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return offerings.filter((o) => {
      if (termFilter !== "all" && o.term_label !== termFilter) return false
      if (!q) return true
      return (
        o.course_code.toLowerCase().includes(q) ||
        o.course_title.toLowerCase().includes(q) ||
        o.term_label.toLowerCase().includes(q) ||
        (o.instructor_name?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [offerings, search, termFilter])

  const unassignedCount = courses.filter((c) => c.instructor_id == null).length

  const saveAssignment = async (courseId: number) => {
    const value = draft[courseId] ?? "none"
    const instructor_id = value === "none" ? null : Number(value)
    setSavingId(courseId)
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ instructor_id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      toast({ title: "Assignment saved", description: `${data.course.course_code} updated` })
      const patch = (c: CourseRow) =>
        c.id === courseId
          ? { ...c, instructor_id: data.course.instructor_id, instructor_name: data.course.instructor_name }
          : c
      setCourses((prev) => prev.map(patch))
      setOfferings((prev) => prev.map((o) => (o.id === courseId ? patch(o) : o)))
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSavingId(null)
    }
  }

  const shellClass = embedInDashboard ? "" : "min-h-screen bg-slate-50 dark:bg-slate-950 p-6"

  return (
    <div className={cn(shellClass, "w-full min-w-0 space-y-6")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <UserCog className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
            Course Assignments
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Assign a primary instructor to each course offering. TA access is managed in{" "}
            <Link
              href="/admin/dashboard-v2/administration/roles-permissions"
              className="text-violet-600 hover:underline dark:text-violet-400"
            >
              Roles & Permissions
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild className="rounded-xl">
            <Link href="/admin/dashboard-v2/courses/catalog">
              <BookOpen className="h-4 w-4 mr-1.5" />
              Catalog
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="rounded-xl">
            <Link href="/admin/dashboard-v2/management/sessions">Terms & sections</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search code, title, term…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={termFilter} onValueChange={setTermFilter}>
            <SelectTrigger className="w-[180px] rounded-xl">
              <SelectValue placeholder="All terms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All terms</SelectItem>
              {termOptions.map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-slate-500 dark:text-slate-400 tabular-nums">
            {filtered.length} of {offerings.length} offerings
            {unassignedCount > 0 ? ` · ${unassignedCount} unassigned` : ""}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/15 p-12 text-center">
          <UserCog className="h-10 w-10 mx-auto text-slate-400 mb-3" />
          <p className="font-medium text-slate-800 dark:text-slate-200">No offerings match your filters</p>
          <p className="text-sm text-slate-500 mt-1">Try a different search or term filter.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden bg-white/80 dark:bg-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 text-left">
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold w-[140px]">Term</th>
                  <th className="px-4 py-3 font-semibold">Primary instructor</th>
                  <th className="px-4 py-3 font-semibold text-right w-[100px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const dirty =
                    (draft[c.id] ?? "none") !==
                    (c.instructor_id != null ? String(c.instructor_id) : "none")
                  return (
                    <tr
                      key={c.row_key}
                      className={cn(
                        "border-b border-slate-100 dark:border-white/5 last:border-0",
                        dirty && "bg-violet-50/60 dark:bg-violet-950/20",
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-white">{c.course_code}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{c.course_title}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-normal", termBadgeClass(c.term_label))}
                        >
                          {c.term_label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={draft[c.id] ?? "none"}
                          onValueChange={(v) => setDraft((d) => ({ ...d, [c.id]: v }))}
                        >
                          <SelectTrigger className="w-full max-w-md rounded-xl">
                            <SelectValue placeholder="Select instructor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Unassigned —</SelectItem>
                            {instructors.map((i) => (
                              <SelectItem key={i.id} value={String(i.id)}>
                                {i.name} (@{i.username})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={dirty ? "default" : "ghost"}
                          className={cn("rounded-xl", dirty && "bg-violet-600 hover:bg-violet-700")}
                          disabled={!dirty || savingId === c.id}
                          onClick={() => void saveAssignment(c.id)}
                        >
                          {savingId === c.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-1.5" />
                              Save
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
