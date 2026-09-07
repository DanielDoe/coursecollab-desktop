import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

// GET - Fetch all configuration settings
export async function GET() {
  try {
    const config = await sql`
      SELECT * FROM ai_tutor_config
      ORDER BY setting_key
    `

    const configObj = config.reduce((acc: any, item: any) => {
      acc[item.setting_key] = {
        value: item.setting_value,
        description: item.description,
        updated_at: item.updated_at
      }
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      config: configObj
    })
  } catch (error: any) {
    console.error("[AI Tutor Config GET Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch configuration" },
      { status: 500 }
    )
  }
}

// PUT - Update configuration setting
export async function PUT(request: NextRequest) {
  try {
    const { setting_key, setting_value, updated_by = "instructor" } = await request.json()

    if (!setting_key || !setting_value) {
      return NextResponse.json(
        { success: false, error: "setting_key and setting_value are required" },
        { status: 400 }
      )
    }

    // Update configuration
    const result = await sql`
      UPDATE ai_tutor_config
      SET 
        setting_value = ${JSON.stringify(setting_value)},
        updated_at = NOW(),
        updated_by = ${updated_by}
      WHERE setting_key = ${setting_key}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: "Configuration key not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Configuration updated successfully",
      config: result[0]
    })
  } catch (error: any) {
    console.error("[AI Tutor Config PUT Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to update configuration" },
      { status: 500 }
    )
  }
}

