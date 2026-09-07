export type LetterheadBodyTextAlign = "left" | "center" | "right" | "justify"

/** University banner: “PRAIRIE VIEW A&M UNIVERSITY” + system line. */
export type LetterheadHeaderTextAlign = "left" | "center" | "right"

/** Left/right page margins for letter body (PDF + preview). */
export type LetterheadContentMargin = "narrow" | "moderate" | "normal" | "wide"

/**
 * Shared shape for PVAMU letterhead preview + PDF export (recommendation letters).
 */
export type RecommendationLetterheadContent = {
  studentName: string
  /** Optional lines shown after the date, before the salutation (inside address). Omit for “To whom it may concern” letters. */
  recipientInsideAddressLines?: string[] | null
  recipientName?: string | null
  letterPurpose?: string | null
  /** Full formatted Re: line (preferred over letterPurpose when set). */
  reLine?: string | null
  letterBody: string
  date: string
  instructorName: string
  instructorTitle?: string | null
  instructorEmail?: string | null
  instructorPhone?: string | null
  instructorOffice?: string | null
  /** Optional; used to fill/dedupe typed closing lines vs structured fields (no duplicate name/title). */
  signatureBlock?: string | null
  logoUrl?: string | null
  signatureUrl?: string | null
  /** 0.4–2.0; default 1. Scales max logo box in preview/PDF. */
  logoScale?: number
  /** 0.4–2.0; default 1. Scales max signature box in preview/PDF. */
  signatureScale?: number
  /** ~0.85–1.35; scales main letter typography (date → closing lines before footer rule). Default 1. */
  bodyFontScale?: number
  /** Alignment for main letter column. Default justified. */
  bodyTextAlign?: LetterheadBodyTextAlign
  /** ~0.85–1.35; scales university banner title + system line. Default ~0.92 for print fidelity. */
  headerFontScale?: number
  /** Alignment of banner text within the stripe beside the seal. Default left (official letterhead). */
  headerTextAlign?: LetterheadHeaderTextAlign
  /** 8–48; horizontal gap (px) between seal and banner text. */
  headerLogoTextGapPx?: number
  /** Horizontal page margins for main letter content. Default normal (~25 mm). */
  contentMargin?: LetterheadContentMargin
}

/** Official header: large title + system line only (dept/address live in the footer). */
export const PVAMU_LETTERHEAD_UNIVERSITY_TITLE = "PRAIRIE VIEW A&M UNIVERSITY"
export const PVAMU_LETTERHEAD_SYSTEM_LINE = "A Member of the Texas A&M University System"

/** Bottom band: URL left; department contact right (matches standard PVAMU ECE letterhead). */
export const PVAMU_LETTERHEAD_FOOTER_WEB = "www.pvamu.edu"
export const PVAMU_LETTERHEAD_FOOTER_CONTACT_LINES = [
  "Department of Electrical and Computer Engineering",
  "P. O. Box 519, MS 2520",
  "Prairie View, Texas 77446",
  "Phone (936) 261-9980  Fax (936) 261-9930",
] as const

/** CourseCollab attribution (small; optional in PDF). */
export const PVAMU_LETTERHEAD_ATTRIBUTION = "Prepared via CourseCollab"

export const PVAMU_LETTERHEAD_PURPLE = "#5E2A84"
export const PVAMU_LETTERHEAD_GOLD = "#EAAA00"
