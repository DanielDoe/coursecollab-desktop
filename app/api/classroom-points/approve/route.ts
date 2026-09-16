import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  CLASSROOM_BASE_POINTS,
  classroomPointsWithBooster,
} from "@/lib/classroom-point-booster"
import { ensureClassroomPointsSchema } from "@/lib/ensure-classroom-points-schema"
import { requireClassroomPointsInstructor } from "@/lib/classroom-points-request-auth"
import { sqlInstructorStudentScope } from "@/lib/classroom-points-term-scope"
import { sqlSubmissionCourseScope } from "@/lib/classroom-submission-scope"
import { getBaseUrl } from "@/lib/get-base-url"

export const dynamic = "force-dynamic"

// Approve individual classroom point
export async function POST(request: NextRequest) {
  try {
    const scope = await requireClassroomPointsInstructor(request)
    if (!scope.ok) return scope.response

    const courseId = scope.course.id
    const studentScope = await sqlInstructorStudentScope(request, courseId, sql)

    await ensureClassroomPointsSchema()
    const { id, approveAll, verifyAndApproveAll } = await request.json()

    if (approveAll || verifyAndApproveAll) {
      // First, fetch all pending code_submission points with code and submission details
      const allPending = await sql`
        SELECT 
          cp.id,
          cp.student_id,
          cp.points,
          cp.reason,
          cp.created_at,
          cp.status,
          cp.submission_id,
          cp.point_booster,
          cs.code,
          cs.plot_image,
          cps.title as submission_title,
          cps.description as submission_description,
          s.full_name as student_name
        FROM classroom_points cp
        LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
        LEFT JOIN classroom_point_submissions cps ON cps.id = cp.submission_id
        LEFT JOIN students s ON s.id = cp.student_id
        WHERE cp.status = 'pending' AND cp.category IN ('code_submission', 'solution_submission')
          ${studentScope}
        ORDER BY cp.student_id, cp.created_at DESC
      `

      console.log("[Approve All] Found", allPending.length, "pending points")

      // Fetch assignments to resolve legacy (submission_id null) to assignment by reason
      let assignments: { id: number; title: string }[] = []
      try {
        assignments = await sql`
          SELECT cps.id, cps.title
          FROM classroom_point_submissions cps
          WHERE 1 = 1
            ${sqlSubmissionCourseScope(courseId)}
        ` as any
      } catch {
        // Table may not exist
      }

      const resolveLegacy = (point: any): number | null => {
        if (point.submission_id != null) return point.submission_id
        const reason = (point.reason || '').trim()
        if (!reason) return null
        let best: { id: number; len: number } | null = null
        for (const a of assignments) {
          const title = (a.title || '').trim()
          if (!title) continue
          if (reason.startsWith(title) || reason.startsWith(title + '...') || reason.startsWith(title + ' -')) {
            if (!best || title.length > best.len) best = { id: a.id, len: title.length }
          }
        }
        return best?.id ?? null
      }

      // Group by (student_id, assignment) - legacy matched to assignment by reason
      const assignmentGroups = new Map<string, any[]>()
      
      for (const point of allPending) {
        const resolvedSubId = resolveLegacy(point)
        const assignmentKey = resolvedSubId != null
          ? `student-${point.student_id}-sub-${resolvedSubId}`
          : `student-${point.student_id}-reason-${(point.reason || point.submission_title || 'unknown').substring(0, 150)}`
        
        if (!assignmentGroups.has(assignmentKey)) {
          assignmentGroups.set(assignmentKey, [])
        }
        assignmentGroups.get(assignmentKey)!.push(point)
      }

      const toApprove: number[] = []
      const toRejectAsDuplicate: number[] = []
      const duplicateReasons = new Map<number, string>()

      for (const [assignmentKey, assignmentGroup] of assignmentGroups.entries()) {
        if (assignmentGroup.length === 1) {
          toApprove.push(assignmentGroup[0].id)
        } else {
          // Multiple submissions for same assignment - keep highest score, reject rest (regardless of time)
          const highestOverall = assignmentGroup.reduce((max, p) => 
            parseFloat(p.points.toString()) > parseFloat(max.points.toString()) ? p : max
          )
          
          toApprove.push(highestOverall.id)
          for (const point of assignmentGroup) {
            if (point.id !== highestOverall.id) {
              toRejectAsDuplicate.push(point.id)
              duplicateReasons.set(
                point.id,
                `Duplicate submission for same assignment - Higher score (${highestOverall.points} points) kept. Only 1 attempt per assignment allowed.`
              )
            }
          }
          const studentId = assignmentGroup[0].student_id
          console.log(`[Approve All] Student ${studentId}: ${assignmentGroup.length} submissions for same assignment, keeping highest score (${highestOverall.points} points)`)
        }
      }

      // Reject duplicates first
      if (toRejectAsDuplicate.length > 0) {
        for (const duplicateId of toRejectAsDuplicate) {
          const reason = duplicateReasons.get(duplicateId) || "Duplicate submission - Higher score already approved"
          await sql`
            UPDATE classroom_points
            SET status = 'rejected', reason = ${reason}
            WHERE id = ${duplicateId}
          `
        }
        console.log("[Approve All] Rejected", toRejectAsDuplicate.length, "duplicate submissions")
      }

      // AI Validation - Only if verifyAndApproveAll is true
      if (verifyAndApproveAll && toApprove.length > 0) {
        // Get full details for points to approve
        const pointsToValidate = allPending.filter(p => toApprove.includes(p.id))
        
        // Prepare batch validation requests (10 per batch)
        const batchSize = 10
        const validationResults = new Map<number, { points: number; remark: string }>()
        
        for (let i = 0; i < pointsToValidate.length; i += batchSize) {
          const batch = pointsToValidate.slice(i, i + batchSize)
          
          // Prepare batch for AI validation
          const batchSubmissions = batch
            .filter(p => p.code && p.submission_title)
            .map(p => ({
              id: p.id,
              code: p.code,
              plotImage: p.plot_image || undefined,
              assignmentTitle: p.submission_title,
              assignmentDescription: p.submission_description,
              studentName: p.student_name,
              studentId: p.student_id
            }))
          
          if (batchSubmissions.length > 0) {
            try {
              const baseUrl = getBaseUrl()
              
              const validationResponse = await fetch(`${baseUrl}/api/classroom-points/validate-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissions: batchSubmissions })
              })
              
              if (validationResponse.ok) {
                const validationData = await validationResponse.json()
                if (validationData.results && Array.isArray(validationData.results)) {
                  for (const result of validationData.results) {
                    validationResults.set(result.id, {
                      points: result.points || 2.5,
                      remark: result.remark || ''
                    })
                  }
                }
              }
            } catch (error) {
              console.error(`[Verify and Approve All] AI validation error for batch ${i / batchSize + 1}:`, error)
              // Continue with default points if AI validation fails
            }
          }
        }
        
        // Update points with AI validation results
        const updatePromises = toApprove.map(async (pointId) => {
          const point = allPending.find(p => p.id === pointId)
          if (!point) return
          
          const booster = Math.max(1, Number((point as { point_booster?: number | null }).point_booster) || 1)
          const aiResult = validationResults.get(pointId)
          let basePoints = point.points > 0 ? Number(point.points) / booster : CLASSROOM_BASE_POINTS
          let updatedReason = point.reason || ''
          
          if (aiResult) {
            basePoints = Math.max(0, Math.min(CLASSROOM_BASE_POINTS, Number(aiResult.points) || 0))
            if (aiResult.remark) {
              updatedReason = `${updatedReason} | AI: ${aiResult.remark}`.substring(0, 1000)
            }
          } else if (point.code && point.submission_title) {
            basePoints = CLASSROOM_BASE_POINTS
          }
          
          const pointsToAward = classroomPointsWithBooster(basePoints, booster)
          
          return sql`
            UPDATE classroom_points
            SET status = 'approved', 
                awarded_at = COALESCE(awarded_at, NOW()),
                points = ${pointsToAward},
                reason = ${updatedReason}
            WHERE id = ${pointId}
            RETURNING *
          `
        })
        
        const results = await Promise.all(updatePromises)
        const approvedPoints = results.flat().filter(r => r && r.length > 0).flat()
        
        // Update corresponding codebench_submissions to approved with points_awarded
        if (approvedPoints.length > 0) {
          try {
            for (const approvedPoint of approvedPoints) {
              await sql`
                UPDATE codebench_submissions
                SET status = 'approved',
                    points_awarded = ${approvedPoint.points}
                WHERE classroom_point_id = ${approvedPoint.id}
                  AND status = 'pending'
              `
            }
            console.log("[Verify and Approve All] Updated codebench submissions with points:", approvedPoints.length)
          } catch (error) {
            console.log("[Verify and Approve All] Codebench submission update:", error)
            // Non-critical error, continue
          }
        }

        return NextResponse.json({
          success: true,
          message: `${approvedPoints.length} points verified and approved with AI, ${toRejectAsDuplicate.length} duplicates rejected`,
          count: approvedPoints.length,
          duplicatesRejected: toRejectAsDuplicate.length,
        })
      } else if (toApprove.length > 0) {
        // Original approve all without AI - just check duplicates and approve
        const result = await sql`
          UPDATE classroom_points
          SET status = 'approved', 
              awarded_at = COALESCE(awarded_at, NOW()),
              points = CASE 
                WHEN points::numeric < (COALESCE(point_booster, 1)::numeric * ${CLASSROOM_BASE_POINTS}::numeric)
                  THEN (COALESCE(point_booster, 1)::numeric * ${CLASSROOM_BASE_POINTS}::numeric)
                ELSE points 
              END
          WHERE id = ANY(${toApprove})
          RETURNING *
        `
        
        // Update corresponding codebench_submissions to approved with points_awarded
        if (result.length > 0) {
          try {
            for (const approvedPoint of result) {
              await sql`
                UPDATE codebench_submissions
                SET status = 'approved',
                    points_awarded = ${approvedPoint.points}
                WHERE classroom_point_id = ${approvedPoint.id}
                  AND status = 'pending'
              `
            }
            console.log("[Approve All] Updated codebench submissions with points:", result.length)
          } catch (error) {
            console.log("[Approve All] Codebench submission update:", error)
            // Non-critical error, continue
          }
        }

        return NextResponse.json({
          success: true,
          message: `${result.length} points approved, ${toRejectAsDuplicate.length} duplicates rejected`,
          count: result.length,
          duplicatesRejected: toRejectAsDuplicate.length,
        })
      } else {
        return NextResponse.json({
          success: true,
          message: `No points to approve`,
          count: 0,
          duplicatesRejected: toRejectAsDuplicate.length,
        })
      }
    } else {
      // Approve single point
      if (!id) {
        return NextResponse.json(
          { error: "Point ID is required" },
          { status: 400 }
        )
      }

      const body = await request.json().catch(() => ({}))
      const customPoints = body.points
      
      // First, fetch the point to check for duplicates and get submission details
      const pointToApprove = await sql`
        SELECT 
          cp.*,
          cs.code,
          cs.plot_image,
          cps.title as submission_title,
          cps.description as submission_description,
          s.full_name as student_name
        FROM classroom_points cp
        LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
        LEFT JOIN classroom_point_submissions cps ON cps.id = cp.submission_id
        LEFT JOIN students s ON s.id = cp.student_id
        WHERE cp.id = ${id} AND cp.status = 'pending' AND cp.category IN ('code_submission', 'solution_submission')
          ${studentScope}
      `
      
      if (pointToApprove.length === 0) {
        return NextResponse.json(
          { error: "Point not found or already approved" },
          { status: 404 }
        )
      }

      const point = pointToApprove[0]
      const booster = Math.max(1, Number(point.point_booster) || 1)
      
      // AI Validation - Check if code matches assignment description
      let aiValidation = null
      let pointsToAward =
        customPoints && customPoints > 0
          ? Number.parseFloat(String(customPoints))
          : Number(point.points) > 0
            ? Number(point.points)
            : classroomPointsWithBooster(CLASSROOM_BASE_POINTS, booster)
      let aiRemark = null
      
      if (point.code && point.submission_title) {
        try {
          const validationResponse = await fetch(`${getBaseUrl()}/api/classroom-points/validate-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: point.code,
              plotImage: point.plot_image || undefined,
              assignmentTitle: point.submission_title,
              assignmentDescription: point.submission_description,
              studentName: point.student_name
            })
          })
          
          if (validationResponse.ok) {
            aiValidation = await validationResponse.json()
            const baseAi = Math.max(
              0,
              Math.min(CLASSROOM_BASE_POINTS, Number(aiValidation.points) || 0),
            )
            pointsToAward = classroomPointsWithBooster(baseAi, booster)
            aiRemark = aiValidation.remark || null
            
            // If AI says it doesn't match, set points to 0 and add remark
            if (!aiValidation.matches) {
              pointsToAward = 0
              aiRemark = `AI Validation: ${aiValidation.remark || 'Code does not match assignment requirements'}`
            }
          }
        } catch (error) {
          console.error("[Approve Points] AI validation error:", error)
          // Continue with default points if AI validation fails
        }
      }
      
      // Check for duplicate submissions for the same assignment (same student + same submission_id or reason)
      // Per-assignment duplicate check - not limited by time
      let potentialDuplicates
      if (point.submission_id != null) {
        potentialDuplicates = await sql`
          SELECT cp.id, cp.points, cp.created_at, cs.code
          FROM classroom_points cp
          LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
          WHERE cp.student_id = ${point.student_id}
            AND cp.submission_id = ${point.submission_id}
            AND cp.status = 'pending'
            AND cp.category IN ('code_submission', 'solution_submission')
            AND cp.id != ${id}
          ORDER BY cp.points DESC, cp.created_at ASC
        `
      } else {
        // Legacy: match by reason prefix (same assignment when submission_id is NULL)
        const reasonPrefix = (point.reason || point.submission_title || '').substring(0, 150)
        potentialDuplicates = await sql`
          SELECT cp.id, cp.points, cp.created_at, cs.code
          FROM classroom_points cp
          LEFT JOIN codebench_submissions cs ON cs.classroom_point_id = cp.id
          WHERE cp.student_id = ${point.student_id}
            AND cp.submission_id IS NULL
            AND cp.status = 'pending'
            AND cp.category IN ('code_submission', 'solution_submission')
            AND cp.id != ${id}
            AND LEFT(COALESCE(cp.reason, ''), 150) = ${reasonPrefix}
          ORDER BY cp.points DESC, cp.created_at ASC
        `
      }
      
      let duplicateWarning = null
      if (potentialDuplicates.length > 0) {
        const higherScore = potentialDuplicates.find((d: any) => parseFloat(d.points?.toString() || '0') > parseFloat(point.points?.toString() || '0'))
        if (higherScore) {
          duplicateWarning = `Warning: Higher-scoring submission (${higherScore.points} pts) exists for same assignment from ${new Date(higherScore.created_at).toLocaleString()}. Consider approving that one instead.`
        } else {
          duplicateWarning = `${potentialDuplicates.length} other pending submission(s) for same assignment. Only 1 per assignment will count.`
        }
        console.log("[Approve Points] Duplicate(s) for same assignment:", { current: point.id, others: potentialDuplicates.map((d: any) => d.id), student_id: point.student_id })
      }
      
      // Update reason with AI remark if available
      const updatedReason = aiRemark 
        ? `${point.reason || ''} | ${aiRemark}`.substring(0, 1000)
        : point.reason
      
      const result = await sql`
        UPDATE classroom_points
        SET status = 'approved', 
            awarded_at = COALESCE(awarded_at, NOW()),
            points = ${pointsToAward},
            reason = ${updatedReason}
        WHERE id = ${id} AND status = 'pending' AND category IN ('code_submission', 'solution_submission')
        RETURNING *
      `

      if (result.length === 0) {
        return NextResponse.json(
          { error: "Point not found or already approved" },
          { status: 404 }
        )
      }

      const approvedPoint = result[0]
      console.log("[Approve Points] Approved point:", {
        id: approvedPoint.id,
        student_id: approvedPoint.student_id,
        points: approvedPoint.points,
        category: approvedPoint.category,
        duplicateWarning
      })

      // Also update the codebench_submissions status to approved and points_awarded
      try {
        const updateResult = await sql`
          UPDATE codebench_submissions
          SET status = 'approved',
              points_awarded = ${pointsToAward}
          WHERE classroom_point_id = ${approvedPoint.id}
            AND status = 'pending'
          RETURNING id
        `
        console.log("[Approve Points] Updated codebench submissions:", updateResult.length)
      } catch (error) {
        console.log("[Approve Points] Codebench submission update:", error)
        // Non-critical error, continue
      }

      // Send assessment_completed email when classroom points (code submission) is approved
      try {
        const { getStudentForEmail } = await import("@/lib/email/send-notification-email")
        const { sendEmail } = await import("@/lib/email/sendEmail")
        const student = await getStudentForEmail(approvedPoint.student_id)
        const title = point.submission_title || "Code Submission"
        if (student?.email) {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com"
          sendEmail("assessment_completed", student.email, {
            name: student.name,
            assessmentType: "code submission",
            assessmentTitle: title,
            score: String(pointsToAward),
            maxScore: String(pointsToAward),
            link: `${baseUrl}/student/dashboard-v2/classroom-points`,
          }).catch((e) => console.warn("[Approve Points] Email send failed:", e))
        }
      } catch (e) {
        console.warn("[Approve Points] Assessment email error:", e)
      }

      return NextResponse.json({
        success: true,
        message: duplicateWarning 
          ? `Point approved with ${pointsToAward} points. ${duplicateWarning}`
          : `Point approved with ${pointsToAward} points`,
        point: result[0],
        duplicateWarning
      })
    }
  } catch (error) {
    console.error("[Approve Points] Error:", error)
    return NextResponse.json(
      { error: "Failed to approve points" },
      { status: 500 }
    )
  }
}

// Reject individual classroom point
export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireClassroomPointsInstructor(request)
    if (!scope.ok) return scope.response

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Point ID is required" },
        { status: 400 }
      )
    }

      const result = await sql`
        UPDATE classroom_points
        SET status = 'rejected'
        WHERE id = ${id} AND status = 'pending' AND category IN ('code_submission', 'solution_submission')
        RETURNING *
      `

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Point not found or already processed" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Point rejected",
      point: result[0],
    })
  } catch (error) {
    console.error("[Reject Points] Error:", error)
    return NextResponse.json(
      { error: "Failed to reject point" },
      { status: 500 }
    )
  }
}

