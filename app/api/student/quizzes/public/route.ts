import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    // This table was planned but not yet created in the schema
    return NextResponse.json({ quizzes: [] })
  } catch (error) {
    console.error("[v0] Failed to fetch public quizzes:", error)
    return NextResponse.json({ error: "Failed to fetch quizzes" }, { status: 500 })
  }
}
