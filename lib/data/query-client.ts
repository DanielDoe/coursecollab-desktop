import { QueryClient } from "@tanstack/react-query"
import { CACHE_GC_MS } from "@/lib/data/cache-times"

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: CACHE_GC_MS,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
        structuralSharing: true,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}
