import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

function trimOrEmpty(v: string | null | undefined) {
  return v == null ? "" : String(v).trim()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const moduleFilter = trimOrEmpty(searchParams.get("module"))
    const subModuleFilter = trimOrEmpty(searchParams.get("subModule"))
    const eventType = trimOrEmpty(searchParams.get("eventType"))
    const status = trimOrEmpty(searchParams.get("status"))
    const userIdRaw = trimOrEmpty(searchParams.get("userId"))
    const sessionId = trimOrEmpty(searchParams.get("sessionId"))
    const startDate = trimOrEmpty(searchParams.get("startDate"))
    const endDate = trimOrEmpty(searchParams.get("endDate"))
    const limit = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get("limit") || "100", 10)),
    )
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10))

    const dateExt: string[] = []
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      dateExt.push(`ol.timestamp::date >= '${startDate}'::date`)
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      dateExt.push(`ol.timestamp::date <= '${endDate}'::date`)
    }
    const dateSqlFrag =
      dateExt.length > 0 ? ` AND ${dateExt.join(" AND ")}` : ""

    const userIdOk = /^\d+$/.test(userIdRaw)
    const userIdBound = userIdOk ? parseInt(userIdRaw, 10) : -999999999

    const logs = await sql`
      SELECT 
        ol.*,
        s.full_name as student_name,
        s.student_id as student_number,
        s.email as student_email
      FROM observability_logs ol
      LEFT JOIN students s ON ol.user_id = s.id
      WHERE
        (${moduleFilter} = '' OR ol.module = ${moduleFilter})
        AND (${subModuleFilter} = '' OR ol.sub_module = ${subModuleFilter})
        AND (${eventType} = '' OR ol.event_type = ${eventType})
        AND (${status} = '' OR ol.status = ${status})
        AND (${sessionId} = '' OR ol.session_id = ${sessionId})
        AND (${userIdRaw} = '' OR ol.user_id = ${userIdBound})
        ${sql.unsafe(dateSqlFrag)}
      ORDER BY ol.timestamp DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const countResult = await sql`
      SELECT COUNT(*)::int as total
      FROM observability_logs ol
      WHERE
        (${moduleFilter} = '' OR ol.module = ${moduleFilter})
        AND (${subModuleFilter} = '' OR ol.sub_module = ${subModuleFilter})
        AND (${eventType} = '' OR ol.event_type = ${eventType})
        AND (${status} = '' OR ol.status = ${status})
        AND (${sessionId} = '' OR ol.session_id = ${sessionId})
        AND (${userIdRaw} = '' OR ol.user_id = ${userIdBound})
        ${sql.unsafe(dateSqlFrag)}
    `

    const total = parseInt(String(countResult[0]?.total || "0"), 10)

    const stats = await sql`
      SELECT 
        ol.module,
        ol.status,
        COUNT(*)::int as count
      FROM observability_logs ol
      WHERE
        (${moduleFilter} = '' OR ol.module = ${moduleFilter})
        AND (${subModuleFilter} = '' OR ol.sub_module = ${subModuleFilter})
        AND (${eventType} = '' OR ol.event_type = ${eventType})
        AND (${status} = '' OR ol.status = ${status})
        AND (${sessionId} = '' OR ol.session_id = ${sessionId})
        AND (${userIdRaw} = '' OR ol.user_id = ${userIdBound})
        ${sql.unsafe(dateSqlFrag)}
      GROUP BY ol.module, ol.status
      ORDER BY count DESC
    `

    return NextResponse.json({
      logs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats,
    })
  } catch (error) {
    console.error("[Observability] Failed to fetch logs:", error)
    return NextResponse.json(
      { error: "Failed to fetch observability logs" },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const f = body?.filters ?? {}
    const moduleFilter = trimOrEmpty(f.module)
    const status = trimOrEmpty(f.status)
    const userIdRaw = trimOrEmpty(f.userId != null ? String(f.userId) : "")
    const startDate = trimOrEmpty(f.startDate)
    const endDate = trimOrEmpty(f.endDate)

    const userIdOk = /^\d+$/.test(userIdRaw)
    const userIdBound = userIdOk ? parseInt(userIdRaw, 10) : -999999999

    const postDateExt: string[] = []
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      postDateExt.push(`ol.timestamp::date >= '${startDate}'::date`)
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      postDateExt.push(`ol.timestamp::date <= '${endDate}'::date`)
    }
    const postDateSqlFrag =
      postDateExt.length > 0 ? ` AND ${postDateExt.join(" AND ")}` : ""

    const logs = await sql`
      SELECT 
        ol.id,
        ol.timestamp,
        ol.module,
        ol.sub_module,
        ol.event_type,
        ol.status,
        ol.event_data,
        s.full_name as student_name,
        s.student_id as student_number
      FROM observability_logs ol
      LEFT JOIN students s ON ol.user_id = s.id
      WHERE
        (${moduleFilter} = '' OR ol.module = ${moduleFilter})
        AND (${status} = '' OR ol.status = ${status})
        AND (${userIdRaw} = '' OR ol.user_id = ${userIdBound})
        ${sql.unsafe(postDateSqlFrag)}
      ORDER BY ol.timestamp DESC
      LIMIT 10000
    `

    return NextResponse.json({ logs })
  } catch (error) {
    console.error("[Observability] Failed to export logs:", error)
    return NextResponse.json(
      { error: "Failed to export logs" },
      { status: 500 },
    )
  }
}
