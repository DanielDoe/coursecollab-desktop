/**
 * Single AI call grading many code questions (Assessment bulk re-evaluate tab).
 * Uses the same OpenAI / Anthropic routing as single-answer grading.
 */
import { chatCompletionWithFallback } from "@/lib/openai-with-fallback"
import {
  resolveAiModel,
  type AiModelSettings,
} from "@/lib/resolve-ai-model"
import { resolveReferenceAnswerForAiGrading } from "@/lib/resolve-reference-answer-for-ai"
import { isOpenAiApiKeyConfigured, isAnthropicApiKeyConfigured } from "@/lib/ai-env"

export type BatchAiQuestionInput = {
  answerId: number
  questionId: number
  questionType: string
  questionText: string
  maxPoints: number
  studentAnswer: string
  correctAnswer?: string | null
  expectedAnswer?: string | null
  rubric?: string | null
  /** Expected language for AI grading (per-question override or quiz default). */
  evaluationLanguage?: string
  /** When set, student may use any of these languages (quiz multi-select). */
  evaluationLanguages?: string[]
}

/** Structured feedback sized for storage + AIFeedbackDisplay (quiz-results). */
export type BatchAiQuestionGrade = {
  answerId: number
  scorePercent: number
  requiresManualReview: boolean
  /** 📝 Grade Explanation — primary prose (bounded in prompt). */
  gradeExplanation: string
  /** ✅ Strengths */
  strengths: string[]
  /** ⚠️ Areas for Improvement */
  areasForImprovement: string[]
  /** 🚀 How to Improve (optional, short bullets) */
  howToImprove: string[]
  /** 📋 Itemized Feedback → maps to itemizedIssues */
  itemizedFeedback: Array<{ issue: string; hint?: string }>
  /** 📊 Detailed scoring — 0–100 each */
  detailedScoring: {
    correctness: number
    codeQuality: number
    efficiency: number
    completeness: number
  }
}

const MAX_Q_TEXT = 6000
const MAX_CODE = 10000
const MAX_CHUNK = 8

function trunc(s: string, n: number): string {
  if (!s || s.length <= n) return s
  return s.slice(0, n) + "\n…[truncated]"
}

const LIM = {
  explanation: 320,
  bullet: 100,
  itemIssue: 140,
  itemHint: 80,
}

function clampStr(s: string, n: number): string {
  if (!s || s.length <= n) return s
  return s.slice(0, n).trim() + "…"
}

function parseBatchJson(raw: string): unknown {
  let t = raw.replace(/^[\s\S]*?```(?:json)?\s*/, "").replace(/\s*```[\s\S]*$/, "").trim()
  if (!t.startsWith("{")) {
    const i = t.indexOf("{")
    if (i >= 0) t = t.slice(i)
  }
  return JSON.parse(t)
}

export type BatchAiEvalOptions = {
  evaluationMode: string
  codeLanguage: string
} & AiModelSettings

/**
 * Grades many code questions in chunks via the assessment's configured model provider.
 */
export async function evaluateBatchCodeQuestionsWithAI(
  items: BatchAiQuestionInput[],
  opts: BatchAiEvalOptions,
): Promise<BatchAiQuestionGrade[]> {
  if (items.length === 0) return []

  const resolved = resolveAiModel({
    questionType: "code_write",
    task: "code",
    aiModel: opts.aiModel,
    aiModelByTask: opts.aiModelByTask,
    aiEnableOpusFallback: opts.aiEnableOpusFallback,
    aiOpusConfidenceThreshold: opts.aiOpusConfidenceThreshold,
    skipEscalation: true,
  })

  if (resolved.provider === "anthropic") {
    if (!isAnthropicApiKeyConfigured()) {
      throw new Error("ANTHROPIC_API_KEY is not configured for Claude batch grading")
    }
  } else if (!isOpenAiApiKeyConfigured()) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  const apiKey = process.env.OPENAI_API_KEY || ""
  const model = resolved.modelId
  const timeoutMs = 240_000
  const out: BatchAiQuestionGrade[] = []

  console.log(
    `[Batch AI Eval] model=${model} provider=${resolved.provider} preset=${resolved.preset} items=${items.length}`,
  )

  for (let c = 0; c < items.length; c += MAX_CHUNK) {
    const chunk = items.slice(c, c + MAX_CHUNK)
    const idSet = new Set(chunk.map((x) => x.answerId))

    const payload = chunk.map((it, idx) => {
      const langs =
        it.evaluationLanguages && it.evaluationLanguages.length > 1
          ? it.evaluationLanguages
          : null
      return {
        index: idx + 1,
        answerId: it.answerId,
        questionId: it.questionId,
        questionType: it.questionType,
        maxPoints: it.maxPoints,
        expectedLanguage: (it.evaluationLanguage || opts.codeLanguage || "cpp").toLowerCase(),
        ...(langs ? { acceptedLanguages: langs } : {}),
        questionText: trunc(it.questionText || "", MAX_Q_TEXT),
        reference: trunc(
          String(
            resolveReferenceAnswerForAiGrading({
              expected_answer: it.expectedAnswer,
              correct_answer: it.correctAnswer,
            }) ?? "",
          ),
          2000,
        ),
        rubricHint: trunc(String(it.rubric ?? ""), 1500),
        studentSubmission: trunc(it.studentAnswer || "", MAX_CODE),
      }
    })

    const system = `You are an expert programming instructor. Grade multiple INDEPENDENT questions in one response.
Return ONLY valid JSON (no markdown fences) with this exact shape:
{"grades":[{"answerId":number,"scorePercent":number,"requiresManualReview":boolean,"gradeExplanation":string,"strengths":string[],"areasForImprovement":string[],"howToImprove":string[],"itemizedFeedback":[{"issue":string,"hint":string}],"detailedScoring":{"correctness":number,"codeQuality":number,"efficiency":number,"completeness":number}}]}

Field rules (keep payloads small):
- One "grades" entry per answerId in the user message (matching answerId values exactly).
- scorePercent: 0–100 for this question.
- gradeExplanation: max ~280 characters; plain text; why this score (no markdown code fences).
- strengths: max 3 items, each max ~90 characters.
- areasForImprovement: max 3 items, each max ~90 characters (concrete gaps).
- howToImprove: max 2 optional items, each max ~90 characters (actionable next steps).
- itemizedFeedback: max 4 items; issue = problem; hint = quick fix or location note (each line bounded).
- detailedScoring: integers 0–100 for correctness, codeQuality, efficiency, completeness (consistent with scorePercent).
- requiresManualReview: true if empty, suspicious, or cannot grade fairly from text alone.
- If questionType is **code_write_plot**: treat the submission as **MATLAB** (not C++). Students often paste from the MATLAB editor after running locally—**do not** penalize, flag, or mention copy/paste or "suspiciously complete" scripts; grade on MATLAB correctness only.
- When **reference** (canonical expected answer) is provided, grade EVERY student against that exact reference. Do NOT invent or re-derive different expected results per student.
- Each question includes **expectedLanguage** (e.g. cpp, matlab, python). Grade that student's code **only** as that language for that question—do not assume every question uses the same language.
- When **acceptedLanguages** is present (array of 2+ ids): the student may use **any one** of those languages for that question. Detect which applies; **do not** penalize "wrong language" among acceptedLanguages. Still use expectedLanguage as a hint when ambiguous.

Evaluation mode: ${opts.evaluationMode}. Fallback language when expectedLanguage is missing: ${opts.codeLanguage}. Be fair with partial credit.`

    const user = `Grade each question. answerId must match exactly.

${JSON.stringify({ questions: payload })}`

    const result = await Promise.race([
      chatCompletionWithFallback(apiKey, {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 12288,
        response_format: { type: "json_object" },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Batch grading timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ])

    const rawText = result.content?.trim() || ""
    if (!rawText) throw new Error("Empty response from batch grading model")

    let parsed: { grades?: unknown[] }
    try {
      parsed = parseBatchJson(rawText) as { grades?: unknown[] }
    } catch {
      throw new Error("Batch grading response was not valid JSON")
    }

    const grades = Array.isArray(parsed.grades) ? parsed.grades : []
    const byAnswer = new Map<number, BatchAiQuestionGrade>()

    for (const g of grades) {
      if (!g || typeof g !== "object") continue
      const o = g as Record<string, unknown>
      const aid = Number(o.answerId)
      if (!Number.isFinite(aid) || !idSet.has(aid)) continue
      let sp = Number(o.scorePercent)
      if (!Number.isFinite(sp)) sp = 0
      sp = Math.max(0, Math.min(100, sp))
      const req = Boolean(o.requiresManualReview)

      const gradeExplanation =
        clampStr(typeof o.gradeExplanation === "string" ? o.gradeExplanation : "", LIM.explanation) ||
        "Graded in batch."

      const strengths = Array.isArray(o.strengths)
        ? o.strengths.filter((x): x is string => typeof x === "string").slice(0, 3).map((s) => clampStr(s, LIM.bullet))
        : []
      const areasForImprovement = Array.isArray(o.areasForImprovement)
        ? o.areasForImprovement
            .filter((x): x is string => typeof x === "string")
            .slice(0, 3)
            .map((s) => clampStr(s, LIM.bullet))
        : []
      const howToImprove = Array.isArray(o.howToImprove)
        ? o.howToImprove.filter((x): x is string => typeof x === "string").slice(0, 2).map((s) => clampStr(s, LIM.bullet))
        : []

      const itemRaw = Array.isArray(o.itemizedFeedback) ? o.itemizedFeedback : []
      const itemizedFeedback: Array<{ issue: string; hint?: string }> = []
      for (const row of itemRaw.slice(0, 4)) {
        if (!row || typeof row !== "object") continue
        const r = row as Record<string, unknown>
        const issue = typeof r.issue === "string" ? clampStr(r.issue, LIM.itemIssue) : ""
        if (!issue) continue
        const hint = typeof r.hint === "string" ? clampStr(r.hint, LIM.itemHint) : undefined
        itemizedFeedback.push(hint ? { issue, hint } : { issue })
      }

      const ds = o.detailedScoring && typeof o.detailedScoring === "object" ? (o.detailedScoring as Record<string, unknown>) : {}
      const num = (k: string) => {
        const v = Number(ds[k])
        if (!Number.isFinite(v)) return 0
        return Math.max(0, Math.min(100, Math.round(v)))
      }
      const detailedScoring = {
        correctness: num("correctness"),
        codeQuality: num("codeQuality"),
        efficiency: num("efficiency"),
        completeness: num("completeness"),
      }

      byAnswer.set(aid, {
        answerId: aid,
        scorePercent: sp,
        requiresManualReview: req,
        gradeExplanation,
        strengths,
        areasForImprovement,
        howToImprove,
        itemizedFeedback,
        detailedScoring,
      })
    }

    for (const it of chunk) {
      const g = byAnswer.get(it.answerId)
      if (g) {
        out.push(g)
      } else {
        out.push({
          answerId: it.answerId,
          scorePercent: 0,
          requiresManualReview: true,
          gradeExplanation: "Batch model did not return a grade for this answer; instructor review recommended.",
          strengths: [],
          areasForImprovement: ["Missing from batch model output"],
          howToImprove: [],
          itemizedFeedback: [{ issue: "No grade object returned for this answerId", hint: "Re-run or grade manually" }],
          detailedScoring: { correctness: 0, codeQuality: 0, efficiency: 0, completeness: 0 },
        })
      }
    }
  }

  return out
}
