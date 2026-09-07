import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === "increment-view") {
      const [material] = await sql`
        UPDATE lecture_materials
        SET view_count = view_count + 1
        WHERE id = ${params.id}
        RETURNING *
      `
      return NextResponse.json(material)
    }

    if (action === "reset-views") {
      const [material] = await sql`
        UPDATE lecture_materials
        SET view_count = 0
        WHERE id = ${params.id}
        RETURNING *
      `
      return NextResponse.json(material)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error updating material:", error)
    return NextResponse.json({ error: "Failed to update material" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await sql`DELETE FROM lecture_materials WHERE id = ${params.id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting material:", error)
    return NextResponse.json({ error: "Failed to delete material" }, { status: 500 })
  }
}
