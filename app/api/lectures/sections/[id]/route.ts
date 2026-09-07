import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

// Update a section
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sectionId = params.id
    const body = await request.json()
    const { section_order, heading, content, bullets, code_snippet, image_url } = body

    console.log("[v0] Updating section with ID:", sectionId)

    const result = await sql`
      UPDATE lecture_sections
      SET 
        section_order = COALESCE(${section_order}, section_order),
        heading = COALESCE(${heading}, heading),
        content = COALESCE(${content}, content),
        bullets = COALESCE(${bullets}, bullets),
        code_snippet = COALESCE(${code_snippet}, code_snippet),
        image_url = COALESCE(${image_url}, image_url)
      WHERE id = ${sectionId}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 })
    }

    console.log("[v0] Section updated successfully")
    return NextResponse.json({ section: result[0] })
  } catch (error) {
    console.error("[v0] Failed to update section:", error)
    return NextResponse.json({ error: "Failed to update section" }, { status: 500 })
  }
}

// Delete a section
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const sectionId = params.id

    console.log("[v0] Deleting section with ID:", sectionId)

    const result = await sql`
      DELETE FROM lecture_sections
      WHERE id = ${sectionId}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 })
    }

    console.log("[v0] Section deleted successfully")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Failed to delete section:", error)
    return NextResponse.json({ error: "Failed to delete section" }, { status: 500 })
  }
}
