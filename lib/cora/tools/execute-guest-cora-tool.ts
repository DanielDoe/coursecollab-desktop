import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import type { GuestCoraToolName } from "@/lib/cora/tools/guest-tool-definitions"
import type { GuestCapability } from "@/lib/guest/types"
import {
  generateAndStoreRecommendationBrief,
  getRecommendationBrief,
  upsertRecommendationBriefFields,
} from "@/lib/recommendation-brief-store"
import type { ProfileBundle } from "@/lib/recommendation-letters-ai"
import { purposeLabel } from "@/lib/recommendation-letters-shared"
import { getGuestCoraBalance } from "@/lib/guest/cora-credit-ledger"
import { resolveGuestCapabilities } from "@/lib/guest/entitlements"
import { guestHasCapability } from "@/lib/guest/capabilities"
import {
  analyzeResumeOpportunityMatch,
  createGuestOpportunity,
  ensureApplicationWorkspace,
  findCachedAnalysis,
  generateGuestCoverLetter,
  getGuestApplication,
  getGuestCoverLetter,
  getGuestMasterResume,
  listGuestApplications,
  upsertGuestMasterResume,
} from "@/lib/guest/career/store"
import {
  getGuestContextForCora,
  upsertGuestCoraProfile,
} from "@/lib/cora/fetch-guest-context"
import {
  chargeGuestAiCredits,
  requireGuestAiCreditsOrThrow,
} from "@/lib/guest/career/guest-ai-credits"
import type { GuestCareerAiFeature } from "@/lib/guest/career/guest-ai-credit-costs"
import {
  gateGuestResumeMatchBilling,
  settleGuestResumeMatchBilling,
} from "@/lib/guest/career/resume-match-billing"
import { hashCareerContent } from "@/lib/guest/career/hash-content"
import {
  gateCareerAnalysis,
  gateCoverLetterBody,
  careerAnalysisIssueCounts,
} from "@/lib/guest/career/preview-gate"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

async function runGuestCareerAiTool<T>(
  guestId: number,
  feature: GuestCareerAiFeature,
  run: () => Promise<T>,
): Promise<T> {
  await requireGuestAiCreditsOrThrow(guestId, feature)
  const result = await run()
  await chargeGuestAiCredits(guestId, feature)
  return result
}

export type GuestCoraToolActor = {
  guestId: number
  capabilities: readonly GuestCapability[]
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

async function assertOwnRequest(guestId: number, requestId: number) {
  const rows = await sql`
    SELECT 1 FROM recommendation_requests
    WHERE id = ${requestId} AND student_id = ${guestId}
    LIMIT 1
  `
  if (rows.length === 0) throw new Error("Recommendation request not found")
}

async function loadRequestContext(guestId: number, requestId: number) {
  await assertOwnRequest(guestId, requestId)
  const rows = sqlRows<Record<string, unknown>>(
    await sql`
      SELECT r.*, s.full_name AS student_full_name, i.name AS instructor_name,
        sess.code AS course_code, sess.description AS course_description
      FROM recommendation_requests r
      JOIN students s ON s.id = r.student_id
      JOIN instructors i ON i.id = r.instructor_id
      JOIN sessions sess ON sess.id = r.course_id
      WHERE r.id = ${requestId} AND r.student_id = ${guestId}
      LIMIT 1
    `,
  )
  if (!rows[0]) throw new Error("Recommendation request not found")
  return rows[0]
}

async function loadProfile(requestId: number): Promise<ProfileBundle> {
  const profRows = sqlRows(await sql`SELECT * FROM recommendation_profiles WHERE request_id = ${requestId} LIMIT 1`)
  if (profRows.length === 0) throw new Error("Complete your questionnaire before using this tool.")
  return profRows[0] as ProfileBundle
}

async function loadAttachments(requestId: number) {
  return sqlRows<{ file_type: string; file_name: string | null; file_url: string }>(
    await sql`
      SELECT file_type, file_name, file_url
      FROM recommendation_attachments
      WHERE request_id = ${requestId}
    `,
  )
}

function requireCapability(actor: GuestCoraToolActor, cap: GuestCapability) {
  if (!guestHasCapability(actor.capabilities, cap)) {
    throw new Error("This tool requires Cora Career.")
  }
}

function guestAccessTier(actor: GuestCoraToolActor) {
  return guestHasCapability(actor.capabilities, "career.cora") ? "full" : "preview"
}

async function executeGuestCoraToolImpl(
  toolName: GuestCoraToolName,
  args: Record<string, unknown>,
  actor: GuestCoraToolActor,
): Promise<string> {
  const guestId = actor.guestId

  switch (toolName) {
    case "get_guest_career_context": {
      const ctx = await getGuestContextForCora(guestId)
      return JSON.stringify(ctx)
    }

    case "refresh_guest_career_context": {
      const ctx = await getGuestContextForCora(guestId)
      return JSON.stringify({ ok: true, syncedAt: ctx.syncedAt, summary: ctx.summary })
    }

    case "update_guest_career_profile": {
      const existing = await getGuestContextForCora(guestId)
      const notes = { ...existing.careerProfile.coraNotes }
      if (args.note_key && args.note_value) {
        notes[String(args.note_key)] = String(args.note_value)
      }
      const updated = await upsertGuestCoraProfile(guestId, {
        goals: args.goals != null ? String(args.goals) : undefined,
        careerSummary: args.career_summary != null ? String(args.career_summary) : undefined,
        targetRoles: Array.isArray(args.target_roles) ? args.target_roles.map(String) : undefined,
        focusTopics: Array.isArray(args.focus_topics) ? args.focus_topics.map(String) : undefined,
        coraNotes: Object.keys(notes).length ? notes : undefined,
      })
      return JSON.stringify({ ok: true, careerProfile: updated })
    }

    case "list_guest_applications": {
      const limit = clamp(Number(args.limit ?? 10), 1, 20)
      const apps = await listGuestApplications(guestId)
      return JSON.stringify(
        apps.slice(0, limit).map((a) => ({
          id: a.id,
          title: a.opportunity.title,
          organization: a.opportunity.organization,
          status: a.status,
          matchScore: a.matchScore,
          matchBand: a.matchBand,
          coverLetterStatus: a.coverLetterStatus,
          updatedAt: a.updatedAt,
        })),
      )
    }

    case "get_guest_application_detail": {
      const applicationId = Number(args.application_id)
      const app = await getGuestApplication(guestId, applicationId)
      if (!app) throw new Error("Application not found")
      return JSON.stringify({
        id: app.id,
        status: app.status,
        matchScore: app.matchScore,
        matchBand: app.matchBand,
        coverLetterStatus: app.coverLetterStatus,
        interviewPrepStatus: app.interviewPrepStatus,
        opportunity: {
          title: app.opportunity.title,
          organization: app.opportunity.organization,
          descriptionPreview: app.opportunity.description.slice(0, 1200),
        },
      })
    }

    case "get_guest_master_resume": {
      const resume = await getGuestMasterResume(guestId)
      if (!resume) return JSON.stringify({ hasResume: false })
      const maxChars = clamp(Number(args.max_chars ?? 4000), 500, 12000)
      return JSON.stringify({
        hasResume: true,
        label: resume.label,
        updatedAt: resume.updatedAt,
        skillCount: resume.profile.skills.length,
        experienceCount: resume.profile.experience.length,
        parsedText: resume.parsedText.slice(0, maxChars),
        profile: resume.profile,
      })
    }

    case "get_guest_cover_letter": {
      const applicationId = Number(args.application_id)
      const app = await getGuestApplication(guestId, applicationId)
      if (!app) throw new Error("Application not found")
      const letter = await getGuestCoverLetter(guestId, applicationId)
      if (!letter) return JSON.stringify({ hasCoverLetter: false, applicationId })
      const tier = guestAccessTier(actor)
      const gated = gateCoverLetterBody(letter.body, tier)
      return JSON.stringify({
        hasCoverLetter: true,
        applicationId,
        tone: letter.tone,
        status: letter.status,
        body: gated.body,
        lockedParagraphCount: gated.lockedParagraphCount,
        preview: tier === "preview",
      })
    }

    case "run_guest_resume_match": {
      const opportunityDescription = String(args.opportunity_description ?? "").trim()
      if (opportunityDescription.length < 40) {
        throw new Error("Provide an opportunity description (40+ chars).")
      }
      let resume
      const pastedText = String(args.parsed_text ?? "").trim()
      if (pastedText.length >= 40) {
        resume = await upsertGuestMasterResume({ guestId, parsedText: pastedText })
      } else {
        resume = await getGuestMasterResume(guestId)
        if (!resume?.parsedText || resume.parsedText.length < 40) {
          throw new Error(
            "No master résumé on file. Ask the user to upload one in Settings → Cora or paste résumé text.",
          )
        }
      }
      const opportunity = await createGuestOpportunity({
        guestId,
        description: opportunityDescription,
      })
      const resumeHash = resume.contentHash ?? hashCareerContent(resume.parsedText)
      const opportunityHash =
        opportunity.contentHash ?? hashCareerContent(opportunity.description)
      const cachedAnalysis = await findCachedAnalysis({
        guestId,
        resumeHash,
        opportunityHash,
      })
      const hasFullAccess = guestHasCapability(actor.capabilities, "career.cora")
      const billingGate = await gateGuestResumeMatchBilling({
        guestId,
        hasFullAccess,
        isCached: Boolean(cachedAnalysis),
      })
      if (!billingGate.allowed) {
        throw new Error(String(billingGate.body.error ?? "Resume Match not available"))
      }
      const application = await ensureApplicationWorkspace({
        guestId,
        opportunityId: opportunity.id,
        masterResumeId: resume.id,
        status: "PREPARING",
      })
      const analysis = await analyzeResumeOpportunityMatch({
        guestId,
        resume,
        opportunity,
        applicationId: application.id,
      })
      await settleGuestResumeMatchBilling({ guestId, mode: billingGate.mode })
      const tier = guestAccessTier(actor)
      return JSON.stringify({
        applicationId: application.id,
        matchScore: analysis.overallScore,
        matchBand: analysis.matchBand,
        summary: analysis.summary,
        issueCounts: careerAnalysisIssueCounts(analysis),
        analysis: gateCareerAnalysis(analysis, tier),
        preview: tier === "preview",
        fromCache: Boolean(cachedAnalysis),
      })
    }

    case "generate_guest_cover_letter": {
      const opportunityDescription = String(args.opportunity_description ?? "").trim()
      if (opportunityDescription.length < 40) {
        throw new Error("Provide an opportunity description (40+ chars).")
      }
      const pastedText = String(args.parsed_text ?? "").trim()
      let parsedText = pastedText
      if (parsedText.length >= 40) {
        await upsertGuestMasterResume({ guestId, parsedText })
      } else {
        const master = await getGuestMasterResume(guestId)
        parsedText = master?.parsedText?.trim() ?? ""
        if (parsedText.length < 40) {
          throw new Error(
            "No master résumé on file. Ask the user to upload one in Settings → Cora or paste résumé text.",
          )
        }
      }
      const tone = args.tone === "warm" ? "warm" : "professional"
      const result = await generateGuestCoverLetter({
        guestId,
        parsedText,
        opportunityDescription,
        tone: tone as "professional" | "warm",
      })
      const tier = guestAccessTier(actor)
      const gated = gateCoverLetterBody(result.coverLetter.body, tier)
      return JSON.stringify({
        applicationId: result.application.id,
        tone: result.coverLetter.tone,
        body: gated.body,
        lockedParagraphCount: gated.lockedParagraphCount,
        preview: tier === "preview",
      })
    }

    case "get_guest_profile": {
      const ent = await resolveGuestCapabilities(guestId)
      const bal = await getGuestCoraBalance(guestId)
      const profileRows = await sql`
        SELECT full_name, guest_organization, guest_access_purpose
        FROM students WHERE id = ${guestId} LIMIT 1
      `
      const p = profileRows[0] as { full_name: string; guest_organization: string | null; guest_access_purpose: string | null } | undefined
      return JSON.stringify({
        fullName: p?.full_name ?? "Guest",
        organization: p?.guest_organization ?? "",
        onboardingPurpose: p?.guest_access_purpose ?? "",
        plan: ent.plan,
        capabilities: ent.capabilities,
        coraCredits: bal.available,
      })
    }

    case "list_guest_recommendations": {
      const limit = clamp(Number(args.limit ?? 10), 1, 20)
      const rows = sqlRows<Record<string, unknown>>(
        await sql`
          SELECT r.id, r.status, r.purpose, r.deadline, r.updated_at, i.name AS instructor_name
          FROM recommendation_requests r
          JOIN instructors i ON i.id = r.instructor_id
          WHERE r.student_id = ${guestId}
          ORDER BY r.updated_at DESC
          LIMIT ${limit}
        `,
      )
      return JSON.stringify(
        rows.map((r) => ({
          id: Number(r.id),
          status: String(r.status),
          purpose: purposeLabel(String(r.purpose)),
          deadline: r.deadline ? String(r.deadline) : null,
          instructorName: String(r.instructor_name ?? ""),
          updatedAt: String(r.updated_at ?? ""),
        })),
      )
    }

    case "get_guest_recommendation_detail": {
      const requestId = Number(args.request_id)
      const row = await loadRequestContext(guestId, requestId)
      const profile = sqlRows(await sql`SELECT * FROM recommendation_profiles WHERE request_id = ${requestId} LIMIT 1`)
      return JSON.stringify({
        id: requestId,
        status: String(row.status),
        purpose: purposeLabel(String(row.purpose)),
        deadline: row.deadline ? String(row.deadline) : null,
        instructorName: String(row.instructor_name ?? ""),
        deliveryMethod: row.delivery_method ?? "student_download",
        questionnaireComplete: profile.length > 0,
      })
    }

    case "list_guest_recommendation_attachments": {
      const requestId = Number(args.request_id)
      await assertOwnRequest(guestId, requestId)
      const attachments = await loadAttachments(requestId)
      return JSON.stringify(
        attachments.map((a) => ({
          fileType: a.file_type,
          fileName: a.file_name,
          uploaded: true,
        })),
      )
    }

    case "get_guest_recommendation_brief": {
      const requestId = Number(args.request_id)
      await assertOwnRequest(guestId, requestId)
      const brief = await getRecommendationBrief(requestId)
      return JSON.stringify(brief ?? { brief_markdown: "", generated_at: null })
    }

    case "save_guest_recommendation_brief_fields": {
      if (!guestHasCapability(actor.capabilities, "cora.generateRecommendationBrief")) {
        throw new Error("Recommendation brief is not enabled for this account.")
      }
      const requestId = Number(args.request_id)
      await assertOwnRequest(guestId, requestId)
      const brief = await upsertRecommendationBriefFields(requestId, {
        opportunityTitle: args.opportunity_title != null ? String(args.opportunity_title) : undefined,
        programName: args.program_name != null ? String(args.program_name) : undefined,
        highlightTopics: args.highlight_topics != null ? String(args.highlight_topics) : undefined,
        relationshipContext: args.relationship_context != null ? String(args.relationship_context) : undefined,
      })
      return JSON.stringify({ ok: true, brief })
    }

    case "generate_guest_recommendation_brief": {
      if (!guestHasCapability(actor.capabilities, "cora.generateRecommendationBrief")) {
        throw new Error("Recommendation brief is not enabled for this account.")
      }
      const requestId = Number(args.request_id)
      const reqRow = await loadRequestContext(guestId, requestId)
      const st = String(reqRow.status)
      if (["rejected", "withdrawn", "finalized", "downloaded", "delivered"].includes(st)) {
        throw new Error("Brief cannot be updated in this status.")
      }
      const profile = await loadProfile(requestId)
      const attachments = await loadAttachments(requestId)
      const brief = await generateAndStoreRecommendationBrief({
        requestId,
        studentName: String(reqRow.student_full_name ?? "Guest"),
        purpose: String(reqRow.purpose),
        deadline: reqRow.deadline ? String(reqRow.deadline) : null,
        instructorName: String(reqRow.instructor_name ?? "Faculty"),
        courseLabel: `${reqRow.course_code ?? ""} ${reqRow.course_description ?? ""}`.trim(),
        profile,
        attachments,
        fields: {
          opportunityTitle: args.opportunity_title != null ? String(args.opportunity_title) : undefined,
          programName: args.program_name != null ? String(args.program_name) : undefined,
          highlightTopics: args.highlight_topics != null ? String(args.highlight_topics) : undefined,
          relationshipContext: args.relationship_context != null ? String(args.relationship_context) : undefined,
        },
      })
      return JSON.stringify({
        ok: true,
        brief_markdown: brief.brief_markdown,
        generated_at: brief.generated_at,
        model: brief.ai_model,
      })
    }

    case "review_guest_resume": {
      requireCapability(actor, "cora.reviewResume")
      const requestId = Number(args.request_id)
      await assertOwnRequest(guestId, requestId)
      const attachments = await loadAttachments(requestId)
      const resume = attachments.find((a) => /resume|cv|curriculum/i.test(`${a.file_type} ${a.file_name ?? ""}`))
      if (!resume) throw new Error("Upload a résumé or CV on your recommendation request first.")
      const profile = await loadProfile(requestId).catch(() => null)
      if (!openai) throw new Error("AI is not configured")

      const profileBlock = profile
        ? [
            (profile as ProfileBundle).student_strengths && `Strengths: ${(profile as ProfileBundle).student_strengths}`,
            (profile as ProfileBundle).achievements && `Achievements: ${(profile as ProfileBundle).achievements}`,
            (profile as ProfileBundle).projects && `Projects: ${(profile as ProfileBundle).projects}`,
            (profile as ProfileBundle).skills && `Skills: ${(profile as ProfileBundle).skills}`,
            (profile as ProfileBundle).goals && `Goals: ${(profile as ProfileBundle).goals}`,
          ]
            .filter(Boolean)
            .join("\n")
        : ""

      const { content } = await runGuestCareerAiTool(guestId, "resume_review", () =>
        createForFeature(openai, "content_tools", {
          messages: [
            {
              role: "system",
              content:
                "You review résumés/CVs for graduate school, internship, and job applications. Be specific and actionable. Base feedback on provided questionnaire details and uploaded file metadata — do not invent experience.",
            },
            {
              role: "user",
              content: [
                `Focus: ${args.focus ? String(args.focus) : "general improvement"}`,
                `Uploaded file: ${resume.file_name ?? resume.file_type}`,
                profileBlock ? `Questionnaire / background:\n${profileBlock}` : "",
                "Provide structured feedback: summary, strengths, gaps, and 5 concrete improvements.",
              ]
                .filter(Boolean)
                .join("\n\n"),
            },
          ],
          temperature: 0.4,
          max_tokens: 1800,
        }),
      )
      return JSON.stringify({ review: content })
    }

    case "prepare_guest_interview": {
      requireCapability(actor, "cora.prepareInterview")
      const requestId = Number(args.request_id)
      const reqRow = await loadRequestContext(guestId, requestId)
      const profile = await loadProfile(requestId).catch(() => null)
      const attachments = await loadAttachments(requestId)
      const hasResume = attachments.some((a) => /resume|cv/i.test(`${a.file_type} ${a.file_name ?? ""}`))
      if (!openai) throw new Error("AI is not configured")

      const { content } = await runGuestCareerAiTool(guestId, "interview_prep", () =>
        createForFeature(openai, "tutor", {
          messages: [
            {
              role: "system",
              content:
                "Create structured interview preparation: company/program context, talking points, likely questions, and 5 practice questions with guidance. Use only provided materials.",
            },
            {
              role: "user",
              content: [
                `Company/program: ${args.company_or_program ?? "Not specified"}`,
                `Role/degree: ${args.role_or_degree ?? purposeLabel(String(reqRow.purpose))}`,
                `Interview date: ${args.interview_date ?? "Not specified"}`,
                args.job_description ? `Description:\n${String(args.job_description).slice(0, 4000)}` : "",
                profile ? `Questionnaire strengths: ${(profile as ProfileBundle).student_strengths ?? ""}` : "",
                hasResume ? "Résumé/CV is uploaded on this request." : "",
              ]
                .filter(Boolean)
                .join("\n\n"),
          },
        ],
        temperature: 0.5,
        max_tokens: 2200,
      }),
      )
      return JSON.stringify({ interviewPrep: content })
    }

    case "draft_guest_statement": {
      requireCapability(actor, "cora.helpApplication")
      const requestId = Number(args.request_id)
      const reqRow = await loadRequestContext(guestId, requestId)
      const profile = await loadProfile(requestId).catch(() => null)
      if (!openai) throw new Error("AI is not configured")

      const { content } = await runGuestCareerAiTool(guestId, "statement_draft", () =>
        createForFeature(openai, "content_tools", {
          messages: [
            {
              role: "system",
              content:
                "Help draft or improve application essays. Output structured sections and suggested prose the student can edit. Never fabricate credentials.",
            },
            {
              role: "user",
              content: [
                `Statement type: ${String(args.statement_type ?? "personal_statement")}`,
                `Purpose: ${purposeLabel(String(reqRow.purpose))}`,
                args.prompt ? `Requirements/direction:\n${String(args.prompt)}` : "",
                profile
                  ? `Background:\n${[
                      (profile as ProfileBundle).goals,
                      (profile as ProfileBundle).achievements,
                      (profile as ProfileBundle).student_strengths,
                    ]
                      .filter(Boolean)
                      .join("\n")}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n\n"),
            },
          ],
          temperature: 0.55,
          max_tokens: 2400,
        }),
      )
      return JSON.stringify({ statementDraft: content })
    }

    case "propose_guest_application_plan": {
      requireCapability(actor, "career.application")
      if (!openai) throw new Error("AI is not configured")
      const { content } = await runGuestCareerAiTool(guestId, "application_plan", () =>
        createForFeature(openai, "summary", {
          messages: [
            {
              role: "system",
              content:
                "Build a markdown application plan with checklist tasks, timeline working backward from deadline, and priority order.",
            },
            {
              role: "user",
              content: [
                `Opportunity: ${String(args.title ?? "Application")}`,
                args.deadline ? `Deadline: ${String(args.deadline)}` : "",
                `Type: ${String(args.opportunity_type ?? "other")}`,
                args.notes ? `Notes:\n${String(args.notes)}` : "",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
          temperature: 0.4,
          max_tokens: 1600,
        }),
      )
      return JSON.stringify({ applicationPlan: content })
    }

    default:
      throw new Error(`Unknown guest tool: ${toolName}`)
  }
}

export async function executeGuestCoraTool(
  toolName: GuestCoraToolName,
  args: Record<string, unknown>,
  actor: GuestCoraToolActor,
): Promise<string> {
  const { sanitizeCoraToolResult } = await import("@/lib/cora/disclosure/sanitize-tool-result")
  try {
    return sanitizeCoraToolResult(await executeGuestCoraToolImpl(toolName, args, actor), {
      toolName,
    })
  } catch (error) {
    return sanitizeCoraToolResult("", { toolName, error })
  }
}
