"use client"

import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { cachedFetchJson } from "@/lib/student-client-cache"
import type { SyllabusDeadlineRow } from "@/lib/calendar/syllabus-deadlines"
import { getStudentAssessmentFeed } from "@/lib/student-assessment-feed-client"
import {
  buildSemesterTimeline,
  type SemesterTimelineItem,
} from "@/lib/student-semester-timeline"

type SyllabusDeadlinesResponse = {
  published: boolean
  deadlines: Array<Omit<SyllabusDeadlineRow, "parsedDate"> & { parsedDate: string | null }>
}

async function fetchSyllabusDeadlines(): Promise<SyllabusDeadlineRow[]> {
  const res = await studentApiFetch("/api/student/syllabus-deadlines", {
    headers: getStudentAuthHeaders(),
  })
  if (!res.ok) return []
  const data = (await res.json()) as SyllabusDeadlinesResponse
  if (!data.published || !Array.isArray(data.deadlines)) return []
  return data.deadlines.map((d) => ({
    key: d.key,
    title: d.title,
    dateText: d.dateText,
    source: d.source,
    parsedDate: d.parsedDate ? new Date(d.parsedDate) : null,
  }))
}

export async function getStudentSemesterTimeline(
  dbId: string,
  displayId: string,
  section: string,
): Promise<SemesterTimelineItem[]> {
  const key = `semester-timeline:${dbId}:${displayId}:${section}`
  return cachedFetchJson(key, async () => {
    const [feed, syllabusDeadlines] = await Promise.all([
      getStudentAssessmentFeed(dbId, displayId, section),
      fetchSyllabusDeadlines(),
    ])

    return buildSemesterTimeline({
      quizzes: feed.quizzes as Parameters<typeof buildSemesterTimeline>[0]["quizzes"],
      homeworkAssessments: feed.homeworkAssessments as Parameters<
        typeof buildSemesterTimeline
      >[0]["homeworkAssessments"],
      homeworkHistory: feed.homeworkHistory as Parameters<
        typeof buildSemesterTimeline
      >[0]["homeworkHistory"],
      midSemesters: feed.midSemesters as Parameters<typeof buildSemesterTimeline>[0]["midSemesters"],
      finals: feed.finals as Parameters<typeof buildSemesterTimeline>[0]["finals"],
      missingSubmissions: feed.missingSubmissions as Parameters<
        typeof buildSemesterTimeline
      >[0]["missingSubmissions"],
      syllabusDeadlines,
    })
  }, 120_000)
}

if (typeof window !== "undefined") {
  window.addEventListener("student-assessments-updated", () => {
    invalidateClientCache("semester-timeline:")
  })
}
