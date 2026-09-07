import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAssessmentConfig, type AssessmentType } from "@/lib/assessment-core/db"
import { sectionSqlInClause } from "@/lib/session-code-aliases"

export const dynamic = 'force-dynamic'

/**
 * GET /api/instructor/results/deleted
 * Fetch soft-deleted quiz attempts (results)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assessmentType = searchParams.get("assessmentType")
    const section = searchParams.get("section")

    // Check if deleted_at column exists
    let hasDeletedAtColumn = false
    try {
      const columnCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'quiz_attempts' 
        AND column_name = 'deleted_at'
      `
      hasDeletedAtColumn = columnCheck.length > 0
    } catch (error) {
      console.log("[Deleted Results] Could not check for deleted_at column")
    }

    if (!hasDeletedAtColumn) {
      return NextResponse.json({
        results: [],
        message: "Soft delete not available - deleted_at column does not exist"
      })
    }

    // Map assessment type
    const typeMap: Record<string, AssessmentType> = {
      'quiz': 'quiz',
      'homework': 'homework',
      'mid_semester': 'midsem',
      'midsem': 'midsem',
      'final': 'final',
      'finals': 'final',
      'all': 'quiz' // Default
    }

    const normalizedType = assessmentType && assessmentType !== 'all'
      ? (typeMap[assessmentType] || 'quiz')
      : null

    // Build WHERE conditions
    const whereConditions: string[] = ['att.deleted_at IS NOT NULL']
    
    if (section && section !== 'all') {
      whereConditions.push(sectionSqlInClause("s.section", section))
    }

    const whereClause = whereConditions.join(' AND ')

    // CRITICAL: Check quizzes table FIRST since homework/midsem/finals might be stored there with assessment_type
    // Then check the separate tables as fallback
    // Use COALESCE to handle NULL cases properly
    const assessmentTypeMap: Record<string, string> = {
      'quiz': "((q.assessment_type = 'quiz') OR (q.assessment_type IS NULL AND h.id IS NULL AND m.id IS NULL AND f.id IS NULL))",
      'homework': "((q.assessment_type = 'homework') OR (h.id IS NOT NULL))",
      'midsem': "((q.assessment_type = 'mid_semester') OR (m.id IS NOT NULL))",
      'final': "((q.assessment_type = 'final') OR (f.id IS NOT NULL))"
    }

    // Build query - fetch deleted attempts with assessment info
    let query = ''
    let results: any[] = []
    
    if (normalizedType) {
      const typeFilter = assessmentTypeMap[normalizedType] || '1=1'
      
      // Use sql template literal with unsafe fragments (like the working simplified query)
      results = await sql`
        SELECT 
          att.id as attempt_id,
          s.full_name as student_name,
          s.student_id,
          s.section,
          COALESCE(q.title, h.title, m.title, f.title, 'Deleted Assessment') as assessment_title,
          COALESCE(
            NULLIF(att.score, 0),
            (SELECT SUM(COALESCE(ans.points_earned, 
              CASE 
                WHEN ans.is_correct = true THEN COALESCE(qq.max_points, qq.points, 1)
                ELSE 0
              END, 0)) 
             FROM quiz_answers ans
             JOIN quiz_questions qq ON ans.question_id = qq.id
             WHERE ans.attempt_id = att.id),
            att.score,
            0
          ) as score,
          COALESCE(
            NULLIF(att.total_questions, 0),
            (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = att.quiz_id),
            0
          ) as total_questions,
          COALESCE(
            (SELECT COUNT(*) FROM quiz_answers ans WHERE ans.attempt_id = att.id AND ans.is_correct = true),
            0
          ) as correct_answers,
          att.attempt_number,
          att.is_final_grade,
          ROUND(CASE 
            WHEN COALESCE(
              NULLIF(att.total_questions, 0),
              (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = att.quiz_id),
              0
            ) = 0 THEN 0
            ELSE (
              COALESCE(
                (SELECT COUNT(*) FROM quiz_answers ans WHERE ans.attempt_id = att.id AND ans.is_correct = true),
                0
              )::numeric / COALESCE(
                NULLIF(att.total_questions, 0),
                (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = att.quiz_id),
                1
              )::numeric
            ) * 100 
          END) as percentage,
          att.completed_at,
          att.deleted_at,
          att.deleted_by,
          COALESCE(q.assessment_type, 
            CASE 
              WHEN h.id IS NOT NULL THEN 'homework'
              WHEN m.id IS NOT NULL THEN 'mid_semester'
              WHEN f.id IS NOT NULL THEN 'final'
              ELSE 'quiz'
            END, ${normalizedType}) as assessment_type
        FROM quiz_attempts att
        JOIN students s ON att.student_id = s.id
        LEFT JOIN quizzes q ON att.quiz_id = q.id
        LEFT JOIN homeworks h ON att.quiz_id = h.id
        LEFT JOIN midsem_exams m ON att.quiz_id = m.id
        LEFT JOIN final_exams f ON att.quiz_id = f.id
        WHERE ${sql.unsafe(whereClause)}
          AND ${sql.unsafe(typeFilter)}
        ORDER BY att.deleted_at DESC
      `
      
      // Skip the sql.unsafe() execution below since we already executed the query
      const resultArray = Array.isArray(results) ? results : []
      console.log(`[Deleted Results] Found ${resultArray.length} deleted attempts after filtering`)
      
      return NextResponse.json({
        results: resultArray.map((r: any) => ({
          ...r,
          quiz_title: r.assessment_title || r.title,
          assessment_type: r.assessment_type || normalizedType
        })),
        count: resultArray.length
      })
    } else {
      // Fetch from all assessment types
      // CRITICAL: Use LEFT JOINs and don't filter by assessment deleted_at to show attempts even if assessment was deleted
      query = `
        SELECT 
          att.id as attempt_id,
          s.full_name as student_name,
          s.student_id,
          s.section,
          COALESCE(q.title, h.title, m.title, f.title, 'Deleted Assessment') as assessment_title,
          COALESCE(
            NULLIF(att.score, 0),
            (SELECT SUM(COALESCE(ans.points_earned, 
              CASE 
                WHEN ans.is_correct = true THEN COALESCE(qq.max_points, qq.points, 1)
                ELSE 0
              END, 0)) 
             FROM quiz_answers ans
             JOIN quiz_questions qq ON ans.question_id = qq.id
             WHERE ans.attempt_id = att.id),
            att.score,
            0
          ) as score,
          COALESCE(
            NULLIF(att.total_questions, 0),
            (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = att.quiz_id),
            0
          ) as total_questions,
          COALESCE(
            (SELECT COUNT(*) FROM quiz_answers ans WHERE ans.attempt_id = att.id AND ans.is_correct = true),
            0
          ) as correct_answers,
          att.attempt_number,
          att.is_final_grade,
          ROUND(CASE 
            WHEN COALESCE(NULLIF(att.total_questions, 0), 0) = 0 THEN 0
            ELSE (
              COALESCE(
                (SELECT COUNT(*) FROM quiz_answers ans WHERE ans.attempt_id = att.id AND ans.is_correct = true),
                0
              )::numeric / COALESCE(NULLIF(att.total_questions, 0), 1)::numeric
            ) * 100 
          END) as percentage,
          att.completed_at,
          att.deleted_at,
          att.deleted_by,
          COALESCE(q.assessment_type, 
            CASE 
              WHEN h.id IS NOT NULL THEN 'homework'
              WHEN m.id IS NOT NULL THEN 'mid_semester'
              WHEN f.id IS NOT NULL THEN 'final'
              ELSE 'quiz'
            END, 'quiz') as assessment_type
        FROM quiz_attempts att
        JOIN students s ON att.student_id = s.id
        LEFT JOIN quizzes q ON att.quiz_id = q.id AND (q.assessment_type = 'quiz' OR q.assessment_type IS NULL)
        LEFT JOIN homeworks h ON att.quiz_id = h.id
        LEFT JOIN midsem_exams m ON att.quiz_id = m.id
        LEFT JOIN final_exams f ON att.quiz_id = f.id
        WHERE ${whereClause}
        ORDER BY att.deleted_at DESC
      `
    }

    console.log(`[Deleted Results] Executing query with whereClause: ${whereClause}`)
    console.log(`[Deleted Results] Assessment type filter: ${normalizedType || 'all'}`)
    if (normalizedType) {
      const typeFilter = assessmentTypeMap[normalizedType] || '1=1'
      console.log(`[Deleted Results] Type filter condition: ${typeFilter}`)
    }
    console.log(`[Deleted Results] Query: ${query.substring(0, 500)}...`)
    
    // Debug: Check deleted attempts before filtering
    const debugBefore = await sql`
      SELECT 
        att.id,
        att.quiz_id,
        att.deleted_at,
        q.assessment_type as quiz_assessment_type,
        CASE WHEN h.id IS NOT NULL THEN 'homework_table' ELSE NULL END as in_homeworks_table,
        CASE WHEN m.id IS NOT NULL THEN 'midsem_table' ELSE NULL END as in_midsem_table,
        CASE WHEN f.id IS NOT NULL THEN 'final_table' ELSE NULL END as in_final_table,
        h.id as homework_id,
        q.id as quiz_table_id
      FROM quiz_attempts att
      LEFT JOIN quizzes q ON att.quiz_id = q.id
      LEFT JOIN homeworks h ON att.quiz_id = h.id
      LEFT JOIN midsem_exams m ON att.quiz_id = m.id
      LEFT JOIN final_exams f ON att.quiz_id = f.id
      WHERE att.deleted_at IS NOT NULL
      LIMIT 10
    `
    console.log(`[Deleted Results] Debug - Sample deleted attempts:`, JSON.stringify(debugBefore, null, 2))
    
    // Debug: Test the type filter condition directly
    if (normalizedType === 'homework') {
      const testFilter = await sql`
        SELECT 
          att.id,
          att.quiz_id,
          att.student_id,
          q.assessment_type = 'homework' as matches_quiz_type,
          h.id IS NOT NULL as matches_homework_table,
          (q.assessment_type = 'homework' OR h.id IS NOT NULL) as passes_filter,
          s.id as student_exists
        FROM quiz_attempts att
        LEFT JOIN quizzes q ON att.quiz_id = q.id
        LEFT JOIN homeworks h ON att.quiz_id = h.id
        LEFT JOIN students s ON att.student_id = s.id
        WHERE att.deleted_at IS NOT NULL
        LIMIT 5
      `
      console.log(`[Deleted Results] Debug - Filter test results:`, JSON.stringify(testFilter, null, 2))
      
      // Test the exact filter condition
      const exactTest = await sql`
        SELECT 
          att.id,
          att.quiz_id,
          ((q.assessment_type = 'homework') OR (h.id IS NOT NULL)) as filter_result
        FROM quiz_attempts att
        LEFT JOIN quizzes q ON att.quiz_id = q.id
        LEFT JOIN homeworks h ON att.quiz_id = h.id
        WHERE att.deleted_at IS NOT NULL
          AND ((q.assessment_type = 'homework') OR (h.id IS NOT NULL))
        LIMIT 5
      `
      console.log(`[Deleted Results] Debug - Exact filter test:`, JSON.stringify(exactTest, null, 2))
      
      // Test with INNER JOIN students (like the main query)
      const innerJoinTest = await sql`
        SELECT 
          att.id,
          att.quiz_id,
          s.id as student_exists
        FROM quiz_attempts att
        JOIN students s ON att.student_id = s.id
        LEFT JOIN quizzes q ON att.quiz_id = q.id
        LEFT JOIN homeworks h ON att.quiz_id = h.id
        WHERE att.deleted_at IS NOT NULL
          AND ((q.assessment_type = 'homework') OR (h.id IS NOT NULL))
        LIMIT 5
      `
      console.log(`[Deleted Results] Debug - Inner JOIN test:`, JSON.stringify(innerJoinTest, null, 2))
      
      // Test simplified version of main query
      const simplifiedTest = await sql`
        SELECT 
          att.id as attempt_id,
          s.full_name as student_name,
          s.student_id,
          s.section,
          COALESCE(q.title, h.title, 'Deleted Assessment') as assessment_title,
          att.score,
          att.attempt_number,
          att.completed_at,
          att.deleted_at
        FROM quiz_attempts att
        JOIN students s ON att.student_id = s.id
        LEFT JOIN quizzes q ON att.quiz_id = q.id
        LEFT JOIN homeworks h ON att.quiz_id = h.id
        WHERE att.deleted_at IS NOT NULL
          AND ((q.assessment_type = 'homework') OR (h.id IS NOT NULL))
        ORDER BY att.deleted_at DESC
        LIMIT 5
      `
      console.log(`[Deleted Results] Debug - Simplified query test:`, JSON.stringify(simplifiedTest, null, 2))
    }
    
    // Log the full query for debugging (only if query was built as string)
    if (query) {
      console.log(`[Deleted Results] Full query:\n${query}`)
    }
    
    // Only execute sql.unsafe() if we didn't already execute the query above (for 'all' assessment types)
    if (!normalizedType) {
      try {
        // Try executing the query and log the raw result
        const rawResult = await sql.unsafe(query)
        console.log(`[Deleted Results] Raw result type:`, typeof rawResult)
        console.log(`[Deleted Results] Raw result is array:`, Array.isArray(rawResult))
        console.log(`[Deleted Results] Raw result length:`, Array.isArray(rawResult) ? rawResult.length : 'N/A')
        
        // Process results for 'all' assessment types case
        let processedResults: any[] = []
        if (rawResult && typeof rawResult === 'object' && 'rows' in rawResult) {
          processedResults = (rawResult as any).rows
          console.log(`[Deleted Results] Found 'rows' property, length:`, Array.isArray(processedResults) ? processedResults.length : 'N/A')
        } else if (Array.isArray(rawResult)) {
          processedResults = rawResult
        } else {
          console.log(`[Deleted Results] Unexpected result format:`, JSON.stringify(rawResult, null, 2).substring(0, 500))
          processedResults = []
        }
        
        console.log(`[Deleted Results] Query executed successfully, returned ${processedResults.length} rows`)
        if (processedResults.length > 0) {
          console.log(`[Deleted Results] Sample result:`, JSON.stringify(processedResults[0], null, 2))
        }
        
        const resultArray = Array.isArray(processedResults) ? processedResults : []
        console.log(`[Deleted Results] Found ${resultArray.length} deleted attempts after filtering`)
        
        return NextResponse.json({
          results: resultArray.map((r: any) => ({
            ...r,
            quiz_title: r.assessment_title || r.title,
            assessment_type: r.assessment_type || 'quiz'
          })),
          count: resultArray.length
        })
      } catch (queryError: any) {
        console.error(`[Deleted Results] Query execution error:`, queryError.message)
        console.error(`[Deleted Results] Query error stack:`, queryError.stack)
        console.error(`[Deleted Results] Failed query (first 1000 chars):`, query.substring(0, 1000))
        throw queryError
      }
    }

    // This should never be reached since both branches return
    return NextResponse.json({
      results: [],
      count: 0
    })
  } catch (error: any) {
    console.error("[Deleted Results] Error:", error)
    console.error("[Deleted Results] Error stack:", error.stack)
    return NextResponse.json(
      { 
        error: "Failed to fetch deleted results", 
        details: error.message,
        results: [],
        count: 0
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/instructor/results/deleted
 * Restore a deleted attempt
 */
export async function POST(request: NextRequest) {
  try {
    const { attemptId } = await request.json()

    if (!attemptId) {
      return NextResponse.json({ error: "Attempt ID is required" }, { status: 400 })
    }

    // Restore by setting deleted_at to NULL
    const result = await sql`
      UPDATE quiz_attempts
      SET deleted_at = NULL, deleted_by = NULL
      WHERE id = ${attemptId}
        AND deleted_at IS NOT NULL
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Deleted attempt not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: "Result restored successfully",
      attemptId: result[0].id
    })
  } catch (error: any) {
    console.error("[Deleted Results] Restore error:", error)
    return NextResponse.json(
      { error: "Failed to restore result", details: error.message },
      { status: 500 }
    )
  }
}

