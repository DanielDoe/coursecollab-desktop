import { AsyncLocalStorage } from "node:async_hooks"

export type PerfStore = {
  startedAt: number
  queries: number
  dbMs: number
}

export const perfAls = new AsyncLocalStorage<PerfStore>()

export function createPerfStore(): PerfStore {
  return { startedAt: Date.now(), queries: 0, dbMs: 0 }
}

export function trackDbQuery<T>(fn: () => Promise<T>): Promise<T> {
  const store = perfAls.getStore()
  const t0 = Date.now()
  return fn().finally(() => {
    if (!store) return
    store.queries += 1
    store.dbMs += Date.now() - t0
  })
}

export function snapshotPerf(): { durationMs: number; dbMs: number; dbQueries: number } | null {
  const store = perfAls.getStore()
  if (!store) return null
  return {
    durationMs: Date.now() - store.startedAt,
    dbMs: store.dbMs,
    dbQueries: store.queries,
  }
}
