import { sql } from "@/lib/db"
import type { CampCertificateBlockId, CampCertificateTemplate } from "@/lib/summer-camp/certificate-template-types"
import { DEFAULT_CERTIFICATE_BLOCKS } from "@/lib/summer-camp/certificate-default-template"
import { getDefaultCertificateTemplateForSlug } from "@/lib/summer-camp/certificate-training-config"
import { AI_BOOTCAMP_SLUG } from "@/lib/summer-camp/ai-bootcamp-content"
import { normalizeTemplateSignatureStyle } from "@/lib/summer-camp/certificate-signature-styles"
import { clampSignatureScale, clampSignatureOffsetY } from "@/lib/summer-camp/certificate-template-utils"
import {
  applyAiBootcampSignatoriesToTemplate,
  applyTrainingInstructorToTemplate,
} from "@/lib/summer-camp/certificate-instructor-signatory"
import { getTrainingCertificateFaculty } from "@/lib/summer-camp/certificate-instructor-signatory-db"
import { ensureInstructorSignaturesAllStyles } from "@/lib/summer-camp/certificate-signature-files"

export {
  enabledSignatories,
  formatCertificateDate,
  formatCertificateNumber,
  isBlockEnabled,
} from "@/lib/summer-camp/certificate-template-utils"

function mergeTemplate(raw: unknown, base: CampCertificateTemplate): CampCertificateTemplate {
  if (!raw || typeof raw !== "object") return normalizeTemplateSignatureStyle(base)
  const r = raw as Partial<CampCertificateTemplate>
  const merged: CampCertificateTemplate = {
    ...base,
    ...r,
    blocks: { ...DEFAULT_CERTIFICATE_BLOCKS, ...(r.blocks ?? {}) },
    assets: { ...base.assets, ...(r.assets ?? {}) },
    typography: {
      ...base.typography,
      ...(r.typography ?? {}),
      signatureScale: clampSignatureScale(
        r.typography?.signatureScale ?? base.typography.signatureScale,
      ),
      signatureOffsetY: clampSignatureOffsetY(
        r.typography?.signatureOffsetY ?? base.typography.signatureOffsetY,
      ),
    },
    signatories: Array.isArray(r.signatories) && r.signatories.length > 0 ? r.signatories : base.signatories,
  }
  return normalizeTemplateSignatureStyle(merged)
}

export async function getCampCertificateTemplate(trainingId: number): Promise<CampCertificateTemplate> {
  const trainingRows = await sql`
    SELECT title, slug FROM camp_trainings WHERE id = ${trainingId} LIMIT 1
  `
  const slug = String(trainingRows[0]?.slug ?? "")
  const base = getDefaultCertificateTemplateForSlug(slug)

  let template: CampCertificateTemplate = base
  try {
    const rows = await sql`
      SELECT template FROM camp_certificate_templates WHERE training_id = ${trainingId} LIMIT 1
    `
    if (rows.length > 0) {
      template = mergeTemplate(rows[0]?.template, base)
    }
  } catch {
    template = base
  }

  const faculty = await getTrainingCertificateFaculty(trainingId)
  const applyFaculty =
    slug === AI_BOOTCAMP_SLUG ? applyAiBootcampSignatoriesToTemplate : applyTrainingInstructorToTemplate
  template = normalizeTemplateSignatureStyle(applyFaculty(template, faculty))

  for (const sig of template.signatories) {
    if (sig.instructorId == null || !sig.name.trim()) continue
    try {
      await ensureInstructorSignaturesAllStyles(sig.instructorId, sig.name)
    } catch (err) {
      console.error("[getCampCertificateTemplate] signature ensure failed", err)
    }
  }
  return normalizeTemplateSignatureStyle(applyFaculty(template, faculty))
}

export async function saveCampCertificateTemplate(
  trainingId: number,
  template: CampCertificateTemplate,
  instructorId?: number,
): Promise<CampCertificateTemplate> {
  const trainingRows = await sql`
    SELECT slug FROM camp_trainings WHERE id = ${trainingId} LIMIT 1
  `
  const base = getDefaultCertificateTemplateForSlug(String(trainingRows[0]?.slug ?? ""))
  const merged = mergeTemplate(template, base)
  try {
    await sql`
      INSERT INTO camp_certificate_templates (training_id, template, updated_at, updated_by)
      VALUES (${trainingId}, ${JSON.stringify(merged)}::jsonb, NOW(), ${instructorId ?? null})
      ON CONFLICT (training_id) DO UPDATE SET
        template = EXCLUDED.template,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
    `
  } catch (err) {
    console.error("[camp_certificate_templates] save failed — run migrations/camp-certificate-templates.sql", err)
    throw new Error("Certificate template storage is not initialized. Run camp-certificate-templates migration.")
  }
  return merged
}
