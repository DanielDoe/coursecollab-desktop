"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { CourseSyllabusPanel } from "@/components/syllabus/CourseSyllabusPanel"
import { Button } from "@/components/ui/button"
import { getInstructorData } from "@/lib/auth"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"

type PageProps = {
  params: Promise<{ courseId: string }>
}

export default function CourseSyllabusPage({ params }: PageProps) {
  const { courseId: courseIdRaw } = use(params)
  const courseId = Number(courseIdRaw)
  const router = useRouter()
  const [mode, setMode] = useState<"student" | "instructor" | null>(null)
  const [studentId, setStudentId] = useState("")

  useEffect(() => {
    const instructor = getInstructorData()
    if (instructor?.selectedCourseId && Number(instructor.selectedCourseId) === courseId) {
      setMode("instructor")
      return
    }

    const studentSession = localStorage.getItem("studentSession")
    if (!studentSession) {
      router.push("/student/login")
      return
    }

    try {
      const session = JSON.parse(studentSession)
      const databaseId =
        sessionStorage.getItem("studentDatabaseId") ||
        session.databaseId?.toString() ||
        session.id?.toString() ||
        ""
      setStudentId(databaseId)
      setMode("student")
    } catch {
      router.push("/student/login")
    }
  }, [courseId, router])

  if (!Number.isFinite(courseId) || mode == null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    )
  }

  const apiBase = `/api/courses/${courseId}/syllabus`

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href={mode === "instructor" ? "/faculty/dashboard/content/syllabus" : "/student/dashboard-v2/syllabus"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>
      </div>
      <CourseSyllabusPanel
        courseId={courseId}
        mode={mode}
        fetchUrl={apiBase}
        saveUrl={mode === "instructor" ? apiBase : undefined}
        studentId={studentId}
        buildHeaders={() => {
          if (mode === "instructor") return buildInstructorApiHeaders()
          return studentId ? { "x-student-id": studentId } : {}
        }}
      />
    </div>
  )
}
