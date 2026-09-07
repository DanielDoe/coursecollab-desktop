import { type NextRequest, NextResponse } from "next/server"
import { sql, asSqlRows } from "@/lib/db"
import {
  requireSummerCampStaff,
  canAccessSummerCampTraining,
  getAccessibleSummerCampTrainingIds,
  getModuleTrainingId,
} from "@/lib/summer-camp/permissions"
import { notifyCampDiscussionReply } from "@/lib/summer-camp-notifications"

export const dynamic = "force-dynamic"

type DiscussionRow = Record<string, unknown> & { id: number }

async function loadThreadsForTrainings(trainingIds: number[], status?: string | null) {
  if (trainingIds.length === 0) return []

  const threads = asSqlRows<DiscussionRow>(
    status && status !== "all"
      ? await sql`
          SELECT d.*,
            s.full_name AS student_name,
            m.title AS module_title,
            t.title AS training_title,
            t.id AS training_id
          FROM camp_discussions d
          JOIN students s ON s.id = d.student_id
          JOIN camp_modules m ON m.id = d.module_id
          JOIN camp_projects p ON p.id = m.project_id
          JOIN camp_trainings t ON t.id = p.training_id
          WHERE p.training_id = ANY(${trainingIds}::int[])
            AND d.parent_id IS NULL
            AND d.status = ${status}
          ORDER BY d.updated_at DESC
        `
      : await sql`
          SELECT d.*,
            s.full_name AS student_name,
            m.title AS module_title,
            t.title AS training_title,
            t.id AS training_id
          FROM camp_discussions d
          JOIN students s ON s.id = d.student_id
          JOIN camp_modules m ON m.id = d.module_id
          JOIN camp_projects p ON p.id = m.project_id
          JOIN camp_trainings t ON t.id = p.training_id
          WHERE p.training_id = ANY(${trainingIds}::int[])
            AND d.parent_id IS NULL
          ORDER BY
            CASE d.status WHEN 'open' THEN 0 WHEN 'answered' THEN 1 ELSE 2 END,
            d.updated_at DESC
        `,
  )

  const withReplies = []
  for (const thread of threads) {
    const replies = asSqlRows<Record<string, unknown>>(await sql`
      SELECT d.id, d.body, d.created_at,
        COALESCE(i.name, s.full_name) AS author_name,
        CASE WHEN d.instructor_id IS NOT NULL THEN 'instructor' ELSE 'student' END AS author_type
      FROM camp_discussions d
      LEFT JOIN instructors i ON i.id = d.instructor_id
      LEFT JOIN students s ON s.id = d.student_id AND d.instructor_id IS NULL
      WHERE d.parent_id = ${thread.id}
      ORDER BY d.created_at ASC
    `)
    withReplies.push({ ...thread, replies })
  }

  return withReplies
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const trainingIdParam = request.nextUrl.searchParams.get("trainingId")
    const status = request.nextUrl.searchParams.get("status")

    let trainingIds: number[]

    if (trainingIdParam != null && trainingIdParam !== "") {
      const trainingId = Number(trainingIdParam)
      if (!Number.isFinite(trainingId)) {
        return NextResponse.json({ error: "Invalid trainingId" }, { status: 400 })
      }
      const allowed = await canAccessSummerCampTraining(scope.instructorId, trainingId)
      if (!allowed) {
        return NextResponse.json({ error: "Not assigned" }, { status: 403 })
      }
      trainingIds = [trainingId]
    } else {
      trainingIds = await getAccessibleSummerCampTrainingIds(scope.instructorId)
    }

    const discussions = await loadThreadsForTrainings(trainingIds, status)
    return NextResponse.json({ discussions })
  } catch (error) {
    console.error("[instructor/summer-camp/discussions GET]", error)
    return NextResponse.json({ error: "Failed to load discussions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const { module_id, parent_id, body, status } = await request.json()
    if (!module_id || !parent_id || !body?.trim()) {
      return NextResponse.json({ error: "module_id, parent_id, and body required" }, { status: 400 })
    }

    const trainingId = await getModuleTrainingId(Number(module_id))
    if (trainingId == null) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    const allowed = await canAccessSummerCampTraining(scope.instructorId, trainingId)
    if (!allowed) {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 })
    }

    const parentRows = asSqlRows<{ student_id: number; title: string | null }>(await sql`
      SELECT student_id, title FROM camp_discussions WHERE id = ${Number(parent_id)} LIMIT 1
    `)
    if (parentRows.length === 0) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }
    const parent = parentRows[0]

    const inserted = asSqlRows<Record<string, unknown>>(await sql`
      INSERT INTO camp_discussions (
        module_id, student_id, instructor_id, parent_id, body, status
      )
      VALUES (
        ${Number(module_id)},
        ${Number(parent.student_id)},
        ${scope.instructorId},
        ${Number(parent_id)},
        ${String(body).trim()},
        ${status ?? "answered"}
      )
      RETURNING *
    `)

    await sql`
      UPDATE camp_discussions SET status = ${status ?? "answered"}, updated_at = NOW()
      WHERE id = ${Number(parent_id)}
    `

    await notifyCampDiscussionReply(
      Number(parent.student_id),
      String(parent.title ?? ""),
      Number(module_id),
    )

    return NextResponse.json({ reply: inserted[0] ?? null })
  } catch (error) {
    console.error("[instructor/summer-camp/discussions POST]", error)
    return NextResponse.json({ error: "Failed to reply" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const { discussion_id, status } = await request.json()
    if (!discussion_id || !status) {
      return NextResponse.json({ error: "discussion_id and status required" }, { status: 400 })
    }

    const threadRows = asSqlRows<{ module_id: number }>(await sql`
      SELECT module_id FROM camp_discussions WHERE id = ${Number(discussion_id)} LIMIT 1
    `)
    if (threadRows.length === 0) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 })
    }

    const trainingId = await getModuleTrainingId(Number(threadRows[0].module_id))
    if (trainingId == null) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    const allowed = await canAccessSummerCampTraining(scope.instructorId, trainingId)
    if (!allowed) {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 })
    }

    const updated = asSqlRows<Record<string, unknown>>(await sql`
      UPDATE camp_discussions SET status = ${status}, updated_at = NOW()
      WHERE id = ${Number(discussion_id)}
      RETURNING *
    `)
    return NextResponse.json({ discussion: updated[0] ?? null })
  } catch (error) {
    console.error("[instructor/summer-camp/discussions PATCH]", error)
    return NextResponse.json({ error: "Failed to update discussion" }, { status: 500 })
  }
}
