"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { refetchOnFocusFor, staleMsFor } from "@/lib/data/cache-times"
import { beginOptimistic, rollbackOptimistic } from "@/lib/data/mutation"
import { queryKeys } from "@/lib/data/query-keys"
import {
  fetchStudentLectureBookmarks,
  fetchStudentLectureReminders,
  fetchStudentLectures,
} from "@/lib/data/resources/student-reads"
import { useClientScope } from "@/lib/data/scope"

export function useStudentLecturesQuery(studentId: string | null) {
  const scope = useClientScope()
  const queryClient = useQueryClient()
  const enabled = Boolean(studentId && (scope.role === "student" || scope.role === "guest"))
  const id = studentId ?? ""

  const lecturesKey = queryKeys.student.lectures(scope, id)
  const bookmarksKey = queryKeys.student.lectureBookmarks(scope, id)
  const remindersKey = queryKeys.student.lectureReminders(scope, id)

  const lectures = useQuery({
    queryKey: lecturesKey,
    queryFn: () => fetchStudentLectures(id),
    staleTime: staleMsFor("normal"),
    refetchOnWindowFocus: refetchOnFocusFor("normal"),
    enabled,
  })

  const bookmarks = useQuery({
    queryKey: bookmarksKey,
    queryFn: () => fetchStudentLectureBookmarks(id),
    staleTime: staleMsFor("normal"),
    refetchOnWindowFocus: refetchOnFocusFor("normal"),
    enabled,
  })

  const reminders = useQuery({
    queryKey: remindersKey,
    queryFn: () => fetchStudentLectureReminders(id),
    staleTime: staleMsFor("dynamic"),
    refetchOnWindowFocus: refetchOnFocusFor("dynamic"),
    enabled,
  })

  const toggleBookmark = useMutation({
    mutationFn: async (lectureId: number) => {
      const current = new Set(queryClient.getQueryData<number[]>(bookmarksKey) ?? [])
      const isBookmarked = current.has(lectureId)
      if (isBookmarked) {
        const res = await studentApiFetch(
          `/api/lectures/bookmarks?lectureId=${lectureId}&studentId=${id}`,
          { method: "DELETE", headers: getStudentAuthHeaders() },
        )
        if (!res.ok) throw new Error("Bookmark remove failed")
        return { lectureId, bookmarked: false }
      }
      const res = await studentApiFetch("/api/lectures/bookmarks", {
        method: "POST",
        headers: { ...getStudentAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId, studentId: Number.parseInt(id, 10) }),
      })
      if (!res.ok) throw new Error("Bookmark failed")
      return { lectureId, bookmarked: true }
    },
    onMutate: async (lectureId) => {
      await queryClient.cancelQueries({ queryKey: bookmarksKey })
      return beginOptimistic<number[]>(queryClient, bookmarksKey, (current = []) => {
        const next = new Set(current)
        if (next.has(lectureId)) next.delete(lectureId)
        else next.add(lectureId)
        return [...next]
      })
    },
    onError: (_err, _id, ctx) => {
      if (ctx) rollbackOptimistic(queryClient, ctx)
    },
  })

  const addReminder = useMutation({
    mutationFn: async (lectureId: number) => {
      const remindAt = new Date()
      remindAt.setDate(remindAt.getDate() + 1)
      const res = await studentApiFetch("/api/lectures/reminders", {
        method: "POST",
        headers: { ...getStudentAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          lectureId,
          studentId: Number.parseInt(id, 10),
          remindAt: remindAt.toISOString(),
        }),
      })
      if (!res.ok) throw new Error("Reminder failed")
      return lectureId
    },
    onSuccess: (lectureId) => {
      queryClient.setQueryData<number[]>(remindersKey, (current = []) =>
        current.includes(lectureId) ? current : [...current, lectureId],
      )
    },
  })

  return {
    lectures: lectures.data ?? [],
    bookmarks: new Set(bookmarks.data ?? []),
    reminders: new Set(reminders.data ?? []),
    isLoading: lectures.isLoading && !lectures.data,
    isRefreshing: lectures.isFetching || bookmarks.isFetching,
    refreshFailed: lectures.isError && Boolean(lectures.data),
    refetch: () => {
      void lectures.refetch()
      void bookmarks.refetch()
      void reminders.refetch()
    },
    toggleBookmark,
    addReminder,
  }
}
