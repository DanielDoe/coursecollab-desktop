"use client"

import { Suspense, use, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { StudentLectureShell } from "@/components/student-lecture-shell"
import { getStudentData } from "@/lib/auth"
import { getStudentLoginId, resolveStudentCourseIdForLectures } from "@/lib/student-session-ids"
import { Loader2 } from "lucide-react"

interface PageProps {
  params: Promise<{ week: string }>
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError"
}

function isTransientFetchError(err: unknown): boolean {
  if (isAbortError(err)) return true
  return err instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(err.message)
}

async function waitForStudentSession(maxMs = 2500): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    if (getStudentLoginId() || sessionStorage.getItem("studentDatabaseId")) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

async function fetchLectureJson(url: string, signal: AbortSignal, attempt = 0): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(url, { cache: "no-store", signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as Record<string, unknown>
  } catch (err) {
    if (signal.aborted || isAbortError(err)) throw err
    if (attempt < 2 && isTransientFetchError(err)) {
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)))
      return fetchLectureJson(url, signal, attempt + 1)
    }
    throw err
  }
}

function LectureWeekContent({ week }: { week: string }) {
  const searchParams = useSearchParams()
  const lectureId = searchParams.get("lectureId")
  const [lecture, setLecture] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [studentId, setStudentId] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const run = async () => {
      try {
        setLoading(true)
        setError(null)

        await waitForStudentSession()

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

        const sid = getStudentLoginId()

        if (lectureId && sid) {
          const data = await fetchLectureJson(
            `/api/student/lectures/${lectureId}/content?studentId=${encodeURIComponent(sid)}`,
            controller.signal,
          )
          if (!controller.signal.aborted) setLecture(data)
          return
        }

        const qs = new URLSearchParams()
        if (lectureId) qs.set("lectureId", lectureId)
        if (sid) qs.set("studentId", sid)
        const courseId = await resolveStudentCourseIdForLectures()
        if (courseId != null) qs.set("courseId", String(courseId))

        const data = await fetchLectureJson(
          `/api/lectures/by-week/${week}${qs.toString() ? `?${qs}` : ""}`,
          controller.signal,
        )
        if (!controller.signal.aborted) setLecture(data)
      } catch (err) {
        if (controller.signal.aborted || isAbortError(err)) return
        setError("Failed to load lecture. Please try again later.")
        setLecture(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void run()
    return () => controller.abort()
  }, [week, lectureId])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#0c0f16]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#eaaa00]" />
          <p className="text-sm text-slate-400">Loading lecture...</p>
        </div>
      </div>
    )
  }

  if (error || !lecture) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#0c0f16] px-6">
        <div className="max-w-md text-center">
          <h2 className="text-xl font-semibold text-white mb-3">Couldn&apos;t load lecture</h2>
          <p className="text-slate-400 mb-4">{error || "Lecture not found"}</p>
          <a
            href="/student/dashboard-v2/lectures?native=1"
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-[#eaaa00] hover:bg-[#eaaa00]/10 transition-colors"
          >
            ← Back to Lectures
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-0 min-h-0 flex-1 flex-col">
      <StudentLectureShell
        lecture={lecture as Parameters<typeof StudentLectureShell>[0]["lecture"]}
        studentId={studentId || undefined}
        lecturesBasePath="/student/dashboard-v2/lectures"
      />
    </div>
  )
}

export default function LectureWeekPageV2({ params }: PageProps) {
  const { week } = use(params)
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center bg-[#0c0f16]">
          <Loader2 className="h-10 w-10 animate-spin text-[#eaaa00]" />
        </div>
      }
    >
      <LectureWeekContent week={week} />
    </Suspense>
  )
}
