import { getStudentDatabaseId } from "@/lib/student-session-ids"

const LOCAL_ENROLLED_PREFIX = "camp_training_enrolled_"

export function markCampTrainingEnrolledLocally(trainingId: number | string) {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.setItem(`${LOCAL_ENROLLED_PREFIX}${trainingId}`, "1")
}

export function isCampTrainingEnrolledLocally(trainingId: number | string): boolean {
  if (typeof sessionStorage === "undefined") return false
  return sessionStorage.getItem(`${LOCAL_ENROLLED_PREFIX}${trainingId}`) === "1"
}

export function clearCampTrainingEnrolledLocally(trainingId: number | string) {
  if (typeof sessionStorage === "undefined") return
  sessionStorage.removeItem(`${LOCAL_ENROLLED_PREFIX}${trainingId}`)
}

export function resolveStudentDbIdForCamp(): string | null {
  return getStudentDatabaseId()
}

export async function postCampTrainingEnroll(
  trainingId: number,
  studentDbId: string,
): Promise<{ alreadyEnrolled: boolean }> {
  const res = await fetch("/api/summer-camp/enroll", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trainingId }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(String(body.error ?? "Enrollment failed"))
  }
  return { alreadyEnrolled: body.alreadyEnrolled === true }
}

export async function fetchCampTrainingPage(
  trainingId: number | string,
  studentDbId: string,
  options?: { preview?: boolean },
) {
  const previewQuery = options?.preview ? "&preview=1" : ""
  const res = await fetch(
    `/api/summer-camp/training/${trainingId}?studentDatabaseId=${encodeURIComponent(studentDbId)}${previewQuery}`,
    { credentials: "include" },
  )
  if (!res.ok) return null
  return res.json()
}

/** Refetch training after enroll — brief retries for read-after-write lag. */
export async function fetchCampTrainingAfterEnroll(
  trainingId: number | string,
  studentDbId: string,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 120 * attempt))
    }
    const payload = await fetchCampTrainingPage(trainingId, studentDbId, { preview: false })
    if (payload?.enrolled) {
      clearCampTrainingEnrolledLocally(trainingId)
      return payload
    }
  }
  return null
}

export type BrowseTrainingHub = {
  camps: Array<{
    title: string
    trainings: Array<{ id: number | null; enrolled?: boolean; [key: string]: unknown }>
    [key: string]: unknown
  }>
}

export function patchBrowseHubEnrollment<T extends BrowseTrainingHub>(
  hub: T,
  trainingId: number,
): T {
  return {
    ...hub,
    camps: hub.camps.map((camp) => ({
      ...camp,
      trainings: camp.trainings.map((t) =>
        t.id === trainingId ? { ...t, enrolled: true } : t,
      ),
    })),
  }
}

export function applyLocalEnrollmentToBrowseHub<T extends BrowseTrainingHub>(hub: T): T {
  let changed = false
  const camps = hub.camps.map((camp) => ({
    ...camp,
    trainings: camp.trainings.map((t) => {
      if (t.id != null && t.enrolled) {
        clearCampTrainingEnrolledLocally(t.id)
        return t
      }
      if (t.id != null && isCampTrainingEnrolledLocally(t.id)) {
        changed = true
        return { ...t, enrolled: true }
      }
      return t
    }),
  }))
  return changed ? { ...hub, camps } : hub
}

export function applyLocalEnrollmentToTrainingPayload<T extends { enrolled?: boolean }>(
  trainingId: number | string,
  payload: T | null,
): T | null {
  if (!payload) return payload
  if (payload.enrolled) {
    clearCampTrainingEnrolledLocally(trainingId)
    return payload
  }
  if (!isCampTrainingEnrolledLocally(trainingId)) return payload
  return {
    ...payload,
    enrolled: true,
    preview: false,
    overview: false,
  } as T
}
