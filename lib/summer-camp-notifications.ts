import { createNotification } from "@/lib/create-notification"
import { campRoute, SUMMER_CAMP_DASHBOARD_BASE } from "@/lib/summer-camp/camper-nav"

type CampNotificationType =
  | "camp_enrollment"
  | "camp_module"
  | "camp_submission"
  | "camp_discussion"
  | "camp_announcement"

export async function notifyCampEnrollment(studentDbId: number, trainingTitle: string) {
  return createNotification({
    studentId: studentDbId,
    type: "project",
    title: "Summer Camp enrollment confirmed",
    message: `You are enrolled in ${trainingTitle}. Start learning from your camp dashboard.`,
    link: SUMMER_CAMP_DASHBOARD_BASE,
  })
}

export async function notifyCampModuleRelease(
  studentDbIds: number[],
  moduleTitle: string,
  moduleId: number,
) {
  await Promise.all(
    studentDbIds.map((id) =>
      createNotification({
        studentId: id,
        type: "lecture",
        title: "New camp module available",
        message: `"${moduleTitle}" is now published.`,
        link: campRoute(`/module/${moduleId}`),
      }),
    ),
  )
}

export async function notifyCampSubmissionFeedback(
  studentDbId: number,
  blockTitle: string,
  status: string,
  moduleId: number,
) {
  return createNotification({
    studentId: studentDbId,
    type: "homework",
    title: "Submission feedback received",
    message: `Your submission for "${blockTitle}" was marked ${status}.`,
    link: campRoute(`/module/${moduleId}`),
  })
}

export async function notifyCampDiscussionReply(
  studentDbId: number,
  threadTitle: string,
  moduleId: number,
) {
  return createNotification({
    studentId: studentDbId,
    type: "forum",
    title: "Instructor replied to your question",
    message: threadTitle ? `Reply on: ${threadTitle}` : "Your camp discussion has a new reply.",
    link: campRoute(`/module/${moduleId}`),
  })
}

export async function notifyCampAnnouncement(
  studentDbIds: number[],
  title: string,
  message: string,
) {
  await Promise.all(
    studentDbIds.map((id) =>
      createNotification({
        studentId: id,
        type: "deadline",
        title,
        message,
        link: SUMMER_CAMP_DASHBOARD_BASE,
      }),
    ),
  )
}
