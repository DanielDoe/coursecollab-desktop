import { type NextRequest, NextResponse } from "next/server"
import { requireGuestCareerAccess } from "@/lib/guest/career/require-career-access"
import { gateGuestAiCredits, chargeGuestAiCredits } from "@/lib/guest/career/guest-ai-credits"
import { runResumeOptimize } from "@/lib/guest/career/optimize-engine"
import {
  analyzeResumeOpportunityMatch,
  createGuestOpportunity,
  getGuestApplication,
  getGuestMasterResume,
} from "@/lib/guest/career/store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const auth = await requireGuestCareerAccess(request, body)
    if (auth instanceof NextResponse) return auth

    const resume = await getGuestMasterResume(auth.guestId)
    if (!resume?.parsedText?.trim()) {
      return NextResponse.json(
        { error: "Upload your résumé first — Cora needs it to optimize.", needsResume: true },
        { status: 400 },
      )
    }

    // Opportunity comes from an existing application or pasted text.
    const applicationId = Number(body.applicationId ?? 0) || null
    let opportunityDescription = String(body.opportunityDescription ?? "").trim()
    let opportunity = null
    let application = null

    if (applicationId) {
      application = await getGuestApplication(auth.guestId, applicationId)
      if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 })
      opportunity = application.opportunity
      opportunityDescription = opportunity.description
    }

    if (opportunityDescription.length < 40) {
      return NextResponse.json(
        { error: "Paste a fuller opportunity description (at least 40 characters)." },
        { status: 400 },
      )
    }

    const creditGate = await gateGuestAiCredits(auth.guestId, "resume_review")
    if (!creditGate.ok) {
      return NextResponse.json(creditGate.body, { status: creditGate.status })
    }

    if (!opportunity) {
      opportunity = await createGuestOpportunity({
        guestId: auth.guestId,
        description: opportunityDescription,
      })
    }

    // Heuristic match analysis (cached when repeated) supplies the gap list.
    const analysis = await analyzeResumeOpportunityMatch({
      guestId: auth.guestId,
      resume,
      opportunity,
      applicationId: application?.id ?? null,
    })

    const result = await runResumeOptimize({
      resumeText: resume.parsedText,
      opportunityDescription,
      analysis,
    })

    const billing = await chargeGuestAiCredits(
      auth.guestId,
      "resume_review",
      `Résumé optimize: ${opportunity.title || "opportunity"}`,
    )

    return NextResponse.json({
      result,
      analysisId: analysis.id,
      applicationId: application?.id ?? analysis.applicationId,
      opportunityTitle: opportunity.title,
      organization: opportunity.organization,
      matchScore: analysis.overallScore,
      creditsCharged: billing.creditsCharged,
      creditsRemaining: billing.creditsRemaining,
    })
  } catch (e) {
    console.error("[guest/career/optimize POST]", e)
    const message = e instanceof Error ? e.message : "Résumé optimization failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
