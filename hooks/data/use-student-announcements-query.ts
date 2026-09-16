"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { refetchOnFocusFor, staleMsFor } from "@/lib/data/cache-times"
import { queryKeys } from "@/lib/data/query-keys"
import {
  fetchStudentAnnouncements,
  type StudentAnnouncement,
} from "@/lib/data/resources/student-reads"
import { useClientScope } from "@/lib/data/scope"

export function useStudentAnnouncementsQuery(studentId: string) {
  const scope = useClientScope()
  const queryClient = useQueryClient()
  const key = queryKeys.student.announcements(scope, studentId)

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchStudentAnnouncements(studentId),
    staleTime: staleMsFor("dynamic"),
    refetchOnWindowFocus: refetchOnFocusFor("dynamic"),
    enabled: Boolean(studentId && (scope.role === "student" || scope.role === "guest")),
    retry: 2,
  })

  const setAnnouncements = (next: StudentAnnouncement[]) => {
    queryClient.setQueryData(key, next)
  }

  return {
    announcements: query.data ?? [],
    isLoading: query.isLoading && !query.data,
    isRefreshing: query.isFetching,
    refreshFailed: query.isError && Boolean(query.data),
    error: !query.data ? query.error : null,
    refetch: query.refetch,
    setAnnouncements,
  }
}
