export function isCopyableInstructorField(label: string): boolean {
  const key = label.toLowerCase()
  return (
    key.includes("email") ||
    key.includes("phone") ||
    key.includes("office hours") ||
    key.includes("office location")
  )
}

export function isCourseMeetingField(label: string): boolean {
  const key = label.trim().toLowerCase()
  return (
    (/course meeting days|meeting days.*time/i.test(label) && !isLaboratoryMeetingField(label)) ||
    key === "lecture" ||
    /^lecture\s*\(/i.test(label)
  )
}

export function isLaboratoryMeetingField(label: string): boolean {
  return /laboratory|lab meeting|lab days/i.test(label)
}

export function copyValueForField(label: string, value: string): string {
  if (label.toLowerCase().includes("phone")) {
    return value.replace(/[^\d+().\-\s]/g, "").trim() || value
  }
  return value.trim()
}
