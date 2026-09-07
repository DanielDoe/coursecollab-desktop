import { createInstructorNotification } from "@/lib/create-instructor-notification"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import {
  courseExchangeApprovedBodyHtml,
  courseExchangeRequestReceivedBodyHtml,
  courseExchangeSupplementBodyHtml,
  sendCourseExchangeFacultyAlertEmail,
} from "@/lib/course-exchange/instructor-email"
import { escapeHtmlForEmail } from "@/lib/email/emailTemplates"

const EXCHANGE_HREF = `${FACULTY_DASHBOARD_BASE}/course/exchange`

export async function notifyCourseExchangeRequestReceived(input: {
  sourceCourseCode: string
  requesterName: string
  requestId: number
  sourceInstructorId: number
}): Promise<void> {
  await createInstructorNotification({
    type: "course_exchange_request",
    title: "New Course Exchange request",
    message: `${input.requesterName} requested materials from ${input.sourceCourseCode}. Review and select what may be shared.`,
    link: `${EXCHANGE_HREF}?tab=received&request=${input.requestId}`,
    source_type: "course_exchange_request",
    source_id: String(input.requestId),
    instructorId: input.sourceInstructorId,
  })

  try {
    await sendCourseExchangeFacultyAlertEmail({
      instructorId: input.sourceInstructorId,
      title: "New Course Exchange request",
      bodyHtml: courseExchangeRequestReceivedBodyHtml({
        requesterName: input.requesterName,
        sourceCourseCode: input.sourceCourseCode,
      }),
      requestId: input.requestId,
      tab: "received",
      linkLabel: "Review request",
      footerNote: "Sign in to approve or decline this request from Course Exchange → Requests Received.",
    })
  } catch (error) {
    console.warn("[course exchange email] request received:", error)
  }
}

export async function notifyCourseExchangeApproved(input: {
  sourceCourseCode: string
  requestId: number
  requesterInstructorId: number
  ownerName: string
  imported?: boolean
}): Promise<void> {
  const imported = Boolean(input.imported)
  await createInstructorNotification({
    type: "course_exchange_approved",
    title: imported ? "Course materials imported" : "Course Exchange approved",
    message: imported
      ? `Your request for ${input.sourceCourseCode} was approved and materials were copied into your course. Review dates and publish settings before going live.`
      : `Your request for ${input.sourceCourseCode} was approved. Open Course Exchange → Requests Sent and tap Import to copy materials into your course.`,
    link: `${EXCHANGE_HREF}?tab=${imported ? "shared-with-me" : "sent"}&request=${input.requestId}`,
    source_type: "course_exchange_request",
    source_id: String(input.requestId),
    instructorId: input.requesterInstructorId,
  })

  try {
    await sendCourseExchangeFacultyAlertEmail({
      instructorId: input.requesterInstructorId,
      title: imported ? "Course Exchange approved — materials imported" : "Course Exchange request approved",
      bodyHtml: courseExchangeApprovedBodyHtml({
        sourceCourseCode: input.sourceCourseCode,
        ownerName: input.ownerName,
        imported,
      }),
      requestId: input.requestId,
      tab: imported ? "shared-with-me" : "sent",
      linkLabel: imported ? "View imported materials" : "Import materials",
      footerNote: imported
        ? "Materials are in your course workspace. Review publish settings before students can access them."
        : "Your request was approved. Import the materials when you are ready from Course Exchange → Requests Sent.",
    })
  } catch (error) {
    console.warn("[course exchange email] request approved:", error)
  }
}

export async function notifyCourseExchangeRejected(input: {
  sourceCourseCode: string
  requestId: number
  requesterInstructorId: number
  ownerName: string
  reason?: string | null
}): Promise<void> {
  const reasonLine = input.reason?.trim() ? ` Reason: ${input.reason.trim()}` : ""
  await createInstructorNotification({
    type: "course_exchange_rejected",
    title: "Course Exchange request declined",
    message: `Your request for ${input.sourceCourseCode} was not approved.${reasonLine}`,
    link: `${EXCHANGE_HREF}?tab=sent&request=${input.requestId}`,
    source_type: "course_exchange_request",
    source_id: String(input.requestId),
    instructorId: input.requesterInstructorId,
  })

  try {
    await sendCourseExchangeFacultyAlertEmail({
      instructorId: input.requesterInstructorId,
      title: "Course Exchange request declined",
      bodyHtml: `<p style="margin:0 0 12px;color:#475569;font-size:15px;line-height:1.65;"><strong>${escapeHtmlForEmail(input.ownerName)}</strong> declined your Course Exchange request for <strong>${escapeHtmlForEmail(input.sourceCourseCode)}</strong>.</p>${reasonLine ? `<p style="margin:0;color:#475569;font-size:15px;line-height:1.65;">${escapeHtmlForEmail(reasonLine.replace(/^ Reason: /, ""))}</p>` : ""}`,
      requestId: input.requestId,
      tab: "sent",
      linkLabel: "View request",
      footerNote: "You can revise your request or choose another source course from Course Exchange.",
    })
  } catch (error) {
    console.warn("[course exchange email] request rejected:", error)
  }
}

export async function notifyCourseExchangeCopyCompleted(input: {
  destinationCourseCode: string
  requestId: number
  requesterInstructorId: number
  destinationCourseId?: number | null
}): Promise<void> {
  await createInstructorNotification({
    type: "course_exchange_completed",
    title: "Course copy completed",
    message: `Teaching materials were copied into ${input.destinationCourseCode}. Review dates and publish status before releasing to students.`,
    link: `${EXCHANGE_HREF}?tab=shared-with-me&request=${input.requestId}`,
    source_type: "course_exchange_request",
    source_id: String(input.requestId),
    instructorId: input.requesterInstructorId,
    courseId: input.destinationCourseId ?? null,
  })
}

export async function notifyCourseExchangeSupplementRequested(input: {
  sourceCourseCode: string
  requesterName: string
  requestId: number
  modules: string[]
  sourceInstructorId: number
}): Promise<void> {
  const moduleList = input.modules.length > 0 ? input.modules.join(", ") : "additional modules"
  await createInstructorNotification({
    type: "course_exchange_supplement",
    title: "Additional modules requested",
    message: `${input.requesterName} asked to add ${moduleList} from ${input.sourceCourseCode}. Review and approve what may be shared.`,
    link: `${EXCHANGE_HREF}?tab=received&request=${input.requestId}`,
    source_type: "course_exchange_request",
    source_id: String(input.requestId),
    instructorId: input.sourceInstructorId,
  })

  try {
    await sendCourseExchangeFacultyAlertEmail({
      instructorId: input.sourceInstructorId,
      title: "Additional modules requested",
      bodyHtml: courseExchangeSupplementBodyHtml({
        requesterName: input.requesterName,
        sourceCourseCode: input.sourceCourseCode,
        modules: input.modules,
      }),
      requestId: input.requestId,
      tab: "received",
      linkLabel: "Review supplement request",
      footerNote: "Sign in to approve or decline additional modules from Course Exchange → Requests Received.",
    })
  } catch (error) {
    console.warn("[course exchange email] supplement requested:", error)
  }
}

export async function notifyCourseExchangeCopyFailed(input: {
  sourceCourseCode: string
  requestId: number
  error: string
  requesterInstructorId: number
}): Promise<void> {
  await createInstructorNotification({
    type: "course_exchange_failed",
    title: "Course copy failed",
    message: `Copying materials from ${input.sourceCourseCode} failed: ${input.error}`,
    link: `${EXCHANGE_HREF}?tab=sent&request=${input.requestId}`,
    source_type: "course_exchange_request",
    source_id: String(input.requestId),
    instructorId: input.requesterInstructorId,
  })
}
