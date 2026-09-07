export const ANNOUNCEMENT_STUDENT_LOCKED_MESSAGE =
  "This announcement is locked until your instructor unlocks it in class. You can see the title now; content and files will appear after it is unlocked."

export function isAnnouncementStudentContentLocked(row: {
  student_content_locked?: boolean | null
}): boolean {
  return row.student_content_locked === true
}

export const ANNOUNCEMENT_LOCKED_AI_SUMMARY =
  "AI summary will appear after your instructor unlocks this announcement in class."

/** Strip body, attachment URLs, and interactions for student-facing API responses. */
export function redactAnnouncementForStudent<T extends Record<string, unknown>>(announcement: T): T {
  if (!isAnnouncementStudentContentLocked(announcement)) {
    return { ...announcement, student_content_locked: false } as T
  }

  const attachments = Array.isArray(announcement.attachments) ? announcement.attachments : []
  return {
    ...announcement,
    student_content_locked: true,
    content: ANNOUNCEMENT_STUDENT_LOCKED_MESSAGE,
    ai_summary: ANNOUNCEMENT_LOCKED_AI_SUMMARY,
    attachments: [],
    attachment_count: attachments.length,
    allow_reactions: false,
    allow_comments: false,
  } as T
}
