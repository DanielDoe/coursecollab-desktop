import { type NextRequest, NextResponse } from "next/server"
import { sql, asSqlRows } from "@/lib/db"
import {
  canAccessSummerCampTraining,
  requireSummerCampStaff,
} from "@/lib/summer-camp/permissions"
import { getTrainingMeta } from "@/lib/summer-camp/training-catalog"

export const dynamic = "force-dynamic"

/** Training overview for assigned faculty / camp owners: details, stats, and faculty roster. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trainingId: string }> },
) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const { trainingId: trainingIdRaw } = await params
    const trainingId = Number.parseInt(trainingIdRaw, 10)
    if (!Number.isFinite(trainingId)) {
      return NextResponse.json({ error: "Invalid training ID" }, { status: 400 })
    }

    const allowed = await canAccessSummerCampTraining(scope.instructorId, trainingId)
    if (!allowed) {
      return NextResponse.json({ error: "Not assigned to this training" }, { status: 403 })
    }

    const trainingRows = asSqlRows<Record<string, unknown>>(await sql`
      SELECT t.id, t.title, t.slug, t.description, t.status, t.sort_order,
             t.published_at, t.created_at,
             c.id AS camp_id, c.title AS camp_title, c.slug AS camp_slug,
             c.status AS camp_status, c.start_date AS camp_start_date,
             c.end_date AS camp_end_date, c.instructor_id AS camp_owner_id,
             (SELECT COUNT(*)::int FROM camp_enrollments e
              WHERE e.training_id = t.id AND e.status = 'active') AS enrollment_count,
             (SELECT COUNT(*)::int FROM camp_projects p
              WHERE p.training_id = t.id) AS project_count,
             (SELECT COUNT(*)::int FROM camp_projects p
              WHERE p.training_id = t.id
                AND COALESCE(p.metadata->>'kind', '') IN ('capstone', 'team_capstone')) AS capstone_count,
             (SELECT COUNT(*)::int FROM camp_modules m
              JOIN camp_projects p ON p.id = m.project_id
              WHERE p.training_id = t.id AND m.status = 'published') AS module_count,
             (SELECT COUNT(*)::int FROM camp_modules m
              JOIN camp_projects p ON p.id = m.project_id
              WHERE p.training_id = t.id
                AND m.status = 'published'
                AND COALESCE(p.metadata->>'kind', '') = 'curriculum') AS curriculum_module_count,
             (SELECT COUNT(*)::int FROM camp_submissions s
              JOIN camp_modules m ON m.id = s.module_id
              JOIN camp_projects p ON p.id = m.project_id
              WHERE p.training_id = t.id) AS submission_count,
             (SELECT COUNT(*)::int FROM camp_submissions s
              JOIN camp_modules m ON m.id = s.module_id
              JOIN camp_projects p ON p.id = m.project_id
              WHERE p.training_id = t.id
                AND s.status IN ('submitted', 'pending', 'needs_review')) AS pending_submission_count,
             (SELECT COUNT(*)::int FROM camp_discussions d
              JOIN camp_modules m ON m.id = d.module_id
              JOIN camp_projects p ON p.id = m.project_id
              WHERE p.training_id = t.id
                AND d.parent_id IS NULL
                AND d.status = 'open') AS open_discussion_count,
             (SELECT COUNT(*)::int FROM camp_training_faculty f
              WHERE f.training_id = t.id) AS faculty_count,
             (SELECT COUNT(*)::int FROM camp_progress pr
              JOIN camp_modules m ON m.id = pr.module_id
              JOIN camp_projects p ON p.id = m.project_id
              WHERE p.training_id = t.id
                AND pr.progress_type = 'module_complete') AS module_completions
      FROM camp_trainings t
      JOIN summer_camps c ON c.id = t.camp_id
      WHERE t.id = ${trainingId}
      LIMIT 1
    `)
    const training = trainingRows[0]
    if (!training) {
      return NextResponse.json({ error: "Training not found" }, { status: 404 })
    }

    const faculty = asSqlRows<Record<string, unknown>>(await sql`
      SELECT f.instructor_id, f.role AS training_role, f.created_at AS assigned_at,
             i.name, i.email, i.role AS instructor_role, i.job_title, i.institution,
             i.phone, i.office
      FROM camp_training_faculty f
      JOIN instructors i ON i.id = f.instructor_id
      WHERE f.training_id = ${trainingId}
      ORDER BY CASE
        WHEN f.role = 'lead' THEN 0
        WHEN f.role = 'dean' THEN 1
        ELSE 2
      END, i.name ASC
    `)

    const catalog = getTrainingMeta(String(training.slug ?? ""))

    return NextResponse.json({
      training,
      faculty,
      catalog: {
        title: catalog.title,
        summary: catalog.summary,
        overview: catalog.overview,
        duration: catalog.duration,
        difficulty: catalog.difficulty,
        audience: catalog.audience,
        format: catalog.format,
        outcomes: catalog.outcomes,
        tags: catalog.tags,
        comingSoon: catalog.comingSoon ?? false,
      },
    })
  } catch (error) {
    console.error("[instructor/summer-camp/trainings/[trainingId] GET]", error)
    return NextResponse.json({ error: "Failed to load training" }, { status: 500 })
  }
}
