/**
 * AI grading for multi-part circuit questions — uploaded worked solutions.
 * Expert Circuit Theory Instructor persona with vision (diagram + student uploads).
 */

import { parseCircuitSpec } from "@/lib/engineering-circuit-types"
import {
  getGradableSubquestions,
  gradeSubPart,
  parseMultiPartStudentAnswer,
  parseSubquestions,
  subquestionOptionLabels,
} from "@/lib/multi-part-question"
import { hasActiveQuestionMedia, resolveQuestionMedia } from "@/lib/question-media"
import {
  getSolutionUploadAttachmentsForPart,
  type SolutionUploadsMap,
} from "@/lib/solution-upload"
import {
  SOLUTION_UPLOAD_PART_KEY,
  uploadPointsFromRubricPercent,
} from "@/lib/multi-part-grading-policy"
import { resolveVisionAssetDataUrls, resolveVisionImageDataUrl } from "@/lib/vision-image-for-ai"
import { parseAiJsonResponse } from "@/lib/parse-ai-json-response"
import { formatCanonicalReferenceAnswerForPrompt, resolveReferenceAnswerForAiGrading } from "@/lib/resolve-reference-answer-for-ai"
import { resolveAiModel, resolveApiFallbackForModel, type AiModelSettings } from "@/lib/resolve-ai-model"
import { callVisionModelWithFallback } from "@/lib/ai-vision-chat"
import { isAnthropicApiKeyConfigured } from "@/lib/ai-env"

export type MultiPartSolutionAiResult = {
  uploadPointsEarned: number
  uploadScorePercent: number
  feedback: string
  strengths: string[]
  improvements: string[]
  partNotes: { partId: string; notes: string }[]
  confidence: "high" | "medium" | "low"
  canAutoGrade: boolean
  requiresManualReview: boolean
  aiGraded: boolean
  errorType?: string
  technicalError?: string
}

export type EvaluateMultiPartSolutionParams = {
  questionText: string
  subquestionsRaw: unknown
  questionMedia?: unknown
  circuitSpec?: unknown
  studentAnswer: unknown
  solutionUploads: SolutionUploadsMap
  uploadMaxPoints: number
  mcqEarned: number
  mcqMaxPoints: number
  aiEvaluationMode?: string
  sampleAnswer?: string | null
  expectedAnswer?: string | null
  answerGuidelines?: string | null
  aiModel?: string | null
  aiModelByTask?: unknown
  aiEnableOpusFallback?: boolean | null
  aiOpusConfidenceThreshold?: number | null
}

const LOG = "[Multi-Part Solution AI]"

function isGradableUploadMime(mime: string, name: string): boolean {
  const m = (mime || "").toLowerCase()
  if (m.startsWith("image/") || m.includes("pdf")) return true
  const lower = (name || "").toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|heic|pdf)$/i.test(lower)
}

async function collectVisionDataUrls(
  diagramUrl: string | null | undefined,
  uploads: SolutionUploadsMap,
): Promise<{ dataUrl: string; label: string }[]> {
  const out: { dataUrl: string; label: string }[] = []
  if (diagramUrl) {
    const dataUrl = await resolveVisionImageDataUrl(diagramUrl)
    if (dataUrl) out.push({ dataUrl, label: "Circuit diagram (question)" })
  }
  const mainUploads = getSolutionUploadAttachmentsForPart(uploads, SOLUTION_UPLOAD_PART_KEY)
  if (mainUploads.length > 0) {
    for (let i = 0; i < mainUploads.length; i++) {
      const att = mainUploads[i]
      if (!att?.url || !isGradableUploadMime(att.mime, att.name)) continue
      const dataUrls = await resolveVisionAssetDataUrls(att.url, {
        mime: att.mime,
        name: att.name,
      })
      for (let p = 0; p < dataUrls.length; p++) {
        const pageSuffix =
          dataUrls.length > 1 ? ` (page ${p + 1} of ${dataUrls.length})` : ""
        const fileSuffix =
          mainUploads.length > 1 ? `, file ${i + 1}` : ""
        out.push({
          dataUrl: dataUrls[p],
          label: `Student worked solution${fileSuffix}${pageSuffix}`,
        })
      }
    }
  }
  for (const [key, att] of Object.entries(uploads)) {
    if (
      key === SOLUTION_UPLOAD_PART_KEY ||
      key.startsWith(`${SOLUTION_UPLOAD_PART_KEY}_`)
    ) {
      continue
    }
    if (!att?.url || !isGradableUploadMime(att.mime, att.name)) continue
    const dataUrls = await resolveVisionAssetDataUrls(att.url, {
      mime: att.mime,
      name: att.name,
    })
    for (let p = 0; p < dataUrls.length; p++) {
      const pageSuffix = dataUrls.length > 1 ? ` (page ${p + 1})` : ""
      out.push({
        dataUrl: dataUrls[p],
        label: `Student solution (${key})${pageSuffix}`,
      })
    }
  }
  return out
}

function buildMcqSummary(subquestionsRaw: unknown, studentAnswer: unknown): string {
  const subs = getGradableSubquestions(subquestionsRaw)
  const parsed = parseMultiPartStudentAnswer(studentAnswer, parseSubquestions(subquestionsRaw))
  const lines: string[] = []
  for (const sq of subs) {
    const labels = subquestionOptionLabels(sq)
    const submitted = parsed.parts[sq.id]
    const { fraction, isFullyCorrect } = gradeSubPart(sq, submitted)
    const correct =
      sq.type === "select_all"
        ? (sq.correct_answers ?? []).join(", ")
        : sq.correct_answer ?? "N/A"
    const subText =
      sq.type === "select_all" && Array.isArray(submitted)
        ? submitted.join(", ")
        : String(submitted ?? "(no answer)")
    lines.push(
      `Part ${sq.id}: ${sq.prompt}\n  Student: ${subText}\n  Correct key: ${correct}\n  MCQ score fraction: ${fraction.toFixed(2)} (${isFullyCorrect ? "full" : "partial/none"})`,
    )
    if (labels.length) {
      lines.push(`  Options: ${labels.map((l) => `${l.letter}) ${l.text}`).join(" | ")}`)
    }
  }
  return lines.join("\n")
}

function parseAiJson(raw: string): Record<string, unknown> | null {
  return parseAiJsonResponse(raw, LOG)
}

function feedbackLooksWellFormed(feedback: string): boolean {
  const t = feedback.trim()
  if (t.length < 40) return false
  // Expect some structure: numbered items, bullets, or math notation
  return (
    /\d+\.\s/.test(t) ||
    /^[\-*•]/m.test(t) ||
    /\$[^$]+\$/.test(t) ||
    /\\\(/.test(t) ||
    /Part\s+[a-z0-9]/i.test(t)
  )
}

export async function evaluateMultiPartSolutionUpload(
  params: EvaluateMultiPartSolutionParams,
): Promise<MultiPartSolutionAiResult> {
  const uploadMax = Math.max(0, Number(params.uploadMaxPoints) || 0)
  const fail = (msg: string, errorType?: string): MultiPartSolutionAiResult => ({
    uploadPointsEarned: 0,
    uploadScorePercent: 0,
    feedback: msg,
    strengths: [],
    improvements: [],
    partNotes: [],
    confidence: "low",
    canAutoGrade: false,
    requiresManualReview: true,
    aiGraded: false,
    errorType: errorType ?? "ai_failed",
    technicalError: msg,
  })

  if (uploadMax <= 0) {
    return fail("No upload points configured for this question.", "no_upload_points")
  }

  const aiModelSettings: AiModelSettings = {
    aiModel: params.aiModel,
    aiModelByTask: params.aiModelByTask,
    aiEnableOpusFallback: params.aiEnableOpusFallback,
    aiOpusConfidenceThreshold: params.aiOpusConfidenceThreshold,
  }
  const resolvedModel = resolveAiModel({ questionType: "multi_part", ...aiModelSettings, skipEscalation: true })
  const openAiKey = process.env.OPENAI_API_KEY?.trim()
  const visionApiKey = openAiKey || process.env.ANTHROPIC_API_KEY?.trim() || ""
  if (
    !visionApiKey ||
    (resolvedModel.provider === "openai" && !openAiKey) ||
    (resolvedModel.provider === "anthropic" && !isAnthropicApiKeyConfigured())
  ) {
    return fail(
      "AI evaluation unavailable. Your instructor will grade your uploaded solution.",
      "missing_api_key",
    )
  }
  const fallbackModel = resolveApiFallbackForModel(resolvedModel.modelId, resolvedModel.stack)

  const media = resolveQuestionMedia({
    question_media: params.questionMedia,
    circuit_spec: params.circuitSpec,
  })
  const spec = parseCircuitSpec(params.circuitSpec)
  const diagramUrl = hasActiveQuestionMedia(media)
    ? media.media_url
    : spec.circuitDiagramUrl

  const visionItems = await collectVisionDataUrls(diagramUrl, params.solutionUploads)
  if (visionItems.length === 0) {
    return fail(
      "Could not read circuit diagram or solution images. Your instructor will grade your upload manually.",
      "no_vision_assets",
    )
  }

  const mode = (params.aiEvaluationMode || "standard").toLowerCase()
  const strictness =
    mode === "very_strict"
      ? "Grade rigorously; partial credit only when work is clearly shown and mostly correct."
      : mode === "strict"
        ? "Apply standard engineering rigor; award partial credit for sound method with minor errors."
        : "Be fair and constructive; award partial credit when the approach is sound."

  const systemPrompt = `You are an Expert Circuit Theory Instructor grading ECE circuit analysis homework.
${strictness}

You will receive the question text, MCQ selections, a circuit diagram image, and the student's handwritten or digital worked solution image(s).

Grade ONLY the uploaded worked solution (not the MCQ selections — those are already scored separately).
Use KVL, KCL, phasor analysis, impedance, and unit consistency. Reference the circuit diagram.

FEEDBACK RULES:
- Use clear, constructive, itemized feedback (numbered list).
- Use LaTeX math for equations: inline $Z = R + j\\omega L$ or display $$V = IZ$$.
- Cite specific steps from the student's work when praising or correcting.
- Do not invent steps you cannot see in the images.

UPLOAD SCORING (must match instructor rubric):
- Upload pool = ${uploadMax} points (MCQ parts × upload multiplier).
- Use uploadScorePercent as one of: 100, 75, 50, 25, or 0 (snap to these tiers).
- uploadPointsEarned must equal uploadScorePercent/100 × ${uploadMax} (e.g. 75% → ${uploadMax * 0.75} pts).

Respond ONLY with valid JSON (no markdown fence):
{
  "uploadScorePercent": 100 | 75 | 50 | 25 | 0,
  "uploadPointsEarned": number from 0 to ${uploadMax} matching the percent tier,
  "confidence": "high" | "medium" | "low",
  "canAutoGrade": true only if images are legible and you can grade confidently; false if blurry, missing steps, or ambiguous,
  "requiresManualReview": true if instructor should verify; false only when canAutoGrade is true and confidence is high,
  "feedback": "itemized feedback with LaTeX math",
  "strengths": ["..."],
  "improvements": ["..."],
  "partNotes": [{"partId": "a", "notes": "..."}]
}`

  const mcqBlock = buildMcqSummary(params.subquestionsRaw, params.studentAnswer)
  const textBlock = `
QUESTION:
${params.questionText || "N/A"}

MCQ SUB-PARTS (already scored — for context only):
${mcqBlock}

MCQ POINTS ALREADY AWARDED: ${params.mcqEarned}/${params.mcqMaxPoints}
UPLOAD POINTS AVAILABLE: ${uploadMax}

REFERENCE / EXPECTED ANSWER:
${formatCanonicalReferenceAnswerForPrompt(
  resolveReferenceAnswerForAiGrading({
    expected_answer: params.expectedAnswer,
    sample_answer: params.sampleAnswer,
    circuit_spec: params.circuitSpec,
  }),
)}

RUBRIC / GUIDELINES:
${params.answerGuidelines || "Grade holistically: correct method, complete steps, consistent units, final answers."}

${spec.sampleSolution ? `CANONICAL SOLUTION:\n${spec.sampleSolution}` : ""}
`.trim()

  const userParts: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: textBlock }]
  for (const v of visionItems) {
    userParts.push({ type: "text", text: `IMAGE: ${v.label}` })
    userParts.push({ type: "image_url", image_url: { url: v.dataUrl } })
  }

  let raw: string
  try {
    const visionResult = await callVisionModelWithFallback(
      visionApiKey,
      resolvedModel.modelId,
      systemPrompt,
      userParts,
      fallbackModel,
    )
    raw = visionResult.text
  } catch (visionErr) {
    console.error(LOG, "Vision grading failed:", visionErr)
    return fail(
      "AI could not grade your solution image. Your instructor will review it manually.",
      "api_error",
    )
  }

  const parsed = parseAiJson(raw)
  if (!parsed) {
    return fail(
      "AI returned an unreadable response. Your instructor will grade your uploaded solution.",
      "parse_error",
    )
  }

  const feedback = String(parsed.feedback ?? "").trim()
  const confidence = String(parsed.confidence ?? "low").toLowerCase() as "high" | "medium" | "low"
  const canAutoGrade = parsed.canAutoGrade === true
  // Default false when omitted — only flag manual review when the model explicitly requests it.
  const modelRequestsManualReview = parsed.requiresManualReview === true

  let uploadScorePercent = Number(parsed.uploadScorePercent)
  if (!Number.isFinite(uploadScorePercent)) {
    uploadScorePercent = 0
  }
  uploadScorePercent = Math.max(0, Math.min(100, uploadScorePercent))

  // Rubric source of truth: percent → upload max tier (100/75/50/25/0% of upload pool).
  const uploadPointsEarned = uploadPointsFromRubricPercent(uploadMax, uploadScorePercent)
  uploadScorePercent =
    uploadMax > 0
      ? parseFloat(((uploadPointsEarned / uploadMax) * 100).toFixed(2))
      : 0

  const strengths = Array.isArray(parsed.strengths)
    ? (parsed.strengths as unknown[]).map((s) => String(s)).filter(Boolean)
    : []
  const improvements = Array.isArray(parsed.improvements)
    ? (parsed.improvements as unknown[]).map((s) => String(s)).filter(Boolean)
    : []
  const partNotes = Array.isArray(parsed.partNotes)
    ? (parsed.partNotes as { partId?: string; notes?: string }[])
        .filter((p) => p && p.partId)
        .map((p) => ({ partId: String(p.partId), notes: String(p.notes ?? "") }))
    : []

  const wellFormed = feedbackLooksWellFormed(feedback)

  // Successful AI grade → apply upload points and show feedback to the student as final.
  // Instructor may override later; no mandatory review when the model can auto-grade.
  // Pending only when: model cannot auto-grade, explicitly requests manual review, or feedback is empty.
  const canFinalizeUpload =
    canAutoGrade && !modelRequestsManualReview && feedback.length > 0

  if (!canFinalizeUpload) {
    const failureReason = !feedback
      ? "empty_feedback"
      : modelRequestsManualReview
        ? "manual_review_requested"
        : !canAutoGrade
          ? wellFormed
            ? "cannot_auto_grade"
            : "low_quality_feedback"
          : "cannot_auto_grade"

    return {
      uploadPointsEarned: 0,
      uploadScorePercent,
      feedback:
        feedback ||
        "Your solution was received. An instructor will review your uploaded work and assign upload points.",
      strengths,
      improvements,
      partNotes,
      confidence,
      canAutoGrade: false,
      requiresManualReview: true,
      aiGraded: feedback.length > 0,
      errorType: failureReason,
    }
  }

  return {
    uploadPointsEarned,
    uploadScorePercent,
    feedback,
    strengths,
    improvements,
    partNotes,
    confidence,
    canAutoGrade: true,
    requiresManualReview: false,
    aiGraded: true,
  }
}
