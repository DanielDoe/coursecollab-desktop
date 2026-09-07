import { sql } from "@/lib/db"

interface NotifyInstructorParams {
  studentId: string
  studentName: string
  notificationType: 'performance' | 'milestone' | 'struggle'
  message: string
  data?: any
}

export async function notifyInstructorPractice({
  studentId,
  studentName,
  notificationType,
  message,
  data = {}
}: NotifyInstructorParams) {
  try {
    // Create notification in instructor_practice_notifications table
    await sql`
      INSERT INTO instructor_practice_notifications (
        student_id,
        student_name,
        notification_type,
        message,
        data,
        is_read
      ) VALUES (
        ${studentId},
        ${studentName},
        ${notificationType},
        ${message},
        ${JSON.stringify(data)},
        false
      )
    `

    console.log(`[Notify Instructor] ${notificationType} notification created for student ${studentName}`)
    return { success: true }
  } catch (error) {
    console.error("[Notify Instructor] Failed to create notification:", error)
    return { success: false, error }
  }
}

// Helper functions for common notification types
export async function notifyPracticeCompletion(
  studentId: string,
  studentName: string,
  score: number,
  topic: string,
  difficulty: string
) {
  let notificationType: 'performance' | 'milestone' | 'struggle'
  let message: string

  if (score >= 90) {
    notificationType = 'performance'
    message = `🌟 ${studentName} scored ${score}% on ${topic} (${difficulty})!`
  } else if (score >= 80) {
    notificationType = 'performance'
    message = `👏 ${studentName} scored ${score}% on ${topic} (${difficulty}).`
  } else if (score < 60) {
    notificationType = 'struggle'
    message = `⚠️ ${studentName} scored ${score}% on ${topic} (${difficulty}). May need help.`
  } else {
    notificationType = 'performance'
    message = `${studentName} completed ${topic} practice (${difficulty}) with ${score}%.`
  }

  return notifyInstructorPractice({
    studentId,
    studentName,
    notificationType,
    message,
    data: { score, topic, difficulty }
  })
}

export async function notifyMilestone(
  studentId: string,
  studentName: string,
  milestone: string,
  details: any
) {
  return notifyInstructorPractice({
    studentId,
    studentName,
    notificationType: 'milestone',
    message: `🎯 ${studentName} achieved: ${milestone}`,
    data: details
  })
}

export async function notifyStruggle(
  studentId: string,
  studentName: string,
  strugglingTopic: string,
  averageScore: number
) {
  return notifyInstructorPractice({
    studentId,
    studentName,
    notificationType: 'struggle',
    message: `📚 ${studentName} is struggling with ${strugglingTopic} (Avg: ${averageScore}%). Consider additional support.`,
    data: { topic: strugglingTopic, averageScore }
  })
}
