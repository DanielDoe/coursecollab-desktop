import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// Create a new section for a lecture
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lecture_id, section_order, heading, content, bullets, code_snippet, image_url } = body

    console.log("[v0] Creating new section for lecture:", lecture_id)

    const result = await sql`
      INSERT INTO lecture_sections (lecture_id, section_order, heading, content, bullets, code_snippet, image_url)
      VALUES (
        ${lecture_id}, 
        ${section_order || 0}, 
        ${heading || null}, 
        ${content || null}, 
        ${bullets || null}, 
        ${code_snippet || null}, 
        ${image_url || null}
      )
      RETURNING *
    `

    console.log("[v0] Section created with ID:", result[0].id)
    return NextResponse.json({ section: result[0] })
  } catch (error) {
    console.error("[v0] Failed to create section:", error)
    return NextResponse.json({ error: "Failed to create section" }, { status: 500 })
  }
}
