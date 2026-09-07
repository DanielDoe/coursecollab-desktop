import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const module = searchParams.get("module")

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Check if user is a beta user
    const userResult = await sql`
      SELECT beta_user FROM students WHERE student_id = ${userId}
    `

    if (userResult.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const isBetaUser = userResult[0].beta_user

    // Get feature flags
    let query = sql`
      SELECT flag_name, description, enabled_for_beta, enabled_for_all, module
      FROM feature_flags
      WHERE 1=1
    `

    if (module) {
      query = sql`
        SELECT flag_name, description, enabled_for_beta, enabled_for_all, module
        FROM feature_flags
        WHERE module = ${module}
      `
    }

    const flags = await query

    // Filter flags based on user type
    const enabledFlags = flags.filter(flag => 
      flag.enabled_for_all || (isBetaUser && flag.enabled_for_beta)
    )

    return NextResponse.json({
      isBetaUser,
      flags: enabledFlags,
      allFlags: flags
    })

  } catch (error) {
    console.error("[v0] Feature flags error:", error)
    return NextResponse.json(
      { error: "Failed to fetch feature flags" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { flagName, enabledForBeta, enabledForAll, module, description } = body

    if (!flagName) {
      return NextResponse.json({ error: "Flag name is required" }, { status: 400 })
    }

    // Insert or update feature flag
    await sql`
      INSERT INTO feature_flags (flag_name, description, enabled_for_beta, enabled_for_all, module)
      VALUES (${flagName}, ${description || ''}, ${enabledForBeta || false}, ${enabledForAll || false}, ${module || ''})
      ON CONFLICT (flag_name) 
      DO UPDATE SET 
        enabled_for_beta = ${enabledForBeta || false},
        enabled_for_all = ${enabledForAll || false},
        description = ${description || ''},
        module = ${module || ''}
    `

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("[v0] Feature flag update error:", error)
    return NextResponse.json(
      { error: "Failed to update feature flag" },
      { status: 500 }
    )
  }
}
