/**
 * True when the student should not be forced through the "download PDF before leaving" flow:
 * either they already downloaded, or detailed results (including PDF) are locked by the instructor.
 */
export function studentResultsPdfGateSatisfied(data: {
  has_downloaded_pdf?: boolean
  pdf_downloaded_at?: string | null
  results_review_locked?: boolean
}): boolean {
  if (data.results_review_locked === true) return true
  return (
    data.has_downloaded_pdf === true ||
    (data.pdf_downloaded_at !== null && data.pdf_downloaded_at !== undefined)
  )
}
