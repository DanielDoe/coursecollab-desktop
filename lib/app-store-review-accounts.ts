/**
 * Canonical App Store / Apple review demo accounts.
 * Keep in sync with docs/APP_STORE_REVIEW_CREDENTIALS.md (web + mobile).
 *
 * Note: `students.student_id` is globally unique, so each person has one ID per
 * demo course (ECE + ELEG). Same password and MFA bypass on every row.
 */
export const APP_STORE_REVIEW = {
  /** Shared password for faculty + all demo students (MFA bypassed). Easy to type for App Review. */
  password: "Review26!",
  universityId: 2, // University of Houston
  universityName: "University of Houston",
  instructor: {
    username: "mchen",
    email: "maya.chen@coursecollab.demo",
    name: "Maya Chen",
    /** Prior username — seed migrates this account instead of creating a duplicate. */
    legacyUsernames: ["applestore"] as readonly string[],
  },
  /**
   * Primary student Apple should test with (ECE 2202 enrollment).
   * Matching ELEG enrollment uses elegStudentId.
   */
  primaryStudent: {
    fullName: "Alex Rivera",
    email: "alex.rivera@coursecollab.demo",
    eceStudentId: "910000001",
    elegStudentId: "910100001",
  },
  /** Ten additional classmates (anonymized / fictional). */
  classmates: [
    {
      fullName: "Jordan Lee",
      email: "jordan.lee@coursecollab.demo",
      eceStudentId: "910000002",
      elegStudentId: "910100002",
    },
    {
      fullName: "Sam Patel",
      email: "sam.patel@coursecollab.demo",
      eceStudentId: "910000003",
      elegStudentId: "910100003",
    },
    {
      fullName: "Casey Nguyen",
      email: "casey.nguyen@coursecollab.demo",
      eceStudentId: "910000004",
      elegStudentId: "910100004",
    },
    {
      fullName: "Riley Brooks",
      email: "riley.brooks@coursecollab.demo",
      eceStudentId: "910000005",
      elegStudentId: "910100005",
    },
    {
      fullName: "Morgan Ellis",
      email: "morgan.ellis@coursecollab.demo",
      eceStudentId: "910000006",
      elegStudentId: "910100006",
    },
    {
      fullName: "Avery Quinn",
      email: "avery.quinn@coursecollab.demo",
      eceStudentId: "910000007",
      elegStudentId: "910100007",
    },
    {
      fullName: "Cameron Blake",
      email: "cameron.blake@coursecollab.demo",
      eceStudentId: "910000008",
      elegStudentId: "910100008",
    },
    {
      fullName: "Taylor Kim",
      email: "taylor.kim@coursecollab.demo",
      eceStudentId: "910000009",
      elegStudentId: "910100009",
    },
    {
      fullName: "Jamie Ortiz",
      email: "jamie.ortiz@coursecollab.demo",
      eceStudentId: "910000010",
      elegStudentId: "910100010",
    },
    {
      fullName: "Drew Hanson",
      email: "drew.hanson@coursecollab.demo",
      eceStudentId: "910000011",
      elegStudentId: "910100011",
    },
  ],
  courses: {
    eleg1304: {
      sourceCourseId: 6,
      /** Unique catalog code — must NOT prefix-match live ELEG1304 rosters in results APIs. */
      code: "CCREVIEW1304",
      title: "ELEG 1304 (Review Demo)",
      sessionCode: "CCREVIEW1304P01",
    },
    ece2202: {
      sourceCourseId: 7,
      /** Unique catalog code — must NOT prefix-match live ECE2202 rosters in results APIs. */
      code: "CCREVIEW2202",
      title: "ECE 2202 (Review Demo)",
      sessionCode: "CCREVIEW2202",
    },
  },
  webLoginUrls: {
    faculty: "https://course-collab.com/faculty/login",
    student: "https://course-collab.com/auth/student",
  },
} as const

export type AppStoreDemoPerson = {
  fullName: string
  email: string
  eceStudentId: string
  elegStudentId: string
}

export function allAppStoreDemoPeople(): AppStoreDemoPerson[] {
  return [APP_STORE_REVIEW.primaryStudent, ...APP_STORE_REVIEW.classmates]
}

/** External student_id values used for App Store review sandbox (910000xxx ECE, 910100xxx ELEG). */
export function isAppStoreReviewDemoStudentExternalId(studentId: string | null | undefined): boolean {
  const sid = String(studentId ?? "").trim()
  return /^910000\d{3}$/.test(sid) || /^910100\d{3}$/.test(sid)
}

export function isAppStoreReviewDemoInstructorUsername(username: string | null | undefined): boolean {
  const u = String(username ?? "").trim().toLowerCase()
  return u === APP_STORE_REVIEW.instructor.username.toLowerCase()
    || APP_STORE_REVIEW.instructor.legacyUsernames.some((legacy) => legacy.toLowerCase() === u)
}

/** Review demo courses use dedicated catalog codes so results APIs never prefix-match live rosters. */
export function isAppStoreReviewSandboxCourseCode(courseCode: string | null | undefined): boolean {
  const normalized = String(courseCode ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
  const reviewCodes = [
    APP_STORE_REVIEW.courses.ece2202.code,
    APP_STORE_REVIEW.courses.eleg1304.code,
  ].map((code) => code.toUpperCase().replace(/\s+/g, ""))
  return reviewCodes.includes(normalized)
}
