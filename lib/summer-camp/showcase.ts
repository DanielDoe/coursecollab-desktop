import { sql } from "@/lib/db"
import { randomBytes } from "crypto"
import {
  getCertificateTypeForSlug,
  getLinkedInCertificateName,
  XR_ATTENTION_TRAINING_SLUG,
} from "@/lib/summer-camp/certificate-training-config"

export const SHOWCASE_AWARD_TYPES = {
  peoples_choice: "People's Choice Award",
  best_technical_demo: "Best Technical Demo Award",
  best_engineering_reflection: "Best Engineering Reflection Award",
  most_creative_edge_ai: "Most Creative Edge AI Application Award",
} as const

export type ShowcaseAwardType = keyof typeof SHOWCASE_AWARD_TYPES

export async function publishSubmissionToGallery(submissionId: number) {
  const rows = await sql`
    SELECT
      s.id, s.student_id, s.file_url, s.file_name, s.module_id,
      p.training_id, b.content AS block_content,
      st.full_name AS student_name
    FROM camp_submissions s
    JOIN camp_modules m ON m.id = s.module_id
    JOIN camp_projects p ON p.id = m.project_id
    JOIN camp_module_blocks b ON b.id = s.block_id
    JOIN students st ON st.id = s.student_id
    WHERE s.id = ${submissionId} AND s.status = 'approved'
    LIMIT 1
  `
  if (rows.length === 0) return null

  const sub = rows[0] as {
    id: number
    student_id: number
    file_url: string | null
    file_name: string | null
    training_id: number
    block_content: { title?: string }
    student_name: string
  }

  const title = String(sub.block_content?.title ?? "Edge AI Project")
  const isVideo = sub.file_name?.endsWith(".mp4") || sub.file_url?.includes("video")
  const projectType = title.toLowerCase().includes("video") || isVideo ? "video" : "screenshot"

  const inserted = await sql`
    INSERT INTO camp_showcase_entries (
      student_id, training_id, submission_id, title, description,
      project_type, media_url, media_type
    )
    VALUES (
      ${sub.student_id}, ${sub.training_id}, ${sub.id},
      ${title},
      ${`${sub.student_name}'s Edge AI showcase — ${title}`},
      ${projectType},
      ${sub.file_url},
      ${isVideo ? "video/mp4" : "image/jpeg"}
    )
    ON CONFLICT (student_id, training_id, submission_id) DO UPDATE SET
      media_url = EXCLUDED.media_url,
      published_at = NOW()
    RETURNING *
  `
  return inserted[0]
}

export async function listGalleryEntries(
  trainingId: number,
  viewerStudentId?: number,
) {
  const entries = await sql`
    SELECT
      e.*,
      st.full_name AS student_name,
      st.student_id AS student_code
    FROM camp_showcase_entries e
    JOIN students st ON st.id = e.student_id
    WHERE e.training_id = ${trainingId}
    ORDER BY e.is_featured DESC, e.vote_count DESC, e.published_at DESC
  `

  let votedEntryIds = new Set<number>()
  if (viewerStudentId != null) {
    const votes = await sql`
      SELECT entry_id FROM camp_showcase_votes
      WHERE voter_student_id = ${viewerStudentId}
        AND entry_id IN (SELECT id FROM camp_showcase_entries WHERE training_id = ${trainingId})
    `
    votedEntryIds = new Set(votes.map((v) => Number((v as { entry_id: number }).entry_id)))
  }

  return (entries as Array<Record<string, unknown>>).map((e) => ({
    ...e,
    has_voted: votedEntryIds.has(Number(e.id)),
  }))
}

export async function castGalleryVote(entryId: number, voterStudentId: number) {
  const entryRows = await sql`
    SELECT id, student_id, training_id FROM camp_showcase_entries WHERE id = ${entryId} LIMIT 1
  `
  if (entryRows.length === 0) throw new Error("Entry not found")

  const entry = entryRows[0] as { student_id: number; training_id: number }
  if (entry.student_id === voterStudentId) {
    throw new Error("You cannot vote for your own project")
  }

  const enrolled = await sql`
    SELECT 1 FROM camp_enrollments
    WHERE student_id = ${voterStudentId} AND training_id = ${entry.training_id} AND status = 'active'
    LIMIT 1
  `
  if (enrolled.length === 0) throw new Error("Not enrolled in this training")

  try {
    await sql`
      INSERT INTO camp_showcase_votes (entry_id, voter_student_id)
      VALUES (${entryId}, ${voterStudentId})
    `
    await sql`
      UPDATE camp_showcase_entries SET vote_count = vote_count + 1 WHERE id = ${entryId}
    `
    return { voted: true }
  } catch {
    throw new Error("You already voted for this project")
  }
}

export async function listTrainingAwards(trainingId: number) {
  const rows = await sql`
    SELECT a.*, st.full_name AS student_name
    FROM camp_showcase_awards a
    JOIN students st ON st.id = a.student_id
    WHERE a.training_id = ${trainingId}
    ORDER BY a.awarded_at DESC
  `
  return rows.map((r) => {
    const row = r as { award_type: string; student_name: string }
    return {
      ...r,
      award_label: SHOWCASE_AWARD_TYPES[row.award_type as ShowcaseAwardType] ?? row.award_type,
    }
  })
}

export async function assignShowcaseAward(
  trainingId: number,
  studentId: number,
  awardType: ShowcaseAwardType,
  instructorId: number,
  entryId?: number,
) {
  const inserted = await sql`
    INSERT INTO camp_showcase_awards (training_id, student_id, award_type, entry_id, awarded_by)
    VALUES (${trainingId}, ${studentId}, ${awardType}, ${entryId ?? null}, ${instructorId})
    ON CONFLICT (training_id, award_type) DO UPDATE SET
      student_id = EXCLUDED.student_id,
      entry_id = EXCLUDED.entry_id,
      awarded_by = EXCLUDED.awarded_by,
      awarded_at = NOW()
    RETURNING *
  `
  return inserted[0]
}

export async function syncPeoplesChoiceAward(trainingId: number) {
  const top = await sql`
    SELECT student_id, id AS entry_id, vote_count
    FROM camp_showcase_entries
    WHERE training_id = ${trainingId} AND vote_count > 0
    ORDER BY vote_count DESC
    LIMIT 1
  `
  if (top.length === 0) return null

  const winner = top[0] as { student_id: number; entry_id: number }
  return assignShowcaseAward(trainingId, winner.student_id, "peoples_choice", 0, winner.entry_id)
}

export async function listFeedbackCards(studentId: number, trainingId?: number) {
  if (trainingId != null) {
    return sql`
      SELECT c.*, i.name AS instructor_name
      FROM camp_faculty_feedback_cards c
      JOIN instructors i ON i.id = c.instructor_id
      WHERE c.student_id = ${studentId} AND c.training_id = ${trainingId}
      ORDER BY c.created_at DESC
    `
  }
  return sql`
    SELECT c.*, i.name AS instructor_name
    FROM camp_faculty_feedback_cards c
    JOIN instructors i ON i.id = c.instructor_id
    WHERE c.student_id = ${studentId}
    ORDER BY c.created_at DESC
  `
}

export async function createFeedbackCard(input: {
  studentId: number
  trainingId: number
  instructorId: number
  submissionId?: number
  cardType?: string
  title: string
  strengths?: string
  improvements?: string
  rubricScores?: Record<string, unknown>
  message: string
}) {
  const inserted = await sql`
    INSERT INTO camp_faculty_feedback_cards (
      student_id, training_id, instructor_id, submission_id,
      card_type, title, strengths, improvements, rubric_scores, message
    )
    VALUES (
      ${input.studentId}, ${input.trainingId}, ${input.instructorId},
      ${input.submissionId ?? null},
      ${input.cardType ?? "general"},
      ${input.title},
      ${input.strengths ?? null},
      ${input.improvements ?? null},
      ${input.rubricScores ? JSON.stringify(input.rubricScores) : null}::jsonb,
      ${input.message}
    )
    RETURNING *
  `
  return inserted[0]
}

export function generateVerificationCode(): string {
  return `CAMP-2026-${randomBytes(4).toString("hex").toUpperCase()}`
}

export function buildLinkedInCertificateUrl(opts: {
  name: string
  organization: string
  issueYear: number
  issueMonth: number
  certUrl?: string
}) {
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: opts.name,
    organizationName: opts.organization,
    issueYear: String(opts.issueYear),
    issueMonth: String(opts.issueMonth),
  })
  if (opts.certUrl) params.set("certUrl", opts.certUrl)
  return `https://www.linkedin.com/profile/add?${params.toString()}`
}

export async function issueCampCertificate(
  studentDbId: number,
  trainingId: number,
) {
  const info = await sql`
    SELECT st.full_name, t.title AS training_title, t.slug AS training_slug,
           c.id AS camp_id, c.title AS camp_title
    FROM students st
    JOIN camp_enrollments e ON e.student_id = st.id
    JOIN camp_trainings t ON t.id = e.training_id
    JOIN summer_camps c ON c.id = e.camp_id
    WHERE st.id = ${studentDbId} AND t.id = ${trainingId}
    LIMIT 1
  `
  if (info.length === 0) throw new Error("Enrollment not found")

  const row = info[0] as {
    full_name: string
    training_slug: string
    camp_id: number
    camp_title: string
  }
  const certificateType = getCertificateTypeForSlug(row.training_slug)

  const existing = await sql`
    SELECT * FROM camp_certificates
    WHERE student_id = ${studentDbId} AND training_id = ${trainingId}
      AND certificate_type = ${certificateType}
    LIMIT 1
  `
  if (existing.length > 0) return existing[0]

  const code = generateVerificationCode()
  const { buildCertificateVerificationUrl } = await import(
    "@/lib/summer-camp/certificate-verification-url"
  )
  const { getCampCertificateTemplate, formatCertificateNumber } = await import(
    "@/lib/summer-camp/certificate-template-db"
  )
  const template = await getCampCertificateTemplate(trainingId)
  const certName = getLinkedInCertificateName(template)
  const linkedinUrl = buildLinkedInCertificateUrl({
    name: certName,
    organization: "Prairie View A&M University",
    issueYear: 2026,
    issueMonth: 6,
    certUrl: buildCertificateVerificationUrl(code),
  })
  const issuer =
    row.training_slug === XR_ATTENTION_TRAINING_SLUG
      ? "Central State University (partnership)"
      : "CREDIT Center"

  const inserted = await sql`
    INSERT INTO camp_certificates (
      student_id, training_id, camp_id, certificate_type,
      verification_code, student_name, camp_title, linkedin_share_url,
      metadata
    )
    VALUES (
      ${studentDbId}, ${trainingId}, ${row.camp_id},
      ${certificateType}, ${code}, ${row.full_name}, ${row.camp_title},
      ${linkedinUrl},
      ${JSON.stringify({ issuer, department: "Electrical and Computer Engineering" })}::jsonb
    )
    RETURNING *
  `
  const cert = inserted[0] as { id: number }
  const certificateNumber = formatCertificateNumber(template.certificateIdPrefix, cert.id)
  const updated = await sql`
    UPDATE camp_certificates SET
      metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ certificate_number: certificateNumber })}::jsonb
    WHERE id = ${cert.id}
    RETURNING *
  `
  return updated[0] ?? inserted[0]
}
