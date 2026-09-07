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

    const memberships = await sql`
      SELECT 
        m.*,
        COUNT(s.id) as student_count
      FROM memberships m
      LEFT JOIN students s ON s.membership_tier = m.tier_name
      GROUP BY m.id
      ORDER BY m.price ASC
    `

    return NextResponse.json({ memberships })
  } catch (error) {
    console.error("Error fetching memberships:", error)
    return NextResponse.json({ error: "Failed to fetch memberships" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const instructorId = request.nextUrl.searchParams.get("instructorId")
    const body = await request.json()
    
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID required" }, { status: 400 })
    }

    const { tier_name, price, features, limitations } = body

    const membership = await sql`
      INSERT INTO memberships (
        tier_name, price, features, limitations, created_at
      ) VALUES (
        ${tier_name}, ${price}, ${JSON.stringify(features)}, ${JSON.stringify(limitations)}, NOW()
      ) RETURNING *
    `

    return NextResponse.json({ membership: membership[0] })
  } catch (error) {
    console.error("Error creating membership:", error)
    return NextResponse.json({ error: "Failed to create membership" }, { status: 500 })
  }
}

