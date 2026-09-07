import { type NextRequest, NextResponse } from "next/server"
import { canManageResearchStudies, requireInstitutionAdmin } from "@/lib/institutions/auth"
import { upsertResearchInstrument } from "@/lib/institutions/research/pre-post-gain"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  if (!canManageResearchStudies(auth.session.role)) {
    return NextResponse.json({ error: "Research configuration access denied" }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    studyId?: number
    preQuizId?: number
    postQuizId?: number
    preLabel?: string
    postLabel?: string
    maxScore?: number
  }

  const studyId = Number(body.studyId)
  const preQuizId = Number(body.preQuizId)
  const postQuizId = Number(body.postQuizId)
  if (!Number.isFinite(studyId) || studyId <= 0) {
    return NextResponse.json({ error: "studyId is required" }, { status: 400 })
  }
  if (!Number.isFinite(preQuizId) || !Number.isFinite(postQuizId)) {
    return NextResponse.json({ error: "preQuizId and postQuizId are required" }, { status: 400 })
  }

  await upsertResearchInstrument({
    institutionId: auth.session.institutionId,
    studyId,
    instrumentRole: "pre",
    quizId: preQuizId,
    label: body.preLabel?.trim() || "Pre instrument",
    maxScore: body.maxScore,
  })
  await upsertResearchInstrument({
    institutionId: auth.session.institutionId,
    studyId,
    instrumentRole: "post",
    quizId: postQuizId,
    label: body.postLabel?.trim() || "Post instrument",
    maxScore: body.maxScore,
  })

  return NextResponse.json({ success: true })
}
