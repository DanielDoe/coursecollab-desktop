import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { ensureCoraAiAccountingSchema } from "@/lib/cora/ai/schema"
import { ensureFacultyCoraThreadsSchema } from "@/lib/cora/faculty-cora-threads"
import {
  CORA_FACULTY_SURFACES,
  CORA_STUDENT_SURFACES,
  coraFeatureLabel,
} from "@/lib/cora/platform-usage-catalog"
import {
  aggregateCoraModules,
  loadCoraInsightTurns,
} from "@/lib/cora/instructor-cora-insights"
import { getFacultyAskCoraInsights } from "@/lib/cora/assessment-policy-analytics"

export const dynamic = "force-dynamic"

type CountRow = Record<string, unknown>

function num(row: CountRow | undefined, key: string) {
  return Number(row?.[key] ?? 0) || 0
}

export async function GET(request: NextRequest) {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope.response
  const { instructorId, course } = scope
  const courseId = course.id

  try {
    await ensureCoraAiAccountingSchema()
    await ensureFacultyCoraThreadsSchema()
  } catch {
    /* schema helpers are idempotent; continue with best-effort queries */
  }

  try {
    const [
      studentConv,
      studentActive,
      studentSources,
      studentFeatures,
      studentModules,
      facultyEvents,
      facultyFeatures,
      facultyModules,
      facultyThreads,
      facultyByCapability,
    ] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS count
        FROM ai_tutor_conversations aitc
        INNER JOIN students s ON s.id = aitc.student_id
        INNER JOIN sessions sess ON sess.id = s.session_id
        WHERE sess.course_id = ${courseId}
          AND aitc.created_at >= NOW() - INTERVAL '30 days'
      `.catch(() => [{ count: 0 }]),
      sql`
        SELECT COUNT(DISTINCT aitc.student_id)::int AS count
        FROM ai_tutor_conversations aitc
        INNER JOIN students s ON s.id = aitc.student_id
        INNER JOIN sessions sess ON sess.id = s.session_id
        WHERE sess.course_id = ${courseId}
          AND aitc.created_at >= NOW() - INTERVAL '7 days'
      `.catch(() => [{ count: 0 }]),
      Promise.resolve([]),
      sql`
        SELECT
          feature,
          COUNT(*)::int AS events,
          COUNT(DISTINCT user_id)::int AS users,
          COALESCE(SUM(credits_charged), 0)::int AS credits
        FROM cora_usage_events
        WHERE user_role = 'student'
          AND (course_id = ${courseId} OR course_id IS NULL)
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY feature
        ORDER BY events DESC
      `.catch(() => []),
      sql`
        SELECT
          COALESCE(NULLIF(module, ''), 'cora-agent') AS module,
          COUNT(*)::int AS events,
          COUNT(DISTINCT user_id)::int AS users
        FROM cora_usage_events
        WHERE user_role = 'student'
          AND (course_id = ${courseId} OR course_id IS NULL)
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY events DESC
        LIMIT 12
      `.catch(() => []),
      sql`
        SELECT
          COUNT(*)::int AS events,
          COALESCE(SUM(credits_charged), 0)::int AS credits
        FROM cora_usage_events
        WHERE user_role = 'instructor'
          AND user_id = ${instructorId}
          AND (course_id = ${courseId} OR course_id IS NULL)
          AND created_at >= NOW() - INTERVAL '30 days'
      `.catch(() => [{ events: 0, credits: 0 }]),
      sql`
        SELECT
          feature,
          COUNT(*)::int AS events,
          COUNT(DISTINCT user_id)::int AS users,
          COALESCE(SUM(credits_charged), 0)::int AS credits
        FROM cora_usage_events
        WHERE user_role = 'instructor'
          AND user_id = ${instructorId}
          AND (course_id = ${courseId} OR course_id IS NULL)
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY feature
        ORDER BY events DESC
      `.catch(() => []),
      sql`
        SELECT
          COALESCE(NULLIF(module, ''), 'cora-agent') AS module,
          COUNT(*)::int AS events
        FROM cora_usage_events
        WHERE user_role = 'instructor'
          AND user_id = ${instructorId}
          AND (course_id = ${courseId} OR course_id IS NULL)
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1
        ORDER BY events DESC
        LIMIT 12
      `.catch(() => []),
      sql`
        SELECT COUNT(*)::int AS count
        FROM instructor_cora_threads
        WHERE instructor_id = ${instructorId}
          AND course_id = ${courseId}
          AND archived_at IS NULL
      `.catch(() => [{ count: 0 }]),
      sql`
        SELECT
          COALESCE(NULLIF(capability_id, ''), 'assistant') AS capability,
          COUNT(*)::int AS threads
        FROM instructor_cora_threads
        WHERE instructor_id = ${instructorId}
          AND course_id = ${courseId}
          AND archived_at IS NULL
        GROUP BY 1
        ORDER BY threads DESC
      `.catch(() => []),
    ])

    const studentByFeature = (studentFeatures as CountRow[]).map((row) => ({
      feature: String(row.feature ?? "OTHER"),
      label: coraFeatureLabel(String(row.feature ?? "OTHER")),
      events: num(row, "events"),
      users: num(row, "users"),
      credits: num(row, "credits"),
    }))

    const facultyByFeature = (facultyFeatures as CountRow[]).map((row) => ({
      feature: String(row.feature ?? "OTHER"),
      label: coraFeatureLabel(String(row.feature ?? "OTHER")),
      events: num(row, "events"),
      users: num(row, "users"),
      credits: num(row, "credits"),
    }))

    const insightTurns = await loadCoraInsightTurns({ instructorId, courseId })
    const inferredModules = aggregateCoraModules(insightTurns)
    const studentBySource = inferredModules.map((row) => ({
      source: row.module.toLowerCase().replace(/\s+/g, "-"),
      label: row.module,
      questions: row.questions,
      students: row.students,
    }))

    const SURFACE_MODULE_LABELS: Record<string, string[]> = {
      assistant: ["Cora Assistant"],
      lectures: ["Lectures"],
      practice: ["Practice Hub"],
      assessments: ["Assessments"],
      codebench: ["Code"],
      "notes-flashcards": ["Notes", "Flashcards"],
    }

    const matchSurfaceCounts = (
      surfaces: typeof CORA_STUDENT_SURFACES,
      sources: typeof studentBySource,
      modules: CountRow[],
    ) =>
      surfaces.map((surface) => {
        const labels = SURFACE_MODULE_LABELS[surface.id] ?? []
        const fromInferred = inferredModules
          .filter((row) => labels.includes(row.module))
          .reduce((sum, row) => sum + row.questions, 0)
        const fromSource = sources
          .filter((row) => surface.sourceKeys.includes(row.source))
          .reduce((sum, row) => sum + row.questions, 0)
        const fromModule = modules
          .filter((row) => surface.modules.includes(String(row.module ?? "")))
          .reduce((sum, row) => sum + num(row, "events"), 0)
        return {
          ...surface,
          events: fromInferred || fromSource || fromModule,
        }
      })

    const assessmentAssistance = await getFacultyAskCoraInsights(courseId).catch(() => null)

    return NextResponse.json({
      course: { id: course.id, code: course.course_code, title: course.course_title },
      assessmentAssistance,
      student: {
        conversations30d: num(studentConv[0] as CountRow, "count"),
        activeStudents7d: num(studentActive[0] as CountRow, "count"),
        bySource: studentBySource,
        byFeature: studentByFeature,
        byModule: (studentModules as CountRow[]).map((row) => ({
          module: String(row.module ?? "cora-agent"),
          events: num(row, "events"),
          users: num(row, "users"),
        })),
        surfaces: matchSurfaceCounts(CORA_STUDENT_SURFACES, studentBySource, studentModules as CountRow[]),
      },
      faculty: {
        threads: num(facultyThreads[0] as CountRow, "count"),
        events30d: num(facultyEvents[0] as CountRow, "events"),
        credits30d: num(facultyEvents[0] as CountRow, "credits"),
        byFeature: facultyByFeature,
        byModule: (facultyModules as CountRow[]).map((row) => ({
          module: String(row.module ?? "cora-agent"),
          events: num(row, "events"),
        })),
        byCapability: (facultyByCapability as CountRow[]).map((row) => ({
          capability: String(row.capability ?? "assistant"),
          threads: num(row, "threads"),
        })),
        surfaces: matchSurfaceCounts(
          CORA_FACULTY_SURFACES,
          [],
          (facultyModules as CountRow[]).map((row) => ({ ...row, events: num(row, "events") })),
        ),
      },
    })
  } catch (error) {
    console.error("[instructor/cora/platform-usage]", error)
    return NextResponse.json({
      course: { id: course.id, code: course.course_code, title: course.course_title },
      student: {
        conversations30d: 0,
        activeStudents7d: 0,
        bySource: [],
        byFeature: [],
        byModule: [],
        surfaces: CORA_STUDENT_SURFACES.map((s) => ({ ...s, events: 0 })),
      },
      faculty: {
        threads: 0,
        events30d: 0,
        credits30d: 0,
        byFeature: [],
        byModule: [],
        byCapability: [],
        surfaces: CORA_FACULTY_SURFACES.map((s) => ({ ...s, events: 0 })),
      },
    })
  }
}
