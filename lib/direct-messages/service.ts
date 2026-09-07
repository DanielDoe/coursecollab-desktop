import { sql } from "@/lib/db"
import { ensureDirectMessagesSchema } from "@/lib/ensure-direct-messages-schema"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import {
  actorDisplayName,
  buildPairKey,
  participantKey,
} from "@/lib/direct-messages/auth"
import { notifyDirectMessageRecipient } from "@/lib/direct-messages/notify"
import { resolveMessageDeliveryStatus } from "@/lib/direct-messages/delivery-status"
import { messagePreviewText, sanitizeMessageHtml, stripHtmlToPlain } from "@/lib/direct-messages/html"
import { unsentAuditLabel } from "@/lib/direct-messages/message-lifecycle"
import { loadReactionsForMessages } from "@/lib/direct-messages/reactions"
import type {
  MessageActor,
  MessageAttachment,
  MessageEditVersion,
  MessageRecipient,
  ParticipantKind,
  ThreadDetail,
  ThreadMessage,
  ThreadSummary,
} from "@/lib/direct-messages/types"
import {
  canEditMessage,
  canUnsendMessage,
  type MessageDeleteMode,
} from "@/lib/direct-messages/message-lifecycle"
import { hasCourseImportEmbed } from "@/lib/direct-messages/course-import-embed"

export type MessageAttachmentInput = {
  fileName: string
  fileUrl: string
  mimeType?: string | null
  fileSize?: number | null
}

async function loadAttachmentsForMessages(messageIds: number[]): Promise<Map<number, MessageAttachment[]>> {
  const map = new Map<number, MessageAttachment[]>()
  if (messageIds.length === 0) return map

  const rows = (await sql`
    SELECT id, message_id, file_name, file_url, mime_type, file_size
    FROM dm_message_attachments
    WHERE message_id = ANY(${messageIds})
    ORDER BY id ASC
  `) as Array<{
    id: number
    message_id: number
    file_name: string
    file_url: string
    mime_type: string | null
    file_size: number | null
  }>

  for (const row of rows) {
    const list = map.get(row.message_id) ?? []
    list.push({
      id: row.id,
      fileName: row.file_name,
      fileUrl: row.file_url,
      mimeType: row.mime_type,
      fileSize: row.file_size,
    })
    map.set(row.message_id, list)
  }
  return map
}

async function loadEditHistoryForMessages(messageIds: number[]): Promise<Map<number, MessageEditVersion[]>> {
  const map = new Map<number, MessageEditVersion[]>()
  if (messageIds.length === 0) return map

  const rows = (await sql`
    SELECT message_id, body, created_at
    FROM dm_message_edits
    WHERE message_id = ANY(${messageIds})
    ORDER BY created_at ASC
  `) as Array<{ message_id: number; body: string; created_at: string }>

  for (const row of rows) {
    const messageId = Number(row.message_id)
    const list = map.get(messageId) ?? []
    list.push({ body: row.body, editedAt: row.created_at })
    map.set(messageId, list)
  }
  return map
}

function buildThreadMessageRow(params: {
  row: {
    id: number
    sender_kind: ParticipantKind
    sender_id: number
    subject: string | null
    body: string
    created_at: string
    unsent_at: string | null
    edited_at: string | null
  }
  actor: MessageActor
  senderName: string
  otherLastReadAt: string | null
  attachments: MessageAttachment[]
  reactions: import("@/lib/direct-messages/types").MessageReactionGroup[]
  editHistory: MessageEditVersion[]
}): ThreadMessage {
  const messageId = Number(params.row.id)
  const isMine =
    params.row.sender_kind === params.actor.kind && Number(params.row.sender_id) === params.actor.id
  const unsent = Boolean(params.row.unsent_at)
  const hasAttachments = params.attachments.length > 0

  return {
    id: messageId,
    senderKind: params.row.sender_kind,
    senderId: Number(params.row.sender_id),
    senderName: params.senderName,
    subject: params.row.subject,
    body: params.row.body,
    createdAt: params.row.created_at,
    isMine,
    ...(isMine && !unsent
      ? { deliveryStatus: resolveMessageDeliveryStatus(params.row.created_at, params.otherLastReadAt) }
      : {}),
    attachments: params.attachments,
    reactions: params.reactions,
    unsent,
    unsentAt: params.row.unsent_at,
    unsentByMe: unsent && isMine,
    edited: Boolean(params.row.edited_at),
    editedAt: params.row.edited_at,
    editHistory: params.editHistory.length > 0 ? params.editHistory : undefined,
    canUnsend: canUnsendMessage({
      createdAt: params.row.created_at,
      isMine,
      unsentAt: params.row.unsent_at,
      hasAttachments,
    }),
    canEdit: canEditMessage({
      createdAt: params.row.created_at,
      isMine,
      unsentAt: params.row.unsent_at,
      hasAttachments,
    }),
  }
}

function studentSubtitle(row: {
  student_id: string | null
  is_platform_guest?: boolean | null
  student_program_role?: string | null
}): string {
  if (row.is_platform_guest) return "Guest"
  const role = row.student_program_role?.trim()
  if (role === "summer_camper" || role === "summer_camp") return "Summer Camp"
  if (row.student_id) return `Student · ${row.student_id}`
  return "Student"
}

async function loadRecipient(kind: ParticipantKind, id: number): Promise<MessageRecipient | null> {
  if (kind === "student") {
    const rows = (await sql`
      SELECT id, full_name, email, student_id,
             COALESCE(is_platform_guest, false) AS is_platform_guest,
             student_program_role
      FROM students
      WHERE id = ${id}
      LIMIT 1
    `) as Array<{
      id: number
      full_name: string | null
      email: string | null
      student_id: string | null
      is_platform_guest: boolean
      student_program_role: string | null
    }>
    if (rows.length === 0) return null
    const row = rows[0]
    return {
      kind: "student",
      id: row.id,
      displayName: row.full_name?.trim() || row.student_id || "Student",
      email: row.email,
      subtitle: studentSubtitle(row),
    }
  }

  const rows = (await sql`
    SELECT id, name, username, email, COALESCE(role, 'instructor') AS role
    FROM instructors
    WHERE id = ${id} AND COALESCE(is_active, true) = true
    LIMIT 1
  `) as Array<{
    id: number
    name: string | null
    username: string | null
    email: string | null
    role: string
  }>
  if (rows.length === 0) return null
  const row = rows[0]
  const roleLabel = row.role === "ta" ? "Teaching Assistant" : "Faculty"
  return {
    kind: "instructor",
    id: row.id,
    displayName: row.name?.trim() || row.username || "Instructor",
    email: row.email,
    subtitle: roleLabel,
  }
}

type StudentSearchRow = {
  id: number
  full_name: string | null
  email: string | null
  student_id: string | null
  is_platform_guest: boolean
  student_program_role: string | null
}

type InstructorSearchRow = {
  id: number
  name: string | null
  username: string | null
  email: string | null
  role: string
}

function mapStudentSearchRow(row: StudentSearchRow): MessageRecipient {
  return {
    kind: "student",
    id: row.id,
    displayName: row.full_name?.trim() || row.student_id || "Student",
    email: row.email,
    subtitle: studentSubtitle(row),
  }
}

function mapInstructorSearchRow(row: InstructorSearchRow): MessageRecipient {
  return {
    kind: "instructor",
    id: row.id,
    displayName: row.name?.trim() || row.username || "Instructor",
    email: row.email,
    subtitle: row.role === "ta" ? "Teaching Assistant" : "Faculty",
  }
}

function mergeRecipients(
  students: StudentSearchRow[],
  instructors: InstructorSearchRow[],
  limit: number,
): MessageRecipient[] {
  return [...students.map(mapStudentSearchRow), ...instructors.map(mapInstructorSearchRow)]
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .slice(0, limit)
}

/** Courses the instructor owns or TAs — same tables as instructor-course-scope / course_staff. */
async function instructorAccessibleCourseIds(instructorId: number): Promise<number[]> {
  await ensurePortalRbacSchema()
  const rows = (await sql`
    SELECT c.id
    FROM courses c
    WHERE c.is_active = true
      AND (
        c.instructor_id = ${instructorId}
        OR EXISTS (
          SELECT 1 FROM course_staff cs
          WHERE cs.course_id = c.id
            AND cs.instructor_id = ${instructorId}
            AND cs.is_active = true
        )
      )
  `) as Array<{ id: number }>
  return rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0)
}

async function searchStudentsInCourseIds(
  courseIds: number[],
  excludeStudentId: number,
  pattern: string,
  limit: number,
): Promise<StudentSearchRow[]> {
  if (courseIds.length === 0) return []
  return (await sql`
    SELECT s.id, s.full_name, s.email, s.student_id,
           COALESCE(s.is_platform_guest, false) AS is_platform_guest,
           s.student_program_role
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    WHERE s.id <> ${excludeStudentId}
      AND (
        s.course_id = ANY(${courseIds})
        OR sess.course_id = ANY(${courseIds})
      )
      AND (
        s.full_name ILIKE ${pattern}
        OR s.email ILIKE ${pattern}
        OR s.student_id ILIKE ${pattern}
      )
    ORDER BY s.full_name ASC NULLS LAST
    LIMIT ${limit}
  `) as StudentSearchRow[]
}

async function searchInstructorsOnCourseIds(
  courseIds: number[],
  excludeInstructorId: number,
  pattern: string,
  limit: number,
): Promise<InstructorSearchRow[]> {
  if (courseIds.length === 0) return []
  await ensurePortalRbacSchema()
  return (await sql`
    SELECT i.id, i.name, i.username, i.email, COALESCE(i.role, 'instructor') AS role
    FROM instructors i
    WHERE i.id <> ${excludeInstructorId}
      AND COALESCE(i.is_active, true) = true
      AND (
        EXISTS (
          SELECT 1 FROM courses c
          WHERE c.is_active = true
            AND c.id = ANY(${courseIds})
            AND c.instructor_id = i.id
        )
        OR EXISTS (
          SELECT 1 FROM course_staff cs
          WHERE cs.instructor_id = i.id
            AND cs.course_id = ANY(${courseIds})
            AND cs.is_active = true
        )
      )
      AND (
        i.name ILIKE ${pattern}
        OR i.username ILIKE ${pattern}
        OR i.email ILIKE ${pattern}
      )
    ORDER BY i.name ASC NULLS LAST
    LIMIT ${limit}
  `) as InstructorSearchRow[]
}

async function searchRecipientsForStudent(
  studentId: number,
  pattern: string,
  limit: number,
): Promise<MessageRecipient[]> {
  const ctx = await resolveStudentCourseContextByDbId(studentId)
  let courseIds: number[] = []

  if (ctx) {
    courseIds = [ctx.courseId]
  } else {
    const row = (await sql`
      SELECT session_id, section
      FROM students
      WHERE id = ${studentId}
      LIMIT 1
    `) as Array<{ session_id: number | null; section: string | null }>
    if (row.length === 0) return []
    const sessionId =
      row[0].session_id != null && Number.isFinite(Number(row[0].session_id))
        ? Number(row[0].session_id)
        : null
    const section = row[0].section?.trim() || null
    if (sessionId == null && !section) return []

    const students =
      sessionId != null
        ? ((await sql`
            SELECT s.id, s.full_name, s.email, s.student_id,
                   COALESCE(s.is_platform_guest, false) AS is_platform_guest,
                   s.student_program_role
            FROM students s
            WHERE s.id <> ${studentId}
              AND s.session_id = ${sessionId}
              AND (
                s.full_name ILIKE ${pattern}
                OR s.email ILIKE ${pattern}
                OR s.student_id ILIKE ${pattern}
              )
            ORDER BY s.full_name ASC NULLS LAST
            LIMIT ${limit}
          `) as StudentSearchRow[])
        : ((await sql`
            SELECT s.id, s.full_name, s.email, s.student_id,
                   COALESCE(s.is_platform_guest, false) AS is_platform_guest,
                   s.student_program_role
            FROM students s
            WHERE s.id <> ${studentId}
              AND TRIM(s.section) <> ''
              AND TRIM(s.section) = ${section}
              AND (
                s.full_name ILIKE ${pattern}
                OR s.email ILIKE ${pattern}
                OR s.student_id ILIKE ${pattern}
              )
            ORDER BY s.full_name ASC NULLS LAST
            LIMIT ${limit}
          `) as StudentSearchRow[])

    if (sessionId != null) {
      const sessionCourse = (await sql`
        SELECT course_id FROM sessions WHERE id = ${sessionId} LIMIT 1
      `) as Array<{ course_id: number | null }>
      const courseId = Number(sessionCourse[0]?.course_id)
      if (Number.isFinite(courseId) && courseId > 0) courseIds = [courseId]
    }
    const instructors = await searchInstructorsOnCourseIds(courseIds, -1, pattern, limit)
    return mergeRecipients(students, instructors, limit)
  }

  const students = await searchStudentsInCourseIds(courseIds, studentId, pattern, limit)
  const instructors = await searchInstructorsOnCourseIds(courseIds, -1, pattern, limit)
  return mergeRecipients(students, instructors, limit)
}

async function searchRecipientsForInstructor(
  instructorId: number,
  pattern: string,
  limit: number,
): Promise<MessageRecipient[]> {
  const courseIds = await instructorAccessibleCourseIds(instructorId)
  if (courseIds.length === 0) return []
  const students = await searchStudentsInCourseIds(courseIds, -1, pattern, limit)
  const instructors = await searchInstructorsOnCourseIds(courseIds, instructorId, pattern, limit)
  return mergeRecipients(students, instructors, limit)
}

export async function searchMessageRecipients(
  actor: MessageActor,
  query: string,
  limit = 20,
): Promise<MessageRecipient[]> {
  await ensureDirectMessagesSchema()
  const q = query.trim()
  if (q.length < 2) return []

  const pattern = `%${q}%`
  if (actor.kind === "student") {
    return searchRecipientsForStudent(actor.id, pattern, limit)
  }
  return searchRecipientsForInstructor(actor.id, pattern, limit)
}

export async function listThreadsForActor(actor: MessageActor): Promise<ThreadSummary[]> {
  await ensureDirectMessagesSchema()

  const rows = (await sql`
    SELECT
      t.id,
      t.subject,
      t.updated_at,
      p_self.last_read_at AS my_last_read_at,
      (
        SELECT COUNT(*)::int
        FROM dm_messages m
        WHERE m.thread_id = t.id
          AND (p_self.last_read_at IS NULL OR m.created_at > p_self.last_read_at)
          AND NOT (m.sender_kind = ${actor.kind} AND m.sender_id = ${actor.id})
      ) AS unread_count,
      (
        SELECT json_build_object(
          'body', m.body,
          'created_at', m.created_at,
          'sender_kind', m.sender_kind,
          'sender_id', m.sender_id,
          'unsent_at', m.unsent_at
        )
        FROM dm_messages m
        WHERE m.thread_id = t.id
          AND NOT EXISTS (
            SELECT 1 FROM dm_message_hidden h
            WHERE h.message_id = m.id
              AND h.participant_kind = ${actor.kind}
              AND h.participant_id = ${actor.id}
          )
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message,
      p_other.participant_kind AS other_kind,
      p_other.participant_id AS other_id,
      p_other.last_read_at AS other_last_read_at
    FROM dm_threads t
    INNER JOIN dm_participants p_self
      ON p_self.thread_id = t.id
     AND p_self.participant_kind = ${actor.kind}
     AND p_self.participant_id = ${actor.id}
    INNER JOIN dm_participants p_other
      ON p_other.thread_id = t.id
     AND NOT (p_other.participant_kind = ${actor.kind} AND p_other.participant_id = ${actor.id})
    ORDER BY t.updated_at DESC
    LIMIT 100
  `) as Array<{
    id: number
    subject: string | null
    updated_at: string
    unread_count: number
    last_message: {
      body: string
      created_at: string
      sender_kind: ParticipantKind
      sender_id: number
      unsent_at?: string | null
    } | null
    other_kind: ParticipantKind
    other_id: number
    other_last_read_at: string | null
  }>

  const summaries: ThreadSummary[] = []
  for (const row of rows) {
    const other = await loadRecipient(row.other_kind, row.other_id)
    if (!other) continue
    const lastIsMine =
      row.last_message?.sender_kind === actor.kind &&
      Number(row.last_message?.sender_id) === actor.id
    const lastPreview = row.last_message?.unsent_at
      ? unsentAuditLabel(lastIsMine, other.displayName)
      : row.last_message
        ? messagePreviewText(row.last_message.body, 120)
        : null
    summaries.push({
      id: row.id,
      subject: row.subject,
      updatedAt: row.updated_at,
      unreadCount: Number(row.unread_count ?? 0),
      otherParticipant: other,
      lastMessage: row.last_message
        ? {
            body: lastPreview ?? "",
            createdAt: row.last_message.created_at,
            senderKind: row.last_message.sender_kind,
            senderId: row.last_message.sender_id,
            ...(row.last_message.sender_kind === actor.kind &&
            Number(row.last_message.sender_id) === actor.id
              ? {
                  deliveryStatus: resolveMessageDeliveryStatus(
                    row.last_message.created_at,
                    row.other_last_read_at,
                  ),
                }
              : {}),
          }
        : null,
    })
  }

  return summaries
}

async function getOtherParticipant(
  threadId: number,
  actor: MessageActor,
): Promise<MessageRecipient | null> {
  const rows = (await sql`
    SELECT participant_kind, participant_id
    FROM dm_participants
    WHERE thread_id = ${threadId}
      AND NOT (participant_kind = ${actor.kind} AND participant_id = ${actor.id})
    LIMIT 1
  `) as Array<{ participant_kind: ParticipantKind; participant_id: number }>
  if (rows.length === 0) return null
  const row = rows[0]
  return loadRecipient(row.participant_kind, row.participant_id)
}

export async function getThreadForActor(
  threadId: number,
  actor: MessageActor,
): Promise<ThreadDetail | null> {
  await ensureDirectMessagesSchema()

  const membership = (await sql`
    SELECT 1 FROM dm_participants
    WHERE thread_id = ${threadId}
      AND participant_kind = ${actor.kind}
      AND participant_id = ${actor.id}
    LIMIT 1
  `) as unknown[]
  if (membership.length === 0) return null

  const threadRows = (await sql`
    SELECT id, subject FROM dm_threads WHERE id = ${threadId} LIMIT 1
  `) as Array<{ id: number; subject: string | null }>
  if (threadRows.length === 0) return null
  const thread = threadRows[0]

  const other = await getOtherParticipant(threadId, actor)
  if (!other) return null

  const otherReadRows = (await sql`
    SELECT last_read_at
    FROM dm_participants
    WHERE thread_id = ${threadId}
      AND NOT (participant_kind = ${actor.kind} AND participant_id = ${actor.id})
    LIMIT 1
  `) as Array<{ last_read_at: string | null }>
  const otherLastReadAt = otherReadRows[0]?.last_read_at ?? null

  const messageRows = (await sql`
    SELECT m.id, m.sender_kind, m.sender_id, m.subject, m.body, m.created_at, m.unsent_at, m.edited_at
    FROM dm_messages m
    WHERE m.thread_id = ${threadId}
      AND NOT EXISTS (
        SELECT 1 FROM dm_message_hidden h
        WHERE h.message_id = m.id
          AND h.participant_kind = ${actor.kind}
          AND h.participant_id = ${actor.id}
      )
    ORDER BY m.created_at ASC
    LIMIT 500
  `) as Array<{
    id: number
    sender_kind: ParticipantKind
    sender_id: number
    subject: string | null
    body: string
    created_at: string
    unsent_at: string | null
    edited_at: string | null
  }>

  const messageIds = messageRows.map((m) => Number(m.id))
  const attachmentMap = await loadAttachmentsForMessages(messageIds)
  const reactionMap = await loadReactionsForMessages(messageIds, actor)
  const editMap = await loadEditHistoryForMessages(
    messageRows.filter((m) => m.edited_at).map((m) => Number(m.id)),
  )

  const messages: ThreadMessage[] = []
  for (const row of messageRows) {
    const messageId = Number(row.id)
    const senderName =
      row.sender_kind === actor.kind && row.sender_id === actor.id
        ? "You"
        : await actorDisplayName({ kind: row.sender_kind, id: row.sender_id })
    messages.push(
      buildThreadMessageRow({
        row,
        actor,
        senderName,
        otherLastReadAt,
        attachments: attachmentMap.get(messageId) ?? [],
        reactions: reactionMap.get(messageId) ?? [],
        editHistory: editMap.get(messageId) ?? [],
      }),
    )
  }

  await sql`
    UPDATE dm_participants
    SET last_read_at = NOW()
    WHERE thread_id = ${threadId}
      AND participant_kind = ${actor.kind}
      AND participant_id = ${actor.id}
  `

  return {
    id: thread.id,
    subject: thread.subject,
    otherParticipant: other,
    otherLastReadAt,
    messages,
  }
}

export async function markThreadUnreadForActor(
  threadId: number,
  actor: MessageActor,
): Promise<{ success: true } | null> {
  await ensureDirectMessagesSchema()

  const membership = (await sql`
    SELECT 1 FROM dm_participants
    WHERE thread_id = ${threadId}
      AND participant_kind = ${actor.kind}
      AND participant_id = ${actor.id}
    LIMIT 1
  `) as unknown[]
  if (membership.length === 0) return null

  await sql`
    UPDATE dm_participants
    SET last_read_at = NULL
    WHERE thread_id = ${threadId}
      AND participant_kind = ${actor.kind}
      AND participant_id = ${actor.id}
  `

  return { success: true }
}

async function findOrCreateThread(
  actor: MessageActor,
  recipient: MessageActor,
  subject: string | null,
): Promise<number> {
  const pairKey = buildPairKey(actor, recipient)
  const existing = (await sql`
    SELECT id FROM dm_threads WHERE pair_key = ${pairKey} LIMIT 1
  `) as Array<{ id: number }>
  if (existing.length > 0) {
    return Number(existing[0].id)
  }

  const inserted = (await sql`
    INSERT INTO dm_threads (pair_key, subject, updated_at)
    VALUES (${pairKey}, ${subject}, NOW())
    RETURNING id
  `) as Array<{ id: number }>
  const threadId = Number(inserted[0].id)

  await sql`
    INSERT INTO dm_participants (thread_id, participant_kind, participant_id)
    VALUES
      (${threadId}, ${actor.kind}, ${actor.id}),
      (${threadId}, ${recipient.kind}, ${recipient.id})
    ON CONFLICT DO NOTHING
  `

  return threadId
}

export async function sendDirectMessage(params: {
  sender: MessageActor
  recipientKind: ParticipantKind
  recipientId: number
  subject?: string | null
  body: string
  attachments?: MessageAttachmentInput[]
  existingThreadId?: number | null
}): Promise<{ threadId: number; messageId: number }> {
  await ensureDirectMessagesSchema()

  const rawBody = params.body.trim()
  const attachments = params.attachments ?? []
  const plain = stripHtmlToPlain(rawBody)
  if (!plain && attachments.length === 0) throw new Error("Message body is required")

  const body = rawBody ? sanitizeMessageHtml(rawBody) : "<p></p>"

  const recipient: MessageActor = { kind: params.recipientKind, id: params.recipientId }
  if (participantKey(recipient.kind, recipient.id) === participantKey(params.sender.kind, params.sender.id)) {
    throw new Error("Cannot message yourself")
  }

  const recipientProfile = await loadRecipient(recipient.kind, recipient.id)
  if (!recipientProfile) throw new Error("Recipient not found")

  const subject = params.subject?.trim() || null
  let threadId = params.existingThreadId ?? null

  if (threadId != null) {
    const membership = (await sql`
      SELECT 1 FROM dm_participants
      WHERE thread_id = ${threadId}
        AND participant_kind = ${params.sender.kind}
        AND participant_id = ${params.sender.id}
      LIMIT 1
    `) as unknown[]
    if (membership.length === 0) throw new Error("Thread not found")
  } else {
    threadId = await findOrCreateThread(params.sender, recipient, subject)
  }

  const inserted = (await sql`
    INSERT INTO dm_messages (thread_id, sender_kind, sender_id, subject, body)
    VALUES (${threadId}, ${params.sender.kind}, ${params.sender.id}, ${subject}, ${body})
    RETURNING id
  `) as Array<{ id: number }>
  const messageId = Number(inserted[0].id)

  for (const att of attachments) {
    await sql`
      INSERT INTO dm_message_attachments (message_id, file_name, file_url, mime_type, file_size)
      VALUES (
        ${messageId},
        ${att.fileName},
        ${att.fileUrl},
        ${att.mimeType ?? null},
        ${att.fileSize ?? null}
      )
    `
  }

  await sql`
    UPDATE dm_threads
    SET updated_at = NOW(),
        subject = COALESCE(subject, ${subject})
    WHERE id = ${threadId}
  `

  void notifyDirectMessageRecipient({
    sender: params.sender,
    recipient,
    threadId,
    subject,
    body: plain || "(Attachment)",
  })

  return { threadId, messageId }
}

export async function deleteMessageForActor(
  threadId: number,
  messageId: number,
  actor: MessageActor,
  mode: MessageDeleteMode = "hide",
): Promise<{ success: true; mode: MessageDeleteMode }> {
  if (mode === "unsend") {
    await unsendMessageForActor(threadId, messageId, actor)
    return { success: true, mode: "unsend" }
  }
  await hideMessageForActor(threadId, messageId, actor)
  return { success: true, mode: "hide" }
}

async function assertMessageInThread(
  threadId: number,
  messageId: number,
  actor: MessageActor,
): Promise<{
  id: number
  sender_kind: ParticipantKind
  sender_id: number
  body: string
  created_at: string
  unsent_at: string | null
  edited_at: string | null
}> {
  await ensureDirectMessagesSchema()

  const membership = (await sql`
    SELECT 1 FROM dm_participants
    WHERE thread_id = ${threadId}
      AND participant_kind = ${actor.kind}
      AND participant_id = ${actor.id}
    LIMIT 1
  `) as unknown[]
  if (membership.length === 0) throw new Error("Thread not found")

  const rows = (await sql`
    SELECT id, sender_kind, sender_id, body, created_at, unsent_at, edited_at
    FROM dm_messages
    WHERE id = ${messageId}
      AND thread_id = ${threadId}
    LIMIT 1
  `) as Array<{
    id: number
    sender_kind: ParticipantKind
    sender_id: number
    body: string
    created_at: string
    unsent_at: string | null
    edited_at: string | null
  }>

  if (rows.length === 0) throw new Error("Message not found")
  return rows[0]
}

export async function unsendMessageForActor(
  threadId: number,
  messageId: number,
  actor: MessageActor,
): Promise<{ success: true }> {
  const row = await assertMessageInThread(threadId, messageId, actor)
  const isMine = row.sender_kind === actor.kind && Number(row.sender_id) === actor.id
  if (!isMine) throw new Error("You can only unsend your own messages")
  if (row.unsent_at) throw new Error("Message already unsent")

  const attachments = await loadAttachmentsForMessages([messageId])
  if (!canUnsendMessage({
    createdAt: row.created_at,
    isMine: true,
    unsentAt: row.unsent_at,
    hasAttachments: (attachments.get(messageId) ?? []).length > 0,
  })) {
    throw new Error("Undo Send is no longer available for this message")
  }

  await sql`
    UPDATE dm_messages
    SET unsent_at = NOW()
    WHERE id = ${messageId}
  `

  return { success: true }
}

export async function hideMessageForActor(
  threadId: number,
  messageId: number,
  actor: MessageActor,
): Promise<{ success: true }> {
  await assertMessageInThread(threadId, messageId, actor)

  await sql`
    INSERT INTO dm_message_hidden (message_id, participant_kind, participant_id)
    VALUES (${messageId}, ${actor.kind}, ${actor.id})
    ON CONFLICT (message_id, participant_kind, participant_id) DO NOTHING
  `

  return { success: true }
}

export async function editMessageForActor(
  threadId: number,
  messageId: number,
  actor: MessageActor,
  rawBody: string,
): Promise<{ message: ThreadMessage }> {
  const row = await assertMessageInThread(threadId, messageId, actor)
  const isMine = row.sender_kind === actor.kind && Number(row.sender_id) === actor.id
  if (!isMine) throw new Error("You can only edit your own messages")
  if (row.unsent_at) throw new Error("Unsent messages cannot be edited")
  if (hasCourseImportEmbed(row.body)) {
    throw new Error("Imported course questions cannot be edited")
  }

  const attachments = await loadAttachmentsForMessages([messageId])
  if (!canEditMessage({
    createdAt: row.created_at,
    isMine: true,
    unsentAt: row.unsent_at,
    hasAttachments: (attachments.get(messageId) ?? []).length > 0,
  })) {
    throw new Error("Edit is no longer available for this message")
  }

  const plain = stripHtmlToPlain(rawBody)
  if (!plain) throw new Error("Message body is required")

  const body = sanitizeMessageHtml(rawBody.trim())

  await sql`
    INSERT INTO dm_message_edits (message_id, body)
    VALUES (${messageId}, ${row.body})
  `
  await sql`
    UPDATE dm_messages
    SET body = ${body}, edited_at = NOW()
    WHERE id = ${messageId}
  `

  const thread = await getThreadForActor(threadId, actor)
  if (!thread) throw new Error("Thread not found")

  const message = thread.messages.find((entry) => entry.id === messageId)
  if (!message) throw new Error("Message not found")

  return { message }
}
