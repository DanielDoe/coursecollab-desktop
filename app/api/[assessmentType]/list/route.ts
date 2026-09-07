import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAssessmentConfig, type AssessmentType } from "@/lib/assessment-core/db"
import { assessmentListCreatorIdForActor } from "@/lib/instructor-actor-scope"
import {
  augmentSessionAccessWithLegacyAliases,
  normalizedSectionVariantsForSql,
} from "@/lib/session-code-aliases"

export const dynamic = 'force-dynamic'

/**
 * GET /api/[assessmentType]/list
 * 
 * Dynamic list endpoint for all assessment types
 * Replaces old /api/assessments?type=... pattern
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentType: string }> }
) {
  try {
    const resolvedParams = await params
    const assessmentType = resolvedParams.assessmentType as AssessmentType
    
    // Validate assessment type
    const validTypes: AssessmentType[] = ['quiz', 'homework', 'midsem', 'final', 'practice', 'points']
    if (!validTypes.includes(assessmentType)) {
      return NextResponse.json(
        { error: `Invalid assessment type: ${assessmentType}` },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const instructorId = searchParams.get("instructorId")
    const studentId = searchParams.get("studentId")
    const session = searchParams.get("session")
    const status = searchParams.get("status")
    const saved = searchParams.get("saved")

    const config = getAssessmentConfig(assessmentType)

    // For students: get available assessments
    if (studentId) {
      // Build column references as strings for sql.unsafe()
      const questionIdColumn = `q.${config.idColumn}`
      const attemptIdColumn = `att.${config.idColumn}`
      
      let query = sql`
        SELECT 
          a.id,
          a.title,
          a.description,
          a.created_by,
          a.is_public,
          a.is_active,
          a.time_per_question,
          a.available_from,
          a.available_until,
          a.retake_enabled,
          a.retake_limit,
          a.retake_policy,
          a.review_before_retake,
          a.is_saved,
          a.parent_quiz_id,
          a.strict_mode_enabled,
          a.block_copy_paste,
          a.track_tab_switches,
          a.track_mouse_movement,
          a.warn_on_tab_switch,
          a.max_tab_switches,
          a.auto_submit_on_violations,
          a.session_access,
          a.created_at,
          a.updated_at,
          a.deleted_at,
          COUNT(DISTINCT q.id) as question_count,
          COUNT(DISTINCT att.id) as attempt_count,
          MAX(att.attempt_number) as max_attempt_number,
          MAX(att.completed_at) as last_attempt_date
        FROM ${sql.unsafe(config.tableName)} a
        LEFT JOIN ${sql.unsafe(config.questionsTable)} q ON a.id = ${sql.unsafe(questionIdColumn)}
        LEFT JOIN ${sql.unsafe(config.attemptsTable)} att ON a.id = ${sql.unsafe(attemptIdColumn)} AND att.student_id = ${Number(studentId)}
        WHERE a.deleted_at IS NULL
        AND a.is_active = true
        AND (a.available_from IS NULL OR a.available_from <= NOW())
        AND (a.available_until IS NULL OR a.available_until > NOW())
      `

      if (session && session !== "all") {
        const sessionVariants = normalizedSectionVariantsForSql(session)
        query = sql`
          ${query}
          AND EXISTS (
            SELECT 1 FROM ${sql.unsafe(config.sessionAccessTable)} sa
            JOIN sessions s ON sa.session_id = s.id
            WHERE sa.${sql.unsafe(config.idColumn)} = a.id
            AND TRIM(s.code) = ANY(${sessionVariants}::text[])
            AND sa.is_active = true
          )
        `
      }

      query = sql`
        ${query}
        GROUP BY 
          a.id, a.title, a.description, a.created_by, a.is_public, a.is_active,
          a.time_per_question, a.available_from, a.available_until, a.retake_enabled,
          a.retake_limit, a.retake_policy, a.review_before_retake, a.is_saved,
          a.parent_quiz_id, a.strict_mode_enabled, a.block_copy_paste,
          a.track_tab_switches, a.track_mouse_movement, a.warn_on_tab_switch,
          a.max_tab_switches, a.auto_submit_on_violations, a.session_access,
          a.created_at, a.updated_at, a.deleted_at
        ORDER BY a.available_from DESC, a.created_at DESC
      `

      const assessments = await query
      return NextResponse.json({ assessments })
    }

    // For instructors: get all assessments they created (TAs see supervising instructor's content)
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID or Student ID required" }, { status: 400 })
    }

    const actorId = Number(instructorId)
    const listCreatorId = await assessmentListCreatorIdForActor(actorId)

    // Check if migration has been run (quizzes_legacy exists = migration completed)
    // Also check if assessment_type column exists (old table has it, new table doesn't)
    let useOldTable = true
    let needsTypeFilter = false
    try {
      // Check if migration ran (quizzes_legacy table exists)
      const migrationRan = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'quizzes_legacy'
        ) as exists
      `
      
      // Check if assessment_type column exists in quizzes table
      const hasAssessmentTypeColumn = await sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public'
          AND table_name = ${config.tableName}
          AND column_name = 'assessment_type'
        ) as exists
      `
      
      const migrationCompleted = migrationRan[0]?.exists
      const hasTypeColumn = hasAssessmentTypeColumn[0]?.exists
      
      // If migration ran, use new table (no filter needed)
      // If migration didn't run but table has assessment_type column, it's the old table - need filter
      if (migrationCompleted) {
        // Migration completed - new clean table exists
        const tableCheck = await sql`
          SELECT COUNT(*) as count
          FROM ${sql.unsafe(config.tableName)}
          WHERE deleted_at IS NULL
        `
        const count = Number(tableCheck[0]?.count || 0)
        
        if (count > 0) {
          useOldTable = false
          needsTypeFilter = false
        } else {
          useOldTable = true
          needsTypeFilter = true
        }
      } else if (hasTypeColumn && config.tableName === 'quizzes') {
        // Old table still in use - needs filter
        useOldTable = true
        needsTypeFilter = true
      } else {
        // New table exists without assessment_type column
        const tableCheck = await sql`
          SELECT COUNT(*) as count
          FROM ${sql.unsafe(config.tableName)}
          WHERE deleted_at IS NULL
        `
        const count = Number(tableCheck[0]?.count || 0)
        
        if (count > 0) {
          useOldTable = false
          needsTypeFilter = false
        } else {
          useOldTable = true
          needsTypeFilter = true
        }
      }
    } catch (error) {
      useOldTable = true
      needsTypeFilter = true
    }
    
    // Map assessment types to old table assessment_type values
    const oldTableTypeMap: Record<string, string> = {
      'quiz': 'quiz',
      'homework': 'homework',
      'midsem': 'mid_semester',
      'final': 'final',
      'practice': 'practice'
    }
    
    const oldTableType = oldTableTypeMap[assessmentType] || assessmentType

    // Quiz list includes rows with NULL assessment_type (legacy). Other menus must be strict.
    // Do NOT nest `sql` fragments inside a parent `sql` template — Neon mis-numbers parameters ($2 errors).
    const esc = (s: string) => s.replace(/'/g, "''")
    const assessmentTypeFilterSql = sql.unsafe(
      assessmentType === "quiz"
        ? `AND (a.assessment_type = '${esc(oldTableType)}' OR a.assessment_type IS NULL)`
        : `AND a.assessment_type = '${esc(oldTableType)}'`,
    )

    // Use old table if new table is empty or migration hasn't run
    // Apply assessment_type filter if needed (old table contains all types)
    if (useOldTable && needsTypeFilter) {
      try {
        // Query old quizzes table with assessment_type filter
        // Build query as single template literal to avoid nesting issues with pg.Pool
        const assessments = saved === "true"
          ? await sql`
              SELECT 
                a.id,
                a.title,
                a.description,
                a.created_by,
                a.is_public,
                a.time_per_question,
                a.created_at,
                a.is_saved,
                a.available_from,
                a.available_until,
                COUNT(DISTINCT q.id) as question_count,
                COUNT(DISTINCT att.id) as total_attempts,
                AVG(att.score) as average_score,
                CASE 
                  WHEN COUNT(att.id) > 0 THEN 
                    COUNT(CASE WHEN att.completed_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(att.id)
                  ELSE 0 
                END as completion_rate
              FROM quizzes a
              LEFT JOIN quiz_questions q ON a.id = q.quiz_id
              LEFT JOIN quiz_attempts att ON a.id = att.quiz_id
              WHERE (
                a.created_by = ${listCreatorId}
                OR a.created_by = ${actorId}
                OR EXISTS (SELECT 1 FROM admin_users au WHERE au.id = a.created_by)
              )
              ${assessmentTypeFilterSql}
              AND a.deleted_at IS NULL
              AND a.is_saved = true
              GROUP BY a.id, a.title, a.description, a.created_by, a.is_public, a.time_per_question, a.created_at, a.is_saved, a.available_from, a.available_until
              ORDER BY a.created_at DESC
            `
          : await sql`
              SELECT 
                a.id,
                a.title,
                a.description,
                a.created_by,
                a.is_public,
                a.time_per_question,
                a.created_at,
                a.is_saved,
                a.available_from,
                a.available_until,
                COUNT(DISTINCT q.id) as question_count,
                COUNT(DISTINCT att.id) as total_attempts,
                AVG(att.score) as average_score,
                CASE 
                  WHEN COUNT(att.id) > 0 THEN 
                    COUNT(CASE WHEN att.completed_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(att.id)
                  ELSE 0 
                END as completion_rate
              FROM quizzes a
              LEFT JOIN quiz_questions q ON a.id = q.quiz_id
              LEFT JOIN quiz_attempts att ON a.id = att.quiz_id
              WHERE (
                a.created_by = ${listCreatorId}
                OR a.created_by = ${actorId}
                OR EXISTS (SELECT 1 FROM admin_users au WHERE au.id = a.created_by)
              )
              ${assessmentTypeFilterSql}
              AND a.deleted_at IS NULL
              GROUP BY a.id, a.title, a.description, a.created_by, a.is_public, a.time_per_question, a.created_at, a.is_saved, a.available_from, a.available_until
              ORDER BY a.created_at DESC
            `
        
        // Add session_access for each assessment
        const assessmentsWithAccess = await Promise.all(
          assessments.map(async (assessment: any) => {
            const sessionAccess = await sql`
              SELECT s.code, qsa.is_active, qsa.quiz_id, qsa.session_id
              FROM quiz_session_access qsa
              JOIN sessions s ON qsa.session_id = s.id
              WHERE qsa.quiz_id = ${assessment.id}
            `
            
            const sessionAccessObj = augmentSessionAccessWithLegacyAliases(
              sessionAccess.reduce((acc, row) => {
                acc[row.code] = row.is_active
                return acc
              }, {} as Record<string, boolean>),
            )
            
            // Calculate is_active: must have at least one active session AND be within date range
            const now = new Date()
            const hasActiveSession = sessionAccess.some((s: any) => s.is_active)
            const availableFrom = assessment.available_from ? new Date(assessment.available_from) : null
            const availableUntil = assessment.available_until ? new Date(assessment.available_until) : null
            // Compare dates in UTC to avoid timezone issues
            // Database stores TIMESTAMP WITH TIME ZONE in UTC, so we compare UTC to UTC
            const availableFromOk = !availableFrom || availableFrom.getTime() <= now.getTime()
            const availableUntilOk = !availableUntil || availableUntil.getTime() >= now.getTime()
            // Default is_public to true if not set (for backward compatibility)
            const isPublic = assessment.is_public !== false
            const is_active = hasActiveSession && availableFromOk && availableUntilOk && isPublic
            
            return {
              ...assessment,
              session_access: sessionAccessObj,
              is_active: is_active
            }
          })
        )
        
        return NextResponse.json({ assessments: assessmentsWithAccess })
      } catch (queryError: any) {
        console.error(`[${assessmentType}/list] ❌ Query error:`, queryError.message)
        console.error(`[${assessmentType}/list] ❌ Query error stack:`, queryError.stack)
        throw queryError // Re-throw to be caught by outer catch
      }
    }
    
    // Use shared quiz_questions and quiz_attempts tables for all assessment types
    // The quiz_id column in these tables stores the assessment ID regardless of type
    const questionsTable = 'quiz_questions'
    const attemptsTable = 'quiz_attempts'
    const idColumn = 'quiz_id' // Always use quiz_id column name in shared tables
    
    // Build join conditions as complete strings to avoid nested sql.unsafe()
    const questionJoin = `a.id = q.${idColumn}`
    const attemptJoin = `a.id = att.${idColumn}`
    
    // Build query using sql template literal with sql.unsafe() for dynamic table/column names
    // The new tables are clean and only contain their specific assessment type
    const assessments = saved === "true"
      ? await sql`
          SELECT 
            a.id,
            a.title,
            a.description,
            a.created_by,
            a.is_public,
            a.time_per_question,
            a.created_at,
            a.is_saved,
            a.available_from,
            a.available_until,
            COUNT(DISTINCT q.id) as question_count,
            COUNT(DISTINCT att.id) as total_attempts,
            AVG(att.score) as average_score,
            CASE 
              WHEN COUNT(att.id) > 0 THEN 
                COUNT(CASE WHEN att.completed_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(att.id)
              ELSE 0 
            END as completion_rate
          FROM ${sql.unsafe(config.tableName)} a
          LEFT JOIN ${sql.unsafe(questionsTable)} q ON ${sql.unsafe(questionJoin)}
          LEFT JOIN ${sql.unsafe(attemptsTable)} att ON ${sql.unsafe(attemptJoin)}
          WHERE (
            a.created_by = ${listCreatorId}
            OR a.created_by = ${actorId}
            OR EXISTS (SELECT 1 FROM admin_users au WHERE au.id = a.created_by)
          )
          AND a.deleted_at IS NULL
          AND a.is_saved = true
          ${config.tableName === 'quizzes' ? assessmentTypeFilterSql : sql``}
          GROUP BY a.id, a.title, a.description, a.created_by, a.is_public, a.time_per_question, a.created_at, a.is_saved, a.available_from, a.available_until
          ORDER BY a.created_at DESC
        `
      : await sql`
          SELECT 
            a.id,
            a.title,
            a.description,
            a.created_by,
            a.is_public,
            a.time_per_question,
            a.created_at,
            a.is_saved,
            a.available_from,
            a.available_until,
            COUNT(DISTINCT q.id) as question_count,
            COUNT(DISTINCT att.id) as total_attempts,
            AVG(att.score) as average_score,
            CASE 
              WHEN COUNT(att.id) > 0 THEN 
                COUNT(CASE WHEN att.completed_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(att.id)
              ELSE 0 
            END as completion_rate
          FROM ${sql.unsafe(config.tableName)} a
          LEFT JOIN ${sql.unsafe(questionsTable)} q ON ${sql.unsafe(questionJoin)}
          LEFT JOIN ${sql.unsafe(attemptsTable)} att ON ${sql.unsafe(attemptJoin)}
          WHERE (
            a.created_by = ${listCreatorId}
            OR a.created_by = ${actorId}
            OR EXISTS (SELECT 1 FROM admin_users au WHERE au.id = a.created_by)
          )
          AND a.deleted_at IS NULL
          ${config.tableName === 'quizzes' ? assessmentTypeFilterSql : sql``}
          GROUP BY a.id, a.title, a.description, a.created_by, a.is_public, a.time_per_question, a.created_at, a.is_saved, a.available_from, a.available_until
          ORDER BY a.created_at DESC
        `
    
    // Add session_access for each assessment
    const assessmentsWithAccess = await Promise.all(
      assessments.map(async (assessment: any) => {
        const sessionAccess = await sql`
          SELECT s.code, qsa.is_active
          FROM quiz_session_access qsa
          JOIN sessions s ON qsa.session_id = s.id
          WHERE qsa.quiz_id = ${assessment.id}
        `
        
        const sessionAccessObj = augmentSessionAccessWithLegacyAliases(
          sessionAccess.reduce((acc, row) => {
            acc[row.code] = row.is_active
            return acc
          }, {} as Record<string, boolean>),
        )
        
            // Calculate is_active: must have at least one active session AND be within date range
            const now = new Date()
            const hasActiveSession = sessionAccess.some((s: any) => s.is_active)
            const availableFrom = assessment.available_from ? new Date(assessment.available_from) : null
            const availableUntil = assessment.available_until ? new Date(assessment.available_until) : null
            // Compare dates in UTC to avoid timezone issues
            // Database stores TIMESTAMP WITH TIME ZONE in UTC, so we compare UTC to UTC
            const availableFromOk = !availableFrom || availableFrom.getTime() <= now.getTime()
            const availableUntilOk = !availableUntil || availableUntil.getTime() >= now.getTime()
            // Default is_public to true if not set (for backward compatibility)
            const isPublic = assessment.is_public !== false
            const is_active = hasActiveSession && availableFromOk && availableUntilOk && isPublic
        
        return {
          ...assessment,
          session_access: sessionAccessObj,
          is_active: is_active
        }
          })
        )
        
        return NextResponse.json({ assessments: assessmentsWithAccess })
  } catch (error) {
    const resolvedParams = await params
    console.error(`[${resolvedParams.assessmentType} List] Error:`, error)
    return NextResponse.json({ error: "Failed to fetch assessments" }, { status: 500 })
  }
}

