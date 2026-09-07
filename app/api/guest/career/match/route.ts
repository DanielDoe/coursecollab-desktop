import { type NextRequest, NextResponse } from "next/server"
import type { OpportunityType } from "@/lib/guest/career/types"
import { careerAccessMeta, gateCareerAnalysis, careerAnalysisIssueCounts } from "@/lib/guest/career/preview-gate"
import { requireGuestCareerGuest } from "@/lib/guest/career/require-career-access"
import {
  analyzeResumeOpportunityMatch,
  createGuestOpportunity,
  ensureApplicationWorkspace,
  findCachedAnalysis,
  getGuestMasterResume,
  upsertGuestMasterResume,
} from "@/lib/guest/career/store"
import { hashCareerContent } from "@/lib/guest/career/hash-content"
import { complimentaryMatchMeta } from "@/lib/guest/career/complimentary-matches"
import { GUEST_RESUME_MATCH_CREDIT_COST } from "@/lib/guest/career/match-config"
import {
  gateGuestResumeMatchBilling,
  settleGuestResumeMatchBilling,
} from "@/lib/guest/career/resume-match-billing"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await requireGuestCareerGuest(request, body)
    if (auth instanceof NextResponse) return auth

    const opportunityDescription = String(body.opportunityDescription ?? body.description ?? "").trim()
    if (opportunityDescription.length < 40) {
      return NextResponse.json(
        { error: "Paste a fuller opportunity description (at least 40 characters)." },
        { status: 400 },
      )
    }

    let resume = body.resumeId ? null : await getGuestMasterResume(auth.guestId)

    const parsedText = String(body.parsedText ?? body.resumeText ?? "").trim()
    const useMasterResume = body.useMasterResume === true || body.use_master_resume === true

    if (parsedText) {
      resume = await upsertGuestMasterResume({
        guestId: auth.guestId,
        parsedText,
        label: body.resumeLabel ? String(body.resumeLabel) : undefined,
      })
    } else if (!resume && useMasterResume) {
      resume = await getGuestMasterResume(auth.guestId)
    } else if (!resume) {
      resume = await getGuestMasterResume(auth.guestId)
    }

    if (!resume) {
      return NextResponse.json(
        { error: "Upload or paste your résumé before analyzing.", needsResume: true },
        { status: 400 },
      )
    }

    const opportunity = await createGuestOpportunity({
      guestId: auth.guestId,
      type: (body.opportunityType as OpportunityType | undefined) ?? "JOB",
      description: opportunityDescription,
      organization: body.organization ? String(body.organization) : null,
      title: body.opportunityTitle ? String(body.opportunityTitle) : null,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
      location: body.location ? String(body.location) : null,
      deadline: body.deadline ? String(body.deadline) : null,
    })

    const resumeHash = resume.contentHash ?? hashCareerContent(resume.parsedText)
    const opportunityHash =
      opportunity.contentHash ?? hashCareerContent(opportunity.description)
    const cachedAnalysis = await findCachedAnalysis({
      guestId: auth.guestId,
      resumeHash,
      opportunityHash,
    })

    const billingGate = await gateGuestResumeMatchBilling({
      guestId: auth.guestId,
      hasFullAccess: auth.hasFullAccess,
      isCached: Boolean(cachedAnalysis),
    })
    if (!billingGate.allowed) {
      return NextResponse.json(billingGate.body, { status: billingGate.status })
    }

    const application = await ensureApplicationWorkspace({
      guestId: auth.guestId,
      opportunityId: opportunity.id,
      masterResumeId: resume.id,
      status: "PREPARING",
    })

    const analysis = await analyzeResumeOpportunityMatch({
      guestId: auth.guestId,
      resume,
      opportunity,
      applicationId: application.id,
    })

    const billing = await settleGuestResumeMatchBilling({
      guestId: auth.guestId,
      mode: billingGate.mode,
    })

    const gated = gateCareerAnalysis(analysis, auth.accessTier)

    return NextResponse.json({
      ...careerAccessMeta(auth.accessTier),
      ...(billing.complimentary ? complimentaryMatchMeta(billing.complimentary) : {}),
      resumeMatchCreditCost: auth.hasFullAccess ? GUEST_RESUME_MATCH_CREDIT_COST : undefined,
      creditsCharged: billing.creditsCharged,
      creditsRemaining: billing.creditsRemaining,
      fromCache: Boolean(cachedAnalysis),
      issueCounts: careerAnalysisIssueCounts(analysis),
      application: {
        ...application,
        matchScore: analysis.overallScore,
        matchBand: analysis.matchBand,
        latestAnalysisId: analysis.id,
      },
      analysis: gated,
      resume,
      opportunity,
    })
  } catch (e) {
    console.error("[guest/career/match POST]", e)
    return NextResponse.json({ error: "Match analysis failed" }, { status: 500 })
  }
}
