/**
 * Send new assessment notification emails to students
 * Call alongside createBulkNotifications when posting new assessments
 */

import { sql } from "@/lib/db"
import { sendEmail } from "./sendEmail"
import { getStudentForEmail } from "./send-notification-email"

type AssessmentType = "quiz" | "homework" | "mid-semester" | "final" | "code submission"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com"

const LINK_MAP: Record<AssessmentType, string> = {
  quiz: `${BASE_URL}/student/dashboard-v2/quizzes`,
  homework: `${BASE_URL}/student/dashboard-v2/homework`,
  "mid-semester": `${BASE_URL}/student/dashboard-v2/mid-semester-exams`,
  final: `${BASE_URL}/student/dashboard-v2/final-exams`,
  "code submission": `${BASE_URL}/student/dashboard-v2/classroom-points`,
}

/**
 * Send new assessment emails to students (by internal ID)
 */
export async function sendNewAssessmentEmails(
  studentIds: number[],
  assessmentType: AssessmentType,
  title: string,
  dueDate: string | null = null
): Promise<{ sent: number; skipped: number }> {
  const link = LINK_MAP[assessmentType] || `${BASE_URL}/student/dashboard-v2`
  let sent = 0
  let skipped = 0
  for (const id of studentIds) {
    const student = await getStudentForEmail(id)
    if (!student?.email) {
      skipped++
      continue
    }
    const result = await sendEmail("new_assessment", student.email, {
      name: student.name,
      assessmentType,
      assessmentTitle: title,
      dueDate,
      link,
    })
    if (result.success) sent++
    else skipped++
  }
  return { sent, skipped }
}
