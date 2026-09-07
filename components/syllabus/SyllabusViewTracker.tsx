"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useRef } from "react"
import { toast } from "@/lib/app-toast"
import type { CourseSyllabus } from "@/lib/syllabus/types"

type SyllabusViewTrackerProps = {
  syllabus: CourseSyllabus
  studentId: string
}

export function SyllabusViewTracker({ syllabus, studentId }: SyllabusViewTrackerProps) {
  const hasTracked = useRef(false)

  useEffect(() => {
    if (syllabus.status !== "published") return
    if (hasTracked.current) return
    hasTracked.current = true

    void (async () => {
      try {
        const res = await studentApiFetch("/api/student/syllabus/view", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-student-id": studentId,
          },
          body: JSON.stringify({ courseId: syllabus.courseId }),
        })
        const data = await res.json()
        if (!res.ok) return

        if (data.pointsAwarded > 0) {
          toast.success(`+${data.pointsAwarded} engagement points`, {
            description: "Thanks for reviewing the course syllabus.",
          })
        }
      } catch {
        /* non-critical */
      }
    })()
  }, [syllabus.courseId, syllabus.status, studentId])

  return null
}
