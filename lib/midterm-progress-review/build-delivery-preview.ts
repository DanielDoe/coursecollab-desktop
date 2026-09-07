import { emailTemplates } from "@/lib/email/emailTemplates"
import {
  buildNotificationPreview,
  buildProgressReviewAnnouncementContent,
  buildProgressReviewEmailHtml,
} from "./build-email-html"
import { getReviewPeriodConfig } from "./review-period"
import type { ProgressReviewSections, StudentProgressData } from "./types"

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com").replace(/\/$/, "")

function firstName(full: string): string {
  const s = String(full ?? "").trim()
  if (!s) return "Student"
  return s.split(/\s+/)[0] ?? "Student"
}

export type ProgressReviewDeliveryPreview = {
  emailSubject: string
  emailHtml: string
  announcementTitle: string
  announcementContent: string
  notificationPreview: string
}

export function buildProgressReviewDeliveryPreview(
  sections: ProgressReviewSections,
  data: StudentProgressData,
): ProgressReviewDeliveryPreview {
  const fn = firstName(data.student.fullName)
  const courseLabel = data.courseCode ?? "your course"
  const periodCfg = getReviewPeriodConfig(data.reviewPeriod)
  const bodySectionsHtml = buildProgressReviewEmailHtml(sections, data)
  const { subject, html } = emailTemplates.midterm_progress_review(
    fn,
    periodCfg.emailSubject(courseLabel),
    periodCfg.emailTitle,
    bodySectionsHtml,
    `${BASE_URL}/student/dashboard-v2/progress-review`,
    "View full review in dashboard",
  )

  return {
    emailSubject: subject,
    emailHtml: html,
    announcementTitle: periodCfg.announcementTitle(courseLabel),
    announcementContent: buildProgressReviewAnnouncementContent(sections, data),
    notificationPreview: buildNotificationPreview(sections),
  }
}
