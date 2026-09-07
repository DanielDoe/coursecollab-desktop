import type { CampCertificateBlockId, CampCertificateTemplate } from "@/lib/summer-camp/certificate-template-types"
import { applySignatureStyleToTemplate } from "@/lib/summer-camp/certificate-signature-styles"

export const DEFAULT_CERTIFICATE_BLOCKS: Record<CampCertificateBlockId, boolean> = {
  header: true,
  certificateTitle: true,
  presentedTo: true,
  completionStatement: true,
  programLine: false,
  seal: true,
  signatures: true,
  footer: true,
  border: true,
  watermark: true,
  qrCode: true,
}

export function createDefaultCampCertificateTemplate(
  overrides?: Partial<CampCertificateTemplate>,
): CampCertificateTemplate {
  const base = {
    certificateTitle: "CERTIFICATE",
    certificateSubtitle: "OF COMPLETION",
    universityLine: "PRAIRIE VIEW A&M UNIVERSITY",
    collegeLine: "ROY G. PERRY",
    collegeLineSecondary: "COLLEGE OF ENGINEERING",
    departmentLine: "Department of Electrical &",
    departmentLineSecondary: "Computer Engineering",
    creditCenterLine: "CREDIT Center",
    creditCenterSubtitle: "Center for Research, Education and Development of Innovative Technologies",
    presentedToLabel: "PRESENTED TO",
    completionLeadIn: "FOR SUCCESSFULLY COMPLETING THE",
    trainingName: "AI & EDGE COMPUTING SUMMER CAMP 2026",
    programLine: "Electrical & Computer Engineering STEM Summer Camp",
    certificateIdPrefix: "PVAMU-AI-2026",
    dateFormat: "month-year",
    blocks: { ...DEFAULT_CERTIFICATE_BLOCKS },
    signatories: [
      {
        id: "sig-1",
        name: "Dr. Anthony Hill",
        title: "Department Head",
        department: "Electrical & Computer Engineering",
        organization: "Prairie View A&M University",
        signatureImageUrl: null,
        enabled: true,
      },
      {
        id: "sig-2",
        name: "",
        title: "",
        department: "",
        organization: "Prairie View A&M University",
        signatureImageUrl: null,
        instructorId: null,
        enabled: true,
      },
    ],
    assets: {
      pvamuLogoUrl: null,
      creditLogoUrl: null,
      sealImageUrl: "/summer-camp/certificate-seal.png",
      watermarkImageUrl: "/summer-camp/certificate-watermark.png",
    },
    typography: {
      nameScale: 1,
      titleScale: 1,
      signatureScale: 1,
      signatureOffsetY: 0,
    },
    signatureStyle: "classic-script" as const,
    ...overrides,
  }
  return applySignatureStyleToTemplate(base, base.signatureStyle ?? "classic-script")
}
