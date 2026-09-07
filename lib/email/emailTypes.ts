/**
 * Email type definitions for CourseCollab
 * Centralized types for all email notifications
 */

export type EmailType =
  | "account_verification"
  | "password_reset"
  | "student_password_reset_by_staff"
  | "quiz_available"
  | "grade_released"
  | "grades_updated"
  | "project_invite"
  | "announcement"
  | "instructor_broadcast"
  | "assessment_completed"
  | "new_assessment"
  | "payment_success"
  | "missed_deadline"
  | "missed_assessments_summary"
  | "trade_center_instructor_alert"
  | "course_exchange_faculty_alert"
  | "trade_center_peer_transfer_done"
  | "recommendation_student_update"
  | "recommendation_instructor_update"
  | "midterm_progress_review"
  | "direct_message"
