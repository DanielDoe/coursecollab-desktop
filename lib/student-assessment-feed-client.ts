"use client"

import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { cachedFetchJson, invalidateClientCache } from "@/lib/student-client-cache"

export type StudentAssessmentFeed = {
  quizzes: Array<Record<string, unknown>>
  homeworkAssessments: Array<Record<string, unknown>>
  homeworkHistory: Array<Record<string, unknown>>
  midSemesters: Array<Record<string, unknown>>
  finals: Array<Record<string, unknown>>
  missingSubmissions: Array<Record<string, unknown>>
}

async function fetchAssessmentFeed(
  dbId: string,
  displayId: string,
  section: string,
): Promise<StudentAssessmentFeed> {
  const studentId = displayId || dbId
  const [quizzesRes, homeworkRes, homeworkHistoryRes, midsRes, finalsRes, submissionsRes] =
    await Promise.all([
      studentApiFetch(`/api/student/quizzes?studentDatabaseId=${dbId}&assessmentType=quiz`),
      studentApiFetch(`/api/student/quizzes?studentDatabaseId=${dbId}&assessmentType=homework`),
      section && studentId
        ? studentApiFetch(`/api/student/homework-history?studentId=${studentId}&session=${section}`, {
            headers: getStudentAuthHeaders(),
          })
        : Promise.resolve(null),
      studentApiFetch(`/api/student/mid-semesters?studentId=${studentId}`).catch(() => null),
      section && studentId
        ? studentApiFetch(`/api/student/finals?session=${section}&studentId=${studentId}`)
        : Promise.resolve(null),
      section
        ? studentApiFetch(`/api/classroom-points/submissions?session=${section}&studentId=${dbId}`)
        : Promise.resolve(null),
    ])

  const quizzes = quizzesRes.ok ? ((await quizzesRes.json()).quizzes ?? []) : []
  const homeworkAssessments = homeworkRes.ok ? ((await homeworkRes.json()).quizzes ?? []) : []
  let homeworkHistory: Array<Record<string, unknown>> = []
  if (homeworkHistoryRes?.ok) {
    const data = await homeworkHistoryRes.json()
    homeworkHistory = data.homeworkHistory ?? []
  }
  const midSemesters =
    midsRes?.ok ? ((await midsRes.json()).midSemesters ?? []) : []
  const finals = finalsRes?.ok ? ((await finalsRes.json()).finals ?? []) : []
  let missingSubmissions: Array<Record<string, unknown>> = []
  if (submissionsRes?.ok) {
    const data = await submissionsRes.json()
    missingSubmissions = data.missingSubmissions ?? []
  }

  return {
    quizzes,
    homeworkAssessments,
    homeworkHistory,
    midSemesters,
    finals,
    missingSubmissions,
  }
}

/** Single cached bundle for pending banner + deadlines panel (avoids duplicate parallel fetches). */
export function getStudentAssessmentFeed(
  dbId: string,
  displayId: string,
  section: string,
): Promise<StudentAssessmentFeed> {
  const key = `assessment-feed:${dbId}:${displayId}:${section}`
  return cachedFetchJson(key, () => fetchAssessmentFeed(dbId, displayId, section), 120_000)
}

if (typeof window !== "undefined") {
  window.addEventListener("student-assessments-updated", () => {
    invalidateClientCache("assessment-feed:")
  })
}
