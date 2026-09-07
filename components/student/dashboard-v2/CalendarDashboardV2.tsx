"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarDays, ListTree } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getStudentData } from "@/lib/auth"
import { StudentCalendar } from "@/components/student-calendar"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"

export function CalendarDashboardV2() {
  const router = useRouter()
  const [studentId, setStudentId] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const student = getStudentData()
    if (!student) {
      router.push("/student/login")
      return
    }
    setStudentId(student.databaseId?.toString() || "")
    setMounted(true)
  }, [router])

  const headerAction = useMemo(
    () => (
      <Button asChild variant="ghost" size="sm" className="h-9 rounded-xl px-3">
        <Link href="/student/dashboard-v2/timeline">
          <ListTree className="h-4 w-4 mr-1.5" />
          Semester timeline
        </Link>
      </Button>
    ),
    [],
  )

  return (
    <StudentModuleHubLayout
      moduleId="calendar"
      title="Calendar"
      metaLine="Personal events, class schedule, and deadlines"
      metaSuffix="plan your week"
      hideSideMenu
      loading={!mounted || !studentId}
      headerAction={headerAction}
      menuView="calendar"
      onMenuSelect={() => {}}
      menuItems={[{ id: "calendar", label: "Calendar", icon: CalendarDays }]}
    >
      {studentId ? <StudentCalendar studentId={studentId} embedInDashboard hubLayout /> : null}
    </StudentModuleHubLayout>
  )
}
