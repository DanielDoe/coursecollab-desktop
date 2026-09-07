import {
  FALLBACK_UNIVERSITIES,
  OTHER_UNIVERSITY_SHORT_NAME,
  type UniversityRecord,
} from "@/lib/universities-shared"

/** Hipo/university-domains-list (MIT). Hosted search is flaky; JSON catalog is the source of truth. */
const HIPOLABS_SEARCH_URLS = [
  "http://universities.hipolabs.com/search",
  "https://universities.hipolabs.com/search",
]
const CATALOG_URLS = [
  "https://cdn.jsdelivr.net/gh/Hipo/university-domains-list@master/world_universities_and_domains.json",
  "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json",
]

const STOP = new Set(["of", "the", "and", "at", "a", "an", "for", "in", "de", "la", "university", "college"])

type HipoUniversity = {
  name?: string
  country?: string
  domains?: string[]
  web_pages?: string[]
  alpha_two_code?: string
}

export type UniversityCatalogDraft = {
  name: string
  domain: string | null
  country: string | null
  shortNameHint: string
}

const searchCache = new Map<string, { at: number; hits: UniversityCatalogDraft[] }>()
const CACHE_MS = 10 * 60 * 1000

export function emailHost(email: string): string {
  const host = String(email ?? "").trim().toLowerCase().split("@")[1] ?? ""
  return host.replace(/^www\./, "")
}

/** Map student emails like cougarnet.uh.edu → uh.edu. */
export function canonicalEducationDomain(host: string): string {
  const h = host.trim().toLowerCase()
  if (!h) return ""
  if (h === "uh.edu" || h.endsWith(".uh.edu")) return "uh.edu"
  if (h === "pvamu.edu" || h.endsWith(".pvamu.edu")) return "pvamu.edu"
  return h
}

export function shortNameFromInstitution(name: string, domain: string | null): string {
  const known = domain ? FALLBACK_UNIVERSITIES.find((u) => u.domain === domain)?.short_name : null
  if (known) return known
  const words = String(name ?? "")
    .replace(/&/g, " ")
    .split(/[^A-Za-z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0 && !STOP.has(w.toLowerCase()))
  let acronym = words.map((w) => w[0]!).join("").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
  if (acronym.length < 2) {
    acronym = String(domain ?? "UNI")
      .split(".")[0]
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 10)
  }
  return acronym || "UNI"
}

export function draftFromHipo(row: HipoUniversity): UniversityCatalogDraft | null {
  const name = String(row.name ?? "").trim()
  if (name.length < 3) return null
  const domain = String(row.domains?.[0] ?? "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "") || null
  return {
    name,
    domain,
    country: String(row.country ?? "").trim() || null,
    shortNameHint: shortNameFromInstitution(name, domain),
  }
}

export function isOtherShortName(shortName: string): boolean {
  return String(shortName ?? "").trim().toUpperCase() === OTHER_UNIVERSITY_SHORT_NAME
}

function rankCatalogHit(hit: UniversityCatalogDraft, q: string): number {
  const n = hit.name.toLowerCase()
  const query = q.toLowerCase()
  let score = 0
  if (n === query) score += 50
  if (n.startsWith(query)) score += 20
  if (n.includes(query)) score += 10
  if (hit.country === "United States") score += 8
  if (hit.domain?.endsWith(".edu")) score += 6
  if (hit.domain?.includes(query)) score += 4
  return score
}

let catalogLoad: Promise<HipoUniversity[]> | null = null

async function fetchJsonArray(url: string, timeoutMs: number): Promise<unknown[] | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } })
    if (!res.ok) return null
    const json = (await res.json()) as unknown
    return Array.isArray(json) ? json : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function loadUniversityCatalog(): Promise<HipoUniversity[]> {
  if (!catalogLoad) {
    catalogLoad = (async () => {
      for (const url of CATALOG_URLS) {
        const rows = await fetchJsonArray(url, 15000)
        if (rows && rows.length > 100) return rows as HipoUniversity[]
      }
      catalogLoad = null
      return []
    })()
  }
  return catalogLoad
}

function draftsFromRows(rows: unknown[], query: string): UniversityCatalogDraft[] {
  const seen = new Set<string>()
  const hits: UniversityCatalogDraft[] = []
  for (const row of rows) {
    const draft = draftFromHipo(row as HipoUniversity)
    if (!draft) continue
    const hay = `${draft.name} ${draft.domain ?? ""} ${draft.country ?? ""}`.toLowerCase()
    if (!hay.includes(query.toLowerCase())) continue
    const dedupe = (draft.domain || draft.name).toLowerCase()
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    hits.push(draft)
  }
  hits.sort((a, b) => rankCatalogHit(b, query) - rankCatalogHit(a, query))
  return hits.slice(0, 12)
}

export async function searchHipoUniversities(query: string): Promise<UniversityCatalogDraft[]> {
  const q = String(query ?? "").trim()
  if (q.length < 2) return []
  const key = q.toLowerCase()
  const cached = searchCache.get(key)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.hits

  for (const base of HIPOLABS_SEARCH_URLS) {
    const rows = await fetchJsonArray(`${base}?name=${encodeURIComponent(q)}`, 6000)
    if (rows && rows.length > 0) {
      const hits = draftsFromRows(rows, q)
      if (hits.length > 0) {
        searchCache.set(key, { at: Date.now(), hits })
        return hits
      }
    }
  }

  const catalog = await loadUniversityCatalog()
  const hits = draftsFromRows(catalog, q)
  searchCache.set(key, { at: Date.now(), hits })
  return hits
}

export function catalogDraftToPreview(draft: UniversityCatalogDraft): UniversityRecord {
  return {
    id: 0,
    name: draft.name,
    short_name: draft.shortNameHint,
    logo: null,
    primary_color: "#582c83",
    secondary_color: "#EAAA00",
    domain: draft.domain,
    authentication_type: "local",
    is_active: true,
  }
}
