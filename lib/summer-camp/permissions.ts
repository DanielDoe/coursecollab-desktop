import { type NextRequest, NextResponse } from "next/server"
import { sql, asSqlRows } from "@/lib/db"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"

export async function isFacultyAssignedToTraining(
  instructorId: number,
  trainingId: number,
): Promise<boolean> {
  const rows = asSqlRows(await sql`
    SELECT 1 FROM camp_training_faculty
    WHERE instructor_id = ${instructorId} AND training_id = ${trainingId}
    LIMIT 1
  `)
  return rows.length > 0
}

/** Faculty/TA on the training, or instructor who owns the parent summer camp program. */
export async function canAccessSummerCampTraining(
  instructorId: number,
  trainingId: number,
): Promise<boolean> {
  if (await isFacultyAssignedToTraining(instructorId, trainingId)) return true
  const campId = await getTrainingCampId(trainingId)
  if (campId == null) return false
  const owns = asSqlRows(await sql`
    SELECT 1 FROM summer_camps
    WHERE id = ${campId} AND instructor_id = ${instructorId}
    LIMIT 1
  `)
  return owns.length > 0
}

export async function getAccessibleSummerCampTrainingIds(instructorId: number): Promise<number[]> {
  const rows = asSqlRows<{ training_id: number }>(await sql`
    SELECT DISTINCT training_id
    FROM (
      SELECT training_id FROM camp_training_faculty WHERE instructor_id = ${instructorId}
      UNION
      SELECT t.id AS training_id
      FROM camp_trainings t
      JOIN summer_camps sc ON sc.id = t.camp_id
      WHERE sc.instructor_id = ${instructorId}
    ) accessible
  `)
  return rows.map((r) => Number(r.training_id))
}

export async function isStudentEnrolledInTraining(
  studentDbId: number,
  trainingId: number,
): Promise<boolean> {
  const rows = asSqlRows(await sql`
    SELECT 1 FROM camp_enrollments
    WHERE student_id = ${studentDbId}
      AND training_id = ${trainingId}
      AND status = 'active'
    LIMIT 1
  `)
  return rows.length > 0
}

export async function getTrainingCampId(trainingId: number): Promise<number | null> {
  const rows = asSqlRows<{ camp_id: number }>(await sql`
    SELECT camp_id FROM camp_trainings WHERE id = ${trainingId} LIMIT 1
  `)
  return rows.length > 0 ? Number(rows[0].camp_id) : null
}

/** Faculty or TA assigned to a camp training — no course scope header required. */
export async function requireSummerCampStaff(request: NextRequest) {
  const instructorIdRaw = request.headers.get("x-instructor-id")
  if (!instructorIdRaw) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const instructorId = Number(instructorIdRaw)
  const actor = await loadInstructorActor(instructorId)
  if (!actor || !actor.is_active) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const assigned = asSqlRows(await sql`
    SELECT 1 FROM camp_training_faculty WHERE instructor_id = ${instructorId} LIMIT 1
  `)
  if (assigned.length === 0) {
    const owns = asSqlRows(await sql`
      SELECT 1 FROM summer_camps WHERE instructor_id = ${instructorId} LIMIT 1
    `)
    if (owns.length === 0) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Not assigned to summer camp" }, { status: 403 }),
      }
    }
  }

  return { ok: true as const, instructorId, actor }
}

/** Faculty or TA assigned to at least one summer camp training (read-only portal). */
export async function requireSummerCampPortalActor(request: NextRequest) {
  const instructorIdRaw = request.headers.get("x-instructor-id")
  if (!instructorIdRaw) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const instructorId = Number(instructorIdRaw)
  const actor = await loadInstructorActor(instructorId)
  if (!actor || !actor.is_active) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  if (actor.role !== "ta") {
    return { ok: true as const, instructorId, actor, isTa: false }
  }

  const assigned = asSqlRows(await sql`
    SELECT 1 FROM camp_training_faculty WHERE instructor_id = ${instructorId} LIMIT 1
  `)
  if (assigned.length === 0) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Not assigned to a summer camp training" }, { status: 403 }),
    }
  }

  return { ok: true as const, instructorId, actor, isTa: true }
}

export async function getModuleTrainingId(moduleId: number): Promise<number | null> {
  const rows = asSqlRows<{ training_id: number }>(await sql`
    SELECT t.id AS training_id
    FROM camp_modules m
    JOIN camp_projects p ON p.id = m.project_id
    JOIN camp_trainings t ON t.id = p.training_id
    WHERE m.id = ${moduleId}
    LIMIT 1
  `)
  return rows.length > 0 ? Number(rows[0].training_id) : null
}
