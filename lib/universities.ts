import { sql } from "@/lib/db"
import {
  FALLBACK_UNIVERSITIES,
  OTHER_UNIVERSITY,
  OTHER_UNIVERSITY_SHORT_NAME,
  type UniversityRecord,
} from "@/lib/universities-shared"
import {
  canonicalEducationDomain,
  catalogDraftToPreview,
  emailHost,
  searchHipoUniversities,
  shortNameFromInstitution,
} from "@/lib/universities-catalog"

export type { UniversityAuthType, UniversityRecord } from "@/lib/universities-shared"
export {
  FALLBACK_UNIVERSITIES,
  OTHER_UNIVERSITY,
  OTHER_UNIVERSITY_SHORT_NAME,
  SELECTED_UNIVERSITY_DATA_KEY,
  SELECTED_UNIVERSITY_SESSION_KEY,
} from "@/lib/universities-shared"

async function ensureOtherUniversity(): Promise<UniversityRecord> {
  try {
    const existing = (await sql`
      SELECT id, name, short_name, logo, primary_color, secondary_color, domain, authentication_type, is_active
      FROM universities
      WHERE LOWER(short_name) = ${OTHER_UNIVERSITY_SHORT_NAME.toLowerCase()}
      LIMIT 1
    `) as UniversityRecord[]
    if (existing[0]) return existing[0]
    const inserted = (await sql`
      INSERT INTO universities (name, short_name, logo, primary_color, secondary_color, domain, authentication_type, is_active)
      VALUES (
        ${OTHER_UNIVERSITY.name}, ${OTHER_UNIVERSITY_SHORT_NAME}, NULL,
        ${OTHER_UNIVERSITY.primary_color}, ${OTHER_UNIVERSITY.secondary_color}, NULL, 'local', true
      )
      RETURNING id, name, short_name, logo, primary_color, secondary_color, domain, authentication_type, is_active
    `) as UniversityRecord[]
    return inserted[0] ?? OTHER_UNIVERSITY
  } catch {
    return OTHER_UNIVERSITY
  }
}


/** Active universities for public login picker (no roster data). */
export async function listActiveUniversities(): Promise<UniversityRecord[]> {
  try {
    const rows = (await sql`
      SELECT id, name, short_name, logo, primary_color, secondary_color, domain, authentication_type, is_active
      FROM universities
      WHERE is_active = true
      ORDER BY name ASC
    `) as UniversityRecord[]
    return rows
  } catch {
    return FALLBACK_UNIVERSITIES
  }
}

export async function getUniversityById(id: number): Promise<UniversityRecord | null> {
  if (!Number.isFinite(id)) return null
  try {
    const rows = (await sql`
      SELECT id, name, short_name, logo, primary_color, secondary_color, domain, authentication_type, is_active
      FROM universities
      WHERE id = ${id} AND is_active = true
      LIMIT 1
    `) as UniversityRecord[]
    return rows[0] ?? null
  } catch {
    return FALLBACK_UNIVERSITIES.find((u) => u.id === id) ?? null
  }
}

export async function getUniversityByShortName(shortName: string): Promise<UniversityRecord | null> {
  const key = String(shortName ?? "").trim().toLowerCase()
  if (!key) return null
  try {
    const rows = (await sql`
      SELECT id, name, short_name, logo, primary_color, secondary_color, domain, authentication_type, is_active
      FROM universities
      WHERE LOWER(short_name) = ${key} AND is_active = true
      LIMIT 1
    `) as UniversityRecord[]
    return rows[0] ?? null
  } catch {
    return FALLBACK_UNIVERSITIES.find((u) => u.short_name.toLowerCase() === key) ?? null
  }
}

/** Resolve university for a course (prefers university_id, falls back to text column). */
export async function resolveUniversityForCourse(courseId: number): Promise<UniversityRecord | null> {
  const rows = (await sql`
    SELECT u.id, u.name, u.short_name, u.logo, u.primary_color, u.secondary_color,
           u.domain, u.authentication_type, u.is_active, c.university
    FROM courses c
    LEFT JOIN universities u ON u.id = c.university_id
    WHERE c.id = ${courseId}
    LIMIT 1
  `) as Array<UniversityRecord & { university?: string | null }>
  if (rows.length === 0) return null
  const row = rows[0]
  if (row.id) return row as UniversityRecord

  const legacy = String(row.university ?? "").trim()
  if (!legacy) return FALLBACK_UNIVERSITIES[0] ?? null
  const key = legacy.toLowerCase()
  if (key.includes("houston") || key === "uh") {
    return FALLBACK_UNIVERSITIES.find((u) => u.short_name === "UH") ?? null
  }
  return FALLBACK_UNIVERSITIES.find((u) => u.short_name === "PVAMU") ?? null
}

const FEATURED_ORDER: Record<string, number> = { PVAMU: 1, UH: 2 }

function orderPicker(rows: UniversityRecord[]): UniversityRecord[] {
  const featured = rows
    .filter((u) => FEATURED_ORDER[u.short_name.toUpperCase()] != null)
    .sort((a, b) => FEATURED_ORDER[a.short_name.toUpperCase()] - FEATURED_ORDER[b.short_name.toUpperCase()])
  const other = rows.find((u) => u.short_name.toUpperCase() === OTHER_UNIVERSITY_SHORT_NAME)
  return other ? [...featured, other] : featured
}

/** Featured partners + Other for the login picker (search handles the rest). */
export async function listUniversityPickerOptions(): Promise<UniversityRecord[]> {
  const other = await ensureOtherUniversity()
  try {
    const rows = (await sql`
      SELECT id, name, short_name, logo, primary_color, secondary_color, domain, authentication_type, is_active
      FROM universities
      WHERE is_active = true
        AND LOWER(short_name) IN ('pvamu', 'uh', 'other')
    `) as UniversityRecord[]
    const ordered = orderPicker(rows)
    if (ordered.some((u) => u.short_name.toUpperCase() === "OTHER")) return ordered
    return [...ordered, other]
  } catch {
    return FALLBACK_UNIVERSITIES
  }
}

export async function searchUniversitiesForPicker(query: string): Promise<UniversityRecord[]> {
  const q = String(query ?? "").trim()
  if (q.length < 2) return []
  const like = `%${q}%`

  let local: UniversityRecord[] = []
  try {
    local = (await sql`
      SELECT id, name, short_name, logo, primary_color, secondary_color, domain, authentication_type, is_active
      FROM universities
      WHERE is_active = true
        AND LOWER(short_name) <> ${OTHER_UNIVERSITY_SHORT_NAME.toLowerCase()}
        AND (
          name ILIKE ${like}
          OR short_name ILIKE ${like}
          OR COALESCE(domain, '') ILIKE ${like}
        )
      ORDER BY name ASC
      LIMIT 8
    `) as UniversityRecord[]
  } catch {
    local = FALLBACK_UNIVERSITIES.filter(
      (u) =>
        u.short_name.toUpperCase() !== OTHER_UNIVERSITY_SHORT_NAME &&
        `${u.name} ${u.short_name} ${u.domain ?? ""}`.toLowerCase().includes(q.toLowerCase()),
    )
  }

  const localKeys = new Set(
    local.flatMap((u) => [u.domain?.toLowerCase(), u.name.toLowerCase()].filter(Boolean) as string[]),
  )

  const remote = await searchHipoUniversities(q)
  const extra: UniversityRecord[] = []
  for (const draft of remote) {
    const domainKey = draft.domain?.toLowerCase()
    if (domainKey && localKeys.has(domainKey)) continue
    if (localKeys.has(draft.name.toLowerCase())) continue
    extra.push(catalogDraftToPreview(draft))
    if (local.length + extra.length >= 12) break
  }
  return [...local, ...extra]
}

export async function ensureUniversityFromCatalog(input: {
  name: string
  domain?: string | null
  shortName?: string | null
}): Promise<UniversityRecord> {
  const name = String(input.name ?? "").trim()
  const domain = String(input.domain ?? "").trim().toLowerCase().replace(/^www\./, "") || null
  if (name.length < 3) {
    return ensureOtherUniversity()
  }

  if (domain) {
    const byDomain = (await sql`
      SELECT id, name, short_name, logo, primary_color, secondary_color, domain, authentication_type, is_active
      FROM universities
      WHERE LOWER(domain) = ${domain}
      LIMIT 1
    `) as UniversityRecord[]
    if (byDomain[0]) return byDomain[0]
  }

  const byName = (await sql`
    SELECT id, name, short_name, logo, primary_color, secondary_color, domain, authentication_type, is_active
    FROM universities
    WHERE LOWER(name) = ${name.toLowerCase()}
    LIMIT 1
  `) as UniversityRecord[]
  if (byName[0]) return byName[0]

  const base = String(input.shortName ?? shortNameFromInstitution(name, domain))
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12) || "UNI"

  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? base : `${base}${i + 1}`.slice(0, 16)
    try {
      const inserted = (await sql`
        INSERT INTO universities (name, short_name, logo, primary_color, secondary_color, domain, authentication_type, is_active)
        VALUES (
          ${name}, ${candidate}, NULL, '#582c83', '#EAAA00', ${domain}, 'local', true
        )
        RETURNING id, name, short_name, logo, primary_color, secondary_color, domain, authentication_type, is_active
      `) as UniversityRecord[]
      if (inserted[0]) return inserted[0]
    } catch {
      const raced = domain
        ? ((await sql`
            SELECT id, name, short_name, logo, primary_color, secondary_color, domain, authentication_type, is_active
            FROM universities
            WHERE LOWER(domain) = ${domain} OR LOWER(short_name) = ${candidate.toLowerCase()}
            LIMIT 1
          `) as UniversityRecord[])
        : ((await sql`
            SELECT id, name, short_name, logo, primary_color, secondary_color, domain, authentication_type, is_active
            FROM universities
            WHERE LOWER(short_name) = ${candidate.toLowerCase()}
            LIMIT 1
          `) as UniversityRecord[])
      if (raced[0] && (raced[0].name.toLowerCase() === name.toLowerCase() || raced[0].domain?.toLowerCase() === domain)) {
        return raced[0]
      }
    }
  }
  return ensureOtherUniversity()
}

/** Link a person to UH / PVAMU / Other / a matched catalog row. */
export async function resolveUniversityIdForAccount(args: {
  universityId?: number | null
  email?: string | null
  organization?: string | null
}): Promise<number | null> {
  const explicit = Number(args.universityId)
  if (Number.isFinite(explicit) && explicit > 0) {
    const row = await getUniversityById(explicit)
    if (row) return row.id
  }

  const host = canonicalEducationDomain(emailHost(String(args.email ?? "")))
  if (host) {
    const byDomain = (await sql`
      SELECT id FROM universities
      WHERE is_active = true AND LOWER(domain) = ${host}
      LIMIT 1
    `) as Array<{ id: number }>
    if (byDomain[0]) return byDomain[0].id
  }

  const org = String(args.organization ?? "").trim().toLowerCase()
  if (org.length >= 3) {
    if (org.includes("houston") || org === "uh") {
      const uh = await getUniversityByShortName("UH")
      if (uh) return uh.id
    }
    if (org.includes("prairie view") || org === "pvamu") {
      const pv = await getUniversityByShortName("PVAMU")
      if (pv) return pv.id
    }
    const named = (await sql`
      SELECT id FROM universities
      WHERE is_active = true AND LOWER(name) = ${org}
      LIMIT 1
    `) as Array<{ id: number }>
    if (named[0]) return named[0].id
  }

  return (await ensureOtherUniversity()).id
}
