import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get("quizId")
    const section = searchParams.get("section")
    const sectionRows = section && section !== "all" ? normalizedSectionVariantsForSql(section) : []

    let results

    if (quizId && quizId !== "all" && section && section !== "all") {
      // Both filters
      results = await sql`
        SELECT 
          qa.id as attempt_id,
          s.full_name as student_name,
          s.student_id,
          s.section,
          q.title as quiz_title,
          qa.score,
          qa.total_questions,
          COALESCE(
            (SELECT SUM(COALESCE(qq.max_points, qq.points, 1)) FROM quiz_questions qq WHERE qq.quiz_id = q.id),
            0
          ) as total_possible_points,
          -- CRITICAL: Count correct answers for display (score should show correct/total, not points/total)
          COALESCE(
            (SELECT COUNT(*) FROM quiz_answers qa3 WHERE qa3.attempt_id = qa.id AND qa3.is_correct = true),
            0
          ) as correct_answers,
          -- CRITICAL FIX: Calculate percentage based on correct answers / total questions
          -- This matches what students see: "21/23" should show 91.3%, not 67%
          -- The percentage should reflect the ratio of correct answers to total questions, not weighted points
          ROUND(CASE 
            WHEN COALESCE(
              NULLIF(qa.total_questions, 0),
              (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id),
              0
            ) = 0 THEN 0
            ELSE (
              COALESCE(
                (SELECT COUNT(*) FROM quiz_answers qa3 WHERE qa3.attempt_id = qa.id AND qa3.is_correct = true),
                0
              )::numeric / COALESCE(
                NULLIF(qa.total_questions, 0),
                (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id),
                1
              )::numeric
            ) * 100 
          END) as percentage,
          qa.completed_at
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.quiz_id = ${Number.parseInt(quizId)}
          AND (
            TRIM(s.section) = ANY(${sectionRows}::text[])
            OR EXISTS (
              SELECT 1 FROM sessions sess
              WHERE sess.id = s.session_id
              AND TRIM(sess.code) = ANY(${sectionRows}::text[])
            )
          )
        ORDER BY qa.completed_at DESC
      `
    } else if (quizId && quizId !== "all") {
      // Quiz filter only
      results = await sql`
        SELECT 
          qa.id as attempt_id,
          s.full_name as student_name,
          s.student_id,
          s.section,
          q.title as quiz_title,
          qa.score,
          qa.total_questions,
          COALESCE(
            (SELECT SUM(COALESCE(qq.max_points, qq.points, 1)) FROM quiz_questions qq WHERE qq.quiz_id = q.id),
            0
          ) as total_possible_points,
          -- CRITICAL: Count correct answers for display (score should show correct/total, not points/total)
          COALESCE(
            (SELECT COUNT(*) FROM quiz_answers qa3 WHERE qa3.attempt_id = qa.id AND qa3.is_correct = true),
            0
          ) as correct_answers,
          -- CRITICAL FIX: Calculate percentage based on correct answers / total questions
          -- This matches what students see: "21/23" should show 91.3%, not 67%
          -- The percentage should reflect the ratio of correct answers to total questions, not weighted points
          ROUND(CASE 
            WHEN COALESCE(
              NULLIF(qa.total_questions, 0),
              (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id),
              0
            ) = 0 THEN 0
            ELSE (
              COALESCE(
                (SELECT COUNT(*) FROM quiz_answers qa3 WHERE qa3.attempt_id = qa.id AND qa3.is_correct = true),
                0
              )::numeric / COALESCE(
                NULLIF(qa.total_questions, 0),
                (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id),
                1
              )::numeric
            ) * 100 
          END) as percentage,
          qa.completed_at
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.quiz_id = ${Number.parseInt(quizId)}
        ORDER BY qa.completed_at DESC
      `
    } else if (section && section !== "all") {
      // Section filter only
      results = await sql`
        SELECT 
          qa.id as attempt_id,
          s.full_name as student_name,
          s.student_id,
          s.section,
          q.title as quiz_title,
          qa.score,
          qa.total_questions,
          COALESCE(
            (SELECT SUM(COALESCE(qq.max_points, qq.points, 1)) FROM quiz_questions qq WHERE qq.quiz_id = q.id),
            0
          ) as total_possible_points,
          -- CRITICAL: Count correct answers for display (score should show correct/total, not points/total)
          COALESCE(
            (SELECT COUNT(*) FROM quiz_answers qa3 WHERE qa3.attempt_id = qa.id AND qa3.is_correct = true),
            0
          ) as correct_answers,
          -- CRITICAL FIX: Calculate percentage based on correct answers / total questions
          -- This matches what students see: "21/23" should show 91.3%, not 67%
          -- The percentage should reflect the ratio of correct answers to total questions, not weighted points
          ROUND(CASE 
            WHEN COALESCE(
              NULLIF(qa.total_questions, 0),
              (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id),
              0
            ) = 0 THEN 0
            ELSE (
              COALESCE(
                (SELECT COUNT(*) FROM quiz_answers qa3 WHERE qa3.attempt_id = qa.id AND qa3.is_correct = true),
                0
              )::numeric / COALESCE(
                NULLIF(qa.total_questions, 0),
                (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id),
                1
              )::numeric
            ) * 100 
          END) as percentage,
          qa.completed_at
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE (
          TRIM(s.section) = ANY(${sectionRows}::text[])
          OR EXISTS (
            SELECT 1 FROM sessions sess
            WHERE sess.id = s.session_id
            AND TRIM(sess.code) = ANY(${sectionRows}::text[])
          )
        )
        ORDER BY qa.completed_at DESC
      `
    } else {
      // No filters
      results = await sql`
        SELECT 
          qa.id as attempt_id,
          s.full_name as student_name,
          s.student_id,
          s.section,
          q.title as quiz_title,
          qa.score,
          qa.total_questions,
          COALESCE(
            (SELECT SUM(COALESCE(qq.max_points, qq.points, 1)) FROM quiz_questions qq WHERE qq.quiz_id = q.id),
            0
          ) as total_possible_points,
          -- CRITICAL: Count correct answers for display (score should show correct/total, not points/total)
          COALESCE(
            (SELECT COUNT(*) FROM quiz_answers qa3 WHERE qa3.attempt_id = qa.id AND qa3.is_correct = true),
            0
          ) as correct_answers,
          -- CRITICAL FIX: Calculate percentage based on correct answers / total questions
          -- This matches what students see: "21/23" should show 91.3%, not 67%
          -- The percentage should reflect the ratio of correct answers to total questions, not weighted points
          ROUND(CASE 
            WHEN COALESCE(
              NULLIF(qa.total_questions, 0),
              (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id),
              0
            ) = 0 THEN 0
            ELSE (
              COALESCE(
                (SELECT COUNT(*) FROM quiz_answers qa3 WHERE qa3.attempt_id = qa.id AND qa3.is_correct = true),
                0
              )::numeric / COALESCE(
                NULLIF(qa.total_questions, 0),
                (SELECT COUNT(*) FROM quiz_questions WHERE quiz_id = q.id),
                1
              )::numeric
            ) * 100 
          END) as percentage,
          qa.completed_at
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN quizzes q ON qa.quiz_id = q.id
        ORDER BY qa.completed_at DESC
      `
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error("[v0] Failed to fetch results:", error)
    return NextResponse.json({ error: "Failed to fetch results", results: [] }, { status: 500 })
  }
}
