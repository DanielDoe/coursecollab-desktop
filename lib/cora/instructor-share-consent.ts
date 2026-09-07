import {
  getCoraPrivacySettings,
  setCoraPrivacySettings,
} from "@/lib/cora/privacy/cora-privacy-settings"

export async function getShareWithInstructor(studentId: number): Promise<boolean> {
  const settings = await getCoraPrivacySettings(studentId)
  return settings.shareWithInstructor
}

export async function setShareWithInstructor(studentId: number, share: boolean): Promise<boolean> {
  const settings = await setCoraPrivacySettings(studentId, { shareWithInstructor: share })
  return settings.shareWithInstructor
}

export async function listConsentedStudentIds(studentIds: number[]): Promise<Set<number>> {
  const unique = [...new Set(studentIds.filter((id) => Number.isFinite(id) && id > 0))]
  if (unique.length === 0) return new Set()
  const consented = new Set<number>()
  for (const id of unique) {
    if (await getShareWithInstructor(id)) consented.add(id)
  }
  return consented
}
