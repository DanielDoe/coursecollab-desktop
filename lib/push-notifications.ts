import { sql } from "@/lib/db"
import { ensurePushTokensSchema } from "@/lib/ensure-push-tokens-schema"
import { sendExpoPushMessages, type ExpoPushMessage } from "@/lib/expo-push"
import type { MessageActor } from "@/lib/direct-messages/types"

type RegisterPushTokenInput = {
  ownerKind: "student" | "instructor"
  ownerId: number
  expoPushToken: string
  platform?: string | null
  device?: string | null
}

type StudentPushInput = {
  studentInternalId: number
  type: string
  title: string
  body: string
  link?: string | null
  route?: string | null
  extraData?: Record<string, unknown>
}

type InstructorPushInput = {
  /** Target instructor. Omitted means "no known owner" and nothing is sent. */
  instructorId?: number | null
  type: string
  title: string
  body: string
  link?: string | null
  route?: string | null
  extraData?: Record<string, unknown>
}

const PREFERENCE_COLUMN: Record<string, string> = {
  quiz: "quiz_reminders",
  homework: "homework_alerts",
  exam: "exam_alerts",
  deadline: "deadline_alerts",
  practice: "practice_updates",
  ai_tutor: "ai_tutor_alerts",
  codebench: "codebench_results",
  forum: "forum_replies",
  group: "group_messages",
  project: "project_updates",
  lecture: "lecture_updates",
  code_submission: "codebench_results",
  classroom_points: "codebench_results",
  announcement: "announcement_alerts",
  grade: "quiz_reminders",
  membership: "quiz_reminders",
  donation: "quiz_reminders",
  recommendation_letter_ready: "quiz_reminders",
  recommendation_revision: "quiz_reminders",
  recommendation_instructor_update: "quiz_reminders",
  upgrade_reminder: "quiz_reminders",
  calendar: "deadline_alerts",
}

function pushChannelForType(type: string): { categoryId: string; channelId: string; priority: "default" | "high" } {
  const normalized = type.toLowerCase()
  if (normalized.includes("message") || normalized === "forum" || normalized === "direct_message") {
    return { categoryId: "coursecollab.message", channelId: "messages", priority: "high" }
  }
  if (
    normalized.includes("quiz") ||
    normalized.includes("homework") ||
    normalized.includes("exam") ||
    normalized === "deadline" ||
    normalized === "grade" ||
    normalized === "calendar" ||
    normalized.includes("study") ||
    normalized === "classroom_points" ||
    normalized === "code_submission"
  ) {
    return { categoryId: "coursecollab.quiz", channelId: "urgent", priority: "high" }
  }
  if (normalized.includes("announce")) {
    return { categoryId: "coursecollab.announcement", channelId: "announcements", priority: "default" }
  }
  if (normalized.includes("grade")) {
    return { categoryId: "coursecollab.grade", channelId: "default", priority: "high" }
  }
  return { categoryId: "coursecollab.default", channelId: "default", priority: "default" }
}

export async function registerExpoPushToken(input: RegisterPushTokenInput): Promise<void> {
  await ensurePushTokensSchema()

  await sql`
    INSERT INTO expo_push_tokens (owner_kind, owner_id, expo_push_token, platform, device, updated_at)
    VALUES (
      ${input.ownerKind},
      ${input.ownerId},
      ${input.expoPushToken},
      ${input.platform ?? null},
      ${input.device ?? null},
      NOW()
    )
    ON CONFLICT (owner_kind, owner_id, expo_push_token)
    DO UPDATE SET
      platform = EXCLUDED.platform,
      device = EXCLUDED.device,
      updated_at = NOW()
  `
}

export async function unregisterExpoPushToken(params: {
  ownerKind: "student" | "instructor"
  ownerId: number
  expoPushToken?: string | null
}): Promise<void> {
  await ensurePushTokensSchema()

  if (params.expoPushToken) {
    await sql`
      DELETE FROM expo_push_tokens
      WHERE owner_kind = ${params.ownerKind}
        AND owner_id = ${params.ownerId}
        AND expo_push_token = ${params.expoPushToken}
    `
    return
  }

  await sql`
    DELETE FROM expo_push_tokens
    WHERE owner_kind = ${params.ownerKind}
      AND owner_id = ${params.ownerId}
  `
}

async function listPushTokens(owner: MessageActor): Promise<string[]> {
  await ensurePushTokensSchema()

  const rows = (await sql`
    SELECT expo_push_token
    FROM expo_push_tokens
    WHERE owner_kind = ${owner.kind}
      AND owner_id = ${owner.id}
    ORDER BY updated_at DESC
  `) as Array<{ expo_push_token: string }>

  return rows.map((row) => row.expo_push_token).filter(Boolean)
}

async function studentPushAllowed(studentInternalId: number, notificationType: string): Promise<boolean> {
  const column = PREFERENCE_COLUMN[notificationType]
  if (!column) return true

  const rows = (await sql`
    SELECT *
    FROM notification_preferences
    WHERE student_id = ${studentInternalId}
    LIMIT 1
  `) as Array<Record<string, boolean | null>>

  if (rows.length === 0) return true
  const value = rows[0][column]
  return value !== false
}

async function unreadBadgeForStudent(studentInternalId: number): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS count
    FROM notifications
    WHERE student_id = ${studentInternalId}
      AND is_read = FALSE
  `) as Array<{ count: number }>
  return Number(rows[0]?.count ?? 0)
}

async function unreadBadgeForInstructor(instructorId?: number | null): Promise<number> {
  // Without an owner filter this counted every instructor's unread notifications.
  const id = Number(instructorId)
  if (!Number.isFinite(id) || id < 1) return 0
  const rows = (await sql`
    SELECT COUNT(*)::int AS count
    FROM instructor_notifications
    WHERE is_read = FALSE AND instructor_id = ${id}
  `) as Array<{ count: number }>
  return Number(rows[0]?.count ?? 0)
}

function buildPushData(input: {
  type: string
  link?: string | null
  route?: string | null
  extraData?: Record<string, unknown>
}): Record<string, unknown> {
  return {
    type: input.type,
    ...(input.link ? { link: input.link } : {}),
    ...(input.route ? { route: input.route } : {}),
    ...input.extraData,
  }
}

export async function sendStudentPushNotification(input: StudentPushInput): Promise<void> {
  const allowed = await studentPushAllowed(input.studentInternalId, input.type)
  if (!allowed) return

  const tokens = await listPushTokens({ kind: "student", id: input.studentInternalId })
  if (tokens.length === 0) return

  const badge = await unreadBadgeForStudent(input.studentInternalId)
  const channel = pushChannelForType(input.type)

  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title: input.title,
    body: input.body,
    sound: "default",
    badge,
    priority: channel.priority,
    categoryId: channel.categoryId,
    channelId: channel.channelId,
    data: buildPushData(input),
  }))

  await sendExpoPushMessages(messages)
}

export async function sendStudentPushToMany(params: {
  studentInternalIds: number[]
  type: string
  title: string
  body: string
  link?: string | null
  route?: string | null
  extraData?: Record<string, unknown>
}): Promise<void> {
  const uniqueIds = [...new Set(params.studentInternalIds.filter((id) => Number.isFinite(id) && id > 0))]
  if (uniqueIds.length === 0) return

  await ensurePushTokensSchema()

  const tokenRows = (await sql`
    SELECT owner_id, expo_push_token
    FROM expo_push_tokens
    WHERE owner_kind = 'student'
      AND owner_id = ANY(${uniqueIds})
  `) as Array<{ owner_id: number; expo_push_token: string }>

  if (tokenRows.length === 0) return

  const preferenceRows = (await sql`
    SELECT *
    FROM notification_preferences
    WHERE student_id = ANY(${uniqueIds})
  `) as Array<Record<string, boolean | null> & { student_id: number }>

  const preferenceByStudent = new Map(preferenceRows.map((row) => [Number(row.student_id), row]))
  const column = PREFERENCE_COLUMN[params.type]
  const channel = pushChannelForType(params.type)

  const messages: ExpoPushMessage[] = []
  for (const row of tokenRows) {
    if (column) {
      const prefs = preferenceByStudent.get(Number(row.owner_id))
      if (prefs && prefs[column] === false) continue
    }

    messages.push({
      to: row.expo_push_token,
      title: params.title,
      body: params.body,
      sound: "default",
      priority: channel.priority,
      categoryId: channel.categoryId,
      channelId: channel.channelId,
      data: buildPushData(params),
    })
  }

  await sendExpoPushMessages(messages)
}

export async function sendInstructorPushNotification(input: InstructorPushInput): Promise<void> {
  // This used to select every instructor device token, so one instructor's
  // notification was pushed to every faculty member's phone.
  const instructorId = Number(input.instructorId)
  if (!Number.isFinite(instructorId) || instructorId < 1) {
    console.warn(
      `[Push] instructor notification "${input.type}" has no instructorId; skipping push rather than broadcasting it.`,
    )
    return
  }

  await ensurePushTokensSchema()

  const tokenRows = (await sql`
    SELECT DISTINCT expo_push_token
    FROM expo_push_tokens
    WHERE owner_kind = 'instructor' AND owner_id = ${instructorId}
  `) as Array<{ expo_push_token: string }>

  const tokens = tokenRows.map((row) => row.expo_push_token).filter(Boolean)
  if (tokens.length === 0) return

  const badge = await unreadBadgeForInstructor(instructorId)
  const channel = pushChannelForType(input.type)

  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title: input.title,
    body: input.body,
    sound: "default",
    badge,
    priority: channel.priority,
    categoryId: channel.categoryId,
    channelId: channel.channelId,
    data: buildPushData(input),
  }))

  await sendExpoPushMessages(messages)
}

export async function sendDirectMessagePush(params: {
  recipient: MessageActor
  title: string
  body: string
  threadId: number
  webLink: string
}): Promise<void> {
  const { recipient, title, body, threadId, webLink } = params
  const notificationType = recipient.kind === "student" ? "forum" : "direct_message"
  const nativeRoute = `/messages/${threadId}`

  if (recipient.kind === "student") {
    await sendStudentPushNotification({
      studentInternalId: recipient.id,
      type: notificationType,
      title,
      body,
      link: webLink,
      route: nativeRoute,
      extraData: { threadId: String(threadId) },
    })
    return
  }

  await sendInstructorPushNotification({
    instructorId: recipient.id,
    type: notificationType,
    title,
    body,
    link: webLink,
    route: nativeRoute,
    extraData: { threadId: String(threadId) },
  })
}

export async function sendAnnouncementPushForCourse(params: {
  courseId: number
  title: string
  body: string
  link: string
  announcementId?: number
}): Promise<void> {
  const studentRows = (await sql`
    SELECT DISTINCT s.id
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.course_id = ${params.courseId}
       OR sess.course_id = ${params.courseId}
  `) as Array<{ id: number }>

  const route = params.announcementId
    ? `/announcements/${params.announcementId}`
    : "/announcements"

  await sendStudentPushToMany({
    studentInternalIds: studentRows.map((row) => Number(row.id)),
    type: "announcement",
    title: params.title,
    body: params.body,
    link: params.link,
    route,
    extraData: params.announcementId ? { announcementId: String(params.announcementId) } : undefined,
  })
}
