import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { getActiveInstitutionLicense } from "@/lib/institutions/licenses"
import { countActiveLearners } from "@/lib/institutions/active-learners"

export async function getInstitutionFacultyModule(institutionId: number) {
  await ensureInstitutionSchema()
  const license = await getActiveInstitutionLicense(institutionId)
  const licenseId = license ? Number(license.id) : null

  const rows = await sql`
    SELECT
      m.id,
      m.role,
      m.status,
      m.email,
      m.joined_at,
      i.id AS instructor_id,
      i.name,
      i.email AS instructor_email,
      i.membership_tier,
      cora.last_used,
      COALESCE(cora.n, 0)::int AS cora_workflows,
      COALESCE(cora.credits, 0)::int AS cora_credits,
      COALESCE(course_counts.n, 0)::int AS course_count
    FROM institution_members m
    LEFT JOIN instructors i ON m.user_type = 'instructor' AND i.id = m.user_id AND m.user_id > 0
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS n, COALESCE(SUM(credits), 0)::int AS credits, MAX(created_at) AS last_used
      FROM institution_cora_usage u
      WHERE u.institution_id = ${institutionId}
        AND u.user_type = 'instructor'
        AND u.user_id = m.user_id
        AND m.user_id > 0
    ) cora ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT c.id)::int AS n
      FROM courses c
      LEFT JOIN course_staff cs ON cs.course_id = c.id AND cs.instructor_id = m.user_id AND cs.is_active = true
      WHERE m.user_id > 0 AND (c.instructor_id = m.user_id OR cs.instructor_id IS NOT NULL)
    ) course_counts ON TRUE
    WHERE m.institution_id = ${institutionId}
      AND m.user_type = 'instructor'
      AND m.removed_at IS NULL
      AND m.role IN ('faculty', 'owner', 'institution_admin', 'academic_admin', 'department_admin')
    ORDER BY COALESCE(i.name, m.email) ASC
  `

  const faculty = rows.map((r) => ({
    memberId: Number(r.id),
    instructorId: r.instructor_id != null ? Number(r.instructor_id) : null,
    name: r.name ? String(r.name) : null,
    email: String(r.instructor_email ?? r.email ?? ""),
    role: String(r.role),
    status: String(r.status),
    personalTier: r.membership_tier ? String(r.membership_tier) : null,
    lastActive: r.last_used ? String(r.last_used).slice(0, 10) : null,
    coraWorkflows: Number(r.cora_workflows ?? 0),
    coraCredits: Number(r.cora_credits ?? 0),
    courses: Number(r.course_count ?? 0),
    institutionalAccess: r.status === "active" ? "Active" : r.status === "invited" ? "Invited" : String(r.status),
  }))

  const active = faculty.filter((f) => f.status === "active").length
  const invited = faculty.filter((f) => f.status === "invited").length
  const usingCora = faculty.filter((f) => f.coraWorkflows > 0).length
  const coursesManaged = faculty.reduce((s, f) => s + f.courses, 0)

  return {
    kpis: { covered: faculty.length, active, invited, usingCora, coursesManaged },
    faculty,
    licenseId,
  }
}

export async function getInstitutionStudentsModule(institutionId: number, courseId?: number | null) {
  await ensureInstitutionSchema()
  const license = await getActiveInstitutionLicense(institutionId)
  const licenseId = license ? Number(license.id) : null
  const activeLearnerCount = licenseId ? await countActiveLearners(licenseId) : 0

  const filterCourseId =
    courseId != null && Number.isFinite(courseId) && courseId > 0 ? courseId : null

  const rows = await sql`
    SELECT DISTINCT ON (st.id)
      st.id,
      st.full_name,
      st.email,
      st.student_id,
      st.course_id,
      activity.last_active,
      c.course_code,
      c.course_title,
      COALESCE(cora.n, 0)::int AS cora_workflows,
      EXISTS (
        SELECT 1 FROM quiz_attempts qa
        WHERE qa.student_id = st.id AND qa.deleted_at IS NULL
          AND COALESCE(qa.started_at, qa.completed_at) >= NOW() - INTERVAL '30 days'
      ) AS recent_activity
    FROM students st
    JOIN courses c ON c.id = st.course_id
    JOIN institution_license_scopes s ON s.course_id = st.course_id
    JOIN institution_licenses l ON l.id = s.license_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS n FROM institution_cora_usage u
      WHERE u.user_type = 'student' AND u.user_id = st.id AND u.institution_id = ${institutionId}
    ) cora ON TRUE
    LEFT JOIN LATERAL (
      SELECT MAX(ts) AS last_active
      FROM (
        SELECT COALESCE(qa.started_at, qa.completed_at) AS ts
        FROM quiz_attempts qa
        WHERE qa.student_id = st.id AND qa.deleted_at IS NULL
        UNION ALL
        SELECT u.created_at AS ts
        FROM institution_cora_usage u
        WHERE u.user_type = 'student' AND u.user_id = st.id AND u.institution_id = ${institutionId}
      ) events
    ) activity ON TRUE
    WHERE l.institution_id = ${institutionId}
      AND l.status = 'active'
      AND st.deleted_at IS NULL
      AND (${filterCourseId}::int IS NULL OR st.course_id = ${filterCourseId})
    ORDER BY st.id, st.full_name
    LIMIT 500
  `

  const students = rows.map((r) => {
    const lastActive = r.last_active ? new Date(String(r.last_active)) : null
    const inactive = !lastActive || lastActive < new Date(Date.now() - 14 * 86400000)
    return {
      id: Number(r.id),
      name: String(r.full_name ?? "Student"),
      email: String(r.email ?? ""),
      institutionId: r.student_id ? String(r.student_id) : null,
      courseId: Number(r.course_id),
      courseCode: String(r.course_code ?? ""),
      courseTitle: String(r.course_title ?? ""),
      lastActive: r.last_active ? String(r.last_active).slice(0, 10) : null,
      activityStatus: r.recent_activity ? "Active" : inactive ? "Inactive" : "Quiet",
      coraWorkflows: Number(r.cora_workflows ?? 0),
      countsTowardLicense: Boolean(r.recent_activity || r.last_active),
      sponsorship: "Institution license",
    }
  })

  const active = students.filter((s) => s.activityStatus === "Active").length
  const inactive = students.filter((s) => s.activityStatus === "Inactive").length
  const seatLimit =
    license?.seat_limit_students != null ? Number(license.seat_limit_students) : null

  return {
    kpis: {
      sponsored: students.length,
      active,
      inactive,
      needingAttention: inactive,
      licenseUsed: activeLearnerCount,
      seatLimit,
    },
    students,
    activeLearnerCount,
  }
}

export async function getInstitutionCoursesModule(institutionId: number) {
  await ensureInstitutionSchema()
  const license = await getActiveInstitutionLicense(institutionId)
  const licenseId = license ? Number(license.id) : null
  if (!licenseId) return { kpis: { activeCourses: 0, sections: 0, students: 0, faculty: 0, coraCourses: 0 }, courses: [] }

  const rows = await sql`
    SELECT
      c.id,
      c.course_code,
      c.course_title,
      c.semester,
      c.is_active,
      i.name AS instructor_name,
      COALESCE(stu.n, 0)::int AS active_students,
      COALESCE(sec.n, 0)::int AS sections,
      COALESCE(cora.n, 0)::int AS cora_workflows,
      COALESCE(sub.n, 0)::int AS submissions_30d
    FROM institution_license_scopes s
    JOIN courses c ON c.id = s.course_id
    LEFT JOIN instructors i ON i.id = c.instructor_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS n FROM students st
      WHERE st.course_id = c.id AND st.deleted_at IS NULL
    ) stu ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT session_id)::int AS n FROM students st
      WHERE st.course_id = c.id AND st.session_id IS NOT NULL AND st.deleted_at IS NULL
    ) sec ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS n FROM institution_cora_usage u
      WHERE u.course_id = c.id AND u.institution_id = ${institutionId}
    ) cora ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS n FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE q.course_id = c.id AND qa.deleted_at IS NULL
        AND COALESCE(qa.completed_at, qa.started_at) >= NOW() - INTERVAL '30 days'
    ) sub ON TRUE
    WHERE s.license_id = ${licenseId}
    ORDER BY c.course_code
  `

  const courses = rows.map((r) => ({
    id: Number(r.id),
    code: String(r.course_code ?? ""),
    name: String(r.course_title ?? ""),
    semester: r.semester ? String(r.semester) : null,
    instructor: r.instructor_name ? String(r.instructor_name) : null,
    sections: Number(r.sections ?? 0),
    activeStudents: Number(r.active_students ?? 0),
    coraWorkflows: Number(r.cora_workflows ?? 0),
    submissions30d: Number(r.submissions_30d ?? 0),
    coverage: "Covered" as const,
    status: r.is_active === false ? "Inactive" : "Active",
  }))

  return {
    kpis: {
      activeCourses: courses.filter((c) => c.status === "Active").length,
      sections: courses.reduce((s, c) => s + c.sections, 0),
      students: courses.reduce((s, c) => s + c.activeStudents, 0),
      faculty: new Set(courses.map((c) => c.instructor).filter(Boolean)).size,
      coraCourses: courses.filter((c) => c.coraWorkflows > 0).length,
    },
    courses,
  }
}
