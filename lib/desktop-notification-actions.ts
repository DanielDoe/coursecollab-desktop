"use client"

import { studentApiFetch } from "@/lib/auth"
import { instructorApiFetch } from "@/lib/instructor-api-headers"
import type { DesktopNotificationActionPayload } from "@/lib/desktop-notifications"

/** Ids the alert stood for. Grouped alerts represent a whole batch, not just the first item. */
function resolveNotificationIds(payload: DesktopNotificationActionPayload): number[] {
  const ids = payload.notificationIds?.filter((id) => Number.isFinite(id)) ?? []
  if (ids.length > 0) return Array.from(new Set(ids))
  return Number.isFinite(payload.notificationId) ? [payload.notificationId] : []
}

export async function handleDesktopNotificationAction(
  payload: DesktopNotificationActionPayload,
  auth: {
    studentId?: string | null
    adminId?: string | null
    faculty?: boolean
  },
): Promise<void> {
  if (payload.action === "reply") {
    // Reply opens the thread in-app; navigation is handled by the main process.
    return
  }

  if (payload.action !== "mark-read") return

  const notificationIds = resolveNotificationIds(payload)
  if (notificationIds.length === 0) return

  const markOne = async (notificationId: number): Promise<void> => {
    if (payload.portal === "student" && auth.studentId) {
      await studentApiFetch("/api/student/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-student-id": auth.studentId,
        },
        body: JSON.stringify({ notification_id: notificationId }),
      })
      return
    }

    if (payload.portal === "admin" && auth.adminId) {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-id": auth.adminId,
        },
        body: JSON.stringify({ notification_id: notificationId }),
      })
      return
    }

    if (payload.portal === "faculty" && auth.faculty) {
      await instructorApiFetch("/api/instructor/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: notificationId }),
      })
    }
  }

  // One failure should not strand the rest of the group as unread.
  const results = await Promise.allSettled(notificationIds.map(markOne))
  for (const result of results) {
    if (result.status === "rejected") {
      console.warn("[desktop-notifications] mark-as-read action failed:", result.reason)
    }
  }
}
