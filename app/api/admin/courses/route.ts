import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { mergeCourseModuleSettings } from "@/lib/course-module-settings"

export const dynamic = "force-dynamic"

/** All active courses — admin portal course picker (global scope). */
export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") ?? "active"

    const rows =
      status === "all"
        ? await sql`
            SELECT
              c.id,
              c.course_code,
              c.course_title,
              c.university,
              c.semester,
              c.instructor_id,
              c.description,
              c.is_active,
              c.module_settings,
              c.created_at,
              c.updated_at,
              i.name AS instructor_name,
              i.username AS instructor_username
            FROM courses c
            LEFT JOIN instructors i ON i.id = c.instructor_id
            ORDER BY c.course_title ASC, c.id ASC
          `
        : status === "inactive"
          ? await sql`
              SELECT
                c.id,
                c.course_code,
                c.course_title,
                c.university,
                c.semester,
                c.instructor_id,
                c.description,
                c.is_active,
                c.module_settings,
                c.created_at,
                c.updated_at,
                i.name AS instructor_name,
                i.username AS instructor_username
              FROM courses c
              LEFT JOIN instructors i ON i.id = c.instructor_id
              WHERE c.is_active = false
              ORDER BY c.course_title ASC, c.id ASC
            `
          : await sql`
              SELECT
                c.id,
                c.course_code,
                c.course_title,
                c.university,
                c.semester,
                c.instructor_id,
                c.description,
                c.is_active,
                c.module_settings,
                c.created_at,
                c.updated_at,
                i.name AS instructor_name,
                i.username AS instructor_username
              FROM courses c
              LEFT JOIN instructors i ON i.id = c.instructor_id
              WHERE c.is_active = true
              ORDER BY c.course_title ASC, c.id ASC
            `

    const courses = rows.map((r: Record<string, unknown>) => ({
      ...r,
      module_settings: mergeCourseModuleSettings(r.module_settings),
    }))

    return NextResponse.json({ courses })
  } catch (error) {
    console.error("[admin/courses]", error)
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 })
  }
}
