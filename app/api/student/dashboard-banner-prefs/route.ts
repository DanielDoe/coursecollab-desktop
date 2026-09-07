import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"
import { BANNER_PREF_MODULES } from "@/lib/student-dashboard-banner-prefs-shared"

export const dynamic = "force-dynamic"

const MODULE_BY_BANNER = {
  welcome: BANNER_PREF_MODULES.welcome,
  coursePolicyNotice: BANNER_PREF_MODULES.coursePolicyNotice,
} as const

type BannerKey = keyof typeof MODULE_BY_BANNER

async function readDismissed(studentDbId: number, moduleName: string): Promise<boolean> {
  const rows = await sql`
    SELECT is_favorite
    FROM student_module_preferences
    WHERE student_id = ${studentDbId}
      AND module_name = ${moduleName}
    LIMIT 1
  `
  return rows.length > 0 && rows[0].is_favorite === true
}

async function writeDismissed(studentDbId: number, moduleName: string): Promise<void> {
  await sql`
    INSERT INTO student_module_preferences (
      student_id,
      module_name,
      is_favorite,
      display_order,
      usage_count,
      last_accessed
    )
    VALUES (${studentDbId}, ${moduleName}, true, 0, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (student_id, module_name)
    DO UPDATE SET
      is_favorite = true,
      last_accessed = CURRENT_TIMESTAMP
  `
}

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    const auth = await requireStudentIdParamMatchesCaller(request, studentId)
    if (!auth.ok) return auth.response

    const [welcomeDismissed, coursePolicyNoticeDismissed] = await Promise.all([
      readDismissed(auth.studentDbId, BANNER_PREF_MODULES.welcome),
      readDismissed(auth.studentDbId, BANNER_PREF_MODULES.coursePolicyNotice),
    ])

    return NextResponse.json({
      welcomeDismissed,
      coursePolicyNoticeDismissed,
    })
  } catch (error) {
    console.error("[Dashboard Banner Prefs GET]", error)
    return NextResponse.json({ error: "Failed to load banner preferences" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const banner = body.banner as BannerKey | undefined
    const dismissed = body.dismissed === true

    if (!banner || !(banner in MODULE_BY_BANNER)) {
      return NextResponse.json({ error: "Invalid banner key" }, { status: 400 })
    }
    if (!dismissed) {
      return NextResponse.json({ error: "Only permanent dismissal is supported" }, { status: 400 })
    }

    const auth = await requireStudentIdParamMatchesCaller(request, body.studentId ?? null)
    if (!auth.ok) return auth.response

    await writeDismissed(auth.studentDbId, MODULE_BY_BANNER[banner])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Dashboard Banner Prefs POST]", error)
    return NextResponse.json({ error: "Failed to save banner preference" }, { status: 500 })
  }
}
