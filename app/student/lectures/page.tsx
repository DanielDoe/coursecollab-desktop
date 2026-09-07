"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { GraduationCap, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { StudentProfileDropdown } from "@/components/student-profile-dropdown"
import { Button } from "@/components/ui/button"
import { StudentLecturesViewer } from "@/components/student-lectures-viewer"
import { useSmartHomeLink } from "@/hooks/useSmartHomeLink"

export default function StudentLecturesPage() {
  const router = useRouter()
  const homeLink = useSmartHomeLink()
  const [studentName, setStudentName] = useState("")
  const [studentSection, setStudentSection] = useState("")

  useEffect(() => {
    const id = sessionStorage.getItem("studentId")
    const name = sessionStorage.getItem("studentName")
    const section = sessionStorage.getItem("studentSection")

    if (!id) {
      router.push("/student/login")
      return
    }

    setStudentName(name || "")
    setStudentSection(section || "")
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-border dark:border-slate-700 bg-background dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <Link href={homeLink} className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
              <GraduationCap className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 text-[var(--cc-accent-dark)] shrink-0" />
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-[var(--cc-accent-dark)]">CourseCollab</h1>
            </Link>
            <StudentProfileDropdown />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 max-w-7xl">
        <StudentLecturesViewer />
      </main>
    </div>
  )
}
