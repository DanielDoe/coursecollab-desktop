import { Pool } from "pg"
import { neon, neonConfig } from "@neondatabase/serverless"
import { trackDbQuery } from "@/lib/perf/context"

// GLOBAL TIMEZONE CONVENTION: naive DB timestamps are UTC wall-clock; UI converts
// to Central via lib/timezone.ts. Force the server process to UTC so the Neon
// driver parses naive timestamps identically in local dev and on Vercel.
if (typeof process !== "undefined" && process.env.TZ !== "UTC") {
  process.env.TZ = "UTC"
}

/**
 * Database transport:
 * - Default: `@neondatabase/serverless` `neon()` over HTTPS — works through strict firewalls (e.g. school WiFi)
 *   that block raw Postgres TCP (port 5432).
 * - Optional: set `USE_PG_POOL=true` to use `pg.Pool` TCP in production (Node only), e.g. legacy debugging.
 *
 * `NEON_FETCH_TIMEOUT_MS`: max wait per HTTP request to Neon (default 45_000). Set `0` to disable.
 * Do NOT use `neon({ fetchOptions: { signal: AbortSignal.timeout(n) } })` — that shares one signal across
 * all queries; after it fires, every request fails until process restart.
 */
function parseNeonFetchTimeoutMs(): number | null {
  const raw = process.env.NEON_FETCH_TIMEOUT_MS
  if (raw === undefined || raw === "") return 45_000
  const n = Number(raw)
  if (!Number.isFinite(n)) return 45_000
  if (n <= 0) return null
  return n
}

let neonFetchWrapperInstalled = false

/** Per-request fetch timeout (fresh AbortSignal each call). Safe for long-running dev servers. */
function ensureNeonPerRequestFetchTimeout() {
  if (neonFetchWrapperInstalled) return
  neonFetchWrapperInstalled = true
  const ms = parseNeonFetchTimeoutMs()
  if (ms == null) return

  const baseFetch = globalThis.fetch.bind(globalThis)
  neonConfig.fetchFunction = (url: RequestInfo | URL, init?: RequestInit) => {
    const timeoutSignal = AbortSignal.timeout(ms)
    const parent = init?.signal
    const signal =
      parent && typeof AbortSignal.any === "function"
        ? AbortSignal.any([parent, timeoutSignal])
        : timeoutSignal
    return baseFetch(url, { ...init, signal })
  }
}

// Cache the pool for production (pg.Pool) — only when USE_PG_POOL=true
let productionPool: Pool | null = null

// Single neon() client per isolate — avoids new client per query; uses HTTPS to Neon (not raw TCP)
let neonSqlSingleton: ReturnType<typeof neon> | null = null

function getOrCreateNeonSql(): ReturnType<typeof neon> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set")
  }
  const dbUrl = process.env.DATABASE_URL.trim()
  if (!neonSqlSingleton) {
    ensureNeonPerRequestFetchTimeout()
    neonSqlSingleton = neon(dbUrl, {})
    neonSqlSingleton`SET timezone = 'America/Chicago'`.catch((err: { message?: string }) => {
      console.warn("[DB] Failed to set timezone on neon connection:", err?.message)
    })
  }
  return neonSqlSingleton
}

const DB_RETRY_MAX_ATTEMPTS = 3
const DB_RETRY_BASE_MS = 500

/** Reset pooled clients after transient failures so the next attempt uses a fresh connection. */
function resetDbClientsAfterTransientFailure() {
  neonSqlSingleton = null
  if (productionPool) {
    productionPool.end().catch(() => {})
    productionPool = null
  }
}

function isTransientDbError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "")
  const code = (error as { code?: string })?.code
  if (code && /^\d{5}$/.test(code)) {
    const nonRetryable = new Set(["23505", "23503", "42703", "42P01", "22P02", "42883", "57014"])
    if (nonRetryable.has(code)) return false
  }
  return (
    msg.includes("TimeoutError") ||
    msg.includes("timeout") ||
    msg.includes("Error connecting to database") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("fetch failed") ||
    msg.includes("Connection terminated") ||
    msg.includes("Connection closed") ||
    msg.includes("Too many connections") ||
    msg.includes("503") ||
    msg.includes("502")
  )
}

async function withTransientDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < DB_RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < DB_RETRY_MAX_ATTEMPTS - 1 && isTransientDbError(error)) {
        console.warn(
          `[DB] Transient error (attempt ${attempt + 1}/${DB_RETRY_MAX_ATTEMPTS}), retrying:`,
          error instanceof Error ? error.message : error,
        )
        resetDbClientsAfterTransientFailure()
        const delay = Math.min(DB_RETRY_BASE_MS * 2 ** attempt, 3000)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
  throw lastError
}

/**
 * Inline a JS value into raw SQL for the neon() unsafe path (no $n binding).
 * Arrays become `ARRAY[1,2]` so `ANY($1::int[])` becomes valid `ANY(ARRAY[1,2]::int[])`.
 * (Brace literals `{1,2}` after `ANY` are a syntax error; `String([1,2])` is also wrong.)
 */
function formatValueForNeonUnsafeInline(param: unknown): string {
  if (Array.isArray(param)) {
    const elems = param.map((el) => {
      if (el === null || el === undefined) return "NULL"
      if (typeof el === "number" && Number.isFinite(el)) return String(el)
      if (typeof el === "boolean") return el ? "true" : "false"
      if (typeof el === "bigint") return String(el)
      const s = String(el)
      return `'${s.replace(/'/g, "''")}'`
    })
    return `ARRAY[${elems.join(",")}]`
  }
  if (typeof param === "string") return `'${param.replace(/'/g, "''")}'`
  if (param === null) return "NULL"
  if (typeof param === "number") return String(param)
  if (typeof param === "boolean") return param ? "true" : "false"
  return `'${String(param).replace(/'/g, "''")}'`
}

/** Run raw SQL with $1…$n placeholders (Neon inline or pg pool). */
export async function executeParameterizedSql(
  queryText: string,
  params: unknown[],
): Promise<Record<string, unknown>[]> {
  const isEdgeRuntime = checkIsEdgeRuntime()
  const isProduction = getIsProduction()

  return await withTransientDbRetry(async () => {
    if (isProduction && productionPool && !isEdgeRuntime) {
      const result = await productionPool.query(queryText, params)
      return result.rows as Record<string, unknown>[]
    }

    let finalQuery = queryText
    for (let idx = params.length; idx >= 1; idx--) {
      const paramValue = formatValueForNeonUnsafeInline(params[idx - 1])
      finalQuery = finalQuery.replaceAll(new RegExp(`\\$${idx}(?!\\d)`, "g"), paramValue)
    }
    const neonClient = getOrCreateNeonSql()
    const template = Object.assign([finalQuery], { raw: [finalQuery] })
    // @ts-ignore neon tagged template
    return (await neonClient(template as any)) as Record<string, unknown>[]
  })
}

// Helper function to convert template literal to parameterized query for pg.Pool
function convertTemplateLiteral(strings: TemplateStringsArray, values: any[]): { text: string; params: any[] } {
  let text = strings[0]
  const params: any[] = []
  
  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    // Check if this is an sql.unsafe() fragment
    if (value && typeof value === 'object' && '__unsafe' in value && value.__unsafe) {
      // Inject raw SQL without parameterization
      text += value.__sql + strings[i + 1]
    } else {
      // Normal parameterized value
      params.push(value)
      text += `$${params.length}` + strings[i + 1]
    }
  }
  
  return { text, params }
}

// Create a pg.Pool-compatible SQL function
function createPoolSQL(pool: Pool) {
  return async (strings: TemplateStringsArray, ...values: any[]) => {
    // Handle sql.unsafe() fragments
    let text = strings[0]
    const params: any[] = []
    
    for (let i = 0; i < values.length; i++) {
      const value = values[i]
      // Check if this is an sql.unsafe() fragment
      if (value && typeof value === 'object' && '__unsafe' in value && value.__unsafe) {
        // Inject raw SQL without parameterization
        text += value.__sql + strings[i + 1]
      } else {
        // Normal parameterized value
        params.push(value)
        text += `$${params.length}` + strings[i + 1]
      }
    }
    
    const result = await pool.query(text, params)
    return result.rows
  }
}

// Check if we're in edge runtime (which can't use Node.js packages like pg)
// EdgeRuntime is only available at runtime in edge functions, not at module level
// We check at runtime instead of module level to avoid TypeScript errors
function checkIsEdgeRuntime(): boolean {
  try {
    // @ts-ignore - EdgeRuntime may not be defined in types
    return typeof EdgeRuntime !== "undefined" || process.env.NEXT_RUNTIME === "edge"
  } catch {
    return process.env.NEXT_RUNTIME === "edge"
  }
}

// Determine if we should use production (pg.Pool) or development (neon)
// Edge runtime always uses neon() since it can't use Node.js packages
function getIsProduction(): boolean {
  const isEdgeRuntime = checkIsEdgeRuntime()
  return !isEdgeRuntime && (process.env.NODE_ENV === "production" || process.env.VERCEL === "1")
}

export function getSQL() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set")
  }

  const dbUrl = process.env.DATABASE_URL.trim()
  const isEdgeRuntime = checkIsEdgeRuntime()
  const isProduction = getIsProduction()
  const usePgPool =
    process.env.USE_PG_POOL === "true" && !isEdgeRuntime && isProduction

  // Edge: neon HTTPS only (no pg)
  if (isEdgeRuntime) {
    return getOrCreateNeonSql()
  }

  // Production Node: optional TCP pool; default is neon HTTPS (firewall-friendly)
  if (isProduction && usePgPool) {
    if (!productionPool) {
      productionPool = new Pool({
        connectionString: dbUrl,
        max: 20, // Increased from 10 to handle more concurrent requests
        min: 2, // Keep at least 2 connections alive
        idleTimeoutMillis: 30000, // Reduced from 60s to 30s to release idle connections faster
        connectionTimeoutMillis: 10000, // Reduced from 30s to 10s - fail fast if can't connect
        statement_timeout: 25000, // Query timeout: 25 seconds
        query_timeout: 25000, // Query timeout: 25 seconds
        allowExitOnIdle: false, // Changed to false - don't close pool when idle
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000, // Increased from 5s to 10s
        // Set timezone in connection options
        options: '-c timezone=America/Chicago'
      })
      
      productionPool.on('error', (err) => {
        console.error('[DB] Pool error:', err.message)
        // Reset pool on error to force reconnection
        if (err.message.includes('Connection') || err.message.includes('timeout')) {
          console.warn('[DB] Connection error detected, resetting pool...')
          productionPool = null
        }
      })
      
      // Set timezone on all new connections
      productionPool.on('connect', async (client) => {
        try {
          // Check if client is still connected before setting timezone/timeout
          // Connection may be terminated before this handler runs
          if (client && !client.ended && !client.destroyed) {
            await client.query("SET timezone = 'America/Chicago'")
            // Set statement timeout on each connection
            await client.query("SET statement_timeout = '25s'")
          }
        } catch (err: any) {
          // Only log if it's not a connection termination error
          // Connection termination is expected in some scenarios (pool cleanup, etc.)
          if (err?.message && !err.message.includes('Connection terminated') && !err.message.includes('Connection closed')) {
            console.warn('[DB] Failed to set timezone/timeout on new connection:', err)
          }
        }
      })
      
      // Monitor pool health
      setInterval(() => {
        if (productionPool) {
          const poolStats = {
            totalCount: productionPool.totalCount,
            idleCount: productionPool.idleCount,
            waitingCount: productionPool.waitingCount
          }
          if (poolStats.waitingCount > 0 || poolStats.totalCount >= 18) {
            console.warn('[DB] Pool stats:', poolStats)
          }
        }
      }, 30000) // Check every 30 seconds
    }
    
    return createPoolSQL(productionPool) as ReturnType<typeof neon>
  }

  // Development, or production without USE_PG_POOL — Neon's HTTP driver (same path as typical school WiFi allowlist: 443)
  return getOrCreateNeonSql()
}

// Export sql as a tagged template function (like neon() returns)
// This allows us to use sql`SELECT * FROM table` syntax
// CRITICAL: All queries automatically use Central Time (America/Chicago)
// The database connection is configured to use Central Time globally
export const sql = async (strings: TemplateStringsArray, ...values: any[]) => {
  const sqlFunction = getSQL()
  
  // Handle sql.unsafe() fragments for neon() client
  // Check if we're using neon (not pg.Pool)
  const isEdgeRuntime = checkIsEdgeRuntime()
  const isProduction = getIsProduction()
  
  // Check if we have any sql.unsafe() fragments
  const hasUnsafe = values.some(v => v && typeof v === 'object' && '__unsafe' in v && v.__unsafe)
  
  const queryPreview = strings.join("?").slice(0, 500)

  if (hasUnsafe) {
    try {
      return await trackDbQuery(() => withTransientDbRetry(async () => {
        // Build query with unsafe fragments injected
        let queryText = strings[0]
        const safeParams: any[] = []

        for (let i = 0; i < values.length; i++) {
          const value = values[i]
          if (value && typeof value === "object" && "__unsafe" in value && value.__unsafe) {
            queryText += value.__sql + strings[i + 1]
          } else {
            safeParams.push(value)
            queryText += `$${safeParams.length}` + strings[i + 1]
          }
        }

        if (isProduction && productionPool && !isEdgeRuntime) {
          const result = await productionPool.query(queryText, safeParams)
          return result.rows
        }

        const neonClient = getOrCreateNeonSql()
        let finalQuery = queryText
        for (let idx = safeParams.length; idx >= 1; idx--) {
          const paramValue = formatValueForNeonUnsafeInline(safeParams[idx - 1])
          finalQuery = finalQuery.replaceAll(new RegExp(`\\$${idx}(?!\\d)`, "g"), paramValue)
        }
        // @ts-ignore
        const template = Object.assign([finalQuery], { raw: [finalQuery] })
        return await neonClient(template as any)
      }))
    } catch (error) {
      void import("@/lib/system-log")
        .then((m) =>
          m.logDatabaseError(error, {
            operation: "sql.unsafe",
            metadata: { queryPreview },
          }),
        )
        .catch(() => {})
      throw error
    }
  }

  // No unsafe fragments - use normal processing
  try {
    return await trackDbQuery(() => withTransientDbRetry(() => sqlFunction(strings, ...values)))
  } catch (error) {
    void import("@/lib/system-log")
      .then((m) =>
        m.logDatabaseError(error, {
          operation: "sql",
          metadata: { queryPreview },
        }),
      )
      .catch(() => {})
    throw error
  }
}

// Add unsafe method for executing raw SQL
// sql.unsafe is used as a fragment within sql template literals
// It returns a marker object that gets injected into the query
sql.unsafe = function (queryText: string) {
  return {
    __unsafe: true,
    __sql: queryText
  } as any
}

/** Normalize `sql` tagged-template results (array rows vs Neon FullQueryResults). */
export function asSqlRows<T extends Record<string, unknown> = Record<string, unknown>>(
  result: unknown,
): T[] {
  return Array.isArray(result) ? (result as T[]) : []
}
