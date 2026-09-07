import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { ensureCodebenchStudioEventsSchema } from "@/lib/codebench-studio-schema"
import { studioFamilyLabel, studioFamilyTip, type StudioErrorFamily } from "@/lib/codebench-studio-analytics"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope.response
  const courseId = scope.course.id

  try {
    await ensureCodebenchStudioEventsSchema()
  } catch {
    /* continue with empty studio rows */
  }

  try {
    const [errorRows, toolRows, runRows, studentRows, submissionRows] = await Promise.all([
      sql`
        SELECT error_family, COUNT(*)::int AS count
        FROM codebench_studio_events
        WHERE course_id = ${courseId}
          AND event_type = 'compile_error'
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY error_family
        ORDER BY count DESC
        LIMIT 8
      `.catch(() => []),
      sql`
        SELECT tool, COUNT(*)::int AS count
        FROM codebench_studio_events
        WHERE course_id = ${courseId}
          AND event_type = 'cora_tool'
          AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY tool
        ORDER BY count DESC
        LIMIT 8
      `.catch(() => []),
      sql`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'run')::int AS runs,
          COUNT(*) FILTER (WHERE event_type = 'compile_success')::int AS compiles_ok,
          COUNT(*) FILTER (WHERE event_type = 'compile_error')::int AS compiles_fail,
          COUNT(DISTINCT student_id)::int AS active_students
        FROM codebench_studio_events
        WHERE course_id = ${courseId}
          AND created_at > NOW() - INTERVAL '30 days'
      `.catch(() => []),
      sql`
        SELECT s.id, s.full_name, s.student_code,
          COUNT(*) FILTER (WHERE e.event_type = 'compile_error')::int AS errors,
          COUNT(*) FILTER (WHERE e.event_type = 'compile_success')::int AS successes,
          COUNT(*) FILTER (WHERE e.event_type = 'run')::int AS runs
        FROM codebench_studio_events e
        JOIN students s ON s.id = e.student_id
        WHERE e.course_id = ${courseId}
          AND e.created_at > NOW() - INTERVAL '30 days'
        GROUP BY s.id, s.full_name, s.student_code
        ORDER BY errors DESC, runs DESC
        LIMIT 12
      `.catch(() => []),
      sql`
        SELECT COUNT(*)::int AS submissions, ROUND(AVG(score)::numeric, 1) AS avg_score
        FROM codebench_submissions cs
        JOIN students s ON s.id = cs.student_id
        LEFT JOIN sessions sess ON sess.id = s.session_id
        WHERE (s.course_id = ${courseId} OR sess.course_id = ${courseId})
          AND cs.submitted_at IS NOT NULL
          AND cs.submitted_at > NOW() - INTERVAL '30 days'
      `.catch(() => []),
    ])

    const totals = (runRows[0] ?? {}) as Record<string, unknown>
    const submissions = (submissionRows[0] ?? {}) as Record<string, unknown>
    const compilesOk = Number(totals.compiles_ok) || 0
    const compilesFail = Number(totals.compiles_fail) || 0
    const decided = compilesOk + compilesFail
    const families = (errorRows as Array<Record<string, unknown>>).map((row) => {
      const family = String(row.error_family || "other") as StudioErrorFamily
      return {
        family,
        label: studioFamilyLabel(family),
        tip: studioFamilyTip(family),
        count: Number(row.count) || 0,
      }
    })

    const teachingMove =
      families[0] != null
        ? `The class is tripping on ${families[0].label.toLowerCase()}. A 5-minute board demo of that diagnostic — then one silent recompile — usually drops the next week's repeat rate.`
        : "Students have not generated studio compile data yet. Once they run in CodeBench, this heat map fills with the faults Cora sees first."

    return NextResponse.json({
      windowDays: 30,
      runs: Number(totals.runs) || 0,
      compilesOk,
      compilesFail,
      successRate: decided === 0 ? 0 : Math.round((compilesOk / decided) * 100),
      activeStudents: Number(totals.active_students) || 0,
      submissions: Number(submissions.submissions) || 0,
      avgScore: submissions.avg_score != null ? Number(submissions.avg_score) : null,
      families,
      tools: (toolRows as Array<Record<string, unknown>>).map((row) => ({
        tool: String(row.tool || "unknown"),
        count: Number(row.count) || 0,
      })),
      students: (studentRows as Array<Record<string, unknown>>).map((row) => ({
        id: Number(row.id),
        name: String(row.full_name || "Student"),
        code: row.student_code ? String(row.student_code) : null,
        errors: Number(row.errors) || 0,
        successes: Number(row.successes) || 0,
        runs: Number(row.runs) || 0,
      })),
      teachingMove,
    })
  } catch (error) {
    console.error("[instructor codebench studio-analytics]", error)
    return NextResponse.json({
      windowDays: 30,
      runs: 0,
      compilesOk: 0,
      compilesFail: 0,
      successRate: 0,
      activeStudents: 0,
      submissions: 0,
      avgScore: null,
      families: [],
      tools: [],
      students: [],
      teachingMove: "Studio analytics are not available yet for this course.",
    })
  }
}
