import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getActorCoursePermissionCodes } from "@/lib/course-permission-guard"
import {
  loadInstructorActor,
  type ActorRow,
} from "@/lib/instructor-actor-scope"
import type { ScopedCourseRow } from "@/lib/instructor-course-scope"

type QuizSqlAlias = "q" | "a"

function assertSafeSqlAlias(alias: QuizSqlAlias) {
  if (alias !== "q" && alias !== "a") {
    throw new Error("Invalid quiz SQL alias")
  }
}

/**
 * Course-scoped visibility predicate as a single sql.unsafe fragment.
 * Must not nest sql`` inside parent queries that also use sql.unsafe (see lib/db.ts).
 */
export function sqlQuizVisibleInCourse(
  alias: QuizSqlAlias,
  actor: ActorRow,
  actorId: number,
  courseOwnerId: number,
  courseId: number,
) {
  assertSafeSqlAlias(alias)
  const ownerId = Number(courseOwnerId)
  const scopedCourseId = Number(courseId)
  const scopedActorId = Number(actorId)
  if (!Number.isFinite(ownerId) || !Number.isFinite(scopedCourseId) || !Number.isFinite(scopedActorId)) {
    throw new Error("Invalid quiz course access scope")
  }

  const courseScope = `(
    ${alias}.course_id = ${scopedCourseId}
    OR EXISTS (
      SELECT 1
      FROM quiz_session_access qsa
      INNER JOIN sessions sess ON sess.id = qsa.session_id
      WHERE qsa.quiz_id = ${alias}.id
        AND sess.course_id = ${scopedCourseId}
    )
  )`

  const creatorScope =
    actor.role === "ta"
      ? ` AND (${alias}.created_by = ${ownerId} OR ${alias}.created_by = ${scopedActorId})`
      : ""

  return sql.unsafe(`${courseScope}${creatorScope}`)
}

export async function assertQuizAccessibleInCourse(
  request: NextRequest,
  quizId: number,
  options?: { includeDeleted?: boolean },
): Promise<
  | {
      ok: true
      instructorId: number
      course: ScopedCourseRow
      isInstructorOwner: boolean
      actor: ActorRow
    }
  | { ok: false; response: NextResponse }
> {
  const ctx = await getActorCoursePermissionCodes(request)
  if (!ctx.ok) return ctx

  const actor = await loadInstructorActor(ctx.instructorId)
  if (!actor) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const courseOwnerId = Number(ctx.course.instructor_id)
  const deletedClause = options?.includeDeleted ? sql.unsafe("") : sql.unsafe("AND q.deleted_at IS NULL")

  const rows = await sql`
    SELECT q.id
    FROM quizzes q
    WHERE q.id = ${quizId}
      ${deletedClause}
      AND ${sqlQuizVisibleInCourse("q", actor, ctx.instructorId, courseOwnerId, ctx.course.id)}
    LIMIT 1
  `

  if (rows.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Assessment not found or not accessible in the selected course." },
        { status: 404 },
      ),
    }
  }

  return {
    ok: true,
    instructorId: ctx.instructorId,
    course: ctx.course,
    isInstructorOwner: ctx.isInstructorOwner,
    actor,
  }
}

/** Raw SQL predicate for trash routes that use sql.unsafe (COALESCE instructor_id / created_by). */
export function deletedItemsCreatorFilterSql(
  actor: ActorRow,
  actorId: number,
  courseOwnerId: number,
): string {
  if (actor.role === "ta") {
    return `(COALESCE(instructor_id, created_by) = ${courseOwnerId} OR COALESCE(instructor_id, created_by) = ${actorId})`
  }
  return "TRUE"
}

/** Resolve actor + owner id for list endpoints that already validated course scope. */
export async function loadQuizAccessActor(
  instructorId: number,
  course: ScopedCourseRow,
): Promise<{ actor: ActorRow; courseOwnerId: number } | null> {
  const actor = await loadInstructorActor(instructorId)
  if (!actor) return null
  return {
    actor,
    courseOwnerId: Number(course.instructor_id),
  }
}
