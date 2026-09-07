import { createNotification } from "@/lib/create-notification"
import { createInstructorNotification } from "@/lib/create-instructor-notification"
import { sendEmail } from "@/lib/email/sendEmail"
import { sendDirectMessagePush } from "@/lib/push-notifications"
import { actorDisplayName, actorEmail } from "@/lib/direct-messages/auth"
import type { MessageActor } from "@/lib/direct-messages/types"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com"

function inboxLinkForRecipient(recipient: MessageActor, threadId: number): string {
  if (recipient.kind === "instructor") {
    return `${BASE_URL}/faculty/dashboard/communication/messages?thread=${threadId}`
  }
  return `${BASE_URL}/student/dashboard-v2/messages?thread=${threadId}`
}

import { messagePreviewText, sanitizeMessageHtml } from "@/lib/direct-messages/html"

export async function notifyDirectMessageRecipient(params: {
  sender: MessageActor
  recipient: MessageActor
  threadId: number
  subject: string | null
  body: string
}) {
  const { sender, recipient, threadId, subject, body } = params
  const senderName = await actorDisplayName(sender)
  const recipientName = await actorDisplayName(recipient)
  const recipientEmail = await actorEmail(recipient)
  const linkUrl = inboxLinkForRecipient(recipient, threadId)
  const subjectLine = subject?.trim() || `Message from ${senderName}`

  if (recipientEmail) {
    await sendEmail("direct_message", recipientEmail, {
      recipientName,
      senderName,
      subject: subjectLine,
      bodyPreview: messagePreviewText(body),
      linkUrl,
    }).catch((err) => {
      console.warn("[DM] email failed:", err)
    })
  }

  const title = `New message from ${senderName}`
  const message = messagePreviewText(body, 200)
  const link = recipient.kind === "instructor"
    ? `/faculty/dashboard/communication/messages?thread=${threadId}`
    : `/student/dashboard-v2/messages?thread=${threadId}`

  if (recipient.kind === "student") {
    await createNotification({
      studentId: recipient.id,
      type: "forum",
      title,
      message,
      link,
      skipPush: true,
    }).catch((err) => {
      console.warn("[DM] student notification failed:", err)
    })
  } else {
    await createInstructorNotification({
      type: "direct_message",
      title,
      message,
      link,
      source_type: "dm_thread",
      source_id: String(threadId),
      instructorId: recipient.id,
      skipPush: true,
    }).catch((err) => {
      console.warn("[DM] instructor notification failed:", err)
    })
  }

  await sendDirectMessagePush({
    recipient,
    title,
    body: message,
    threadId,
    webLink: link,
  }).catch((err) => {
    console.warn("[DM] push notification failed:", err)
  })
}
