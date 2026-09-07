"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { refetchOnFocusFor, staleMsFor } from "@/lib/data/cache-times"
import { queryKeys } from "@/lib/data/query-keys"
import {
  fetchFacultyQuestionBank,
  fetchFacultyQuestionBankDeleted,
  fetchFacultyQuestionBankTopics,
} from "@/lib/data/resources/faculty-reads"
import { useClientScope } from "@/lib/data/scope"

export function useFacultyQuestionBankQuery() {
  const scope = useClientScope()
  const queryClient = useQueryClient()
  const enabled = scope.role === "faculty"

  const questions = useQuery({
    queryKey: queryKeys.faculty.questionBank(scope),
    queryFn: fetchFacultyQuestionBank,
    staleTime: staleMsFor("normal"),
    refetchOnWindowFocus: refetchOnFocusFor("normal"),
    enabled,
  })

  const topics = useQuery({
    queryKey: queryKeys.faculty.questionBankTopics(scope),
    queryFn: fetchFacultyQuestionBankTopics,
    staleTime: staleMsFor("normal"),
    refetchOnWindowFocus: refetchOnFocusFor("normal"),
    enabled,
  })

  const deleted = useQuery({
    queryKey: queryKeys.faculty.questionBankDeleted(scope),
    queryFn: fetchFacultyQuestionBankDeleted,
    staleTime: staleMsFor("dynamic"),
    refetchOnWindowFocus: refetchOnFocusFor("dynamic"),
    enabled,
  })

  return {
    questions: questions.data ?? [],
    topics: topics.data ?? [],
    deleted: deleted.data ?? [],
    isLoading: questions.isLoading && !questions.data,
    isRefreshing: questions.isFetching,
    refreshFailed: questions.isError && Boolean(questions.data),
    refetchAll: () => {
      void questions.refetch()
      void topics.refetch()
      void deleted.refetch()
    },
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.faculty.questionBank(scope) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.faculty.questionBankTopics(scope) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.faculty.questionBankDeleted(scope) })
    },
  }
}
