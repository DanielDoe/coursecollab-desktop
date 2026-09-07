"use client"

import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { getAdminData, getInstructorData, getStudentData } from "@/lib/auth"
import { handleDesktopNotificationAction } from "@/lib/desktop-notification-actions"
import { resolveDesktopMenuTarget } from "@/lib/desktop-menu-routes"
import {
  isDesktopElectronShell,
  onDesktopNotificationAction,
  onDesktopNotificationNavigate,
} from "@/lib/desktop-notifications"
import { registerDesktopPushDeviceIfNeeded } from "@/lib/desktop-push-registration"
import { startDesktopFastNotificationPoll } from "@/lib/desktop-fast-notification-poll"

/** Routes notification-center clicks and action buttons back into the SPA. */
export function DesktopNotificationBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isDesktopElectronShell()) return

    void registerDesktopPushDeviceIfNeeded()
    const pushInterval = window.setInterval(() => {
      void registerDesktopPushDeviceIfNeeded()
    }, 5 * 60_000)

    const stopFastPoll = startDesktopFastNotificationPoll()

    const offNavigate = onDesktopNotificationNavigate((link) => {
      const raw = link.trim()
      if (!raw) return

      if (/^https?:\/\//i.test(raw)) {
        window.location.assign(raw)
        return
      }

      const target = resolveDesktopMenuTarget(raw)
      navigate(target.startsWith("/") ? target : `/${target}`)
    })

    const offAction = onDesktopNotificationAction((payload) => {
      const student = getStudentData()
      const admin = getAdminData()
      const faculty = getInstructorData()

      void handleDesktopNotificationAction(payload, {
        studentId: student?.id ?? null,
        adminId: admin?.id ?? null,
        faculty: Boolean(faculty?.id),
      })
    })

    return () => {
      window.clearInterval(pushInterval)
      stopFastPoll()
      offNavigate()
      offAction()
    }
  }, [navigate])

  return null
}
