import type { QueryClient, QueryKey } from "@tanstack/react-query"

export function createTempId(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `temp_${rand}`
}

export function isTempId(id: string | number): boolean {
  return String(id).startsWith("temp_")
}

export function replaceById<T extends { id: string | number }>(
  list: T[],
  fromId: string | number,
  next: T,
): T[] {
  let replaced = false
  const mapped = list.map((row) => {
    if (String(row.id) === String(fromId)) {
      replaced = true
      return next
    }
    return row
  })
  return replaced ? mapped : [next, ...list.filter((row) => String(row.id) !== String(next.id))]
}

export function removeById<T extends { id: string | number }>(list: T[], id: string | number): T[] {
  return list.filter((row) => String(row.id) !== String(id))
}

export function snapshotQuery<T>(queryClient: QueryClient, queryKey: QueryKey): T | undefined {
  return queryClient.getQueryData<T>(queryKey)
}

export function restoreQuery<T>(queryClient: QueryClient, queryKey: QueryKey, previous: T | undefined) {
  if (previous === undefined) {
    queryClient.removeQueries({ queryKey, exact: true })
    return
  }
  queryClient.setQueryData(queryKey, previous)
}
