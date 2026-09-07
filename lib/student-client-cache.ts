"use client"

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

export function primeClientCache<T>(key: string, value: T, ttlMs = 180_000): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export async function cachedFetchJson<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 120_000,
): Promise<T> {
  const now = Date.now()
  const hit = cache.get(key) as CacheEntry<T> | undefined
  if (hit && hit.expiresAt > now) return hit.value

  const pending = inflight.get(key) as Promise<T> | undefined
  if (pending) return pending

  const promise = fetcher()
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs })
      inflight.delete(key)
      return value
    })
    .catch((err) => {
      inflight.delete(key)
      throw err
    })

  inflight.set(key, promise)
  return promise
}

export function invalidateClientCache(prefix?: string): void {
  if (!prefix) {
    cache.clear()
    inflight.clear()
    return
  }
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) inflight.delete(key)
  }
}

export async function fetchJsonCached(
  cacheKey: string,
  url: string,
  init?: RequestInit,
  ttlMs = 120_000,
): Promise<unknown> {
  return cachedFetchJson(
    cacheKey,
    async () => {
      const res = await fetch(url, init)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    ttlMs,
  )
}

if (typeof window !== "undefined") {
  window.addEventListener("classroom-points-updated", () => {
    invalidateClientCache("classroom-points:")
  })
  window.addEventListener("camp-xp-updated", () => {
    invalidateClientCache("camp-xp:")
  })
  window.addEventListener("student-grades-updated", () => {
    invalidateClientCache("grades:")
    invalidateClientCache("dashboard-stats:")
  })
}
