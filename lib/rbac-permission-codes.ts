/**

 * RBAC permission codes stored in `permissions` / `course_staff_permissions` tables.

 */



import {

  COURSE_STAFF_ROLES,

  normalizeCourseStaffRole,

  type CourseStaffRole,

} from "@/lib/roles"



export const RBAC_PERMISSION_CODES = [

  "grade_assignments",

  "grade_exams",

  "edit_quizzes",

  "edit_homework",

  "publish_quizzes",

  "publish_homework",

  "publish_classroom_points",

  "publish_announcements",

  "draft_announcements",

  "manage_groups",

  "manage_attendance",

  "take_attendance",

  "hold_office_hours",

  "view_analytics",

  "manage_practice_content",

  "moderate_discussions",

  "manage_lectures",

  "manage_sections",

  "review_submissions",

  "manage_course_settings",

  "manage_tas",

  "manage_students",

  "publish_grades",

  "override_grades",

  "manage_projects",

  "manage_playground",

  "view_institutional_analytics",

  "manage_financials",

  "manage_platform",

  "manage_enrollments",

  "manage_users",

  "manage_courses",

  "assign_course_staff",

  "view_audit_logs",

  "manage_feature_flags",

  "manage_integrations",

  "manage_subscriptions",

  "view_course_content",

  "view_assessments",

  "view_grades_readonly",

  "manage_classroom_points",

  "manage_syllabus",

] as const



export type RbacPermissionCode = (typeof RBAC_PERMISSION_CODES)[number]



export { COURSE_STAFF_ROLES, type CourseStaffRole, normalizeCourseStaffRole }



/** Legacy TaPermissionKey → DB permission code */

export const TA_KEY_TO_PERMISSION_CODE: Record<string, RbacPermissionCode> = {
  canPublishAnnouncements: "publish_announcements",
  canEditQuizzes: "edit_quizzes",
  canEditHomework: "edit_homework",
  canPublishQuizzes: "publish_quizzes",
  canPublishHomework: "publish_homework",
  canPublishClassroomPoints: "publish_classroom_points",
  canGradeAssignments: "grade_assignments",
  canGradeExams: "grade_exams",
  canManageGroups: "manage_groups",
  canManageAttendance: "manage_attendance",
  canHoldOfficeHours: "hold_office_hours",
  canViewAnalytics: "view_analytics",
  canManagePracticeContent: "manage_practice_content",
  canDraftAnnouncements: "draft_announcements",
  canTakeAttendance: "take_attendance",
  canModerateDiscussions: "moderate_discussions",
  canViewAssessments: "view_assessments",
  canManageLectures: "manage_lectures",
  canManagePlayground: "manage_playground",
  canManageProjects: "manage_projects",
  canManageClassroomPoints: "manage_classroom_points",
  canManageSyllabus: "manage_syllabus",
}



export const PERMISSION_CODE_TO_TA_KEY: Record<string, string> = Object.fromEntries(

  Object.entries(TA_KEY_TO_PERMISSION_CODE).map(([k, v]) => [v, k]),

)



/** All TAs use course_staff.role = TA; overrides live in course_staff_permissions */

export function taLevelToStaffRole(_taLevel?: string | null): CourseStaffRole {

  return "TA"

}


