/**
 * AI grading for circuit_submission — vision over diagram + student uploads.
 */

import { resolveAiModel, resolveApiFallbackForModel, resolveNextEscalation, type AiModelSettings, type EscalationTier } from "@/lib/resolve-ai-model"
import { callVisionModelWithFallback } from "@/lib/ai-vision-chat"
import { isAnthropicApiKeyConfigured, isOpenAiApiKeyConfigured } from "@/lib/ai-env"
import {
  CIRCUIT_SUBMISSION_RUBRIC_KEYS,
  CIRCUIT_SUBMISSION_RUBRIC_LABELS,
  listCircuitSubmissionFiles,
  parseCircuitSubmissionConfig,
  parseCircuitSubmissionRubric,
  sumCircuitSubmissionRubricScores,
  type CircuitSubmissionRubric,
  type CircuitSubmissionRubricScores,
} from "@/lib/circuit-submission"
import { hasActiveQuestionMedia, resolveQuestionMedia } from "@/lib/question-media"
import type { SolutionUploadsMap } from "@/lib/solution-upload"
import { resolveVisionAssetDataUrls, resolveVisionImageDataUrl } from "@/lib/vision-image-for-ai"
import { parseAiJsonResponse } from "@/lib/parse-ai-json-response"
import { formatCanonicalReferenceAnswerForPrompt } from "@/lib/resolve-reference-answer-for-ai"
import {
  appendCircuitFloorNote,
  applyCircuitViableSubmissionFloor,
  buildCircuitLeniencyPromptInstructions,
  circuitViableMinimumPoints,
  isViableCircuitSubmissionAttempt,
  shouldRetryCircuitVisionAfterMissedUpload,
} from "@/lib/circuit-submission-grading-policy"

export type VisionItem = { dataUrl: string; label: string }

export type CollectedCircuitVisionAssets = {
  studentItems: VisionItem[]
  diagramItem: VisionItem | null
  /** Student solution pages first, then the question diagram (reference only). */
  orderedForGrading: VisionItem[]
}

export type CircuitSubmissionAiResult = {
  rubricScores: CircuitSubmissionRubricScores
  totalScore: number
  feedback: string
  strengths: string[]
  improvements: string[]
  confidence: "high" | "medium" | "low"
  canAutoGrade: boolean
  requiresManualReview: boolean
  aiGraded: boolean
  errorType?: string
  technicalError?: string
  minimumFloorApplied?: boolean
  submissionViable?: boolean
}

export type EvaluateCircuitSubmissionParams = {
  questionText: string
  expectedAnswer?: string | null
  questionMedia?: unknown
  solutionUploads: SolutionUploadsMap
  solutionUploadConfig?: unknown
  maxPoints: number
  aiEvaluationMode?: string
  aiModel?: string | null
  aiModelByTask?: unknown
  aiEnableOpusFallback?: boolean | null
  aiOpusConfidenceThreshold?: number | null
}

function confidenceToScore(confidence: "high" | "medium" | "low"): number {
  if (confidence === "high") return 0.9
  if (confidence === "medium") return 0.7
  return 0.4
}

const LOG = "[Circuit Submission AI]"

function isGradableUploadMime(mime: string, name: string): boolean {
  const m = (mime || "").toLowerCase()
  if (m.startsWith("image/") || m.includes("pdf")) return true
  const lower = (name || "").toLowerCase()
  return /\.(png|jpe?g|gif|webp|bmp|heic|pdf)$/i.test(lower)
}

async function collectVisionDataUrls(
  diagramUrl: string | null | undefined,
  uploads: SolutionUploadsMap,
): Promise<CollectedCircuitVisionAssets> {
  const studentItems: VisionItem[] = []
  let diagramItem: VisionItem | null = null

  const files = listCircuitSubmissionFiles(uploads)
  for (let i = 0; i < files.length; i++) {
    const att = files[i]
    if (!att?.url || !isGradableUploadMime(att.mime, att.name)) continue
    const dataUrls = await resolveVisionAssetDataUrls(att.url, {
      mime: att.mime,
      name: att.name,
    })
    for (let p = 0; p < dataUrls.length; p++) {
      const pageSuffix =
        dataUrls.length > 1 ? ` (page ${p + 1} of ${dataUrls.length})` : ""
      const fileSuffix = files.length > 1 ? `, file ${i + 1}` : ""
      studentItems.push({
        dataUrl: dataUrls[p],
        label: `Student worked solution${fileSuffix}${pageSuffix}`,
      })
    }
  }

  if (diagramUrl) {
    const dataUrl = await resolveVisionImageDataUrl(diagramUrl)
    if (dataUrl) {
      diagramItem = { dataUrl, label: "Circuit diagram (question — reference only, NOT student work)" }
    }
  }

  const orderedForGrading = [
    ...studentItems,
    ...(diagramItem ? [diagramItem] : []),
  ]

  return { studentItems, diagramItem, orderedForGrading }
}

function buildUserVisionParts(
  textBlock: string,
  visionItems: VisionItem[],
): Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> {
  const userParts: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: textBlock }]
  for (const v of visionItems) {
    userParts.push({ type: "text", text: `IMAGE: ${v.label}` })
    userParts.push({ type: "image_url", image_url: { url: v.dataUrl } })
  }
  return userParts
}

async function invokeCircuitVisionModel(
  apiKey: string,
  model: string,
  fallbackModel: string,
  systemPrompt: string,
  userParts: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  >,
): Promise<string | null> {
  try {
    const result = await callVisionModelWithFallback(apiKey, model, systemPrompt, userParts, fallbackModel)
    return result.text
  } catch (err) {
    console.error(LOG, "Vision model failed:", err)
    return null
  }
}

function parseAiJson(raw: string): Record<string, unknown> | null {
  return parseAiJsonResponse(raw, LOG)
}

function rubricBlock(rubric: CircuitSubmissionRubric): string {
  return CIRCUIT_SUBMISSION_RUBRIC_KEYS.map(
    (key) => `- ${CIRCUIT_SUBMISSION_RUBRIC_LABELS[key]}: up to ${rubric[key] ?? 0} pts`,
  ).join("\n")
}

function clampRubricScores(
  raw: unknown,
  rubric: CircuitSubmissionRubric,
): CircuitSubmissionRubricScores {
  const scores: CircuitSubmissionRubricScores = {}
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  for (const key of CIRCUIT_SUBMISSION_RUBRIC_KEYS) {
    const max = rubric[key] ?? 0
    if (max <= 0) continue
    const val = Number(obj[key])
    if (!Number.isFinite(val)) {
      scores[key] = null
      continue
    }
    scores[key] = Math.max(0, Math.min(max, parseFloat(val.toFixed(2))))
  }
  return scores
}

function buildCircuitSystemPrompt(
  mode: string,
  leniencyBlock: string,
  rubric: CircuitSubmissionRubric,
  maxPoints: number,
  extraBlock?: string,
): string {
  const modeNote =
    mode === "very_strict"
      ? "Apply the leniency rules above first; they override strict grading for viable uploads."
      : mode === "strict"
        ? "Apply the leniency rules above first; they override standard deductions for viable uploads."
        : "Default to generous partial credit per the leniency rules above."

  return `You are an Expert Circuit Theory Instructor grading ECE circuit analysis homework.
${modeNote}

${leniencyBlock}

IMAGE LAYOUT (CRITICAL):
- Images labeled **"Student worked solution"** are the student's handwritten/PDF submission — grade THESE.
- The image labeled **"Circuit diagram (question)"** is ONLY the assigned problem figure for reference. It is NOT the student's work. Never treat it as the submission or claim the student uploaded nothing when student solution images are present.

Students submit handwritten or digital worked solutions as images/PDF pages. Grade the student solution images only.

Use KVL, KCL, source transformation, node/mesh analysis, and consistent units.
When an EXPECTED FINAL ANSWER is provided, compare the student's work to that reference, but still award generous partial credit per the leniency rules when their method or setup shows genuine effort even if the final value differs.

RUBRIC (award 0 to max for each category; total must not exceed ${maxPoints} pts):
${rubricBlock(rubric)}

FEEDBACK RULES:
- Itemized, constructive feedback (numbered list).
- Use LaTeX for equations: inline $V = IR$ or display $$\\sum I = 0$$.
- Cite specific steps from the student's images when praising or correcting.
- NEVER deduct points or write feedback about spelling, grammar, handwriting neatness, notation style, or syntax unrelated to the circuit solution.
- ONLY evaluate setup, method, calculations, and final answers. Ignore cosmetic issues unless they make the work unreadable.
- Do NOT mention typos, punctuation, or language quality in feedback.
- Be encouraging: acknowledge what the student did well before listing corrections.
${extraBlock ? `\n${extraBlock}` : ""}

Respond ONLY with valid JSON (no markdown fence):
{
  "submissionViable": true if legible work attempts THIS assigned problem; false only for blank/irrelevant/wrong-problem uploads,
  "rubricScores": {
    "setup": number 0-${rubric.setup ?? 0},
    "method": number 0-${rubric.method ?? 0},
    "calculations": number 0-${rubric.calculations ?? 0},
    "final_answer": number 0-${rubric.final_answer ?? 0}
  },
  "confidence": "high" | "medium" | "low",
  "canAutoGrade": true only if images are legible and you can grade confidently,
  "requiresManualReview": true if instructor should verify; false only when canAutoGrade is true and confidence is high,
  "feedback": "itemized feedback with LaTeX math",
  "strengths": ["..."],
  "improvements": ["..."]
}`
}

function finalizeCircuitVisionResult(
  parsed: Record<string, unknown>,
  rubric: CircuitSubmissionRubric,
  maxPoints: number,
  mode: string,
  hasRenderedStudentUploads: boolean,
): CircuitSubmissionAiResult {
  const rubricScores = clampRubricScores(parsed.rubricScores, rubric)
  let totalScore = sumCircuitSubmissionRubricScores(rubricScores)
  totalScore = Math.max(0, Math.min(maxPoints, parseFloat(totalScore.toFixed(2))))

  let feedback = String(parsed.feedback ?? "").trim()
  const confidence = String(parsed.confidence ?? "low").toLowerCase() as "high" | "medium" | "low"
  const canAutoGrade = parsed.canAutoGrade === true
  const modelRequestsManualReview = parsed.requiresManualReview === true
  const submissionViableFlag = parsed.submissionViable

  const strengths = Array.isArray(parsed.strengths)
    ? (parsed.strengths as unknown[]).map((s) => String(s)).filter(Boolean)
    : []
  const improvements = Array.isArray(parsed.improvements)
    ? (parsed.improvements as unknown[]).map((s) => String(s)).filter(Boolean)
    : []

  const viable = isViableCircuitSubmissionAttempt({
    submissionViable: submissionViableFlag,
    rubricScores,
    totalScore,
    feedback,
    strengths,
    hasRenderedStudentUploads,
  })

  let minimumFloorApplied = false
  if (viable) {
    const floored = applyCircuitViableSubmissionFloor(rubricScores, rubric, totalScore, maxPoints)
    if (floored.floorApplied) {
      minimumFloorApplied = true
      Object.assign(rubricScores, floored.rubricScores)
      totalScore = floored.totalScore
      feedback = appendCircuitFloorNote(
        feedback,
        circuitViableMinimumPoints(maxPoints),
        maxPoints,
      )
    }
  }

  const rubricKeysWithMax = CIRCUIT_SUBMISSION_RUBRIC_KEYS.filter((k) => (rubric[k] ?? 0) > 0)
  const rubricComplete =
    rubricKeysWithMax.length > 0 &&
    rubricKeysWithMax.every((k) => typeof rubricScores[k] === "number")
  const visionEvaluationComplete = rubricComplete && feedback.length > 0

  if (visionEvaluationComplete) {
    return {
      rubricScores,
      totalScore,
      feedback,
      strengths,
      improvements,
      confidence,
      canAutoGrade: true,
      requiresManualReview: false,
      aiGraded: true,
      minimumFloorApplied,
      submissionViable: viable,
    }
  }

  const isRelaxed = mode === "relaxed"
  const canFinalize =
    feedback.length > 0 &&
    totalScore >= 0 &&
    (isRelaxed
      ? totalScore > 0 || sumCircuitSubmissionRubricScores(rubricScores) > 0
      : canAutoGrade && !modelRequestsManualReview)

  const requiresManualReview = isRelaxed
    ? modelRequestsManualReview || confidence === "low" || !canAutoGrade
    : !canFinalize

  return {
    rubricScores,
    totalScore,
    feedback,
    strengths,
    improvements,
    confidence,
    canAutoGrade,
    requiresManualReview,
    aiGraded: canFinalize,
    minimumFloorApplied,
    submissionViable: viable,
  }
}

export async function evaluateCircuitSubmissionUpload(
  params: EvaluateCircuitSubmissionParams,
): Promise<CircuitSubmissionAiResult> {
  const maxPoints = Math.max(0, Number(params.maxPoints) || 10)
  const config = parseCircuitSubmissionConfig(params.solutionUploadConfig)
  const rubric = config.rubric ?? parseCircuitSubmissionRubric({ setup: 3, method: 3, calculations: 2, final_answer: 2 })!

  const fail = (msg: string, errorType?: string): CircuitSubmissionAiResult => ({
    rubricScores: { setup: null, method: null, calculations: null, final_answer: null },
    totalScore: 0,
    feedback: msg,
    strengths: [],
    improvements: [],
    confidence: "low",
    canAutoGrade: false,
    requiresManualReview: true,
    aiGraded: false,
    errorType: errorType ?? "ai_failed",
    technicalError: msg,
  })

  const aiModelSettings: AiModelSettings = {
    aiModel: params.aiModel,
    aiModelByTask: params.aiModelByTask,
    aiEnableOpusFallback: params.aiEnableOpusFallback,
    aiOpusConfidenceThreshold: params.aiOpusConfidenceThreshold,
  }
  const resolvedModel = resolveAiModel({
    questionType: "circuit_submission",
    ...aiModelSettings,
    skipEscalation: true,
  })
  const openAiKey = process.env.OPENAI_API_KEY?.trim()
  const anthropicKey = isAnthropicApiKeyConfigured()
  const apiKey = openAiKey || process.env.ANTHROPIC_API_KEY?.trim() || ""
  if (!apiKey || (resolvedModel.provider === "openai" && !openAiKey) || (resolvedModel.provider === "anthropic" && !anthropicKey)) {
    return fail(
      "AI evaluation unavailable. Your instructor will grade your uploaded solution.",
      "missing_api_key",
    )
  }
  const visionApiKey = openAiKey || process.env.ANTHROPIC_API_KEY?.trim() || ""
  const fallbackModel = resolveApiFallbackForModel(resolvedModel.modelId, resolvedModel.stack)

  const media = resolveQuestionMedia({ question_media: params.questionMedia })
  const diagramUrl = hasActiveQuestionMedia(media) ? media.media_url : null
  const visionAssets = await collectVisionDataUrls(diagramUrl, params.solutionUploads)
  const studentPageCount = visionAssets.studentItems.length

  if (visionAssets.orderedForGrading.length === 0) {
    return fail(
      "Could not read circuit diagram or solution images. Your instructor will grade your upload manually.",
      "no_vision_assets",
    )
  }

  const mode = (params.aiEvaluationMode || "standard").toLowerCase()
  const leniencyBlock = buildCircuitLeniencyPromptInstructions(maxPoints)

  const textBlock = `
QUESTION:
${params.questionText || "N/A"}

EXPECTED FINAL ANSWER:
${formatCanonicalReferenceAnswerForPrompt(params.expectedAnswer?.trim() || null)}

MAX POINTS: ${maxPoints}
STUDENT SOLUTION PAGES PROVIDED: ${studentPageCount}
`.trim()

  const runPass = async (
    visionItems: VisionItem[],
    extraPromptBlock?: string,
    modelOverride?: string,
  ): Promise<CircuitSubmissionAiResult | null> => {
    const systemPrompt = buildCircuitSystemPrompt(mode, leniencyBlock, rubric, maxPoints, extraPromptBlock)
    const userParts = buildUserVisionParts(textBlock, visionItems)
    const raw = await invokeCircuitVisionModel(
      visionApiKey,
      modelOverride ?? resolvedModel.modelId,
      fallbackModel,
      systemPrompt,
      userParts,
    )
    if (!raw) return null
    const parsed = parseAiJson(raw)
    if (!parsed) return null
    return finalizeCircuitVisionResult(
      parsed,
      rubric,
      maxPoints,
      mode,
      studentPageCount > 0,
    )
  }

  let result = await runPass(visionAssets.orderedForGrading)
  if (!result) {
    return fail(
      "AI could not grade your solution image. Your instructor will review it manually.",
      "api_error",
    )
  }

  if (
    studentPageCount > 0 &&
    shouldRetryCircuitVisionAfterMissedUpload({
      studentUploadPageCount: studentPageCount,
      submissionViable: result.submissionViable,
      totalScore: result.totalScore,
      rubricScores: result.rubricScores,
      feedback: result.feedback,
      errorType: result.errorType,
    })
  ) {
    console.warn(
      LOG,
      `Retrying vision grade — model missed ${studentPageCount} student page(s); using student-only images`,
    )
    const retryBlock = `RETRY — MISSED STUDENT UPLOAD (MANDATORY)
The prior pass incorrectly treated this as having no student work. ${studentPageCount} student solution page(s) are attached below (images labeled "Student worked solution").
You MUST grade the handwritten/digital work on those pages. If you see redrawn circuits, node labels, KCL/KVL, or algebra, set submissionViable to true and award partial credit per the rubric.`
    const retryResult = await runPass(visionAssets.studentItems, retryBlock)
    if (retryResult) {
      result = retryResult
    }
  }

  let escalationTier: EscalationTier = "none"
  let currentPreset = resolvedModel.preset
  for (let step = 0; step < 2; step++) {
    const conf = confidenceToScore(result.confidence)
    const next = resolveNextEscalation({
      questionType: "circuit_submission",
      ...aiModelSettings,
      basePreset: currentPreset,
      stack: resolvedModel.stack,
      afterTier: escalationTier,
      confidence: conf,
    })
    if (!next) break

    const prompt =
      next.escalationTier === "expert"
        ? "EXPERT REVIEW — prior pass had very low confidence or disputed work. Re-evaluate handwritten/messy submissions with full rubric partial credit."
        : "SECOND PASS — prior grading confidence was below threshold. Re-evaluate carefully; expected_answer is provided for anchoring."

    console.warn(
      LOG,
      `Escalating ${escalationTier} → ${next.escalationTier} (${next.modelId})`,
    )
    const escalated = await runPass(visionAssets.orderedForGrading, prompt, next.modelId)
    if (!escalated) break

    result = escalated
    escalationTier = next.escalationTier
    currentPreset = next.preset
  }

  return result
}
