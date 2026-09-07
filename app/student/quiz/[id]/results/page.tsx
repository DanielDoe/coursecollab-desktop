"use client"

import { use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getStudentData, studentApiFetch } from "@/lib/auth"

export default function StudentQuizResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: quizId } = use(params)
  const router = useRouter()

  useEffect(() => {
    const data = getStudentData()
    if (!data) {
      router.replace("/student/login")
      return
    }

    const studentDbId = data.databaseId ?? data.id
    let cancelled = false

    studentApiFetch(`/api/student/latest-attempt?quizId=${encodeURIComponent(quizId)}&studentId=${encodeURIComponent(studentDbId)}`)
      .then(async (res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (cancelled) return
        const attemptId = body?.attemptId
        if (attemptId) {
          router.replace(`/student/results/${attemptId}?type=quiz`)
          return
        }
        router.replace(`/student/quiz/${quizId}`)
      })
      .catch(() => {
        if (!cancelled) router.replace(`/student/quiz/${quizId}`)
      })

    return () => {
      cancelled = true
    }
  }, [quizId, router])

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--cc-accent)]" />
    </div>
  )
}
