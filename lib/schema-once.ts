import { sql } from "@/lib/db"

/**
 * Bump when any institution stage DDL changes. Production skips a stage whose recorded
 * version matches, so an unbumped change will not be applied on deploy.
 */
export const INSTITUTION_SCHEMA_VERSION = "2026-09-24.1"

let markersPromise: Promise<Map<string, string>> | null = null

/** Another instance applied the same DDL concurrently — the object exists, so not fatal. */
function isConcurrentDdlRace(err: unknown): boolean {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code?: unknown }).code) : ""
  const message = err instanceof Error ? err.message : String(err)
  return (
    code === "42710" ||
    code === "42P07" ||
    code === "23505" ||
    /tuple concurrently (updated|deleted)|already exists/i.test(message)
  )
}

function loadMarkers(): Promise<Map<string, string>> {
  if (!markersPromise) {
    markersPromise = (async () => {
      try {
        const rows = (await sql`SELECT key, version FROM app_schema_markers`) as { key: string; version: string }[]
        return new Map(rows.map((r) => [r.key, r.version]))
      } catch {
        return new Map<string, string>()
      }
    })()
  }
  return markersPromise
}

async function recordMarker(key: string, version: string): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS app_schema_markers (
      key TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    INSERT INTO app_schema_markers (key, version, applied_at)
    VALUES (${key}, ${version}, NOW())
    ON CONFLICT (key) DO UPDATE SET version = EXCLUDED.version, applied_at = NOW()
  `
  ;(await loadMarkers()).set(key, version)
}

/**
 * Runtime DDL (DROP/CREATE POLICY, GRANT, ADD CONSTRAINT) racing across cold serverless
 * instances throws "tuple concurrently updated" / "already exists" inside student requests
 * and briefly leaves tables without their RLS policies. Run each stage once per version.
 */
export async function runSchemaOnce(
  key: string,
  apply: () => Promise<void>,
  version: string = INSTITUTION_SCHEMA_VERSION,
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    await apply()
    return
  }
  const markers = await loadMarkers()
  const recorded = markers.get(key)
  if (recorded === version) return
  try {
    await apply()
  } catch (err) {
    if (recorded == null && !isConcurrentDdlRace(err)) throw err
    console.warn(`[schema-once] ${key} upgrade ${recorded} -> ${version} failed; continuing on installed schema`, err)
    return
  }
  try {
    await recordMarker(key, version)
  } catch (err) {
    console.warn(`[schema-once] could not record ${key}`, err)
  }
}
