"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { refetchOnFocusFor, staleMsFor } from "@/lib/data/cache-times"
import { queryKeys } from "@/lib/data/query-keys"
import {
  fetchFacultyCourseNotes,
  fetchFacultyCourseNotesDeletedCount,
} from "@/lib/data/resources/faculty-reads"
import { useClientScope } from "@/lib/data/scope"
import type { CourseDigitalNote } from "@/lib/course-digital-notes"

export function useFacultyCourseNotesQuery() {
  const scope = useClientScope()
  const queryClient = useQueryClient()
  const notesKey = queryKeys.faculty.courseNotes(scope)
  const deletedKey = queryKeys.faculty.courseNotesDeleted(scope)
  const enabled = scope.role === "faculty"

  const notes = useQuery({
    queryKey: notesKey,
    queryFn: fetchFacultyCourseNotes,
    staleTime: staleMsFor("normal"),
    refetchOnWindowFocus: refetchOnFocusFor("normal"),
    enabled,
  })

  const deleted = useQuery({
    queryKey: deletedKey,
    queryFn: fetchFacultyCourseNotesDeletedCount,
    staleTime: staleMsFor("dynamic"),
    refetchOnWindowFocus: refetchOnFocusFor("dynamic"),
    enabled,
  })

  return {
    notes: notes.data ?? [],
    deletedCount: deleted.data ?? 0,
    isLoading: notes.isLoading && !notes.data,
    isRefreshing: notes.isFetching,
    refreshFailed: notes.isError && Boolean(notes.data),
    refetch: () => {
      void notes.refetch()
      void deleted.refetch()
    },
    setNotes: (next: CourseDigitalNote[]) => {
      queryClient.setQueryData(notesKey, next)
    },
  }
}
