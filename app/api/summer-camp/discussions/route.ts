import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireBoundSummerCamper } from "@/lib/require-summer-camper"
import { isStudentEnrolledInTraining, getModuleTrainingId } from "@/lib/summer-camp/permissions"
import { awardBadge } from "@/lib/summer-camp/camper-profile"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const moduleId = Number(request.nextUrl.searchParams.get("moduleId"))
    const blockId = request.nextUrl.searchParams.get("blockId")

    if (!Number.isFinite(moduleId)) {
      return NextResponse.json({ error: "moduleId is required" }, { status: 400 })
    }

    const camper = await requireBoundSummerCamper(request)
    if (!camper.ok) return camper.response
    const studentDbId = camper.studentDbId

    const threads = blockId
      ? await sql`
          SELECT d.*, s.full_name AS student_name
          FROM camp_discussions d
          JOIN students s ON s.id = d.student_id
          WHERE d.module_id = ${moduleId}
            AND d.block_id = ${Number(blockId)}
            AND d.parent_id IS NULL
          ORDER BY d.updated_at DESC
        `
      : await sql`
          SELECT d.*, s.full_name AS student_name
          FROM camp_discussions d
          JOIN students s ON s.id = d.student_id
          WHERE d.module_id = ${moduleId} AND d.parent_id IS NULL
          ORDER BY d.updated_at DESC
        `

    const withReplies = []
    for (const thread of threads as Array<{ id: number }>) {
      const replies = await sql`
        SELECT d.*,
          COALESCE(s.full_name, i.name) AS author_name,
          CASE WHEN d.instructor_id IS NOT NULL THEN 'instructor' ELSE 'student' END AS author_type
        FROM camp_discussions d
        LEFT JOIN students s ON s.id = d.student_id AND d.instructor_id IS NULL
        LEFT JOIN instructors i ON i.id = d.instructor_id
        WHERE d.parent_id = ${thread.id}
        ORDER BY d.created_at ASC
      `
      withReplies.push({ ...thread, replies })
    }

    return NextResponse.json({ discussions: withReplies })
  } catch (error) {
    console.error("[summer-camp/discussions GET]", error)
    return NextResponse.json({ error: "Failed to load discussions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { moduleId, blockId, title, body: messageBody, parentId, attachments, mentions } = body


    const camper = await requireBoundSummerCamper(request)
    if (!camper.ok) return camper.response
    const studentDbId = camper.studentDbId

    const modId = Number(moduleId)
    if (!Number.isFinite(modId) || !messageBody?.trim()) {
      return NextResponse.json({ error: "moduleId and body are required" }, { status: 400 })
    }

    const trainingId = await getModuleTrainingId(modId)
    if (trainingId == null) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    const enrolled = await isStudentEnrolledInTraining(studentDbId, trainingId)
    if (!enrolled) {
      return NextResponse.json({ error: "Not enrolled" }, { status: 403 })
    }

    const inserted = await sql`
      INSERT INTO camp_discussions (
        module_id, block_id, student_id, parent_id,
        title, body, attachments, mentions, status
      )
      VALUES (
        ${modId},
        ${blockId != null ? Number(blockId) : null},
        ${studentDbId},
        ${parentId != null ? Number(parentId) : null},
        ${title ?? null},
        ${String(messageBody).trim()},
        ${JSON.stringify(attachments ?? [])}::jsonb,
        ${JSON.stringify(mentions ?? [])}::jsonb,
        'open'
      )
      RETURNING *
    `

    if (parentId == null) {
      const prior = await sql`
        SELECT COUNT(*)::int AS c FROM camp_discussions
        WHERE student_id = ${studentDbId} AND parent_id IS NULL AND id != ${inserted[0].id}
      `
      if ((prior[0]?.c as number) === 0) {
        await awardBadge(studentDbId, "first-discussion")
      }
    }

    return NextResponse.json({ discussion: inserted[0] })
  } catch (error) {
    console.error("[summer-camp/discussions POST]", error)
    return NextResponse.json({ error: "Failed to create discussion" }, { status: 500 })
  }
}
