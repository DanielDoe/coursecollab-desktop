"use client"

import { use, useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { StudentLectureShell } from "@/components/student-lecture-shell"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { Loader2, ArrowLeft } from "lucide-react"

type LecturePayload = Parameters<typeof StudentLectureShell>[0]["lecture"]

export default function InstructorLecturePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const pathname = usePathname()
  const lecturesBasePath = pathname?.startsWith(FACULTY_DASHBOARD_BASE)
    ? `${FACULTY_DASHBOARD_BASE}/content/lectures`
    : "/instructor/dashboard-v2/content/lectures"
  const [lecture, setLecture] = useState<LecturePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const instructorId = localStorage.getItem("instructorId")
      if (!instructorId) {
        router.push("/faculty/login")
        return
      }

      const lectureId = Number.parseInt(id, 10)
      if (!Number.isFinite(lectureId)) {
        setError("Invalid lecture id")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const res = await instructorApiFetch(`/api/instructor/lectures/${lectureId}/content`, {
          headers: buildInstructorApiHeaders(),
          cache: "no-store",
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error ?? "Failed to load lecture")
        }
        const data = (await res.json()) as LecturePayload
        setLecture(data)
      } catch (err) {
        console.error("[Instructor lecture preview]", err)
        setError(err instanceof Error ? err.message : "Failed to load lecture")
        setLecture(null)
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [id, router])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2
            className={cn("h-10 w-10 animate-spin", facultyModuleSpinnerClass("lectures"))}
          />
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading lecture preview...</p>
        </div>
      </div>
    )
  }

  if (error || !lecture) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h2 className={cn("mb-3 text-xl font-semibold", PORTAL_TEXT)}>Preview unavailable</h2>
          <p className={cn("mb-4", PORTAL_TEXT_MUTED)}>{error || "Lecture not found"}</p>
          <Link
            href={lecturesBasePath}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-[var(--cc-accent-dark)] transition-colors hover:bg-[var(--cc-accent-soft)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to lectures
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-0 min-h-0 flex-1 flex-col">
      <StudentLectureShell
        lecture={lecture}
        lecturesBasePath={lecturesBasePath}
        isInstructor
        useInstructorPdfProxy
      />
    </div>
  )
}
