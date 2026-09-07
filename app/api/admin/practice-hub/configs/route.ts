import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get("adminId")
    const difficulty = searchParams.get("difficulty")
    const status = searchParams.get("status")

    if (!adminId) {
      return NextResponse.json({ error: "Admin ID required" }, { status: 400 })
    }

    let query = sql`
      SELECT 
        pc.*,
        COUNT(DISTINCT q.id) as question_count,
        COUNT(DISTINCT pa.student_id) as student_count,
        AVG(pa.score) as average_score,
        COUNT(CASE WHEN pa.completed_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(pa.id) as completion_rate
      FROM practice_configs pc
      LEFT JOIN questions q ON pc.topic = q.topic AND pc.difficulty = q.difficulty
      LEFT JOIN practice_attempts pa ON pc.id = pa.config_id
    `

    const conditions = []

    if (difficulty && difficulty !== "all") {
      conditions.push(`pc.difficulty = ${sql.unsafe(`'${difficulty}'`)}`)
    }

    if (status && status !== "all") {
      if (status === "active") {
        conditions.push(`pc.is_active = true`)
      } else if (status === "inactive") {
        conditions.push(`pc.is_active = false`)
      }
    }

    if (conditions.length > 0) {
      query = sql`${query} WHERE ${sql.unsafe(conditions.join(" AND "))}`
    }

    query = sql`${query} GROUP BY pc.id ORDER BY pc.created_at DESC`

    const configs = await query

    // Format the response
    const formattedConfigs = configs.map((config: any) => ({
      id: config.id,
      topic: config.topic,
      difficulty: config.difficulty,
      daily_limit: config.daily_limit,
      is_active: config.is_active,
      created_at: config.created_at,
      updated_at: config.updated_at,
      question_count: Number(config.question_count || 0),
      student_count: Number(config.student_count || 0),
      completion_rate: Number(config.completion_rate || 0),
      average_score: Number(config.average_score || 0),
    }))

    return NextResponse.json({ configs: formattedConfigs })
  } catch (error) {
    console.error("Failed to fetch practice configs:", error)
    return NextResponse.json({ error: "Failed to fetch practice configs" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { topic, difficulty, daily_limit, is_active } = body

    const result = await sql`
      INSERT INTO practice_configs (topic, difficulty, daily_limit, is_active, created_by)
      VALUES (${topic}, ${difficulty}, ${daily_limit}, ${is_active}, ${adminId})
      RETURNING id
    `

    return NextResponse.json({ 
      message: "Practice configuration created successfully", 
      configId: result[0].id 
    })
  } catch (error) {
    console.error("Failed to create practice config:", error)
    return NextResponse.json({ error: "Failed to create practice config" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { configId, is_active, daily_limit } = body

    const result = await sql`
      UPDATE practice_configs 
      SET 
        is_active = ${is_active},
        daily_limit = ${daily_limit || null},
        updated_at = NOW()
      WHERE id = ${configId}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Configuration not found" }, { status: 404 })
    }

    return NextResponse.json({ 
      message: "Practice configuration updated successfully" 
    })
  } catch (error) {
    console.error("Failed to update practice config:", error)
    return NextResponse.json({ error: "Failed to update practice config" }, { status: 500 })
  }
}

