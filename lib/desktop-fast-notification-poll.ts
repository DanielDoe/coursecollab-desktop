"use client"

import { getAdminData, getInstructorData, getStudentData } from "@/lib/auth"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import {
  deliverNewDesktopNotifications,
  isDesktopElectronShell,
  type FeedNotification,
  type NotificationSyncContext,
} from "@/lib/desktop-notifications"
import { DESKTOP_FAST_NOTIFICATION_POLL_MS } from "@/lib/desktop-notification-poll"
import { withDesktopRefreshInit } from "@/lib/desktop-refresh-token"

type DesktopPortal = NotificationSyncContext["portal"]

function resolvePortal(): DesktopPortal | null {
  const student = getStudentData()
  if (student?.databaseId) return "student"
  if (getInstructorData()?.id) return "faculty"
  if (getAdminData()?.id) return "admin"
  return null
}

function buildFastPollInit(): RequestInit {
  const student = getStudentData()
  if (student?.databaseId) {
    return withDesktopRefreshInit({
      credentials: "include",
      headers: { "x-student-id": String(student.databaseId) },
    })
  }

  const admin = getAdminData()
  if (admin?.id) {
    return withDesktopRefreshInit({
      credentials: "include",
      headers: { "x-admin-id": String(admin.id) },
    })
  }

  return withDesktopRefreshInit({
    credentials: "include",
    headers: buildInstructorApiHeaders(),
  })
}

/** Desktop-only fast poll so OS banners appear soon after server events. */
export function startDesktopFastNotificationPoll(): () => void {
  if (!isDesktopElectronShell()) return () => {}

  const portal = resolvePortal()
  if (!portal) return () => {}

  const knownIds = new Set<number>()
  let initialized = false
  let lastSince = new Date().toISOString()
  let timer: ReturnType<typeof setInterval> | null = null

  const poll = async () => {
    try {
      const response = await fetch(
        `/api/desktop/notifications?since=${encodeURIComponent(lastSince)}&limit=30`,
        buildFastPollInit(),
      )
      if (!response.ok) return

      const data = (await response.json()) as {
        portal?: DesktopPortal
        notifications?: Array<FeedNotification & { created_at?: string }>
      }
      const list = data.notifications ?? []
      // `initialized` must flip on the first *completed* poll, not the first
      // non-empty one. The cursor starts at "now", so the opening poll is
      // normally empty; returning early here left the flag false and made
      // deliverNewDesktopNotifications discard the first real notification as
      // if it were backlog. There is no backlog on a since-cursor feed.
      if (list.length === 0) {
        initialized = true
        return
      }

      const activePortal = data.portal ?? portal
      const nextIds = await deliverNewDesktopNotifications(knownIds, list, {
        initialized,
        portal: activePortal,
      })
      for (const id of nextIds) knownIds.add(id)
      initialized = true

      const latest = list[list.length - 1]?.created_at
      if (typeof latest === "string" && latest > lastSince) {
        lastSince = latest
      }
    } catch {
      /* non-blocking */
    }
  }

  const onFocus = () => {
    void poll()
  }

  void poll()
  timer = setInterval(() => {
    void poll()
  }, DESKTOP_FAST_NOTIFICATION_POLL_MS)

  window.addEventListener("focus", onFocus)

  return () => {
    if (timer) clearInterval(timer)
    window.removeEventListener("focus", onFocus)
  }
}
