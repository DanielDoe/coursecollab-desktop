/**
 * CourseCollab Email Service
 * Centralized email sending for the platform
 *
 * Usage:
 *   import { sendEmail } from "@/lib/email"
 *   await sendEmail("quiz_available", student.email, { quizTitle: "Midterm" })
 *
 * Future: email queue, retry, analytics, preferences, unsubscribe
 */

export { sendEmail } from "./sendEmail"
export type { EmailType } from "./emailTypes"
export type { EmailParams } from "./sendEmail"
export { transporter } from "./transporter"
export {
  sendNotificationEmail,
  sendBulkNotificationEmails,
  getStudentForEmail,
  getStudentEmail,
  getStudentsWithEmails,
  isValidStudentEmail,
} from "./send-notification-email"
export { sendNewAssessmentEmails } from "./send-assessment-emails"
export { notifyStudentStaffPasswordReset } from "./notify-student-staff-password-reset"
