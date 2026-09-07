"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSessionCatalog } from "@/components/session-catalog-provider"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { facultyToolbarFilterButtonClass } from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  MessageSquare,
  Mail,
  MoreHorizontal,
  Filter,
  Users,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { CoraSectionTools } from "@/components/instructor/administration/CoraSectionTools"

interface StudentActivity {
  id: number
  full_name: string
  student_id: string
  session_code: string
  questions_asked: number
  last_active: string
  avg_satisfaction: number
  weak_topics: string[]
  trend: "up" | "down" | "stable"
}

export function AITutorStudents({
  embedInDashboard,
  searchQuery: externalSearch = "",
}: {
  embedInDashboard?: boolean
  searchQuery?: string
} = {}) {
  const { toast } = useToast()
  const { selectOptions, labelByCode } = useSessionCatalog()
  const [students, setStudents] = useState<StudentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [internalSearch, setInternalSearch] = useState("")
  const [filterSection, setFilterSection] = useState("all")

  const searchQuery = internalSearch || externalSearch

  useEffect(() => {
    void fetchStudentActivity()
  }, [])

  const fetchStudentActivity = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/ai-tutor/student-activity", {
        headers: buildInstructorApiHeaders(),
      })
      const data = await response.json()
      if (response.ok) setStudents(data.students || [])
    } catch {
      toast({
        title: "Error",
        description: "Failed to load student activity data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredStudents = students.filter((student) => {
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      !q ||
      student.full_name.toLowerCase().includes(q) ||
      student.student_id.toLowerCase().includes(q)
    const matchesSection = filterSection === "all" || student.session_code === filterSection
    return matchesSearch && matchesSection
  })

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-[var(--cc-sem-success)]" />
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-[var(--cc-sem-danger)]" />
    return <Minus className="h-4 w-4 text-[var(--cc-text-muted)]" />
  }

  if (loading) {
    if (embedInDashboard) {
      return <InstructorPolicyLoadingState moduleId="ai-assistant-settings" label="Loading student activity…" />
    }
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white/85 p-12 text-center dark:border-slate-700/60 dark:bg-slate-800/85">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-purple-600" />
        <p className="text-slate-600 dark:text-slate-400">Loading student activity...</p>
      </div>
    )
  }

  const sectionFilter = embedInDashboard ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" className={cn(facultyToolbarFilterButtonClass(), "h-8 gap-1.5 text-xs")}>
          <Filter className="h-3.5 w-3.5" />
          {filterSection === "all" ? "All sections" : (labelByCode.get(filterSection) ?? filterSection)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => setFilterSection("all")}>All sections</DropdownMenuItem>
        {selectOptions.map(({ value, label }) => (
          <DropdownMenuItem key={value} onClick={() => setFilterSection(value)}>
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null

  const tableBody = (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={embedInDashboard ? "text-[var(--cc-text-muted)]" : undefined}>Student</TableHead>
          <TableHead className={embedInDashboard ? "text-[var(--cc-text-muted)]" : undefined}>Section</TableHead>
          <TableHead className={cn("text-center", embedInDashboard && "text-[var(--cc-text-muted)]")}>
            Questions
          </TableHead>
          <TableHead className={cn("text-center", embedInDashboard && "text-[var(--cc-text-muted)]")}>
            Rating
          </TableHead>
          <TableHead className={cn("text-center", embedInDashboard && "text-[var(--cc-text-muted)]")}>Trend</TableHead>
          <TableHead className={embedInDashboard ? "text-[var(--cc-text-muted)]" : undefined}>Last active</TableHead>
          <TableHead className={cn("text-right", embedInDashboard && "text-[var(--cc-text-muted)]")}>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredStudents.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className={cn("py-12 text-center", embedInDashboard && PORTAL_TEXT_MUTED)}>
              No students found
            </TableCell>
          </TableRow>
        ) : (
          filteredStudents.map((student) => (
            <TableRow
              key={student.id}
              className={embedInDashboard ? "hover:bg-[var(--sidebar-accent)]/25" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}
            >
              <TableCell>
                <div>
                  <div className={cn("font-medium", embedInDashboard ? PORTAL_TEXT : "text-slate-900 dark:text-slate-100")}>
                    {student.full_name}
                  </div>
                  <div className={cn("text-xs", embedInDashboard ? PORTAL_TEXT_MUTED : "text-slate-500")}>
                    {student.student_id}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="border-[var(--cc-accent)]/30 font-normal">
                  {student.session_code}
                </Badge>
              </TableCell>
              <TableCell className="text-center tabular-nums">{student.questions_asked}</TableCell>
              <TableCell className="text-center tabular-nums">
                {student.avg_satisfaction.toFixed(1)}
                <span className={cn("text-xs", PORTAL_TEXT_MUTED)}> /5</span>
              </TableCell>
              <TableCell className="text-center">{getTrendIcon(student.trend)}</TableCell>
              <TableCell className={cn("text-sm", embedInDashboard ? PORTAL_TEXT_MUTED : "text-slate-600 dark:text-slate-400")}>
                {student.last_active}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Eye className="mr-2 h-4 w-4" />
                      View details
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      View chats
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Mail className="mr-2 h-4 w-4" />
                      Email student
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )

  if (embedInDashboard) {
    return (
      <div className="space-y-4">
        <CoraSectionTools
          search={internalSearch}
          onSearchChange={setInternalSearch}
          searchPlaceholder="Search students…"
          trailing={sectionFilter}
          meta={`${filteredStudents.length} opted-in student${filteredStudents.length === 1 ? "" : "s"}`}
        />
        <InstructorPolicySurfaceCard
          variant="section"
          title="Student activity"
          description="Named activity only appears when a student shares Cora summaries"
        >
          <div className="-mx-1 overflow-x-auto">{tableBody}</div>
        </InstructorPolicySurfaceCard>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/60 bg-white/85 p-5 dark:border-slate-700/60 dark:bg-slate-800/85">
        <p className="text-sm text-slate-600">Legacy view — open from faculty dashboard for full toolbar.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/85 dark:border-slate-700/60 dark:bg-slate-800/85">
        <div className="flex items-center gap-2 border-b border-slate-200 p-5 dark:border-slate-700">
          <Users className="h-5 w-5" />
          <span className="font-semibold">Student Activity ({filteredStudents.length})</span>
        </div>
        {tableBody}
      </div>
    </div>
  )
}
