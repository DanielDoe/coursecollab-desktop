import { NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const camps = await sql`
      SELECT id, slug, title, description, start_date, end_date, status
      FROM summer_camps
      WHERE status IN ('published', 'active')
      ORDER BY start_date DESC NULLS LAST
    `

    const campList = camps as Array<{
      id: number
      slug: string
      title: string
      description: string | null
      start_date: string | null
      end_date: string | null
      status: string
    }>

    const result = []
    for (const camp of campList) {
      const trainings = await sql`
        SELECT id, slug, title, description, status
        FROM camp_trainings
        WHERE camp_id = ${camp.id} AND status = 'published'
        ORDER BY sort_order ASC, title ASC
      `
      const enrollmentCount = await sql`
        SELECT COUNT(DISTINCT student_id)::int AS count
        FROM camp_enrollments
        WHERE camp_id = ${camp.id} AND status = 'active'
      `
      result.push({
        ...camp,
        trainings,
        enrollment_count: enrollmentCount[0]?.count ?? 0,
      })
    }

    return NextResponse.json({ camps: result })
  } catch (error) {
    console.error("[summer-camp/public]", error)
    return NextResponse.json({ error: "Failed to load camp data" }, { status: 500 })
  }
}
