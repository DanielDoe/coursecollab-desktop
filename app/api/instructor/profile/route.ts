import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const instructor = await sql`
      SELECT 
        id, username, email, name, created_at, last_login
      FROM instructors 
      WHERE id = ${instructorId}
    `

    if (instructor.length === 0) {
      return NextResponse.json({ error: "Instructor not found" }, { status: 404 })
    }

    return NextResponse.json({ instructor: instructor[0] })
  } catch (error) {
    console.error("Error fetching instructor profile:", error)
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    const body = await request.json()
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const { name, email, username } = body

    const instructor = await sql`
      UPDATE instructors 
      SET name = ${name}, email = ${email}, username = ${username}
      WHERE id = ${instructorId}
      RETURNING *
    `

    return NextResponse.json({ instructor: instructor[0] })
  } catch (error) {
    console.error("Error updating instructor profile:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}

