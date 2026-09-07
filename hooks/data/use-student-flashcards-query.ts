"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { refetchOnFocusFor, staleMsFor } from "@/lib/data/cache-times"
import { readJson } from "@/lib/data/fetch-json"
import { queryKeys } from "@/lib/data/query-keys"
import { fetchStudentFlashcards } from "@/lib/data/resources/student-reads"
import { useClientScope } from "@/lib/data/scope"
import type { FlashcardDeck } from "@/lib/flashcards-types"
import type { CreateDeckDraft } from "@/components/student/flashcards/create-deck-dialog"

export function useStudentFlashcardsQuery(practiceHubOnly = false) {
  const scope = useClientScope()
  const queryClient = useQueryClient()
  const key = queryKeys.student.flashcards(scope, practiceHubOnly)

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchStudentFlashcards(practiceHubOnly),
    staleTime: staleMsFor("normal"),
    refetchOnWindowFocus: refetchOnFocusFor("normal"),
    enabled: Boolean(scope.userId && (scope.role === "student" || scope.role === "guest")),
  })

  const createDeck = useMutation({
    mutationFn: async (draft: CreateDeckDraft) => {
      const res = await studentApiFetch("/api/student/flashcards/decks", {
        method: "POST",
        headers: { ...getStudentAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ title: draft.title, description: draft.description }),
      })
      const data = await readJson<{ deck: FlashcardDeck }>(res)
      return data.deck
    },
    onSuccess: (deck) => {
      queryClient.setQueryData<{ courseDecks: FlashcardDeck[]; myDecks: FlashcardDeck[] }>(
        key,
        (current) => ({
          courseDecks: current?.courseDecks ?? [],
          myDecks: [deck, ...(current?.myDecks ?? [])],
        }),
      )
    },
  })

  return {
    courseDecks: query.data?.courseDecks ?? [],
    myDecks: query.data?.myDecks ?? [],
    isLoading: query.isLoading && !query.data,
    isRefreshing: query.isFetching,
    refreshFailed: query.isError && Boolean(query.data),
    refetch: query.refetch,
    createDeck,
  }
}
