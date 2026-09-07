/**
 * Client-safe recommendation request status helpers (no DB).
 */

import type { RecommendationStatus } from "@/lib/recommendation-letters-shared"

/** In-app / email link to a student's recommendation request detail page. */
export function recommendationStudentRequestPath(
  requestId: number,
  isPlatformGuest = false,
): string {
  return isPlatformGuest
    ? `/guest/recommendations/${requestId}`
    : `/student/dashboard-v2/recommendations/${requestId}`
}

const TERMINAL_STUDENT_STATUSES = new Set<RecommendationStatus>(["rejected"])

const RELEASED_STATUSES = new Set<RecommendationStatus>(["finalized", "downloaded"])

/** Instructor may edit request metadata (deadline, notes, recipient on letter tab). */
export function instructorCanEditRequestMetadata(status: string): boolean {
  return !TERMINAL_STUDENT_STATUSES.has(status as RecommendationStatus)
}

/** Instructor may release PDF / notify student (first time). */
export function instructorCanReleaseLetter(status: string): boolean {
  const st = status as RecommendationStatus
  if (st === "rejected" || st === "requested") return false
  return true
}

/** Classic finalize button (student already submitted draft). */
export function instructorCanClassicFinalize(status: string): boolean {
  const st = status as RecommendationStatus
  return st === "student_selected" || st === "instructor_review_pending"
}

/** Approve/reject only on the initial queue. */
export function instructorCanDecideInitialRequest(status: string): boolean {
  return (status as RecommendationStatus) === "requested"
}

/** Ask for more information before a letter is in instructor review or released. */
export function instructorCanRequestMoreInfo(status: string): boolean {
  const st = status as RecommendationStatus
  return st === "requested" || st === "approved" || st === "info_requested"
}

/** Student may mark PDF as downloaded after release. */
export function studentCanMarkDownloaded(status: string): boolean {
  const st = status as RecommendationStatus
  return st === "finalized" || st === "downloaded"
}

/** After instructor saves letter text without notifying — moves student to "instructor polishing" lane. */
export function statusAfterInstructorSaveLetterText(
  currentStatus: string,
  hasLetterText: boolean,
): RecommendationStatus | null {
  if (!hasLetterText) return null
  const st = currentStatus as RecommendationStatus
  if (RELEASED_STATUSES.has(st) || st === "rejected" || st === "requested") return null
  if (st === "student_selected") return "student_selected"
  if (
    st === "approved" ||
    st === "ai_generated" ||
    st === "info_requested" ||
    st === "revision_requested" ||
    st === "instructor_review_pending"
  ) {
    return "instructor_review_pending"
  }
  return null
}

export function studentCanDownloadPdf(status: string): boolean {
  const st = status as RecommendationStatus
  return st === "finalized" || st === "downloaded"
}

export function requestDetailsFieldsChanged(
  prev: {
    purpose: string
    purpose_other_detail: string | null
    recipient_name: string | null
    recipient_organization: string | null
    recipient_address: string | null
    student_request_description: string | null
    deadline: string | null
    letter_is_specific: boolean
  },
  merged: {
    mergedPurpose: string
    mergedOther: string | null
    mergedRecipientName: string | null
    mergedRecipientOrg: string | null
    mergedRecipientAddress: string | null
    mergedStudentDesc: string | null
    mergedDeadline: string | null
    mergedLetterSpecific: boolean
  },
): boolean {
  const norm = (v: string | null | undefined) => String(v ?? "").trim()
  const normDate = (v: string | null | undefined) => {
    const s = norm(v)
    return s ? s.slice(0, 10) : ""
  }
  return (
    norm(prev.purpose) !== norm(merged.mergedPurpose) ||
    norm(prev.purpose_other_detail) !== norm(merged.mergedOther) ||
    norm(prev.recipient_name) !== norm(merged.mergedRecipientName) ||
    norm(prev.recipient_organization) !== norm(merged.mergedRecipientOrg) ||
    norm(prev.recipient_address) !== norm(merged.mergedRecipientAddress) ||
    norm(prev.student_request_description) !== norm(merged.mergedStudentDesc) ||
    normDate(prev.deadline) !== normDate(merged.mergedDeadline) ||
    Boolean(prev.letter_is_specific) !== Boolean(merged.mergedLetterSpecific)
  )
}
