"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { createEmptyWorkspace } from "@/lib/circuit-workspace"
import { refetchOnFocusFor, staleMsFor } from "@/lib/data/cache-times"
import { readJson } from "@/lib/data/fetch-json"
import { beginOptimistic, rollbackOptimistic } from "@/lib/data/mutation"
import { createTempId, isTempId, removeById, replaceById } from "@/lib/data/optimistic"
import { queryKeys } from "@/lib/data/query-keys"
import { fetchStudentCourseNotes, fetchStudentNotes } from "@/lib/data/resources/student-reads"
import { useClientScope } from "@/lib/data/scope"
import type { StudentDigitalNote } from "@/lib/student-digital-notes"
import type { CreateNoteDraft } from "@/components/student/digital-notes/create-note-dialog"

export function useStudentNotesQuery() {
  const scope = useClientScope()
  const queryClient = useQueryClient()
  const notesKey = queryKeys.student.notes(scope)
  const courseKey = queryKeys.student.courseNotes(scope)

  const mine = useQuery({
    queryKey: notesKey,
    queryFn: fetchStudentNotes,
    staleTime: staleMsFor("normal"),
    refetchOnWindowFocus: refetchOnFocusFor("normal"),
    enabled: Boolean(scope.userId && (scope.role === "student" || scope.role === "guest")),
  })

  const course = useQuery({
    queryKey: courseKey,
    queryFn: fetchStudentCourseNotes,
    staleTime: staleMsFor("normal"),
    refetchOnWindowFocus: refetchOnFocusFor("normal"),
    enabled: Boolean(scope.userId && (scope.role === "student" || scope.role === "guest")),
  })

  const createNote = useMutation({
    mutationFn: async (draft: CreateNoteDraft) => {
      const res = await studentApiFetch("/api/student/digital-notes", {
        method: "POST",
        headers: { ...getStudentAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          bodyText: draft.description,
          iconColor: draft.iconColor,
          inkWorkspace: createEmptyWorkspace(),
        }),
      })
      const data = await readJson<{ note: StudentDigitalNote }>(res)
      return { ...data.note, isOwner: true as const }
    },
    onMutate: async (draft) => {
      await queryClient.cancelQueries({ queryKey: notesKey })
      const now = new Date().toISOString()
      const temp: StudentDigitalNote = {
        id: createTempId() as unknown as number,
        title: draft.title,
        bodyText: draft.description,
        inkWorkspace: createEmptyWorkspace(),
        iconColor: draft.iconColor ?? null,
        createdAt: now,
        updatedAt: now,
        isOwner: true,
      }
      const ctx = beginOptimistic<StudentDigitalNote[]>(queryClient, notesKey, (current = []) => [
        temp,
        ...current,
      ])
      return { ...ctx, tempId: temp.id }
    },
    onError: (_err, _draft, ctx) => {
      if (ctx) rollbackOptimistic(queryClient, ctx)
    },
    onSuccess: (saved, _draft, ctx) => {
      queryClient.setQueryData<StudentDigitalNote[]>(notesKey, (current = []) =>
        replaceById(current, ctx?.tempId ?? saved.id, saved),
      )
    },
  })

  const setMyNotes = (next: StudentDigitalNote[]) => {
    queryClient.setQueryData(notesKey, next)
  }

  return {
    myNotes: mine.data ?? [],
    courseNotes: course.data ?? [],
    isLoading: (mine.isLoading && !mine.data) || (course.isLoading && !course.data),
    isRefreshing: mine.isFetching || course.isFetching,
    refreshFailed: (mine.isError && Boolean(mine.data)) || (course.isError && Boolean(course.data)),
    loadError: (!mine.data && mine.error) || (!course.data && course.error) || null,
    refetch: () => {
      void mine.refetch()
      void course.refetch()
    },
    createNote,
    setMyNotes,
  }
}

export { isTempId }
