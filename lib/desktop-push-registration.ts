"use client"

import { getStudentData, getAdminData, getInstructorData } from "@/lib/auth"
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers"
import { isDesktopElectronShell } from "@/lib/desktop-notifications"

type DesktopPushOwner = {
  ownerKind: "student" | "instructor" | "admin"
  ownerId: number
  headers: Record<string, string>
}

function resolveDesktopPushOwner(): DesktopPushOwner | null {
  const student = getStudentData()
  if (student?.databaseId) {
    const dbId = Number(student.databaseId)
    if (!Number.isFinite(dbId)) return null
    return {
      ownerKind: "student",
      ownerId: dbId,
      headers: { "x-student-id": String(dbId) },
    }
  }

  const admin = getAdminData()
  if (admin?.id) {
    return {
      ownerKind: "admin",
      ownerId: Number(admin.id),
      headers: { "x-admin-id": String(admin.id) },
    }
  }

  const faculty = getInstructorData()
  if (faculty?.id) {
    return {
      ownerKind: "instructor",
      ownerId: Number(faculty.id),
      headers: buildInstructorApiHeaders(),
    }
  }

  return null
}

export async function registerDesktopPushDeviceIfNeeded(): Promise<void> {
  if (!isDesktopElectronShell() || !window.courseCollabDesktop?.getDeviceId) return

  const owner = resolveDesktopPushOwner()
  if (!owner) return

  try {
    const deviceId = await window.courseCollabDesktop.getDeviceId()
    const platform = window.courseCollabDesktop.platform

    await fetch("/api/desktop/push-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...owner.headers,
      },
      body: JSON.stringify({
        device_id: deviceId,
        owner_kind: owner.ownerKind,
        owner_id: owner.ownerId,
        platform,
      }),
    })
  } catch (error) {
    console.warn("[desktop-push] device registration failed:", error)
  }
}
