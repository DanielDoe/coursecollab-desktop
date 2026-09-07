/** Client-safe university types/constants — no database imports. */

export type UniversityAuthType = "local" | "microsoft" | "google" | "saml" | "cas"

export type UniversityRecord = {
  id: number
  name: string
  short_name: string
  logo: string | null
  primary_color: string
  secondary_color: string
  domain: string | null
  authentication_type: UniversityAuthType
  is_active: boolean
}

export const OTHER_UNIVERSITY_SHORT_NAME = "OTHER"

export const OTHER_UNIVERSITY: UniversityRecord = {
  id: 3,
  name: "Other",
  short_name: OTHER_UNIVERSITY_SHORT_NAME,
  logo: null,
  primary_color: "#582c83",
  secondary_color: "#EAAA00",
  domain: null,
  authentication_type: "local",
  is_active: true,
}

export const FALLBACK_UNIVERSITIES: UniversityRecord[] = [
  {
    id: 1,
    name: "Prairie View A&M University",
    short_name: "PVAMU",
    logo: "/summer-camp/pvamu-logo.png",
    primary_color: "#4F2D7F",
    secondary_color: "#FFB81C",
    domain: "pvamu.edu",
    authentication_type: "local",
    is_active: true,
  },
  {
    id: 2,
    name: "University of Houston",
    short_name: "UH",
    logo: "/universities/university-of-houston-logo.png",
    primary_color: "#C8102E",
    secondary_color: "#6D6E71",
    domain: "uh.edu",
    authentication_type: "local",
    is_active: true,
  },
  OTHER_UNIVERSITY,
]

export function isOtherUniversity(university: Pick<UniversityRecord, "short_name"> | null | undefined): boolean {
  return String(university?.short_name ?? "").trim().toUpperCase() === OTHER_UNIVERSITY_SHORT_NAME
}

export const SELECTED_UNIVERSITY_SESSION_KEY = "selectedUniversityId"
export const SELECTED_UNIVERSITY_DATA_KEY = "selectedUniversity"

/** University chosen on the picker (sessionStorage — survives route change within the tab). */
export function readSessionSelectedUniversity(): UniversityRecord | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SELECTED_UNIVERSITY_DATA_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UniversityRecord
    if (!parsed?.id || !parsed?.short_name) return null
    return parsed
  } catch {
    return null
  }
}

export function readSessionSelectedUniversityId(): number | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(SELECTED_UNIVERSITY_SESSION_KEY)
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Known catalog entry for a university id (client-safe fallback when only the id was stored). */
export function lookupUniversityById(id: number): UniversityRecord | null {
  if (!Number.isFinite(id) || id <= 0) return null
  return FALLBACK_UNIVERSITIES.find((u) => u.id === id) ?? null
}

function persistSessionUniversity(university: UniversityRecord): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(SELECTED_UNIVERSITY_SESSION_KEY, String(university.id))
  sessionStorage.setItem(SELECTED_UNIVERSITY_DATA_KEY, JSON.stringify(university))
}

/** Resolve university record when only an id survived (faculty session / sessionStorage). */
export function resolveUniversityFromStoredIdHints(): UniversityRecord | null {
  if (typeof window === "undefined") return null

  const sessionId = readSessionSelectedUniversityId()
  if (sessionId != null) {
    const known = lookupUniversityById(sessionId)
    if (known) {
      persistSessionUniversity(known)
      return known
    }
  }

  try {
    const raw = localStorage.getItem("instructorSession")
    if (raw) {
      const parsed = JSON.parse(raw) as { selectedUniversityId?: number }
      const id = Number(parsed.selectedUniversityId)
      const known = lookupUniversityById(id)
      if (known) {
        persistSessionUniversity(known)
        return known
      }
    }
  } catch {
    /* ignore */
  }

  return null
}
