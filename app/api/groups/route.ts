import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql, sectionsAreAliasEquivalent } from "@/lib/session-code-aliases"
import { resolveGroupProjectCourseScope } from "@/lib/student-course-scope"
import { instructorCanAccessCourse } from "@/lib/instructor-actor-scope"
import {
  instructorIdFromGroupsRequest,
  studentDbIdFromGroupsRequest,
} from "@/lib/group-request-auth"
import { assertGroupSizeWithinPolicy, assertStudentSelfFormAllowed } from "@/lib/project-policy-enforcement"
import { resolveGroupProjectTermScope } from "@/lib/group-project-term-scope"

export const dynamic = "force-dynamic"
export const revalidate = 15 // Cache for 15 seconds (groups update moderately)
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const perfStart = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const session = searchParams.get("session")
    const status = searchParams.get("status") // "all", "pending", "approved", "deleted"
    const includeDeleted = searchParams.get("includeDeleted") === "true" || status === "deleted"


    let groups

    const scope = await resolveGroupProjectCourseScope(request)
    if (!scope.ok) return scope.response
    const gCourseScope = scope.gCourseScope
    const gTermScope = await resolveGroupProjectTermScope(request, scope.courseId, session)

    // Build query with proper parameter handling
    if (session && session !== "all") {
      if (status === "deleted") {
        groups = await sql`
          SELECT 
            g.id,
            g.name,
            g.session,
            g.created_by,
            g.created_at,
            g.status,
            g.pending_changes,
            g.deleted_at,
            g.deleted_by,
            s.full_name as leader_name,
            s.student_id as leader_student_id,
            COUNT(gm.id) as member_count,
            json_agg(
              json_build_object(
                'id', st.id,
                'student_id', st.student_id,
                'full_name', st.full_name,
                'joined_at', gm.joined_at
              ) ORDER BY gm.joined_at
            ) FILTER (WHERE st.id IS NOT NULL) as members
          FROM groups g
          JOIN students s ON g.created_by = s.id
          LEFT JOIN group_members gm ON g.id = gm.group_id
          LEFT JOIN students st ON gm.student_id = st.id
          WHERE g.deleted_at IS NOT NULL
          AND (${gCourseScope}) AND (${gTermScope})
          GROUP BY g.id, s.full_name, s.student_id, g.deleted_at, g.deleted_by
          ORDER BY g.deleted_at DESC
        `
      } else if (status && status !== "all") {
        groups = await sql`
          SELECT 
            g.id,
            g.name,
            g.session,
            g.created_by,
            g.created_at,
            g.status,
            g.pending_changes,
            g.deleted_at,
            g.deleted_by,
            s.full_name as leader_name,
            s.student_id as leader_student_id,
            COUNT(gm.id) as member_count,
            json_agg(
              json_build_object(
                'id', st.id,
                'student_id', st.student_id,
                'full_name', st.full_name,
                'joined_at', gm.joined_at
              ) ORDER BY gm.joined_at
            ) FILTER (WHERE st.id IS NOT NULL) as members
          FROM groups g
          JOIN students s ON g.created_by = s.id
          LEFT JOIN group_members gm ON g.id = gm.group_id
          LEFT JOIN students st ON gm.student_id = st.id
          WHERE g.status = ${status}
            AND g.deleted_at IS NULL
          AND (${gCourseScope}) AND (${gTermScope})
          GROUP BY g.id, s.full_name, s.student_id, g.deleted_at, g.deleted_by
          ORDER BY g.created_at DESC
        `
      } else {
        // All groups for this session - conditionally filter deleted
        if (includeDeleted) {
          groups = await sql`
            SELECT 
              g.id,
              g.name,
              g.session,
              g.created_by,
              g.created_at,
              g.status,
              g.pending_changes,
              g.deleted_at,
              g.deleted_by,
              s.full_name as leader_name,
              s.student_id as leader_student_id,
              COUNT(gm.id) as member_count,
              json_agg(
                json_build_object(
                  'id', st.id,
                  'student_id', st.student_id,
                  'full_name', st.full_name,
                  'joined_at', gm.joined_at
                ) ORDER BY gm.joined_at
              ) FILTER (WHERE st.id IS NOT NULL) as members
            FROM groups g
            JOIN students s ON g.created_by = s.id
            LEFT JOIN group_members gm ON g.id = gm.group_id
            LEFT JOIN students st ON gm.student_id = st.id
            WHERE TRUE
            AND (${gCourseScope}) AND (${gTermScope})
            GROUP BY g.id, s.full_name, s.student_id, g.deleted_at, g.deleted_by
            ORDER BY 
              CASE WHEN g.deleted_at IS NOT NULL THEN 1 ELSE 0 END,
              g.created_at DESC
          `
        } else {
          groups = await sql`
            SELECT 
              g.id,
              g.name,
              g.session,
              g.created_by,
              g.created_at,
              g.status,
              g.pending_changes,
              g.deleted_at,
              g.deleted_by,
              s.full_name as leader_name,
              s.student_id as leader_student_id,
              COUNT(gm.id) as member_count,
              json_agg(
                json_build_object(
                  'id', st.id,
                  'student_id', st.student_id,
                  'full_name', st.full_name,
                  'joined_at', gm.joined_at
                ) ORDER BY gm.joined_at
              ) FILTER (WHERE st.id IS NOT NULL) as members
            FROM groups g
            JOIN students s ON g.created_by = s.id
            LEFT JOIN group_members gm ON g.id = gm.group_id
            LEFT JOIN students st ON gm.student_id = st.id
            WHERE g.deleted_at IS NULL
            AND (${gCourseScope}) AND (${gTermScope})
            GROUP BY g.id, s.full_name, s.student_id, g.deleted_at, g.deleted_by
            ORDER BY g.created_at DESC
          `
        }
      }
    } else {
      if (status === "deleted") {
        groups = await sql`
          SELECT 
            g.id,
            g.name,
            g.session,
            g.created_by,
            g.created_at,
            g.status,
            g.pending_changes,
            g.deleted_at,
            g.deleted_by,
            s.full_name as leader_name,
            s.student_id as leader_student_id,
            COUNT(gm.id) as member_count,
            json_agg(
              json_build_object(
                'id', st.id,
                'student_id', st.student_id,
                'full_name', st.full_name,
                'joined_at', gm.joined_at
              ) ORDER BY gm.joined_at
            ) FILTER (WHERE st.id IS NOT NULL) as members
          FROM groups g
          JOIN students s ON g.created_by = s.id
          LEFT JOIN group_members gm ON g.id = gm.group_id
          LEFT JOIN students st ON gm.student_id = st.id
          WHERE g.deleted_at IS NOT NULL
          AND (${gCourseScope}) AND (${gTermScope})
          GROUP BY g.id, s.full_name, s.student_id, g.deleted_at, g.deleted_by
          ORDER BY g.deleted_at DESC
        `
      } else if (status && status !== "all") {
        groups = await sql`
          SELECT 
            g.id,
            g.name,
            g.session,
            g.created_by,
            g.created_at,
            g.status,
            g.pending_changes,
            g.deleted_at,
            g.deleted_by,
            s.full_name as leader_name,
            s.student_id as leader_student_id,
            COUNT(gm.id) as member_count,
            json_agg(
              json_build_object(
                'id', st.id,
                'student_id', st.student_id,
                'full_name', st.full_name,
                'joined_at', gm.joined_at
              ) ORDER BY gm.joined_at
            ) FILTER (WHERE st.id IS NOT NULL) as members
          FROM groups g
          JOIN students s ON g.created_by = s.id
          LEFT JOIN group_members gm ON g.id = gm.group_id
          LEFT JOIN students st ON gm.student_id = st.id
          WHERE g.status = ${status}
            AND g.deleted_at IS NULL
          AND (${gCourseScope}) AND (${gTermScope})
          GROUP BY g.id, s.full_name, s.student_id, g.deleted_at, g.deleted_by
          ORDER BY g.created_at DESC
        `
      } else {
        // All groups - conditionally filter deleted
        if (includeDeleted) {
          groups = await sql`
            SELECT 
              g.id,
              g.name,
              g.session,
              g.created_by,
              g.created_at,
              g.status,
              g.pending_changes,
              g.deleted_at,
              g.deleted_by,
              s.full_name as leader_name,
              s.student_id as leader_student_id,
              COUNT(gm.id) as member_count,
              json_agg(
                json_build_object(
                  'id', st.id,
                  'student_id', st.student_id,
                  'full_name', st.full_name,
                  'joined_at', gm.joined_at
                ) ORDER BY gm.joined_at
              ) FILTER (WHERE st.id IS NOT NULL) as members
            FROM groups g
            JOIN students s ON g.created_by = s.id
            LEFT JOIN group_members gm ON g.id = gm.group_id
            LEFT JOIN students st ON gm.student_id = st.id
            WHERE TRUE
            AND (${gCourseScope}) AND (${gTermScope})
            GROUP BY g.id, s.full_name, s.student_id, g.deleted_at, g.deleted_by
            ORDER BY 
              CASE WHEN g.deleted_at IS NOT NULL THEN 1 ELSE 0 END,
              g.created_at DESC
          `
        } else {
          groups = await sql`
            SELECT 
              g.id,
              g.name,
              g.session,
              g.created_by,
              g.created_at,
              g.status,
              g.pending_changes,
              g.deleted_at,
              g.deleted_by,
              s.full_name as leader_name,
              s.student_id as leader_student_id,
              COUNT(gm.id) as member_count,
              json_agg(
                json_build_object(
                  'id', st.id,
                  'student_id', st.student_id,
                  'full_name', st.full_name,
                  'joined_at', gm.joined_at
                ) ORDER BY gm.joined_at
              ) FILTER (WHERE st.id IS NOT NULL) as members
            FROM groups g
            JOIN students s ON g.created_by = s.id
            LEFT JOIN group_members gm ON g.id = gm.group_id
            LEFT JOIN students st ON gm.student_id = st.id
            WHERE g.deleted_at IS NULL
            AND (${gCourseScope}) AND (${gTermScope})
            GROUP BY g.id, s.full_name, s.student_id, g.deleted_at, g.deleted_by
            ORDER BY g.created_at DESC
          `
        }
      }
    }

    return NextResponse.json({ groups })
  } catch (error) {
    console.error("[v0] Failed to fetch groups - ERROR:", error)
    return NextResponse.json({ error: "Failed to fetch groups" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, session, createdBy, initialMembers } = body

    // Validate required fields
    if (!name || !session || !createdBy) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify student exists and belongs to session
    const studentCheck = await sql`
      SELECT id, section, student_id, full_name, session_id FROM students WHERE id = ${createdBy}
    `

    if (studentCheck.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const leaderRow = studentCheck[0] as { id: number; section: string | null; session_id: number }
    const leaderSessionRow = await sql`
      SELECT id, code, course_id FROM sessions WHERE id = ${leaderRow.session_id}
    `
    const leaderSessionId = Number(leaderSessionRow[0]?.id)
    const leaderEnrolledCode = String(leaderSessionRow[0]?.code ?? "").trim()
    const leaderCourseId = (leaderSessionRow[0] as { course_id?: number | null })?.course_id ?? null
    const leaderSectionText = String(leaderRow.section ?? "").trim()
    if (
      !sectionsAreAliasEquivalent(session, leaderEnrolledCode) &&
      !sectionsAreAliasEquivalent(session, leaderSectionText)
    ) {
      return NextResponse.json({ error: "Student does not belong to this session" }, { status: 403 })
    }

    const sessionForRow = leaderEnrolledCode || session

    const instructorId = instructorIdFromGroupsRequest(request)
    if (instructorId != null) {
      if (leaderCourseId == null || !(await instructorCanAccessCourse(instructorId, Number(leaderCourseId)))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else {
      const studentDbId = await studentDbIdFromGroupsRequest(request)
      if (studentDbId == null || studentDbId !== Number(createdBy)) {
        return NextResponse.json(
          { error: "Student or instructor authentication required" },
          { status: 401 },
        )
      }
    }

    const selfForm = await assertStudentSelfFormAllowed(leaderCourseId, instructorId != null)
    if (!selfForm.ok) return selfForm.response
    const initialCount = 1 + (Array.isArray(initialMembers) ? initialMembers.length : 0)
    const size = await assertGroupSizeWithinPolicy(leaderCourseId, initialCount)
    if (!size.ok) return size.response

    // Check if student is already in a group (excluding deleted groups)
    // Allow students to be in multiple individual groups (groups where they're the only member)
    const existingMembership = await sql`
      SELECT 
        g.id as group_id,
        g.name, 
        g.status, 
        g.created_by,
        (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) as member_count
      FROM group_members gm
      JOIN groups g ON gm.group_id = g.id
      WHERE gm.student_id = ${createdBy}
      AND g.status IN ('pending', 'approved', 'pending_update')
      AND (g.deleted_at IS NULL)
    `

    // Check if student is already in a non-individual group (more than 1 member)
    // OR if student is a member (not creator) of any group
    const nonIndividualGroups = existingMembership.filter((g: any) => {
      const memberCount = parseInt(g.member_count || '0')
      // Block if: student is a member (not creator) of any group, OR student created a group with multiple members
      return (g.created_by !== createdBy) || (g.created_by === createdBy && memberCount > 1)
    })

    if (nonIndividualGroups.length > 0) {
      const blockingGroup = nonIndividualGroups[0]
      const isMember = blockingGroup.created_by !== createdBy
      return NextResponse.json({ 
        error: isMember 
          ? `You are already a member of group: ${blockingGroup.name} (${blockingGroup.status})`
          : `You already have a group with multiple members: ${blockingGroup.name} (${blockingGroup.status})` 
      }, { status: 400 })
    }

    // Determine if this is an individual group (no initial members or empty array)
    const isIndividualGroup = !initialMembers || (Array.isArray(initialMembers) && initialMembers.length === 0)
    // Auto-approve individual groups so students can immediately create projects
    const initialStatus = isIndividualGroup ? 'approved' : 'pending'

    const groupCols = await (await import("@/lib/instructor-default-courses")).getGroupsProjectsCourseIdColumns()

    // Create the group — session_id pins the row to the leader's term-specific section.
    const result = groupCols.groupsHasSessionId
      ? await sql`
          INSERT INTO groups (name, session, session_id, created_by, status, course_id)
          VALUES (
            ${name},
            ${sessionForRow},
            ${Number.isFinite(leaderSessionId) && leaderSessionId > 0 ? leaderSessionId : null},
            ${createdBy},
            ${initialStatus},
            ${leaderCourseId}
          )
          RETURNING id, name, session, status, created_at
        `
      : await sql`
          INSERT INTO groups (name, session, created_by, status, course_id)
          VALUES (${name}, ${sessionForRow}, ${createdBy}, ${initialStatus}, ${leaderCourseId})
          RETURNING id, name, session, status, created_at
        `

    const group = result[0]

    // Add the creator as a member
    await sql`
      INSERT INTO group_members (group_id, student_id)
      VALUES (${group.id}, ${createdBy})
    `

    // Add initial members if provided
    if (initialMembers && initialMembers.length > 0) {
      const failedMembers: Array<{ id: number; name: string; reason: string }> = []
      
      for (const memberId of initialMembers) {
        try {
          // Check if member is already in another group (excluding deleted groups)
          const memberCheck = await sql`
            SELECT gm.id, g.name, s.full_name
            FROM group_members gm
            JOIN groups g ON gm.group_id = g.id
            JOIN students s ON gm.student_id = s.id
            WHERE gm.student_id = ${memberId}
            AND g.status IN ('pending', 'approved', 'pending_update')
            AND (g.deleted_at IS NULL)
          `

          if (memberCheck.length > 0) {
            const member = memberCheck[0]
            failedMembers.push({
              id: memberId,
              name: member.full_name || `Student ${memberId}`,
              reason: `Already in group: ${member.name}`
            })
            continue
          }

          // Verify student exists and belongs to same session
          const memberRowResult = await sql`
            SELECT id, section, full_name, session_id FROM students WHERE id = ${memberId}
          `
          
          if (memberRowResult.length === 0) {
            failedMembers.push({
              id: memberId,
              name: `Student ${memberId}`,
              reason: "Student not found"
            })
            continue
          }

          const m = memberRowResult[0] as { section: string | null; full_name: string | null; session_id: number }
          const mSess = await sql`SELECT code FROM sessions WHERE id = ${m.session_id}`
          const mEnrolled = String(mSess[0]?.code ?? "").trim()
          const mSectionText = String(m.section ?? "").trim()
          if (
            !sectionsAreAliasEquivalent(session, mEnrolled) &&
            !sectionsAreAliasEquivalent(session, mSectionText)
          ) {
            failedMembers.push({
              id: memberId,
              name: m.full_name || `Student ${memberId}`,
              reason: `Student belongs to different session (${mSectionText || mEnrolled || "unknown"})`
            })
            continue
          }

          // Add member
          await sql`
            INSERT INTO group_members (group_id, student_id)
            VALUES (${group.id}, ${memberId})
          `
        } catch (error: any) {
          // Check if it's a unique constraint violation (student already in a group)
          if (error?.code === '23505' || error?.message?.includes('unique constraint') || error?.message?.includes('uq_group_members_student')) {
            const studentInfo = await sql`
              SELECT full_name FROM students WHERE id = ${memberId}
            `
            failedMembers.push({
              id: memberId,
              name: studentInfo[0]?.full_name || `Student ${memberId}`,
              reason: "Already in another group"
            })
          } else {
            console.error("[v0] Error adding member:", memberId, error)
            throw error // Re-throw if it's not a constraint violation
          }
        }
      }
    }
    return NextResponse.json({ success: true, groupId: group.id, group })
  } catch (error: any) {
    console.error("[v0] Failed to create group:", error)

    // Provide more specific error messages
    let errorMessage = "Failed to create group"
    
    if (error?.code === '23505') {
      // Unique constraint violation
      if (error?.constraint === 'uq_group_members_student') {
        errorMessage = "One or more selected members are already in another group. Please remove them and try again."
      } else {
        errorMessage = "A group with this name may already exist in this session."
      }
    } else if (error?.code === '23503') {
      // Foreign key violation
      errorMessage = "Invalid student or session. Please refresh and try again."
    } else if (error?.message) {
      errorMessage = error.message
    }

    return NextResponse.json({ 
      error: errorMessage,
      details: error?.detail || undefined
    }, { status: 500 })
  }
}
