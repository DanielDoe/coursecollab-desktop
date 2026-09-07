import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAssessmentConfig, type AssessmentType } from "@/lib/assessment-core/db"
import {
  normalizedSectionVariantsForSql,
  studentSectionMatchesSessionRenameSqlFragment,
} from "@/lib/session-code-aliases"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get('quizId')
    const section = searchParams.get('section')
    const assessmentType = searchParams.get('assessmentType')
    const sectionAnyVariants = section && section !== "all" ? normalizedSectionVariantsForSql(section) : []

    // Map assessment type to table name
    const typeMap: Record<string, AssessmentType> = {
      'quiz': 'quiz',
      'homework': 'homework',
      'mid_semester': 'midsem',
      'midsem': 'midsem',
      'final': 'final',
      'finals': 'final'
    }

    const normalizedType = assessmentType && assessmentType !== 'all' 
      ? (typeMap[assessmentType] || 'quiz')
      : null

    console.log('[Clear Results] ===== STARTING CLEAR OPERATION =====')
    console.log('[Clear Results] Filters received:', { quizId, section, assessmentType })
    console.log('[Clear Results] Normalized type:', normalizedType || 'ALL TYPES')

    // First, count how many results exist BEFORE deletion
    let beforeCount = 0
    try {
      if (!normalizedType) {
        // Count all attempts from all assessment types
        let countWhereParts: string[] = ['att.deleted_at IS NULL']
        
        if (quizId && quizId !== 'all') {
          countWhereParts.push(`att.quiz_id = ${Number(quizId)}`)
        }
        
        if (section && section !== 'all') {
          countWhereParts.push(studentSectionMatchesSessionRenameSqlFragment("s", section))
        }
        
        countWhereParts.push(`(
          EXISTS (SELECT 1 FROM quizzes q WHERE q.id = att.quiz_id AND q.deleted_at IS NULL)
          OR EXISTS (SELECT 1 FROM homeworks h WHERE h.id = att.quiz_id AND h.deleted_at IS NULL)
          OR EXISTS (SELECT 1 FROM midsem_exams m WHERE m.id = att.quiz_id AND m.deleted_at IS NULL)
          OR EXISTS (SELECT 1 FROM final_exams f WHERE f.id = att.quiz_id AND f.deleted_at IS NULL)
        )`)
        
        const countWhereClause = countWhereParts.join(' AND ')
        
        // Build count query with proper conditional filters
        let countQuery: any
        if (quizId && quizId !== 'all' && section && section !== 'all') {
          countQuery = sql`
            SELECT COUNT(*)::INTEGER as count
            FROM quiz_attempts att
            JOIN students s ON att.student_id = s.id
            WHERE att.deleted_at IS NULL
              AND att.quiz_id = ${Number(quizId)}
              AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              AND (
                EXISTS (SELECT 1 FROM quizzes q WHERE q.id = att.quiz_id AND q.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM homeworks h WHERE h.id = att.quiz_id AND h.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM midsem_exams m WHERE m.id = att.quiz_id AND m.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM final_exams f WHERE f.id = att.quiz_id AND f.deleted_at IS NULL)
              )
          `
        } else if (quizId && quizId !== 'all') {
          countQuery = sql`
            SELECT COUNT(*)::INTEGER as count
            FROM quiz_attempts att
            JOIN students s ON att.student_id = s.id
            WHERE att.deleted_at IS NULL
              AND att.quiz_id = ${Number(quizId)}
              AND (
                EXISTS (SELECT 1 FROM quizzes q WHERE q.id = att.quiz_id AND q.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM homeworks h WHERE h.id = att.quiz_id AND h.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM midsem_exams m WHERE m.id = att.quiz_id AND m.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM final_exams f WHERE f.id = att.quiz_id AND f.deleted_at IS NULL)
              )
          `
        } else if (section && section !== 'all') {
          countQuery = sql`
            SELECT COUNT(*)::INTEGER as count
            FROM quiz_attempts att
            JOIN students s ON att.student_id = s.id
            WHERE att.deleted_at IS NULL
              AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              AND (
                EXISTS (SELECT 1 FROM quizzes q WHERE q.id = att.quiz_id AND q.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM homeworks h WHERE h.id = att.quiz_id AND h.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM midsem_exams m WHERE m.id = att.quiz_id AND m.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM final_exams f WHERE f.id = att.quiz_id AND f.deleted_at IS NULL)
              )
          `
        } else {
          countQuery = sql`
            SELECT COUNT(*)::INTEGER as count
            FROM quiz_attempts att
            JOIN students s ON att.student_id = s.id
            WHERE att.deleted_at IS NULL
              AND (
                EXISTS (SELECT 1 FROM quizzes q WHERE q.id = att.quiz_id AND q.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM homeworks h WHERE h.id = att.quiz_id AND h.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM midsem_exams m WHERE m.id = att.quiz_id AND m.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM final_exams f WHERE f.id = att.quiz_id AND f.deleted_at IS NULL)
              )
          `
        }
        const countResult = await countQuery
        console.log('[Clear Results] Count query for ALL types executed')
        beforeCount = Number(countResult[0]?.count) || 0
        console.log('[Clear Results] Count result:', countResult[0], 'beforeCount:', beforeCount)
      } else {
        const config = getAssessmentConfig(normalizedType)
        
        let countWhereParts: string[] = [
          'att.deleted_at IS NULL',
          'a.deleted_at IS NULL'
        ]
        
        if (quizId && quizId !== 'all') {
          countWhereParts.push(`att.quiz_id = ${Number(quizId)}`)
        }
        
        if (section && section !== 'all') {
          countWhereParts.push(studentSectionMatchesSessionRenameSqlFragment("s", section))
        }
        
        const countWhereClause = countWhereParts.join(' AND ')
        
        // Use parameterized query for specific type with proper conditionals
        const tableName = config.tableName
        let countResult: any[]
        
        if (tableName === 'quizzes') {
          if (quizId && quizId !== 'all' && section && section !== 'all') {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN quizzes a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
            `
          } else if (quizId && quizId !== 'all') {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN quizzes a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
            `
          } else if (section && section !== 'all') {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN quizzes a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
            `
          } else {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN quizzes a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
            `
          }
        } else if (tableName === 'homeworks') {
          if (quizId && quizId !== 'all' && section && section !== 'all') {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN homeworks a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
            `
          } else if (quizId && quizId !== 'all') {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN homeworks a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
            `
          } else if (section && section !== 'all') {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN homeworks a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
            `
          } else {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN homeworks a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
            `
          }
        } else if (tableName === 'midsem_exams') {
          if (quizId && quizId !== 'all' && section && section !== 'all') {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN midsem_exams a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
            `
          } else if (quizId && quizId !== 'all') {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN midsem_exams a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
            `
          } else if (section && section !== 'all') {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN midsem_exams a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
            `
          } else {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN midsem_exams a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
            `
          }
        } else if (tableName === 'final_exams') {
          if (quizId && quizId !== 'all' && section && section !== 'all') {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN final_exams a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
            `
          } else if (quizId && quizId !== 'all') {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN final_exams a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
            `
          } else if (section && section !== 'all') {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN final_exams a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
            `
          } else {
            countResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              JOIN final_exams a ON att.quiz_id = a.id
              WHERE att.deleted_at IS NULL
                AND a.deleted_at IS NULL
            `
          }
        } else {
          countResult = [{ count: 0 }]
        }
        beforeCount = Number(countResult[0]?.count) || 0
        console.log('[Clear Results] Count query for type:', normalizedType, 'executed')
        console.log('[Clear Results] beforeCount:', beforeCount)
      }
      console.log('[Clear Results] BEFORE deletion - Total attempts to delete:', beforeCount)
    } catch (error) {
      console.error('[Clear Results] Error counting before deletion:', error)
    }

    // Check if deleted_at column exists on quiz_attempts
    let hasDeletedAtColumn = false
    try {
      const columnCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'quiz_attempts' 
        AND column_name = 'deleted_at'
      `
      hasDeletedAtColumn = columnCheck.length > 0
      
      // If column doesn't exist, create it
      if (!hasDeletedAtColumn) {
        console.log('[Clear Results] Creating deleted_at column on quiz_attempts')
        await sql`
          ALTER TABLE quiz_attempts 
          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS deleted_by INTEGER DEFAULT NULL
        `
        await sql`
          CREATE INDEX IF NOT EXISTS idx_quiz_attempts_deleted_at 
          ON quiz_attempts(deleted_at) 
          WHERE deleted_at IS NULL
        `
        hasDeletedAtColumn = true
      }
    } catch (error) {
      console.error('[Clear Results] Error checking/creating deleted_at column:', error)
    }

    if (hasDeletedAtColumn) {
      // Soft delete: set deleted_at timestamp
      // When assessmentType is null or 'all', we need to check all assessment tables
      if (!normalizedType) {
        // Clear all attempts from all assessment types using template literals
        console.log('[Clear Results] ===== SOFT DELETING ALL ASSESSMENT TYPES =====')
        console.log('[Clear Results] Expected to delete:', beforeCount, 'attempt(s)')

        // Build UPDATE query with proper conditionals
        let result: any[]
        if (quizId && quizId !== 'all' && section && section !== 'all') {
          result = await sql`
            UPDATE quiz_attempts att
            SET deleted_at = NOW(), deleted_by = NULL
            FROM students s
            WHERE att.student_id = s.id 
              AND att.deleted_at IS NULL
              AND att.quiz_id = ${Number(quizId)}
              AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              AND (
                EXISTS (SELECT 1 FROM quizzes q WHERE q.id = att.quiz_id AND q.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM homeworks h WHERE h.id = att.quiz_id AND h.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM midsem_exams m WHERE m.id = att.quiz_id AND m.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM final_exams f WHERE f.id = att.quiz_id AND f.deleted_at IS NULL)
              )
            RETURNING att.id
          `
        } else if (quizId && quizId !== 'all') {
          result = await sql`
            UPDATE quiz_attempts att
            SET deleted_at = NOW(), deleted_by = NULL
            FROM students s
            WHERE att.student_id = s.id 
              AND att.deleted_at IS NULL
              AND att.quiz_id = ${Number(quizId)}
              AND (
                EXISTS (SELECT 1 FROM quizzes q WHERE q.id = att.quiz_id AND q.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM homeworks h WHERE h.id = att.quiz_id AND h.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM midsem_exams m WHERE m.id = att.quiz_id AND m.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM final_exams f WHERE f.id = att.quiz_id AND f.deleted_at IS NULL)
              )
            RETURNING att.id
          `
        } else if (section && section !== 'all') {
          result = await sql`
            UPDATE quiz_attempts att
            SET deleted_at = NOW(), deleted_by = NULL
            FROM students s
            WHERE att.student_id = s.id 
              AND att.deleted_at IS NULL
              AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              AND (
                EXISTS (SELECT 1 FROM quizzes q WHERE q.id = att.quiz_id AND q.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM homeworks h WHERE h.id = att.quiz_id AND h.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM midsem_exams m WHERE m.id = att.quiz_id AND m.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM final_exams f WHERE f.id = att.quiz_id AND f.deleted_at IS NULL)
              )
            RETURNING att.id
          `
        } else {
          result = await sql`
            UPDATE quiz_attempts att
            SET deleted_at = NOW(), deleted_by = NULL
            FROM students s
            WHERE att.student_id = s.id 
              AND att.deleted_at IS NULL
              AND (
                EXISTS (SELECT 1 FROM quizzes q WHERE q.id = att.quiz_id AND q.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM homeworks h WHERE h.id = att.quiz_id AND h.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM midsem_exams m WHERE m.id = att.quiz_id AND m.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM final_exams f WHERE f.id = att.quiz_id AND f.deleted_at IS NULL)
              )
            RETURNING att.id
          `
        }

        const deletedCount = Array.isArray(result) ? result.length : 0
        console.log('[Clear Results] ===== DELETION COMPLETE =====')
        console.log(`[Clear Results] Query returned ${deletedCount} deleted attempt(s)`)
        console.log('[Clear Results] Result array:', result)
        
        // Verify deletion by counting again
        try {
          let verifyResult: any[]
          if (quizId && quizId !== 'all' && section && section !== 'all') {
            verifyResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              WHERE att.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
                AND (
                  EXISTS (SELECT 1 FROM quizzes q WHERE q.id = att.quiz_id AND q.deleted_at IS NULL)
                  OR EXISTS (SELECT 1 FROM homeworks h WHERE h.id = att.quiz_id AND h.deleted_at IS NULL)
                  OR EXISTS (SELECT 1 FROM midsem_exams m WHERE m.id = att.quiz_id AND m.deleted_at IS NULL)
                  OR EXISTS (SELECT 1 FROM final_exams f WHERE f.id = att.quiz_id AND f.deleted_at IS NULL)
                )
            `
          } else if (quizId && quizId !== 'all') {
            verifyResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              WHERE att.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
                AND (
                  EXISTS (SELECT 1 FROM quizzes q WHERE q.id = att.quiz_id AND q.deleted_at IS NULL)
                  OR EXISTS (SELECT 1 FROM homeworks h WHERE h.id = att.quiz_id AND h.deleted_at IS NULL)
                  OR EXISTS (SELECT 1 FROM midsem_exams m WHERE m.id = att.quiz_id AND m.deleted_at IS NULL)
                  OR EXISTS (SELECT 1 FROM final_exams f WHERE f.id = att.quiz_id AND f.deleted_at IS NULL)
                )
            `
          } else if (section && section !== 'all') {
            verifyResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              WHERE att.deleted_at IS NULL
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
                AND (
                  EXISTS (SELECT 1 FROM quizzes q WHERE q.id = att.quiz_id AND q.deleted_at IS NULL)
                  OR EXISTS (SELECT 1 FROM homeworks h WHERE h.id = att.quiz_id AND h.deleted_at IS NULL)
                  OR EXISTS (SELECT 1 FROM midsem_exams m WHERE m.id = att.quiz_id AND m.deleted_at IS NULL)
                  OR EXISTS (SELECT 1 FROM final_exams f WHERE f.id = att.quiz_id AND f.deleted_at IS NULL)
                )
            `
          } else {
            verifyResult = await sql`
              SELECT COUNT(*)::INTEGER as count
              FROM quiz_attempts att
              JOIN students s ON att.student_id = s.id
              WHERE att.deleted_at IS NULL
                AND (
                  EXISTS (SELECT 1 FROM quizzes q WHERE q.id = att.quiz_id AND q.deleted_at IS NULL)
                  OR EXISTS (SELECT 1 FROM homeworks h WHERE h.id = att.quiz_id AND h.deleted_at IS NULL)
                  OR EXISTS (SELECT 1 FROM midsem_exams m WHERE m.id = att.quiz_id AND m.deleted_at IS NULL)
                  OR EXISTS (SELECT 1 FROM final_exams f WHERE f.id = att.quiz_id AND f.deleted_at IS NULL)
                )
            `
          }
          const afterCount = Number(verifyResult[0]?.count) || 0
          console.log('[Clear Results] AFTER deletion - Remaining attempts:', afterCount)
          console.log('[Clear Results] Verification: Before =', beforeCount, ', After =', afterCount, ', Deleted =', beforeCount - afterCount)
        } catch (error) {
          console.error('[Clear Results] Error verifying deletion:', error)
        }

        return NextResponse.json({
          success: true,
          deletedCount: deletedCount,
          beforeCount: beforeCount,
          message: `Successfully moved ${deletedCount} result(s) to trash`,
          filters: { quizId, section, assessmentType },
          softDeleted: true
        })
      } else {
        // Clear attempts for specific assessment type
        const config = getAssessmentConfig(normalizedType)
        
        console.log('[Clear Results] ===== SOFT DELETING SPECIFIC TYPE:', normalizedType, '=====')
        console.log('[Clear Results] Expected to delete:', beforeCount, 'attempt(s)')

        // Use conditional queries based on table name and filters
        let result: any[]
        if (config.tableName === 'quizzes') {
          if (quizId && quizId !== 'all' && section && section !== 'all') {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN quizzes a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              RETURNING att.id
            `
          } else if (quizId && quizId !== 'all') {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN quizzes a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
              RETURNING att.id
            `
          } else if (section && section !== 'all') {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN quizzes a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              RETURNING att.id
            `
          } else {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN quizzes a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
              RETURNING att.id
            `
          }
        } else if (config.tableName === 'homeworks') {
          if (quizId && quizId !== 'all' && section && section !== 'all') {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN homeworks a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              RETURNING att.id
            `
          } else if (quizId && quizId !== 'all') {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN homeworks a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
              RETURNING att.id
            `
          } else if (section && section !== 'all') {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN homeworks a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              RETURNING att.id
            `
          } else {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN homeworks a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
              RETURNING att.id
            `
          }
        } else if (config.tableName === 'midsem_exams') {
          if (quizId && quizId !== 'all' && section && section !== 'all') {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN midsem_exams a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              RETURNING att.id
            `
          } else if (quizId && quizId !== 'all') {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN midsem_exams a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
              RETURNING att.id
            `
          } else if (section && section !== 'all') {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN midsem_exams a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              RETURNING att.id
            `
          } else {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN midsem_exams a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
              RETURNING att.id
            `
          }
        } else if (config.tableName === 'final_exams') {
          if (quizId && quizId !== 'all' && section && section !== 'all') {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN final_exams a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              RETURNING att.id
            `
          } else if (quizId && quizId !== 'all') {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN final_exams a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
                AND att.quiz_id = ${Number(quizId)}
              RETURNING att.id
            `
          } else if (section && section !== 'all') {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN final_exams a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
                AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              RETURNING att.id
            `
          } else {
            result = await sql`
              UPDATE quiz_attempts att
              SET deleted_at = NOW(), deleted_by = NULL
              FROM students s
              JOIN final_exams a ON att.quiz_id = a.id
              WHERE att.student_id = s.id
                AND a.deleted_at IS NULL
                AND att.deleted_at IS NULL
              RETURNING att.id
            `
          }
        } else {
          result = []
        }

        const deletedCount = Array.isArray(result) ? result.length : 0
        console.log('[Clear Results] ===== DELETION COMPLETE =====')
        console.log(`[Clear Results] Query returned ${deletedCount} deleted attempt(s)`)
        console.log('[Clear Results] Result array:', result)
        
        // Verify deletion
        try {
          const config = getAssessmentConfig(normalizedType)
          let verifyResult: any[]
          if (config.tableName === 'quizzes') {
            if (quizId && quizId !== 'all' && section && section !== 'all') {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN quizzes a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
                  AND att.quiz_id = ${Number(quizId)}
                  AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              `
            } else if (quizId && quizId !== 'all') {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN quizzes a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
                  AND att.quiz_id = ${Number(quizId)}
              `
            } else if (section && section !== 'all') {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN quizzes a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
                  AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              `
            } else {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN quizzes a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
              `
            }
          } else if (config.tableName === 'homeworks') {
            if (quizId && quizId !== 'all' && section && section !== 'all') {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN homeworks a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
                  AND att.quiz_id = ${Number(quizId)}
                  AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              `
            } else if (quizId && quizId !== 'all') {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN homeworks a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
                  AND att.quiz_id = ${Number(quizId)}
              `
            } else if (section && section !== 'all') {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN homeworks a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
                  AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              `
            } else {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN homeworks a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
              `
            }
          } else if (config.tableName === 'midsem_exams') {
            if (quizId && quizId !== 'all' && section && section !== 'all') {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN midsem_exams a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
                  AND att.quiz_id = ${Number(quizId)}
                  AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              `
            } else if (quizId && quizId !== 'all') {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN midsem_exams a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
                  AND att.quiz_id = ${Number(quizId)}
              `
            } else if (section && section !== 'all') {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN midsem_exams a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
                  AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              `
            } else {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN midsem_exams a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
              `
            }
          } else if (config.tableName === 'final_exams') {
            if (quizId && quizId !== 'all' && section && section !== 'all') {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN final_exams a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
                  AND att.quiz_id = ${Number(quizId)}
                  AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              `
            } else if (quizId && quizId !== 'all') {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN final_exams a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
                  AND att.quiz_id = ${Number(quizId)}
              `
            } else if (section && section !== 'all') {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN final_exams a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
                  AND (
                TRIM(s.section) = ANY(${sectionAnyVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionAnyVariants}::text[])
                )
              )
              `
            } else {
              verifyResult = await sql`
                SELECT COUNT(*)::INTEGER as count
                FROM quiz_attempts att
                JOIN students s ON att.student_id = s.id
                JOIN final_exams a ON att.quiz_id = a.id
                WHERE att.deleted_at IS NULL
                  AND a.deleted_at IS NULL
              `
            }
          } else {
            verifyResult = [{ count: 0 }]
          }
          const afterCount = Number(verifyResult[0]?.count) || 0
          console.log('[Clear Results] AFTER deletion - Remaining attempts:', afterCount)
          console.log('[Clear Results] Verification: Before =', beforeCount, ', After =', afterCount, ', Deleted =', beforeCount - afterCount)
        } catch (error) {
          console.error('[Clear Results] Error verifying deletion:', error)
        }

        return NextResponse.json({
          success: true,
          deletedCount: deletedCount,
          beforeCount: beforeCount,
          message: `Successfully moved ${deletedCount} result(s) to trash`,
          filters: { quizId, section, assessmentType },
          softDeleted: true
        })
      }
    } else {
      // Fallback: hard delete if column doesn't exist
      if (!normalizedType) {
        // Hard delete all attempts from all assessment types
        let whereParts: string[] = ['att.student_id = s.id']
        
        if (quizId && quizId !== 'all') {
          whereParts.push(`att.quiz_id = ${Number(quizId)}`)
        }
        
        if (section && section !== 'all') {
          whereParts.push(studentSectionMatchesSessionRenameSqlFragment("s", section))
        }
        
        whereParts.push(`(
          EXISTS (SELECT 1 FROM quizzes q WHERE q.id = att.quiz_id AND q.deleted_at IS NULL)
          OR EXISTS (SELECT 1 FROM homeworks h WHERE h.id = att.quiz_id AND h.deleted_at IS NULL)
          OR EXISTS (SELECT 1 FROM midsem_exams m WHERE m.id = att.quiz_id AND m.deleted_at IS NULL)
          OR EXISTS (SELECT 1 FROM final_exams f WHERE f.id = att.quiz_id AND f.deleted_at IS NULL)
        )`)
        
        const whereClause = whereParts.join(' AND ')
        
        const query = `
          DELETE FROM quiz_attempts att
          USING students s
          WHERE ${whereClause}
          RETURNING att.id
        `
        
        console.log('[Clear Results] Hard deleting ALL assessment types')
        const result = await sql.unsafe(query)
        const deletedCount = Array.isArray(result) ? result.length : 0
        console.log(`[Clear Results] Hard deleted ${deletedCount} attempt(s)`)

        return NextResponse.json({
          success: true,
          deletedCount: deletedCount,
          message: `Successfully permanently deleted ${deletedCount} result(s)`,
          filters: { quizId, section, assessmentType },
          softDeleted: false
        })
      } else {
        // Hard delete for specific assessment type
        const config = getAssessmentConfig(normalizedType)
        
        let whereParts: string[] = [
          'att.student_id = s.id',
          'a.deleted_at IS NULL'
        ]
        
        if (quizId && quizId !== 'all') {
          whereParts.push(`att.quiz_id = ${Number(quizId)}`)
        }
        
        if (section && section !== 'all') {
          whereParts.push(studentSectionMatchesSessionRenameSqlFragment("s", section))
        }
        
        const whereClause = whereParts.join(' AND ')
        
        const query = `
          DELETE FROM quiz_attempts att
          USING students s
          JOIN ${config.tableName} a ON att.quiz_id = a.id
          WHERE ${whereClause}
          RETURNING att.id
        `
        
        console.log('[Clear Results] Hard deleting for type:', normalizedType)
        const result = await sql.unsafe(query)
        const deletedCount = Array.isArray(result) ? result.length : 0
        console.log(`[Clear Results] Hard deleted ${deletedCount} attempt(s)`)

        return NextResponse.json({
          success: true,
          deletedCount: deletedCount,
          message: `Successfully permanently deleted ${deletedCount} result(s)`,
          filters: { quizId, section, assessmentType },
          softDeleted: false
        })
      }
    }
  } catch (error) {
    console.error("[Clear Results] Failed to clear results:", error)
    return NextResponse.json({ 
      error: "Failed to clear results",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

