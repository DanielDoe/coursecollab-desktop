/** Canonical titles aligned with published syllabi (ELEG Fall 2026 + ECE 2202). */
export const CATALOG_COURSE_METADATA = {
  ELEG1301: {
    courseTitle: "Programming for Computer Engineering I",
    discoverableTitle: "ELEG 1301 | Programming for Computer Engineering I",
    description: "Programming for Computer Engineering I — all ELEG1301 sections (ELEG1301Pxx).",
  },
  ELEG1304: {
    courseTitle: "Computer Applications in Engineering",
    discoverableTitle: "ELEG 1304 | Computer Applications in Engineering",
    description: "Computer Applications in Engineering — all ELEG1304 sections (ELEG1304Pxx).",
  },
  ECE2202: {
    courseTitle: "Circuit Analysis II",
    discoverableTitle: "ECE 2202 | Circuit Analysis II",
    description: "Circuit Analysis II — single course roster (ECE2202).",
  },
} as const

export type CatalogCourseCode = keyof typeof CATALOG_COURSE_METADATA

const LEGACY_SHORT_TITLES = new Set(["ELEG 1301", "ELEG 1304", "ECE 2202"])

export function isLegacyCatalogCourseTitle(title: string | null | undefined): boolean {
  const t = title?.trim()
  return t != null && LEGACY_SHORT_TITLES.has(t)
}
