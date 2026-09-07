"use client"

import { Suspense, use, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { StudentLectureShell } from "@/components/student-lecture-shell"
import { getStudentData, studentApiFetch } from "@/lib/auth"
import { getStudentLoginId, resolveStudentCourseIdForLectures } from "@/lib/student-session-ids"
import { Loader2 } from "lucide-react"

interface PageProps {
  params: Promise<{ week: string }>
}

function LectureWeekLegacyContent({ week }: { week: string }) {
  const searchParams = useSearchParams()
  const lectureId = searchParams.get("lectureId")
  const [lecture, setLecture] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [studentId, setStudentId] = useState<number | null>(null)

  useEffect(() => {
    const session = getStudentData()
    const fromSession =
      session?.databaseId != null && session.databaseId !== ""
        ? parseInt(String(session.databaseId), 10)
        : NaN
    if (Number.isFinite(fromSession)) {
      setStudentId(fromSession)
    } else {
      const legacy = sessionStorage.getItem("studentDatabaseId")
      if (legacy) {
        const n = parseInt(legacy, 10)
        if (Number.isFinite(n)) setStudentId(n)
      }
    }
  }, [])

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true)
        setError(null)
        const sid = getStudentLoginId()

        if (lectureId && sid) {
          const res = await fetch(
            `/api/student/lectures/${lectureId}/content?studentId=${encodeURIComponent(sid)}`,
          )
          if (!res.ok) throw new Error("Failed to load lecture")
          setLecture(await res.json())
          return
        }

        const qs = new URLSearchParams()
        if (lectureId) qs.set("lectureId", lectureId)
        if (sid) qs.set("studentId", sid)
        const courseId = await resolveStudentCourseIdForLectures()
        if (courseId != null) qs.set("courseId", String(courseId))
        const res = await studentApiFetch(`/api/lectures/by-week/${week}${qs.toString() ? `?${qs}` : ""}`)
        if (!res.ok) throw new Error("Failed to load lecture")
        setLecture(await res.json())
      } catch (err) {
        console.error("Error loading lecture:", err)
        setError("Failed to load lecture. Please try again later.")
        setLecture(null)
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [week, lectureId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading lecture...</p>
        </div>
      </div>
    )
  }

  if (error || !lecture) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
          <p className="text-gray-400 mb-6">{error || "Lecture not found"}</p>
          <a href="/student/lectures" className="text-indigo-400 hover:text-indigo-300">
            ← Back to Lectures
          </a>
        </div>
      </div>
    )
  }

  return <StudentLectureShell lecture={lecture} studentId={studentId || undefined} />
}

export default function LectureWeekPage({ params }: PageProps) {
  const { week } = use(params)
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
        </div>
      }
    >
      <LectureWeekLegacyContent week={week} />
    </Suspense>
  )
}
