import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { assertAnnouncementUnlockedForStudent } from "@/lib/announcement-student-lock-server"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

/**
 * POST /api/announcements/[id]/react
 * Add or remove a reaction to an announcement (student only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { studentId, reactionType } = body

    const auth = await requireBoundStudentCaller(
      request,
      studentId != null ? String(studentId) : null,
    )
    if (!auth.ok) return auth.response

    if (!reactionType) {
      return NextResponse.json({ error: "Reaction type is required" }, { status: 400 })
    }

    // Validate reaction type
    const validReactions = ['like', 'love', 'wow', 'laugh', 'fire']
    if (!validReactions.includes(reactionType)) {
      return NextResponse.json({ error: "Invalid reaction type" }, { status: 400 })
    }

    // Check if announcement exists
    const announcement = await sql`
      SELECT id FROM announcements WHERE id = ${id}
    `

    if (announcement.length === 0) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    const lockState = await assertAnnouncementUnlockedForStudent(Number(id))
    if (lockState.locked) {
      return NextResponse.json(
        { error: "Reactions are locked until your instructor unlocks this announcement." },
        { status: 403 },
      )
    }

    // Check if student already reacted
    const existingReaction = await sql`
      SELECT * FROM announcement_reactions
      WHERE announcement_id = ${id} AND student_id = ${auth.studentDbId}
    `

    if (existingReaction.length > 0) {
      // If same reaction, remove it (toggle off)
      if (existingReaction[0].reaction_type === reactionType) {
        await sql`
          DELETE FROM announcement_reactions
          WHERE announcement_id = ${id} AND student_id = ${auth.studentDbId}
        `
        
        return NextResponse.json({ 
          message: "Reaction removed",
          action: "removed",
          reactionType: null
        })
      } else {
        // Different reaction, update it
        await sql`
          UPDATE announcement_reactions
          SET reaction_type = ${reactionType}, created_at = CURRENT_TIMESTAMP
          WHERE announcement_id = ${id} AND student_id = ${auth.studentDbId}
        `
        
        return NextResponse.json({ 
          message: "Reaction updated",
          action: "updated",
          reactionType
        })
      }
    } else {
      // New reaction, insert it
      await sql`
        INSERT INTO announcement_reactions (announcement_id, student_id, reaction_type)
        VALUES (${id}, ${auth.studentDbId}, ${reactionType})
      `
      
      return NextResponse.json({ 
        message: "Reaction added",
        action: "added",
        reactionType
      })
    }
  } catch (error) {
    console.error("[Announcements] React error:", error)
    return NextResponse.json({ error: "Failed to process reaction" }, { status: 500 })
  }
}

/**
 * GET /api/announcements/[id]/react
 * Get all reactions for an announcement
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get reaction breakdown
    const reactions = await sql`
      SELECT 
        reaction_type,
        COUNT(*) as count,
        ARRAY_AGG(s.full_name) as student_names
      FROM announcement_reactions ar
      JOIN students s ON ar.student_id = s.id
      WHERE ar.announcement_id = ${id}
      GROUP BY reaction_type
    `

    const breakdown = reactions.reduce((acc, r) => {
      acc[r.reaction_type] = {
        count: Number(r.count),
        students: r.student_names
      }
      return acc
    }, {} as Record<string, { count: number; students: string[] }>)

    return NextResponse.json({ reactions: breakdown })
  } catch (error) {
    console.error("[Announcements] Get reactions error:", error)
    return NextResponse.json({ error: "Failed to fetch reactions" }, { status: 500 })
  }
}

