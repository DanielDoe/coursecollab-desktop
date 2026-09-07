import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = sessionStorage.getItem("adminId")
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { questionIds, action } = body

    if (!questionIds || !Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json({ error: "Invalid question IDs" }, { status: 400 })
    }

    let result
    switch (action) {
      case "archive":
        result = await sql`
          UPDATE questions 
          SET is_archived = true, updated_at = NOW()
          WHERE id = ANY(${questionIds})
        `
        break
      
      case "unarchive":
        result = await sql`
          UPDATE questions 
          SET is_archived = false, updated_at = NOW()
          WHERE id = ANY(${questionIds})
        `
        break
      
      case "favorite":
        result = await sql`
          UPDATE questions 
          SET is_favorite = true, updated_at = NOW()
          WHERE id = ANY(${questionIds})
        `
        break
      
      case "unfavorite":
        result = await sql`
          UPDATE questions 
          SET is_favorite = false, updated_at = NOW()
          WHERE id = ANY(${questionIds})
        `
        break
      
      case "delete":
        result = await sql`
          DELETE FROM questions 
          WHERE id = ANY(${questionIds})
        `
        break
      
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    return NextResponse.json({ 
      message: `Bulk ${action} completed successfully`,
      affectedRows: result.count 
    })
  } catch (error) {
    console.error(`Failed to perform bulk ${action}:`, error)
    return NextResponse.json({ error: `Failed to perform bulk ${action}` }, { status: 500 })
  }
}

