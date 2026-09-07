import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lectureId = searchParams.get("lectureId")

    if (!lectureId) {
      return NextResponse.json({ error: "Lecture ID is required" }, { status: 400 })
    }

    const materials = await sql`
      SELECT 
        lm.*
      FROM lecture_materials lm
      WHERE lm.lecture_id = ${lectureId}
      ORDER BY lm.uploaded_at DESC
    `

    return NextResponse.json(materials)
  } catch (error) {
    console.error("Error fetching lecture materials:", error)
    return NextResponse.json({ error: "Failed to fetch materials" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lectureId, fileUrl, title, fileType, uploadedBy } = body

    if (!lectureId || !fileUrl || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const [material] = await sql`
      INSERT INTO lecture_materials (lecture_id, file_url, title, file_type, uploaded_by)
      VALUES (${lectureId}, ${fileUrl}, ${title}, ${fileType || "file"}, ${uploadedBy})
      RETURNING *
    `

    return NextResponse.json(material, { status: 201 })
  } catch (error) {
    console.error("Error creating lecture material:", error)
    return NextResponse.json({ error: "Failed to create material" }, { status: 500 })
  }
}
