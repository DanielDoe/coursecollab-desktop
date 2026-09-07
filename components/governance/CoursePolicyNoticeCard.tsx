"use client"


import { studentApiFetch } from "@/lib/auth"
import { useEffect, useState } from "react"
import { CoursePolicyNotice } from "@/components/governance/CoursePolicyNotice"
import {
  dismissCoursePolicyNoticePermanently,
  fetchDashboardBannerPrefs,
  getStudentDatabaseIdFromClient,
  readClientCoursePolicyNoticeDismissed,
  writeClientCoursePolicyNoticeDismissed,
} from "@/lib/student-dashboard-banner-prefs"

export function CoursePolicyNoticeCard() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const studentDbId = getStudentDatabaseIdFromClient()
    if (!studentDbId) {
      setLoading(false)
      return
    }

    if (readClientCoursePolicyNoticeDismissed(studentDbId)) {
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        const [governanceRes, prefs] = await Promise.all([
          studentApiFetch("/api/student/course-assessment-governance", {
            headers: { "x-student-id": studentDbId },
          }),
          fetchDashboardBannerPrefs(studentDbId),
        ])

        if (cancelled) return

        if (prefs?.coursePolicyNoticeDismissed) {
          writeClientCoursePolicyNoticeDismissed(studentDbId)
          return
        }

        if (!governanceRes.ok) return
        const data = await governanceRes.json()
        if (data?.show_course_policy_notice) {
          setVisible(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const handleDismiss = () => {
    const studentDbId = getStudentDatabaseIdFromClient()
    setVisible(false)
    void dismissCoursePolicyNoticePermanently(studentDbId)
  }

  if (loading || !visible) return null

  return <CoursePolicyNotice className="mb-4" onDismiss={handleDismiss} />
}
