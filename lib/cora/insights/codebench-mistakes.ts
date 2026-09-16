import { sql } from "@/lib/db"
import { scanCodebenchMistakes } from "@/lib/cora/insights/codebench-mistake-scan"
import { recordCoraInteractionEvent } from "@/lib/cora/insights/record"

async function studentCourseId(studentId: number): Promise<number | null> {
  const rows = (await sql`
    SELECT sess.course_id
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id = ${studentId}
    LIMIT 1
  `.catch(() => [])) as Array<{ course_id: number | null }>
  const id = Number(rows[0]?.course_id)
  return Number.isFinite(id) && id > 0 ? id : null
}

/** Persist CodeBench debug / error-spotting findings scanned from the student's actual code. */
export async function recordCodebenchMistakeFindings(input: {
  studentId: number
  module: string
  feature?: string | null
  findings?: Array<string | null | undefined>
  code?: string | null
}): Promise<void> {
  try {
    const hits = scanCodebenchMistakes(input.code)
    if (hits.length === 0) return
    const courseId = await studentCourseId(input.studentId)
    const day = new Date().toISOString().slice(0, 10)
    await Promise.all(
      hits.slice(0, 8).map((hit, i) =>
        recordCoraInteractionEvent({
          userId: input.studentId,
          courseId,
          feature: input.feature,
          module: input.module,
          concept: "Debugging",
          subconcept: hit.label,
          interactionCategory: "debugging",
          assistanceCategory: "debugging",
          assistanceLevel: 3,
          questionType: "code",
          text: hit.snippet,
          source: "codebench",
          sourceRef: `codebench:${input.studentId}:${input.module}:${day}:${hit.kind}:${i}`,
          metadata: { module: input.module, feature: input.feature ?? null, line: hit.line, kind: hit.kind },
        }),
      ),
    )
  } catch {
    // Insights writes must never break CodeBench.
  }
}
