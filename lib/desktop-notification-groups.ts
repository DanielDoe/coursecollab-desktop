const PORTAL_LABELS: Record<string, string> = {
  student: 'Student',
  faculty: 'Faculty',
  admin: 'Admin',
}

const TYPE_LABELS: Record<string, string> = {
  announcement: 'announcements',
  quiz: 'quiz updates',
  homework: 'homework updates',
  exam: 'exam updates',
  grade: 'grade updates',
  deadline: 'deadlines',
  deadline_reminder: 'deadlines',
  quiz_submission: 'quiz submissions',
  code_submission: 'code submissions',
  classroom_points: 'classroom points',
  practice: 'practice updates',
  student_question: 'student questions',
  student_registration: 'registrations',
  analytics: 'analytics',
  lecture: 'lectures',
  project: 'projects',
  group: 'groups',
  message: 'messages',
  forum: 'discussions',
  recommendation: 'recommendations',
  membership: 'membership',
  access_request: 'access requests',
  donation: 'donations',
  calendar: 'calendar',
  office_hours: 'office hours',
  attendance: 'attendance',
  course_exchange: 'course exchange',
}

function normalizeType(type?: string | null): string {
  if (!type) return 'general'
  return type.toLowerCase().replace(/\s+/g, '_')
}

export function extractCourseKeyFromLink(link?: string | null): string | null {
  if (!link) return null

  const numericPatterns = [
    /\/courses\/(\d+)/i,
    /courseId=(\d+)/i,
    /\/course\/(\d+)/i,
    /selectedCourse=(\d+)/i,
  ]

  for (const pattern of numericPatterns) {
    const match = link.match(pattern)
    if (match?.[1]) return `course:${match[1]}`
  }

  const facultyMatch = link.match(/\/faculty\/dashboard\/([^/?#]+)/i)
  const segment = facultyMatch?.[1]?.toLowerCase()
  const reserved = new Set(['communication', 'settings', 'analytics', 'courses', 'dashboard'])
  if (segment && !reserved.has(segment)) {
    return `course:${segment}`
  }

  return null
}

export function extractCourseLabel(notification: {
  link?: string | null
  source_name?: string | null
}): string | null {
  if (notification.source_name) return notification.source_name
  const key = extractCourseKeyFromLink(notification.link)
  if (!key) return null
  return key.replace(/^course:/, '')
}

export function desktopNotificationGroupKey(
  portal: string,
  type?: string | null,
  courseKey?: string | null,
  groupByCourse?: boolean,
): string {
  const base = `${portal}:${normalizeType(type)}`
  if (groupByCourse && courseKey) return `${base}:${courseKey}`
  return base
}

export function desktopNotificationGroupLabel(
  portal: string,
  type?: string | null,
  courseLabel?: string | null,
): string {
  const portalLabel = PORTAL_LABELS[portal] ?? 'CourseCollab'
  const normalized = normalizeType(type)

  for (const [needle, label] of Object.entries(TYPE_LABELS)) {
    if (normalized.includes(needle)) {
      if (courseLabel) return `${courseLabel} — ${label}`
      return `${portalLabel} ${label}`
    }
  }

  if (courseLabel) return `${courseLabel} updates`
  return `${portalLabel} updates`
}

export function desktopNotificationHubLink(portal: string): string {
  if (portal === 'faculty') return '/faculty/dashboard/communication/notifications'
  if (portal === 'admin') return '/admin/dashboard-v2/communication/notifications'
  return '/student/dashboard-v2/notifications'
}

export function notificationSupportsReply(type?: string | null): boolean {
  return normalizeType(type).includes('message')
}
