import { sql } from "@/lib/db"
import { getCamperProfile } from "@/lib/summer-camp/camper-profile"
import { getGraduationEligibility } from "@/lib/summer-camp/graduation"
import {
  enabledSignatories,
  formatCertificateNumber,
  getCampCertificateTemplate,
} from "@/lib/summer-camp/certificate-template-db"
import type { CampCertificateVerificationDetails } from "@/lib/summer-camp/certificate-template-types"

const SKILL_LABELS = [
  "Artificial Intelligence",
  "Machine Learning",
  "Computer Vision",
  "Internet of Things",
  "Edge Computing",
  "Raspberry Pi",
  "TensorFlow Lite",
  "Object Detection",
]

export async function getCertificateVerificationDetails(
  verificationCode: string,
): Promise<CampCertificateVerificationDetails | null> {
  const rows = await sql`
    SELECT
      c.*,
      t.title AS training_title,
      t.slug AS training_slug,
      sc.title AS camp_title
    FROM camp_certificates c
    JOIN camp_trainings t ON t.id = c.training_id
    JOIN summer_camps sc ON sc.id = c.camp_id
    WHERE c.verification_code = ${verificationCode}
    LIMIT 1
  `
  if (rows.length === 0) return null

  const cert = rows[0] as {
    id: number
    student_id: number
    training_id: number
    student_name: string
    camp_title: string
    training_title: string
    issued_at: string
    verification_code: string
    metadata: Record<string, unknown> | null
  }

  const template = await getCampCertificateTemplate(cert.training_id)
  const eligibility = await getGraduationEligibility(cert.student_id, cert.training_id)
  const profile = await getCamperProfile(cert.student_id)

  const projectRows = await sql`
    SELECT title FROM camp_projects
    WHERE training_id = ${cert.training_id}
    ORDER BY sort_order ASC LIMIT 1
  `
  const projectTitle = (projectRows[0]?.title as string) ?? "Object Detection on Edge Device"

  const certNumber =
    (cert.metadata?.certificate_number as string) ??
    formatCertificateNumber(template.certificateIdPrefix, cert.id)

  return {
    studentName: cert.student_name,
    certificateNumber: certNumber,
    verificationCode: cert.verification_code,
    campName: cert.camp_title,
    trainingName: cert.training_title,
    trainingTrack: cert.training_title,
    partnerIssuer: template.creditCenterLine,
    hoursCompleted: "40+ hours",
    projectTitle,
    issueDate: cert.issued_at,
    status: "valid",
    verifiedAt: new Date().toISOString(),
    signatories: enabledSignatories(template).map((s) => ({
      name: s.name,
      title: s.title,
      department: s.department,
    })),
    completionRequirements: eligibility.requirements,
    skillsEarned: SKILL_LABELS,
    badgesEarned: profile.badges,
    finalProject: projectTitle,
    totalXp: profile.total_xp,
    modulesCompleted: eligibility.modules_completed,
    modulesTotal: eligibility.modules_total,
  }
}
