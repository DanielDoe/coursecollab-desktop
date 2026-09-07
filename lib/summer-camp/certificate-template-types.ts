/** Toggleable certificate sections — faculty can enable/disable like recommendation letter blocks. */
export type CampCertificateBlockId =
  | "header"
  | "certificateTitle"
  | "presentedTo"
  | "completionStatement"
  | "programLine"
  | "seal"
  | "signatures"
  | "footer"
  | "border"
  | "watermark"
  | "qrCode"

export const CAMP_CERTIFICATE_BLOCK_GROUPS: Array<{
  id: string
  label: string
  description: string
  blocks: CampCertificateBlockId[]
}> = [
  {
    id: "frame",
    label: "Frame & background",
    description: "Border accents and the faint building watermark on the right.",
    blocks: ["border", "watermark"],
  },
  {
    id: "header",
    label: "University header",
    description: "Logos and college / department lines at the top.",
    blocks: ["header"],
  },
  {
    id: "body",
    label: "Certificate body",
    description: "Title, student name, and completion statement.",
    blocks: ["certificateTitle", "presentedTo", "completionStatement", "programLine"],
  },
  {
    id: "footer",
    label: "Signatures & footer",
    description: "Seal, signatories, date, certificate ID, and QR code.",
    blocks: ["seal", "signatures", "footer", "qrCode"],
  },
]

export const CAMP_CERTIFICATE_BLOCK_LABELS: Record<CampCertificateBlockId, string> = {
  header: "University header (logos & departments)",
  certificateTitle: "Certificate title (CERTIFICATE OF COMPLETION)",
  presentedTo: "Presented To / student name",
  completionStatement: "Completion statement & training name",
  programLine: "STEM Summer Camp program line",
  seal: "University seal",
  signatures: "Faculty signatures",
  footer: "Issue date & certificate ID",
  border: "Purple & gold border",
  watermark: "Background watermark",
  qrCode: "QR verification code",
}

export type CampCertificateSignatory = {
  id: string
  name: string
  title: string
  department: string
  organization: string
  signatureImageUrl?: string | null
  enabled: boolean
  /** Links sig-2 to camp_training_faculty; name/title/department sync from instructor profile. */
  instructorId?: number | null
}

export type CampCertificateTemplate = {
  certificateTitle: string
  certificateSubtitle: string
  universityLine: string
  /** First college header line — e.g. "ROY G. PERRY" */
  collegeLine: string
  /** Second college header line — e.g. "COLLEGE OF ENGINEERING" */
  collegeLineSecondary?: string
  /** First department line — e.g. "Department of Electrical &" */
  departmentLine: string
  /** Second department line — e.g. "Computer Engineering" */
  departmentLineSecondary?: string
  creditCenterLine: string
  creditCenterSubtitle: string
  presentedToLabel: string
  completionLeadIn: string
  /** Default training name on template; overridden per certificate when available */
  trainingName: string
  programLine: string
  certificateIdPrefix: string
  dateFormat: "month-year" | "full"
  blocks: Record<CampCertificateBlockId, boolean>
  signatories: CampCertificateSignatory[]
  assets: {
    pvamuLogoUrl?: string | null
    creditLogoUrl?: string | null
    sealImageUrl?: string | null
    watermarkImageUrl?: string | null
  }
  typography: {
    nameScale: number
    titleScale: number
    /** Multiplier for faculty signature image size (0.5–2, default 1). */
    signatureScale?: number
    /** Vertical shift of signature artwork only (mm). Signatory lines and text stay fixed. */
    signatureOffsetY?: number
  }
  /** Preset faculty signature artwork — see certificate-signature-styles.ts */
  signatureStyle?: "classic-script" | "formal-italic" | "modern-flow"
}

export type CampCertificateRenderData = {
  studentName: string
  trainingName: string
  campName: string
  certificateNumber: string
  verificationCode: string
  verificationUrl: string
  issuedAt: string
  certificateType: "completion" | "achievement"
}

export type CampCertificateVerificationDetails = {
  studentName: string
  certificateNumber: string
  verificationCode: string
  campName: string
  trainingName: string
  trainingTrack: string
  hoursCompleted?: string
  projectTitle?: string
  issueDate: string
  status: "valid" | "revoked" | "unknown"
  verifiedAt: string
  signatories: Array<{ name: string; title: string; department: string }>
  completionRequirements: Array<{ label: string; met: boolean; detail?: string }>
  skillsEarned: string[]
  badgesEarned: string[]
  finalProject?: string
  totalXp?: number
  modulesCompleted?: number
  modulesTotal?: number
  partnerIssuer?: string
}
