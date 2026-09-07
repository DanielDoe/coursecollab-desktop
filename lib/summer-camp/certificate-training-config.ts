import { createDefaultCampCertificateTemplate } from "@/lib/summer-camp/certificate-default-template"
import type { CampCertificateTemplate } from "@/lib/summer-camp/certificate-template-types"
import { applySignatureStyleToTemplate } from "@/lib/summer-camp/certificate-signature-styles"
import { AI_BOOTCAMP_SLUG } from "@/lib/summer-camp/ai-bootcamp-content"

export const XR_ATTENTION_TRAINING_SLUG = "xr-attention-analytics"
export const AI_EDGE_TRAINING_SLUG = "ai-edge-computing"

export const XR_ATTENTION_CERTIFICATE_TYPE = "xr-attention-certificate-2026"
export const AI_EDGE_CERTIFICATE_TYPE = "camp-certificate-2026"
export const AI_BOOTCAMP_CERTIFICATE_TYPE = "ai-bootcamp-certificate-2026"

export function createXrAttentionCertificateTemplate(): CampCertificateTemplate {
  return createDefaultCampCertificateTemplate({
    trainingName: "XR, EYE TRACKING, AND AI RESEARCH TRAINING",
    programLine: "AI-Assisted Analysis of Student Attention in VR Learning Environments",
    certificateIdPrefix: "PVAMU-XR-2026",
    creditCenterLine: "Central State University",
    creditCenterSubtitle: "In partnership with Central State University",
    assets: {
      pvamuLogoUrl: "/summer-camp/pvamu-logo.png",
      creditLogoUrl: "/summer-camp/csu-logo.png",
      sealImageUrl: "/summer-camp/certificate-seal.png",
      watermarkImageUrl: "/summer-camp/certificate-watermark.png",
    },
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
  })
}

export function createAiBootcampCertificateTemplate(): CampCertificateTemplate {
  return createDefaultCampCertificateTemplate({
    trainingName: "FOUNDATIONAL AI WORKSHOP",
    programLine: "High School & Freshman AI Pathways",
    certificateIdPrefix: "PVAMU-AI-BOOTCAMP-2026",
    signatories: [
      {
        id: "sig-1",
        name: "",
        title: "",
        department: "",
        organization: "Prairie View A&M University",
        signatureImageUrl: null,
        instructorId: null,
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
  })
}

export function getDefaultCertificateTemplateForSlug(slug: string): CampCertificateTemplate {
  if (slug === XR_ATTENTION_TRAINING_SLUG) return createXrAttentionCertificateTemplate()
  if (slug === AI_BOOTCAMP_SLUG) return createAiBootcampCertificateTemplate()
  return createDefaultCampCertificateTemplate()
}

export function getCertificateTypeForSlug(slug: string): string {
  if (slug === XR_ATTENTION_TRAINING_SLUG) return XR_ATTENTION_CERTIFICATE_TYPE
  if (slug === AI_BOOTCAMP_SLUG) return AI_BOOTCAMP_CERTIFICATE_TYPE
  return AI_EDGE_CERTIFICATE_TYPE
}

export function getCertificateDisplayTitle(slug: string): string {
  if (slug === XR_ATTENTION_TRAINING_SLUG) {
    return "XR, Eye Tracking, and AI Research Training Certificate"
  }
  if (slug === AI_BOOTCAMP_SLUG) {
    return "Foundational AI Workshop Certificate"
  }
  return "AI & Edge Computing Summer Camp Certificate"
}

export function getCertificateIssuerLine(slug: string): string {
  if (slug === XR_ATTENTION_TRAINING_SLUG) {
    return "Prairie View A&M University · Central State University"
  }
  if (slug === AI_BOOTCAMP_SLUG) {
    return "Prairie View A&M University · Roy G. Perry College of Engineering"
  }
  return "Prairie View A&M University · CREDIT Center"
}

export function getLinkedInCertificateName(template: CampCertificateTemplate): string {
  return template.trainingName
    .split(" ")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ")
}
