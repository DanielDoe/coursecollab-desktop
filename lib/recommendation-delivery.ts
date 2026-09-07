export type RecommendationDeliveryMethod =
  | "student_download"
  | "faculty_submits"
  | "designated_recipient"
  | "confidential"

export const RECOMMENDATION_DELIVERY_OPTIONS: {
  id: RecommendationDeliveryMethod
  label: string
  description: string
}[] = [
  {
    id: "student_download",
    label: "Student may download",
    description: "Release the finalized PDF to the student in the app.",
  },
  {
    id: "faculty_submits",
    label: "Faculty submits externally",
    description: "You submit outside CourseCollab; student sees Completed without the letter file.",
  },
  {
    id: "designated_recipient",
    label: "Send to designated recipient",
    description: "Deliver to a specific email; student tracks status only.",
  },
  {
    id: "confidential",
    label: "Confidential recommendation",
    description: "Student sees Completed but never receives letter contents.",
  },
]

export function normalizeDeliveryMethod(raw: unknown): RecommendationDeliveryMethod {
  const v = String(raw ?? "").trim()
  if (
    v === "faculty_submits" ||
    v === "designated_recipient" ||
    v === "confidential" ||
    v === "student_download"
  ) {
    return v
  }
  return "student_download"
}

export function studentCanViewLetterText(
  deliveryMethod: RecommendationDeliveryMethod,
  status: string,
): boolean {
  if (deliveryMethod === "confidential" || deliveryMethod === "faculty_submits") return false
  if (deliveryMethod === "designated_recipient") return false
  return status === "finalized" || status === "downloaded" || status === "delivered"
}

export function studentCanDownloadPdf(
  deliveryMethod: RecommendationDeliveryMethod,
  status: string,
): boolean {
  if (deliveryMethod !== "student_download") return false
  return status === "finalized" || status === "downloaded" || status === "delivered"
}

export function studentDeliveryStatusLabel(
  deliveryMethod: RecommendationDeliveryMethod,
  status: string,
): string {
  if (status === "withdrawn") return "Withdrawn"
  if (status === "rejected") return "Declined"
  if (status === "expired") return "Expired"
  if (status === "finalized" || status === "downloaded" || status === "delivered") {
    if (deliveryMethod === "confidential") return "Completed (confidential)"
    if (deliveryMethod === "faculty_submits") return "Completed — submitted by faculty"
    if (deliveryMethod === "designated_recipient") return "Completed — sent to recipient"
    return "Ready to download"
  }
  return "In progress"
}
