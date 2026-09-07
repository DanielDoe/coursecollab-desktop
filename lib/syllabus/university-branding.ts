export type UniversityBranding = {
  id: string
  displayName: string
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  subtitle?: string
}

const UNIVERSITY_BRANDING: Record<string, UniversityBranding> = {
  "university of houston": {
    id: "uh",
    displayName: "University of Houston",
    logoUrl: "/universities/university-of-houston-logo.png",
    primaryColor: "#C8102E",
    secondaryColor: "#6D6E71",
  },
  uh: {
    id: "uh",
    displayName: "University of Houston",
    logoUrl: "/universities/university-of-houston-logo.png",
    primaryColor: "#C8102E",
    secondaryColor: "#6D6E71",
  },
  "prairie view a&m university": {
    id: "pvamu",
    displayName: "Prairie View A&M University",
    logoUrl: "/universities/pvamu-pvm-mark.png",
    primaryColor: "#4F2D7F",
    secondaryColor: "#FFB81C",
  },
  pvamu: {
    id: "pvamu",
    displayName: "Prairie View A&M University",
    logoUrl: "/universities/pvamu-pvm-mark.png",
    primaryColor: "#4F2D7F",
    secondaryColor: "#FFB81C",
  },
}

const DEFAULT_BRANDING: UniversityBranding = {
  id: "default",
  displayName: "CourseCollab",
  logoUrl: "/universities/university-of-houston-logo.png",
  primaryColor: "#582c83",
  secondaryColor: "#6D6E71",
}

function normalizeUniversityKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export function resolveUniversityBranding(university?: string | null): UniversityBranding {
  if (!university?.trim()) return DEFAULT_BRANDING
  const key = normalizeUniversityKey(university)
  return (
    UNIVERSITY_BRANDING[key] ?? {
      ...DEFAULT_BRANDING,
      id: key.replace(/[^a-z0-9]+/g, "-"),
      displayName: university.trim(),
    }
  )
}

export function formatSyllabusCourseTitle(courseCode?: string | null, courseTitle?: string | null): string {
  const code = courseCode?.trim()
  const title = courseTitle?.trim()
  if (code && title) return `${code} | ${title}`
  return title || code || "Course Syllabus"
}
