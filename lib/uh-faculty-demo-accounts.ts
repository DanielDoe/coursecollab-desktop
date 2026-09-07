/**
 * UH faculty sandbox — one shared ECE 2202 demo for platform walkthroughs.
 * Three professors share the same anonymized course (no per-faculty copies).
 * No invite emails.
 */

export const UH_FACULTY_DEMO = {
  sourceCourseId: 7,
  /** Shared demo catalog code (≤10 chars for session/classroom-points). */
  sharedCourseCode: "ECE2202UH",
  sharedSessionCode: "ECE2202UH",
  sharedCourseTitle: "ECE 2202 — Platform Demo (Anonymized)",
  universityId: 2,
  universityName: "University of Houston",
  facultyPassword: "FACULTY2026!",
  studentPassword: "ECE2202!",
  /** Primary owner for the shared shell; co-instructors get course_staff access. */
  ownerUsername: "broysam",
} as const

export type UhFacultyDemoProfessor = {
  key: string
  name: string
  email: string
  username: string
  jobTitle: string
}

export const UH_FACULTY_DEMO_PROFESSORS: UhFacultyDemoProfessor[] = [
  {
    key: "roysam",
    name: "Badri Roysam",
    email: "broysam@uh.edu",
    username: "broysam",
    jobTitle: "Hugh Roy and Lillie Cranz Cullen University Professor",
  },
  {
    key: "jchen",
    name: "Ji Chen",
    email: "jchen18@uh.edu",
    username: "jchen18",
    jobTitle: "Professor & Chair, Electrical & Computer Engineering",
  },
  {
    key: "zhan",
    name: "Zhu Han",
    email: "zhan2@uh.edu",
    username: "zhan2",
    jobTitle: "Moores Professor",
  },
]

/** Fictional roster names — never real ECE 2202 students. */
export const UH_FACULTY_DEMO_FICTIONAL_NAMES: readonly string[] = [
  "Aiden Brooks",
  "Bella Chen",
  "Carlos Ortiz",
  "Diana Patel",
  "Ethan Nguyen",
  "Fatima Al-Rashid",
  "Grace Kim",
  "Hassan Malik",
  "Isabella Torres",
  "Jamal Wright",
  "Keiko Tanaka",
  "Liam O'Connor",
  "Maya Singh",
  "Noah Fernandez",
  "Olivia Harper",
  "Priya Sharma",
  "Quinn Anderson",
  "Ravi Mehta",
  "Sofia Delgado",
  "Tyler Jackson",
  "Uma Reddy",
  "Victor Liu",
  "Wren Sullivan",
  "Xavier Cole",
  "Yasmin Haddad",
  "Zoe Martinez",
  "Aaron Blake",
  "Brianna Fox",
  "Caleb Stone",
  "Delilah Reed",
  "Elias Park",
  "Freya Campbell",
  "Gavin Price",
  "Hannah Lowe",
]

export function fictionalStudentEmail(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
  return `${slug}@uh.demo.coursecollab.com`
}

export function shuffledFictionalNames(count: number): string[] {
  const names = [...UH_FACULTY_DEMO_FICTIONAL_NAMES]
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[names[i], names[j]] = [names[j], names[i]]
  }
  return names.slice(0, count)
}

/** Legacy per-professor course codes — deactivated when consolidating to shared demo. */
export const UH_FACULTY_LEGACY_DEMO_CODES = [
  "ECE2202UHBR",
  "ECE2202BR",
  "ECE2202JC",
  "ECE2202ZH",
] as const
