"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { refetchOnFocusFor, staleMsFor } from "@/lib/data/cache-times"
import { readJson } from "@/lib/data/fetch-json"
import { beginOptimistic, rollbackOptimistic } from "@/lib/data/mutation"
import { removeById } from "@/lib/data/optimistic"
import { queryKeys } from "@/lib/data/query-keys"
import {
  fetchFacultyAnnouncements,
  type FacultyAnnouncement,
} from "@/lib/data/resources/faculty-reads"
import { getInstructorData } from "@/lib/auth"
import { useClientScope } from "@/lib/data/scope"

export function useFacultyAnnouncementsQuery(instructorId: string, courseId?: string | number | null) {
  const scope = useClientScope()
  const instructor = getInstructorData()
  const queryClient = useQueryClient()
  const facultyScope = {
    role: "faculty" as const,
    userId: instructorId || scope.userId,
    courseId: instructor?.selectedCourseId ?? courseId ?? scope.courseId,
    section: instructor?.selectedSessionCode ?? scope.section,
  }
  const key = queryKeys.faculty.announcements(facultyScope, instructorId)

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchFacultyAnnouncements(instructorId, facultyScope.courseId),
    staleTime: staleMsFor("dynamic"),
    refetchOnWindowFocus: refetchOnFocusFor("dynamic"),
    enabled: Boolean(instructorId),
    retry: 2,
  })

  const deleteAnnouncement = useMutation({
    mutationFn: async (id: number) => {
      const res = await instructorApiFetch(`/api/announcements/${id}`, {
        method: "DELETE",
        headers: { "x-instructor-id": instructorId },
      })
      await readJson(res)
      return id
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key })
      return beginOptimistic<FacultyAnnouncement[]>(queryClient, key, (current = []) =>
        removeById(current, id),
      )
    },
    onError: (_err, _id, ctx) => {
      if (ctx) rollbackOptimistic(queryClient, ctx)
    },
  })

  const pinAnnouncement = useMutation({
    mutationFn: async (announcement: FacultyAnnouncement) => {
      const res = await instructorApiFetch(`/api/announcements/${announcement.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-instructor-id": instructorId },
        body: JSON.stringify({ pinned: !announcement.pinned }),
      })
      await readJson(res)
      return announcement.id
    },
    onMutate: async (announcement) => {
      await queryClient.cancelQueries({ queryKey: key })
      return beginOptimistic<FacultyAnnouncement[]>(queryClient, key, (current = []) =>
        current.map((row) =>
          row.id === announcement.id ? { ...row, pinned: !row.pinned } : row,
        ),
      )
    },
    onError: (_err, _ann, ctx) => {
      if (ctx) rollbackOptimistic(queryClient, ctx)
    },
  })

  const setAnnouncements = (next: FacultyAnnouncement[]) => {
    queryClient.setQueryData(key, next)
  }

  return {
    announcements: query.data ?? [],
    isLoading: query.isLoading && !query.data,
    isRefreshing: query.isFetching,
    refreshFailed: query.isError && Boolean(query.data),
    refetch: query.refetch,
    deleteAnnouncement,
    pinAnnouncement,
    setAnnouncements,
  }
}
