import { sql } from "@/lib/db"
import { ensureGuestCareerIntelligenceSchema } from "@/lib/guest/career/ensure-schema"
import { hashCareerContent } from "@/lib/guest/career/hash-content"
import { parseOpportunityHeuristic } from "@/lib/guest/career/parse-opportunity-heuristic"
import { parseResumeHeuristic } from "@/lib/guest/career/parse-resume-heuristic"
import { rowToApplication, rowToAnalysis, rowToCoverLetter, rowToOpportunity, rowToResume } from "@/lib/guest/career/row-mappers"
import type {
  ApplicationStatus,
  ApplicationWorkspace,
  CareerAnalysis,
  CoverLetter,
  CoverLetterTone,
  OpportunityProfile,
  OpportunityType,
  ResumeProfile,
} from "@/lib/guest/career/types"
import {
  CAREER_ANALYSIS_ALGORITHM_VERSION,
  CAREER_MATCH_WEIGHTS_VERSION,
} from "@/lib/guest/career/match-config"
import { runCareerMatchAnalysis } from "@/lib/guest/career/match-engine"
import { draftCoverLetter } from "@/lib/guest/career/cover-letter-engine"
import { syncGuestProfileFromMasterResume } from "@/lib/guest/career/sync-resume-context"
import { guestResumeHashSeed } from "@/lib/guest/career/resume-file"

export async function getGuestMasterResume(guestId: number): Promise<ResumeProfile | null> {
  await ensureGuestCareerIntelligenceSchema()
  const rows = await sql`
    SELECT * FROM guest_career_resumes
    WHERE guest_id = ${guestId} AND is_master = true
    ORDER BY updated_at DESC
    LIMIT 1
  `
  return rows[0] ? rowToResume(rows[0] as Record<string, unknown>) : null
}

export async function listGuestResumes(guestId: number): Promise<ResumeProfile[]> {
  await ensureGuestCareerIntelligenceSchema()
  const rows = await sql`
    SELECT * FROM guest_career_resumes
    WHERE guest_id = ${guestId}
    ORDER BY is_master DESC, updated_at DESC
  `
  return rows.map((r) => rowToResume(r as Record<string, unknown>))
}

export async function upsertGuestMasterResume(args: {
  guestId: number
  parsedText?: string
  label?: string
  originalFileName?: string | null
  originalFileUrl?: string | null
  originalMime?: string | null
}): Promise<ResumeProfile> {
  await ensureGuestCareerIntelligenceSchema()
  const parsedText = String(args.parsedText ?? "")
  const profile = parseResumeHeuristic(parsedText)
  const contentHash = hashCareerContent(
    guestResumeHashSeed({
      parsedText,
      originalFileName: args.originalFileName,
      originalFileUrl: args.originalFileUrl,
      originalMime: args.originalMime,
    }),
  )
  const existing = await getGuestMasterResume(args.guestId)
  if (existing && existing.contentHash === contentHash && existing.parsedText === parsedText) {
    return existing
  }

  if (existing) {
    const rows = await sql`
      UPDATE guest_career_resumes
      SET
        parsed_text = ${parsedText},
        profile = ${JSON.stringify(profile)}::jsonb,
        content_hash = ${contentHash},
        label = ${args.label ?? existing.label},
        original_file_name = COALESCE(${args.originalFileName ?? null}, original_file_name),
        original_file_url = COALESCE(${args.originalFileUrl ?? null}, original_file_url),
        original_mime = COALESCE(${args.originalMime ?? null}, original_mime),
        updated_at = NOW()
      WHERE id = ${existing.id} AND guest_id = ${args.guestId}
      RETURNING *
    `
    return finishResumeUpsert(args.guestId, rows[0] as Record<string, unknown>)
  }

  await sql`
    UPDATE guest_career_resumes SET is_master = false WHERE guest_id = ${args.guestId} AND is_master = true
  `

  const rows = await sql`
    INSERT INTO guest_career_resumes (
      guest_id, is_master, label, original_file_name, original_file_url, original_mime,
      profile, parsed_text, content_hash
    ) VALUES (
      ${args.guestId}, true, ${args.label ?? "Master Résumé"},
      ${args.originalFileName ?? null}, ${args.originalFileUrl ?? null}, ${args.originalMime ?? null},
      ${JSON.stringify(profile)}::jsonb, ${parsedText}, ${contentHash}
    )
    RETURNING *
  `
  return finishResumeUpsert(args.guestId, rows[0] as Record<string, unknown>)
}

async function finishResumeUpsert(guestId: number, row: Record<string, unknown>): Promise<ResumeProfile> {
  const saved = rowToResume(row)
  await syncGuestProfileFromMasterResume(guestId, saved)
  return saved
}

export async function createGuestOpportunity(args: {
  guestId: number
  type?: OpportunityType
  description: string
  organization?: string | null
  title?: string | null
  sourceUrl?: string | null
  location?: string | null
  deadline?: string | null
}): Promise<OpportunityProfile> {
  await ensureGuestCareerIntelligenceSchema()
  const profile = parseOpportunityHeuristic(args)
  const contentHash = hashCareerContent(args.description)
  const rows = await sql`
    INSERT INTO guest_career_opportunities (
      guest_id, type, organization, title, description, source_url, location, deadline, profile, content_hash
    ) VALUES (
      ${args.guestId},
      ${args.type ?? "JOB"},
      ${profile.organization},
      ${profile.title},
      ${args.description},
      ${args.sourceUrl ?? null},
      ${args.location ?? null},
      ${args.deadline ? new Date(args.deadline).toISOString() : null},
      ${JSON.stringify(profile)}::jsonb,
      ${contentHash}
    )
    RETURNING *
  `
  return rowToOpportunity(rows[0] as Record<string, unknown>)
}

export async function listGuestApplications(guestId: number): Promise<ApplicationWorkspace[]> {
  await ensureGuestCareerIntelligenceSchema()
  const apps = await sql`
    SELECT * FROM guest_career_applications
    WHERE guest_id = ${guestId}
    ORDER BY updated_at DESC
    LIMIT 50
  `
  const out: ApplicationWorkspace[] = []
  for (const row of apps) {
    const appRow = row as Record<string, unknown>
    const oppRows = await sql`
      SELECT * FROM guest_career_opportunities WHERE id = ${Number(appRow.opportunity_id)} LIMIT 1
    `
    if (!oppRows[0]) continue
    out.push(rowToApplication(appRow, rowToOpportunity(oppRows[0] as Record<string, unknown>)))
  }
  return out
}

export async function getGuestApplication(guestId: number, applicationId: number): Promise<ApplicationWorkspace | null> {
  await ensureGuestCareerIntelligenceSchema()
  const rows = await sql`
    SELECT * FROM guest_career_applications
    WHERE guest_id = ${guestId} AND id = ${applicationId}
    LIMIT 1
  `
  if (!rows[0]) return null
  const appRow = rows[0] as Record<string, unknown>
  const oppRows = await sql`
    SELECT * FROM guest_career_opportunities WHERE id = ${Number(appRow.opportunity_id)} LIMIT 1
  `
  if (!oppRows[0]) return null
  return rowToApplication(appRow, rowToOpportunity(oppRows[0] as Record<string, unknown>))
}

export async function ensureApplicationWorkspace(args: {
  guestId: number
  opportunityId: number
  masterResumeId?: number | null
  status?: ApplicationStatus
}): Promise<ApplicationWorkspace> {
  await ensureGuestCareerIntelligenceSchema()
  const existing = await sql`
    SELECT * FROM guest_career_applications
    WHERE guest_id = ${args.guestId} AND opportunity_id = ${args.opportunityId}
    LIMIT 1
  `
  if (existing[0]) {
    const appRow = existing[0] as Record<string, unknown>
    const oppRows = await sql`SELECT * FROM guest_career_opportunities WHERE id = ${args.opportunityId} LIMIT 1`
    return rowToApplication(appRow, rowToOpportunity(oppRows[0] as Record<string, unknown>))
  }

  const inserted = await sql`
    INSERT INTO guest_career_applications (guest_id, opportunity_id, master_resume_id, status)
    VALUES (${args.guestId}, ${args.opportunityId}, ${args.masterResumeId ?? null}, ${args.status ?? "PREPARING"})
    RETURNING *
  `
  const oppRows = await sql`SELECT * FROM guest_career_opportunities WHERE id = ${args.opportunityId} LIMIT 1`
  return rowToApplication(inserted[0] as Record<string, unknown>, rowToOpportunity(oppRows[0] as Record<string, unknown>))
}

export async function findCachedAnalysis(args: {
  guestId: number
  resumeHash: string
  opportunityHash: string
}): Promise<CareerAnalysis | null> {
  await ensureGuestCareerIntelligenceSchema()
  const rows = await sql`
    SELECT * FROM guest_career_analyses
    WHERE guest_id = ${args.guestId}
      AND resume_hash = ${args.resumeHash}
      AND opportunity_hash = ${args.opportunityHash}
      AND algorithm_version = ${CAREER_ANALYSIS_ALGORITHM_VERSION}
      AND weights_version = ${CAREER_MATCH_WEIGHTS_VERSION}
    ORDER BY created_at DESC
    LIMIT 1
  `
  return rows[0] ? rowToAnalysis(rows[0] as Record<string, unknown>) : null
}

export async function saveCareerAnalysis(
  analysis: Omit<CareerAnalysis, "id" | "createdAt">,
): Promise<CareerAnalysis> {
  await ensureGuestCareerIntelligenceSchema()
  const rows = await sql`
    INSERT INTO guest_career_analyses (
      guest_id, application_id, resume_id, opportunity_id,
      resume_hash, opportunity_hash, algorithm_version, weights_version,
      overall_score, match_band, analysis
    ) VALUES (
      ${analysis.guestId},
      ${analysis.applicationId},
      ${analysis.resumeId},
      ${analysis.opportunityId},
      ${analysis.resumeHash},
      ${analysis.opportunityHash},
      ${analysis.algorithmVersion},
      ${analysis.weightsVersion},
      ${analysis.overallScore},
      ${analysis.matchBand},
      ${JSON.stringify(analysis)}::jsonb
    )
    RETURNING *
  `
  const saved = rowToAnalysis(rows[0] as Record<string, unknown>)

  if (analysis.applicationId != null) {
    await sql`
      UPDATE guest_career_applications
      SET
        match_score = ${analysis.overallScore},
        match_band = ${analysis.matchBand},
        latest_analysis_id = ${saved.id},
        status = CASE WHEN status = 'SAVED' THEN 'PREPARING' ELSE status END,
        updated_at = NOW()
      WHERE id = ${analysis.applicationId} AND guest_id = ${analysis.guestId}
    `
  }

  return saved
}

export async function analyzeResumeOpportunityMatch(args: {
  guestId: number
  resume: ResumeProfile
  opportunity: OpportunityProfile
  applicationId?: number | null
}): Promise<CareerAnalysis> {
  const resumeHash = args.resume.contentHash ?? hashCareerContent(args.resume.parsedText)
  const opportunityHash = args.opportunity.contentHash ?? hashCareerContent(args.opportunity.description)

  const cached = await findCachedAnalysis({
    guestId: args.guestId,
    resumeHash,
    opportunityHash,
  })
  if (cached) return cached

  const draft = runCareerMatchAnalysis({
    guestId: args.guestId,
    resume: args.resume,
    opportunity: args.opportunity,
    resumeHash,
    opportunityHash,
    applicationId: args.applicationId,
  })

  return saveCareerAnalysis(draft)
}

export type CareerScanHistoryItem = {
  id: number
  applicationId: number | null
  overallScore: number
  matchBand: string
  createdAt: string
  opportunityTitle: string | null
  organization: string | null
}

export type CoverLetterHistoryItem = {
  id: number
  applicationId: number
  tone: string
  status: string
  updatedAt: string
  preview: string
  opportunityTitle: string | null
  organization: string | null
}

/** Recent match/quick scans and cover letters for the history panels. */
export async function listGuestCareerHistory(guestId: number): Promise<{
  scans: CareerScanHistoryItem[]
  coverLetters: CoverLetterHistoryItem[]
}> {
  await ensureGuestCareerIntelligenceSchema()
  const [scanRows, letterRows] = await Promise.all([
    sql`
      SELECT a.id, a.application_id, a.overall_score, a.match_band, a.created_at,
             o.title AS opportunity_title, o.organization
      FROM guest_career_analyses a
      LEFT JOIN guest_career_opportunities o ON o.id = a.opportunity_id
      WHERE a.guest_id = ${guestId}
      ORDER BY a.created_at DESC
      LIMIT 25
    `,
    sql`
      SELECT cl.id, cl.application_id, cl.tone, cl.status, cl.updated_at,
             LEFT(cl.body, 200) AS preview,
             o.title AS opportunity_title, o.organization
      FROM guest_career_cover_letters cl
      LEFT JOIN guest_career_applications app ON app.id = cl.application_id
      LEFT JOIN guest_career_opportunities o ON o.id = app.opportunity_id
      WHERE cl.guest_id = ${guestId}
      ORDER BY cl.updated_at DESC
      LIMIT 25
    `,
  ])

  return {
    scans: scanRows.map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: Number(row.id),
        applicationId: row.application_id != null ? Number(row.application_id) : null,
        overallScore: Number(row.overall_score ?? 0),
        matchBand: String(row.match_band ?? ""),
        createdAt: String(row.created_at ?? ""),
        opportunityTitle: row.opportunity_title != null ? String(row.opportunity_title) : null,
        organization: row.organization != null ? String(row.organization) : null,
      }
    }),
    coverLetters: letterRows.map((r) => {
      const row = r as Record<string, unknown>
      return {
        id: Number(row.id),
        applicationId: Number(row.application_id),
        tone: String(row.tone ?? "professional"),
        status: String(row.status ?? "DRAFT"),
        updatedAt: String(row.updated_at ?? ""),
        preview: String(row.preview ?? ""),
        opportunityTitle: row.opportunity_title != null ? String(row.opportunity_title) : null,
        organization: row.organization != null ? String(row.organization) : null,
      }
    }),
  }
}

export async function getGuestCoverLetter(
  guestId: number,
  applicationId: number,
): Promise<CoverLetter | null> {
  await ensureGuestCareerIntelligenceSchema()
  const rows = await sql`
    SELECT * FROM guest_career_cover_letters
    WHERE guest_id = ${guestId} AND application_id = ${applicationId}
    LIMIT 1
  `
  return rows[0] ? rowToCoverLetter(rows[0] as Record<string, unknown>) : null
}

export async function upsertGuestCoverLetter(args: {
  guestId: number
  applicationId: number
  body: string
  tone?: CoverLetterTone
}): Promise<CoverLetter> {
  await ensureGuestCareerIntelligenceSchema()
  const tone = args.tone ?? "professional"
  const existing = await getGuestCoverLetter(args.guestId, args.applicationId)

  if (existing) {
    const rows = await sql`
      UPDATE guest_career_cover_letters
      SET body = ${args.body}, tone = ${tone}, status = 'DRAFT', updated_at = NOW()
      WHERE id = ${existing.id} AND guest_id = ${args.guestId}
      RETURNING *
    `
    await sql`
      UPDATE guest_career_applications
      SET cover_letter_status = 'DRAFT', updated_at = NOW()
      WHERE id = ${args.applicationId} AND guest_id = ${args.guestId}
    `
    return rowToCoverLetter(rows[0] as Record<string, unknown>)
  }

  const rows = await sql`
    INSERT INTO guest_career_cover_letters (guest_id, application_id, body, tone, status)
    VALUES (${args.guestId}, ${args.applicationId}, ${args.body}, ${tone}, 'DRAFT')
    RETURNING *
  `
  await sql`
    UPDATE guest_career_applications
    SET cover_letter_status = 'DRAFT', updated_at = NOW()
    WHERE id = ${args.applicationId} AND guest_id = ${args.guestId}
  `
  return rowToCoverLetter(rows[0] as Record<string, unknown>)
}

export async function generateGuestCoverLetter(args: {
  guestId: number
  parsedText: string
  opportunityDescription: string
  opportunityType?: OpportunityType
  organization?: string | null
  opportunityTitle?: string | null
  tone?: CoverLetterTone
}): Promise<{
  coverLetter: CoverLetter
  application: ApplicationWorkspace
  resume: ResumeProfile
  opportunity: OpportunityProfile
}> {
  const resume = await upsertGuestMasterResume({
    guestId: args.guestId,
    parsedText: args.parsedText,
  })

  const opportunity = await createGuestOpportunity({
    guestId: args.guestId,
    type: args.opportunityType ?? "JOB",
    description: args.opportunityDescription,
    organization: args.organization ?? null,
    title: args.opportunityTitle ?? null,
  })

  const application = await ensureApplicationWorkspace({
    guestId: args.guestId,
    opportunityId: opportunity.id,
    masterResumeId: resume.id,
    status: "PREPARING",
  })

  const body = draftCoverLetter({
    resume,
    opportunity,
    tone: args.tone,
  })

  const coverLetter = await upsertGuestCoverLetter({
    guestId: args.guestId,
    applicationId: application.id,
    body,
    tone: args.tone,
  })

  const refreshed = await getGuestApplication(args.guestId, application.id)
  return {
    coverLetter,
    application: refreshed ?? application,
    resume,
    opportunity,
  }
}
