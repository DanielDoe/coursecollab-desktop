import { type NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const sql = getSQL()
    const results: any = {}
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

    // Tables to clean up
    const tables = [
      { name: "quizzes", hasQuestions: true },
      { name: "students", hasQuestions: false },
      { name: "groups", hasQuestions: false },
      { name: "projects", hasQuestions: false },
      { name: "lectures", hasQuestions: false },
      { name: "lecture_slides", hasQuestions: false },
      { name: "sessions", hasQuestions: false },
      { name: "announcements", hasQuestions: false }
    ]

    for (const table of tables) {
      try {
        // Find items deleted more than 24 hours ago
        const itemsToDelete = await sql`
          SELECT id, title, deleted_at
          FROM ${sql(table.name)}
          WHERE deleted_at IS NOT NULL
          AND deleted_at < ${cutoffTime.toISOString()}
        `

        if (itemsToDelete.length > 0) {
          // Log to deletion history before permanent deletion
          for (const item of itemsToDelete) {
            try {
              await sql`
                INSERT INTO deletion_history (
                  table_name, record_id, record_title, deleted_at, 
                  permanently_deleted, permanently_deleted_at
                )
                VALUES (
                  ${table.name}, ${item.id}, ${item.title || 'Untitled'},
                  ${item.deleted_at}, true, NOW()
                )
              `
            } catch (error) {
              console.log(`Could not log deletion history for ${table.name}:${item.id}`)
            }
          }

          // Permanently delete the items
          if (table.hasQuestions && table.name === "quizzes") {
            // Delete quiz questions first
            for (const item of itemsToDelete) {
              await sql`DELETE FROM quiz_questions WHERE quiz_id = ${item.id}`
            }
          }

          const deleted = await sql`
            DELETE FROM ${sql(table.name)}
            WHERE deleted_at IS NOT NULL
            AND deleted_at < ${cutoffTime.toISOString()}
            RETURNING id
          `

          results[table.name] = {
            deleted_count: deleted.length,
            items: itemsToDelete.map(i => ({ id: i.id, title: i.title, deleted_at: i.deleted_at }))
          }
        } else {
          results[table.name] = {
            deleted_count: 0,
            message: "No items older than 24 hours"
          }
        }
      } catch (error: any) {
        results[table.name] = {
          error: error.message
        }
      }
    }

    const totalDeleted = Object.values(results)
      .reduce((sum: number, r: any) => sum + (r.deleted_count || 0), 0)

    return NextResponse.json({
      success: true,
      message: `Cleanup completed. ${totalDeleted} items permanently deleted.`,
      cutoff_time: cutoffTime.toISOString(),
      details: results
    })
  } catch (error: any) {
    console.error("[Cleanup Old Deletions] Failed:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to cleanup old deletions",
      details: error.message
    }, { status: 500 })
  }
}

// GET endpoint to check what will be deleted (dry run)
export async function GET(request: NextRequest) {
  try {
    const sql = getSQL()
    const results: any = {}
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

    const tables = ["quizzes", "students", "groups", "projects", "lectures", "lecture_slides", "sessions", "announcements"]

    for (const tableName of tables) {
      try {
        const items = await sql`
          SELECT id, title, deleted_at, deleted_by
          FROM ${sql(tableName)}
          WHERE deleted_at IS NOT NULL
          AND deleted_at < ${cutoffTime.toISOString()}
        `

        results[tableName] = {
          count: items.length,
          items: items.map(i => ({
            id: i.id,
            title: i.title || 'Untitled',
            deleted_at: i.deleted_at,
            deleted_by: i.deleted_by,
            hours_since_deletion: Math.floor((Date.now() - new Date(i.deleted_at).getTime()) / (1000 * 60 * 60))
          }))
        }
      } catch (error: any) {
        results[tableName] = { error: error.message }
      }
    }

    const totalPending = Object.values(results)
      .reduce((sum: number, r: any) => sum + (r.count || 0), 0)

    return NextResponse.json({
      success: true,
      message: `${totalPending} items will be permanently deleted (older than 24 hours)`,
      cutoff_time: cutoffTime.toISOString(),
      details: results
    })
  } catch (error: any) {
    console.error("[Check Cleanup] Failed:", error)
    return NextResponse.json({
      success: false,
      error: "Failed to check cleanup status",
      details: error.message
    }, { status: 500 })
  }
}
