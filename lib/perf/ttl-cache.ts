type Entry<T> = { value: T; expiresAt: number }

const store = new Map<string, Entry<unknown>>()

export function readTtlCache<T>(key: string): T | undefined {
  const hit = store.get(key) as Entry<T> | undefined
  if (!hit) return undefined
  if (hit.expiresAt <= Date.now()) {
    store.delete(key)
    return undefined
  }
  return hit.value
}

export function writeTtlCache<T>(key: string, value: T, ttlMs: number): T {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
  return value
}

export async function rememberTtl<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const cached = readTtlCache<T>(key)
  if (cached !== undefined) return cached
  const value = await load()
  return writeTtlCache(key, value, ttlMs)
}

export function clearTtlCache(prefix?: string): void {
  if (!prefix) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
