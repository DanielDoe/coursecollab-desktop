import { type NextRequest, NextResponse } from "next/server"
import type { CoverLetterTone, OpportunityType } from "@/lib/guest/career/types"
import { careerAccessMeta, gateCoverLetterBody } from "@/lib/guest/career/preview-gate"
import { requireGuestCareerGuest } from "@/lib/guest/career/require-career-access"
import {
  generateGuestCoverLetter,
  getGuestApplication,
  getGuestCoverLetter,
  getGuestMasterResume,
} from "@/lib/guest/career/store"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function GET(request: NextRequest) {
  try {
    const auth = await requireGuestCareerGuest(request)
    if (auth instanceof NextResponse) return auth

    const applicationId = Number(new URL(request.url).searchParams.get("applicationId") ?? "")
    if (!Number.isFinite(applicationId) || applicationId <= 0) {
      return NextResponse.json({ error: "applicationId required" }, { status: 400 })
    }

    const application = await getGuestApplication(auth.guestId, applicationId)
    if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const coverLetter = await getGuestCoverLetter(auth.guestId, applicationId)
    if (!coverLetter) {
      return NextResponse.json({ application, coverLetter: null, ...careerAccessMeta(auth.accessTier) })
    }

    const gated = gateCoverLetterBody(coverLetter.body, auth.accessTier)
    return NextResponse.json({
      ...careerAccessMeta(auth.accessTier),
      application,
      coverLetter: {
        ...coverLetter,
        body: gated.body,
        lockedParagraphCount: gated.lockedParagraphCount,
        totalParagraphCount: gated.totalParagraphCount,
      },
    })
  } catch (e) {
    console.error("[guest/career/cover-letter GET]", e)
    return NextResponse.json({ error: "Failed to load cover letter" }, { status: 500 })
  }
}

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

    let parsedText = String(body.parsedText ?? body.resumeText ?? "").trim()
    if (!parsedText) {
      // Fall back to the stored master résumé (uploaded file, text already extracted).
      const master = await getGuestMasterResume(auth.guestId)
      parsedText = master?.parsedText?.trim() ?? ""
    }
    if (!parsedText) {
      return NextResponse.json(
        { error: "Upload or paste your résumé before generating.", needsResume: true },
        { status: 400 },
      )
    }

    const tone = (body.tone === "warm" ? "warm" : "professional") as CoverLetterTone
    const result = await generateGuestCoverLetter({
      guestId: auth.guestId,
      parsedText,
      opportunityDescription,
      opportunityType: body.opportunityType as OpportunityType | undefined,
      organization: body.organization ? String(body.organization) : null,
      opportunityTitle: body.opportunityTitle ? String(body.opportunityTitle) : null,
      tone,
    })

    const gated = gateCoverLetterBody(result.coverLetter.body, auth.accessTier)
    return NextResponse.json({
      ...careerAccessMeta(auth.accessTier),
      application: result.application,
      resume: result.resume,
      opportunity: result.opportunity,
      coverLetter: {
        ...result.coverLetter,
        body: gated.body,
        lockedParagraphCount: gated.lockedParagraphCount,
        totalParagraphCount: gated.totalParagraphCount,
      },
    })
  } catch (e) {
    console.error("[guest/career/cover-letter POST]", e)
    return NextResponse.json({ error: "Cover letter generation failed" }, { status: 500 })
  }
}
