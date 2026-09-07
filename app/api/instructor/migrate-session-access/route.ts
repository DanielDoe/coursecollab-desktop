import { NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import { resolveSessionRowByCode } from "@/lib/resolve-session-by-code"

export async function POST(request: NextRequest) {
  try {
    const sql = getSQL()
    
    console.log("[Migration] Starting session access migration...")
    
    // Get all quizzes that have session_access JSON but no quiz_session_access records
    const quizzes = await sql`
      SELECT 
        q.id,
        q.title,
        q.session_access,
        q.assessment_type
      FROM quizzes q
      WHERE q.session_access IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM quiz_session_access qsa WHERE qsa.quiz_id = q.id
      )
    `
    
    console.log(`[Migration] Found ${quizzes.length} quizzes to migrate`)
    
    let migratedCount = 0
    
    for (const quiz of quizzes) {
      try {
        const sessionAccess = JSON.parse(quiz.session_access)
        console.log(`[Migration] Processing quiz ${quiz.id} (${quiz.title}):`, sessionAccess)
        
        for (const [sessionCode, isActive] of Object.entries(sessionAccess)) {
          const resolved = await resolveSessionRowByCode(String(sessionCode))
          if (resolved) {
            const sessionId = resolved.id
            await sql`
              INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
              VALUES (${quiz.id}, ${sessionId}, ${isActive}, CURRENT_TIMESTAMP)
              ON CONFLICT (quiz_id, session_id)
              DO UPDATE SET 
                is_active = ${isActive}, 
                updated_at = CURRENT_TIMESTAMP
            `
            console.log(`[Migration] Created session access for quiz ${quiz.id}, session ${sessionCode}: ${isActive}`)
          } else {
            console.log(`[Migration] Session ${sessionCode} not found for quiz ${quiz.id}`)
          }
        }
        
        migratedCount++
      } catch (error) {
        console.error(`[Migration] Error processing quiz ${quiz.id}:`, error)
      }
    }
    
    // Also handle quizzes with no session_access JSON - create default access for all sessions
    const quizzesWithoutSessionAccess = await sql`
      SELECT 
        q.id,
        q.title,
        q.assessment_type
      FROM quizzes q
      WHERE q.session_access IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM quiz_session_access qsa WHERE qsa.quiz_id = q.id
      )
    `
    
    console.log(`[Migration] Found ${quizzesWithoutSessionAccess.length} quizzes without session access`)
    
    for (const quiz of quizzesWithoutSessionAccess) {
      try {
        // Get all sessions
        const sessions = await sql`
          SELECT id, code FROM sessions
        `
        
        // Create session access for all sessions (default to false for security)
        for (const session of sessions) {
          await sql`
            INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
            VALUES (${quiz.id}, ${session.id}, false, CURRENT_TIMESTAMP)
            ON CONFLICT (quiz_id, session_id)
            DO UPDATE SET 
              is_active = false, 
              updated_at = CURRENT_TIMESTAMP
          `
          
          console.log(`[Migration] Created default session access for quiz ${quiz.id}, session ${session.code}: false`)
        }
        
        migratedCount++
      } catch (error) {
        console.error(`[Migration] Error processing quiz without session access ${quiz.id}:`, error)
      }
    }
    
    console.log(`[Migration] Migration completed. Processed ${migratedCount} quizzes.`)
    
    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${migratedCount} quizzes`,
      migratedCount,
      quizzesWithAccess: quizzes.length,
      quizzesWithoutAccess: quizzesWithoutSessionAccess.length
    })
    
  } catch (error) {
    console.error("[Migration] Migration failed:", error)
    return NextResponse.json(
      { error: "Migration failed", details: error.message },
      { status: 500 }
    )
  }
}
