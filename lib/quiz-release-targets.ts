export type SessionRow = {
  id: number
  code: string
  description?: string | null
}

export type QuizReleaseTarget = {
  sessionId: number
  sessionCode: string
  label: string
  studentToggleLabel: string
  kind: "beta" | "course" | "section"
}

function norm(code: string): string {
  return code.trim().toUpperCase()
}

/**
 * Build student-release rows for quiz cards:
 * - BETA (demo testers) when a BETA session exists
 * - One row per lecture section when multiple exist (e.g. ELEG1304P01…)
 * - Otherwise a single course row labeled with course_code (e.g. ECE2202)
 * Drops a duplicate session whose code equals course_code when real sections exist.
 */
export function buildQuizReleaseTargets(
  sessions: SessionRow[],
  courseCode: string,
): QuizReleaseTarget[] {
  const course = norm(courseCode)
  const beta = sessions.filter((s) => norm(s.code) === "BETA")
  const lecture = sessions.filter((s) => norm(s.code) !== "BETA")

  const targets: QuizReleaseTarget[] = []

  for (const s of beta) {
    targets.push({
      sessionId: s.id,
      sessionCode: s.code,
      label: "BETA",
      studentToggleLabel: "Beta testers",
      kind: "beta",
    })
  }

  let lectureRows = lecture
  if (lecture.length > 1) {
    lectureRows = lecture.filter((s) => norm(s.code) !== course)
  }

  if (lectureRows.length === 0) {
    if (lecture.length === 1) {
      const s = lecture[0]
      targets.push({
        sessionId: s.id,
        sessionCode: s.code,
        label: courseCode || s.code,
        studentToggleLabel: "Students",
        kind: "course",
      })
    } else if (courseCode) {
      const match = lecture.find((s) => norm(s.code) === course)
      if (match) {
        targets.push({
          sessionId: match.id,
          sessionCode: match.code,
          label: courseCode,
          studentToggleLabel: "Students",
          kind: "course",
        })
      }
    }
  } else {
    const sorted = [...lectureRows].sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true }),
    )
    for (const s of sorted) {
      targets.push({
        sessionId: s.id,
        sessionCode: s.code,
        label: s.code,
        studentToggleLabel: "Students",
        kind: "section",
      })
    }
  }

  return targets
}

/** Lecture/course targets only (excludes BETA) for section pickers. */
export function lectureReleaseTargets(targets: QuizReleaseTarget[]): QuizReleaseTarget[] {
  return targets.filter((t) => t.kind !== "beta")
}
