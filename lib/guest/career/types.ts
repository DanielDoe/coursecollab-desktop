/** Cora Career Intelligence — shared domain types. */

export type OpportunityType =
  | "JOB"
  | "INTERNSHIP"
  | "GRADUATE_PROGRAM"
  | "SCHOLARSHIP"
  | "FELLOWSHIP"
  | "RESEARCH"
  | "ACADEMIC_POSITION"
  | "OTHER"

export type ApplicationStatus =
  | "SAVED"
  | "PREPARING"
  | "READY"
  | "APPLIED"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN"

export type ArtifactStatus = "NOT_STARTED" | "DRAFT" | "READY"

export type MatchEvidenceLevel = "EXPLICIT_MATCH" | "SEMANTIC_MATCH" | "PARTIAL" | "NOT_FOUND"

export type RequirementLevel = "demonstrated" | "partial" | "not_demonstrated"

export type MatchBand =
  | "NEEDS_ALIGNMENT"
  | "DEVELOPING_MATCH"
  | "STRONG_MATCH"
  | "EXCELLENT_ALIGNMENT"

export type ProvenanceRef = {
  sourceSection: string
  sourceText: string
}

export type ResumeContact = {
  name?: string
  email?: string
  phone?: string
  location?: string
  linkedIn?: string
  website?: string
}

export type ResumeExperience = {
  title: string
  organization: string
  location?: string
  startDate?: string
  endDate?: string
  bullets: string[]
  provenance?: ProvenanceRef[]
}

export type ResumeEducation = {
  degree: string
  institution: string
  location?: string
  graduationDate?: string
  details?: string[]
  provenance?: ProvenanceRef[]
}

export type ResumeSkill = {
  name: string
  category?: string
  provenance?: ProvenanceRef[]
}

export type ResumeProfileData = {
  contactInformation: ResumeContact
  summary?: string
  experience: ResumeExperience[]
  education: ResumeEducation[]
  skills: ResumeSkill[]
  projects: Array<{ name: string; description: string; bullets?: string[]; provenance?: ProvenanceRef[] }>
  certifications: Array<{ name: string; issuer?: string; date?: string; provenance?: ProvenanceRef[] }>
  publications: Array<{ title: string; venue?: string; date?: string; provenance?: ProvenanceRef[] }>
  awards: Array<{ title: string; issuer?: string; date?: string; provenance?: ProvenanceRef[] }>
  volunteerExperience: ResumeExperience[]
  additionalSections: Array<{ heading: string; content: string; provenance?: ProvenanceRef[] }>
}

export type ResumeProfile = {
  id: number
  guestId: number
  isMaster: boolean
  label: string | null
  originalFileName: string | null
  originalFileUrl: string | null
  originalMime: string | null
  profile: ResumeProfileData
  parsedText: string
  contentHash: string | null
  createdAt: string
  updatedAt: string
}

export type OpportunityProfileData = {
  organization: string | null
  title: string
  description: string
  sourceUrl: string | null
  location: string | null
  deadline: string | null
  requiredQualifications: string[]
  preferredQualifications: string[]
  requiredSkills: string[]
  preferredSkills: string[]
  educationRequirements: string[]
  experienceRequirements: string[]
  responsibilities: string[]
  keywords: string[]
  extractedMetadata: Record<string, unknown>
}

export type OpportunityProfile = {
  id: number
  guestId: number
  type: OpportunityType
  organization: string | null
  title: string
  description: string
  sourceUrl: string | null
  location: string | null
  deadline: string | null
  profile: OpportunityProfileData
  contentHash: string | null
  createdAt: string
  updatedAt: string
}

export type MatchDimensionScores = {
  skillsMatch: number
  experienceAlignment: number
  roleTitleAlignment: number
  educationQualifications: number
  keywordCoverage: number
  resumeImpact: number
  atsReadability: number
}

export type SkillEvidenceItem = {
  label: string
  level: MatchEvidenceLevel
  evidence: ProvenanceRef[]
  guidance?: string
  /** Preview tier — label/evidence withheld until unlock */
  locked?: boolean
}

export type RequirementCheckItem = {
  label: string
  level: RequirementLevel
  evidence: ProvenanceRef[]
  guidance?: string
  locked?: boolean
}

export type AtsReadabilityFinding = {
  kind: "pass" | "attention"
  message: string
  locked?: boolean
}

export type AtsReadabilityReport = {
  score: number
  findings: AtsReadabilityFinding[]
}

export type CareerAnalysis = {
  id: number
  guestId: number
  applicationId: number | null
  resumeId: number
  opportunityId: number
  algorithmVersion: string
  weightsVersion: string
  overallScore: number
  matchBand: MatchBand
  dimensionScores: MatchDimensionScores
  summary: string
  topImprovements: string[]
  skillEvidence: {
    matched: SkillEvidenceItem[]
    partial: SkillEvidenceItem[]
    notDemonstrated: SkillEvidenceItem[]
  }
  requirements: RequirementCheckItem[]
  atsReadability: AtsReadabilityReport
  resumeHash: string
  opportunityHash: string
  createdAt: string
}

export type CoverLetter = {
  id: number
  guestId: number
  applicationId: number
  body: string
  tone: string
  status: ArtifactStatus
  createdAt: string
  updatedAt: string
}

export type ApplicationWorkspace = {
  id: number
  guestId: number
  opportunityId: number
  opportunity: OpportunityProfile
  masterResumeId: number | null
  resumeVersionId: number | null
  status: ApplicationStatus
  matchScore: number | null
  matchBand: MatchBand | null
  coverLetterStatus: ArtifactStatus
  interviewPrepStatus: ArtifactStatus
  appliedAt: string | null
  notes: string | null
  latestAnalysisId: number | null
  createdAt: string
  updatedAt: string
}

export type ResumeVersion = {
  id: number
  guestId: number
  masterResumeId: number
  applicationId: number | null
  label: string
  profile: ResumeProfileData
  parsedText: string
  createdAt: string
}
