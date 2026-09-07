import type {
  ApplicationStatus,
  ApplicationWorkspace,
  ArtifactStatus,
  CareerAnalysis,
  CoverLetter,
  MatchBand,
  OpportunityProfile,
  OpportunityProfileData,
  OpportunityType,
  ResumeProfile,
  ResumeProfileData,
} from "@/lib/guest/career/types"
import { emptyResumeProfileData } from "@/lib/guest/career/parse-resume-heuristic"

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value === "object") return value as T
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return fallback
}

function rowToResume(row: Record<string, unknown>): ResumeProfile {
  return {
    id: Number(row.id),
    guestId: Number(row.guest_id),
    isMaster: Boolean(row.is_master),
    label: row.label != null ? String(row.label) : null,
    originalFileName: row.original_file_name != null ? String(row.original_file_name) : null,
    originalFileUrl: row.original_file_url != null ? String(row.original_file_url) : null,
    originalMime: row.original_mime != null ? String(row.original_mime) : null,
    profile: parseJson<ResumeProfileData>(row.profile, emptyResumeProfileData()),
    parsedText: String(row.parsed_text ?? ""),
    contentHash: row.content_hash != null ? String(row.content_hash) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function rowToOpportunity(row: Record<string, unknown>): OpportunityProfile {
  const description = String(row.description ?? "")
  const profile = parseJson<OpportunityProfileData>(row.profile, {
    organization: row.organization != null ? String(row.organization) : null,
    title: String(row.title ?? ""),
    description,
    sourceUrl: row.source_url != null ? String(row.source_url) : null,
    location: row.location != null ? String(row.location) : null,
    deadline: row.deadline != null ? String(row.deadline) : null,
    requiredQualifications: [],
    preferredQualifications: [],
    requiredSkills: [],
    preferredSkills: [],
    educationRequirements: [],
    experienceRequirements: [],
    responsibilities: [],
    keywords: [],
    extractedMetadata: {},
  })

  return {
    id: Number(row.id),
    guestId: Number(row.guest_id),
    type: String(row.type ?? "JOB") as OpportunityType,
    organization: row.organization != null ? String(row.organization) : null,
    title: String(row.title ?? ""),
    description,
    sourceUrl: row.source_url != null ? String(row.source_url) : null,
    location: row.location != null ? String(row.location) : null,
    deadline: row.deadline != null ? String(row.deadline) : null,
    profile,
    contentHash: row.content_hash != null ? String(row.content_hash) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function rowToApplication(
  row: Record<string, unknown>,
  opportunity: OpportunityProfile,
): ApplicationWorkspace {
  return {
    id: Number(row.id),
    guestId: Number(row.guest_id),
    opportunityId: Number(row.opportunity_id),
    opportunity,
    masterResumeId: row.master_resume_id != null ? Number(row.master_resume_id) : null,
    resumeVersionId: row.resume_version_id != null ? Number(row.resume_version_id) : null,
    status: String(row.status ?? "SAVED") as ApplicationStatus,
    matchScore: row.match_score != null ? Number(row.match_score) : null,
    matchBand: row.match_band != null ? (String(row.match_band) as MatchBand) : null,
    coverLetterStatus: String(row.cover_letter_status ?? "NOT_STARTED") as ArtifactStatus,
    interviewPrepStatus: String(row.interview_prep_status ?? "NOT_STARTED") as ArtifactStatus,
    appliedAt: row.applied_at != null ? String(row.applied_at) : null,
    notes: row.notes != null ? String(row.notes) : null,
    latestAnalysisId: row.latest_analysis_id != null ? Number(row.latest_analysis_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function rowToAnalysis(row: Record<string, unknown>): CareerAnalysis {
  const analysis = parseJson<Omit<CareerAnalysis, "id" | "guestId" | "createdAt">>(row.analysis, {
    applicationId: row.application_id != null ? Number(row.application_id) : null,
    resumeId: Number(row.resume_id),
    opportunityId: Number(row.opportunity_id),
    algorithmVersion: String(row.algorithm_version),
    weightsVersion: String(row.weights_version),
    overallScore: Number(row.overall_score),
    matchBand: String(row.match_band) as MatchBand,
    dimensionScores: {
      skillsMatch: 0,
      experienceAlignment: 0,
      roleTitleAlignment: 0,
      educationQualifications: 0,
      keywordCoverage: 0,
      resumeImpact: 0,
      atsReadability: 0,
    },
    summary: "",
    topImprovements: [],
    skillEvidence: { matched: [], partial: [], notDemonstrated: [] },
    requirements: [],
    atsReadability: { score: 0, findings: [] },
    resumeHash: String(row.resume_hash),
    opportunityHash: String(row.opportunity_hash),
  })

  return {
    ...analysis,
    id: Number(row.id),
    guestId: Number(row.guest_id),
    createdAt: String(row.created_at),
  }
}

export function rowToCoverLetter(row: Record<string, unknown>): CoverLetter {
  return {
    id: Number(row.id),
    guestId: Number(row.guest_id),
    applicationId: Number(row.application_id),
    body: String(row.body ?? ""),
    tone: String(row.tone ?? "professional"),
    status: String(row.status ?? "DRAFT") as ArtifactStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export { rowToResume, rowToOpportunity }
