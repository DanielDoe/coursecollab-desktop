import type { QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/data/query-keys"
import { readClientScope } from "@/lib/data/scope"
import {
  fetchFacultyAnnouncements,
  fetchFacultyCourseNotes,
  fetchFacultyQuestionBank,
} from "@/lib/data/resources/faculty-reads"
import {
  fetchStudentAnnouncements,
  fetchStudentCourseNotes,
  fetchStudentFlashcards,
  fetchStudentLectures,
  fetchStudentNotes,
} from "@/lib/data/resources/student-reads"
import { staleMsFor } from "@/lib/data/cache-times"

const HOVER_DELAY_MS = 140

const STUDENT_PREFETCH: Record<string, (queryClient: QueryClient) => Promise<unknown>> = {
  "/student/dashboard-v2/notes": async (qc) => {
    const scope = readClientScope()
    return Promise.all([
      qc.prefetchQuery({
        queryKey: queryKeys.student.notes(scope),
        queryFn: fetchStudentNotes,
        staleTime: staleMsFor("normal"),
      }),
      qc.prefetchQuery({
        queryKey: queryKeys.student.courseNotes(scope),
        queryFn: fetchStudentCourseNotes,
        staleTime: staleMsFor("normal"),
      }),
    ])
  },
  "/student/dashboard-v2/flashcards": async (qc) => {
    const scope = readClientScope()
    return qc.prefetchQuery({
      queryKey: queryKeys.student.flashcards(scope, false),
      queryFn: () => fetchStudentFlashcards(false),
      staleTime: staleMsFor("normal"),
    })
  },
  "/student/dashboard-v2/announcements": async (qc) => {
    const scope = readClientScope()
    const studentId = scope.userId
    if (!studentId) return
    return qc.prefetchQuery({
      queryKey: queryKeys.student.announcements(scope, studentId),
      queryFn: () => fetchStudentAnnouncements(studentId),
      staleTime: staleMsFor("dynamic"),
    })
  },
  "/student/dashboard-v2/lectures": async (qc) => {
    const scope = readClientScope()
    const studentId = scope.userId
    if (!studentId) return
    return qc.prefetchQuery({
      queryKey: queryKeys.student.lectures(scope, studentId),
      queryFn: () => fetchStudentLectures(studentId),
      staleTime: staleMsFor("normal"),
    })
  },
}

const FACULTY_PREFETCH: Record<string, (queryClient: QueryClient) => Promise<unknown>> = {
  "/instructor/dashboard-v2/communication/announcements": async (qc) => {
    const scope = readClientScope()
    const instructorId = scope.userId
    if (!instructorId) return
    return qc.prefetchQuery({
      queryKey: queryKeys.faculty.announcements(scope, instructorId),
      queryFn: () => fetchFacultyAnnouncements(instructorId, scope.courseId),
      staleTime: staleMsFor("dynamic"),
    })
  },
  "/instructor/dashboard-v2/content/notes": async (qc) => {
    const scope = readClientScope()
    return qc.prefetchQuery({
      queryKey: queryKeys.faculty.courseNotes(scope),
      queryFn: fetchFacultyCourseNotes,
      staleTime: staleMsFor("normal"),
    })
  },
  "/instructor/dashboard-v2/assessments/quizzes/question-bank": async (qc) => {
    const scope = readClientScope()
    return qc.prefetchQuery({
      queryKey: queryKeys.faculty.questionBank(scope),
      queryFn: fetchFacultyQuestionBank,
      staleTime: staleMsFor("normal"),
    })
  },
}

const FACULTY_ALIASES: Record<string, (queryClient: QueryClient) => Promise<unknown>> = {
  "/faculty/dashboard/communication/announcements":
    FACULTY_PREFETCH["/instructor/dashboard-v2/communication/announcements"],
  "/faculty/dashboard/content/notes": FACULTY_PREFETCH["/instructor/dashboard-v2/content/notes"],
  "/faculty/dashboard/assessments/quizzes/question-bank":
    FACULTY_PREFETCH["/instructor/dashboard-v2/assessments/quizzes/question-bank"],
}

const ROUTE_PREFETCH = { ...STUDENT_PREFETCH, ...FACULTY_PREFETCH, ...FACULTY_ALIASES }

export function prefetchRouteData(queryClient: QueryClient, href: string) {
  const path = href.split("?")[0] ?? href
  const run = ROUTE_PREFETCH[path]
  if (!run) return
  void run(queryClient)
}

export function createHoverPrefetch(queryClient: QueryClient) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastHref = ""

  return {
    onEnter(href: string) {
      if (timer) clearTimeout(timer)
      lastHref = href
      timer = setTimeout(() => {
        timer = null
        prefetchRouteData(queryClient, lastHref)
      }, HOVER_DELAY_MS)
    },
    onLeave() {
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}

export function isPrefetchableHref(href: string): boolean {
  const path = href.split("?")[0] ?? href
  return path in ROUTE_PREFETCH
}
