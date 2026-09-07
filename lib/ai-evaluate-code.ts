/**
 * AI-Powered Code Evaluation - shared logic for all evaluation paths.
 * Used by: evaluate-code API route, quiz/evaluate, evaluate-code-api, retry route, health check.
 *
 * evaluateCode throws only for validation errors (missing required fields).
 * On OpenAI/parse errors, returns heuristic fallback (never throws).
 */

import { sql } from "@/lib/db"
import { buildChatCompletionBody } from "@/lib/openai-gpt5-mini"
import { analyzeReplayForSuspicion } from "@/lib/typing-replay"
import { isResponsesModel } from "@/lib/openai-model-params"
import {
  MIN_ATTEMPT_SCORE_FRACTION_BY_MODE,
  buildMandatoryAttemptFloorInstructionsForPrompt,
  extractTextForAttemptFloorCheck,
  getMinAttemptScorePercentForPrompt,
  isEligibleForAttemptMinimumFloor,
} from "@/lib/ai-code-attempt-floor"
import { isLikelyUnmodifiedStarterCode } from "@/lib/code-template-detection"
import { formatLanguageListForPrompt, normalizeAiCodeLanguage } from "@/lib/ai-code-languages"
import { formatCanonicalReferenceAnswerForPrompt } from "@/lib/resolve-reference-answer-for-ai"
import { resolveAiModel, resolveApiFallbackForModel, type AiModelSettings } from "@/lib/resolve-ai-model"
import { chatCompletionWithFallback } from "@/lib/openai-with-fallback"
import { callVisionModelWithFallback } from "@/lib/ai-vision-chat"
import { isAnthropicApiKeyConfigured } from "@/lib/ai-env"
import OpenAI from "openai"

export interface EvaluateCodeParams {
  questionType: string
  questionText: string
  studentAnswer: string
  correctAnswer?: string
  rubric?: unknown
  maxPoints?: number
  plotImage?: unknown
  aiEvaluationMode?: string
  /** Expected programming language (cpp, python, java, etc.). Default: cpp. Used when `allowedCodeLanguages` is not set. */
  codeLanguage?: string
  /** When set (e.g. from quiz), student may submit in any of these; grader must not penalize among allowed options. */
  allowedCodeLanguages?: string[]
  typingReplay?: {
    startTime: number
    events: Array<{ t: number; op: "i" | "d"; offset: number; text: string; len?: number }>
    initialDocument?: string
  }
  /** Assessment / course AI model settings for routing. */
  aiModel?: string | null
  aiModelByTask?: unknown
  aiEnableOpusFallback?: boolean | null
  aiOpusConfidenceThreshold?: number | null
}

export interface EvaluationCriteria {
  correctness: number
  codeQuality: number
  efficiency: number
  completeness: number
}

export interface EvaluateCodeResult {
  score: number
  isCorrect: boolean
  status: string
  statusMessage: string
  feedback: string
  criteria: EvaluationCriteria
  suggestions: string[]
  detailedExplanation?: string
  gradeBreakdown?: {
    reasoning: string
    strengths: string[]
    weaknesses: string[]
    improvements: string[]
  }
  scoreBreakdown?: {
    criteriaScores?: { correctness?: number; codeQuality?: number; efficiency?: number; completeness?: number }
    rawScore?: number
    suspiciousTypingPenalty?: number
    penaltyReason?: string
    finalScore?: number
  }
  itemizedIssues?: { issue: string; location: string; fix: string }[]
  sampleAnswers?: { approach: string; description: string; code: string }[]
  maxPoints: number
  pointsEarned: number
  aiGraded: boolean
  requiresManualReview: boolean
  fallbackReason?: string
  errorType?: string
  evaluationDiagnostics?: Record<string, unknown>
}

const EVAL_LOG = "[Evaluate Code]"

/** GPT-5 Responses API via SDK - supports vision (plot images). Uses input_text/input_image format. */
async function callGpt5Evaluation(
  apiKey: string,
  model: string,
  messages: { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }[],
  opts: { max_tokens?: number },
  timeoutMs: number
): Promise<string> {
  const input = messages.map((m) => {
    const role = m.role === "system" ? "developer" : (m.role as "user" | "assistant")
    if (Array.isArray(m.content)) {
      return {
        role,
        content: m.content.map((c: { type: string; text?: string; image_url?: { url: string } }) => {
          if (c.type === "text") {
            return { type: "input_text" as const, text: c.text ?? "" }
          }
          if (c.type === "image_url" && c.image_url?.url) {
            return {
              type: "input_image" as const,
              image_url: c.image_url.url,
            }
          }
          return { type: "input_text" as const, text: "" }
        }),
      }
    }
    return {
      role,
      content: m.content as string,
    }
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  const openai = new OpenAI({ apiKey })
  const response = await openai.responses.create(
    {
      model,
      input,
      reasoning: { effort: "low" },
      max_output_tokens: opts.max_tokens ?? 8192,
    },
    { signal: controller.signal }
  )

  clearTimeout(timeoutId)

  const text = (response.output_text ?? "").trim()
  const status = (response as { status?: string }).status
  const incompleteReason = (response as { incomplete_details?: { reason?: string } }).incomplete_details?.reason

  console.log(`${EVAL_LOG} GPT-5 status:`, status)
  console.log(`${EVAL_LOG} GPT-5 output_text length:`, text?.length ?? 0)

  if (!text) {
    throw new Error(`GPT-5 empty: ${incompleteReason || "unknown"}`)
  }
  if (status === "incomplete" && incompleteReason === "content_filter") {
    throw new Error(`GPT-5 content_filter: ${incompleteReason}`)
  }
  return text
}

function getSystemPrompt(questionType: string, criteria: any[], questionTypeConfig?: any, isVisionModel: boolean = false, aiEvaluationMode?: string): string {
  const jsonInstruction = `You are an automated grading engine.

Return ONLY valid JSON in this exact format. DO NOT include markdown, explanations, or text outside JSON.
Start directly with { and end with }. No \`\`\`json, no preamble, no trailing text.
`

  let basePrompt = `${jsonInstruction}You are an expert programming instructor evaluating student code submissions. 
You must provide fair, constructive, and accurate evaluations.

When a CANONICAL REFERENCE ANSWER is provided in the user prompt, grade every student against that exact reference. Do NOT invent or re-derive a different expected result between submissions.

${isVisionModel 
  ? 'CRITICAL: You MUST respond with ONLY valid JSON. Do NOT wrap in markdown code blocks. Do NOT add any text before or after the JSON. Start directly with { and end with }.' 
  : 'IMPORTANT: You MUST respond with valid JSON only. No markdown, no code blocks, just pure JSON.'
}

Your response must follow this exact JSON structure:
{
  "score": <number 0-100>,
  "isCorrect": <boolean>,
  "feedback": "<itemized summary - list each issue with location and fix; never claim something is missing if it exists in the code>",
  "criteria": {
    "correctness": <number 0-40>,
    "codeQuality": <number 0-25>,
    "efficiency": <number 0-20>,
    "completeness": <number 0-15>
  },
  "suggestions": ["<string>", "<string>", ...],
  "detailedExplanation": "<detailed explanation of why this grade was given>",
  "gradeBreakdown": {
    "reasoning": "<explanation of the overall grade reasoning>",
    "strengths": ["<strength 1>", "<strength 2>", ...],
    "weaknesses": ["<itemized weakness - MUST reference specific code, e.g. Line 15: variable X is uninitialized when...>", ...],
    "improvements": ["<itemized fix - MUST reference specific code and show correct approach>", ...]
  },
  "scoreBreakdown": {
    "criteriaScores": { "correctness": <0-40>, "codeQuality": <0-25>, "efficiency": <0-20>, "completeness": <0-15> },
    "rawScore": <number 0-100 before any penalty>,
    "suspiciousTypingPenalty": <number 0-20 if penalty applied, else 0>,
    "penaltyReason": "<reason for penalty if applied, else null>",
    "finalScore": <number 0-100, equals rawScore when no penalty, else rawScore - suspiciousTypingPenalty; must respect MANDATORY MINIMUM SCORE for substantive attempts in the active evaluation mode>
  },
  "itemizedIssues": [
    {"issue": "<what is wrong>", "location": "<line number or code snippet from student code>", "fix": "<exact correction or correct approach>"},
    ...
  ],
  "sampleAnswers": [
    {
      "approach": "Basic",
      "description": "Simple, straightforward solution",
      "code": "<complete working code here>"
    },
    {
      "approach": "Intermediate",
      "description": "Solution with improvements or alternative approach",
      "code": "<complete working code here>"
    },
    {
      "approach": "Advanced",
      "description": "Optimized solution with best practices (optional)",
      "code": "<complete working code here>"
    }
  ]
}

Note: Provide at least 2 sample answers, 3 is preferred if there are distinct approaches.

FEEDBACK VS FINAL NUMERIC GRADE (course policy):
- **Words:** Grade the submission completely—every error can appear in feedback, weaknesses, and itemizedIssues.
- **Numbers:** The minimum is a **floor**, not leniency to over-award. Weak work with many serious problems should land **at** the minimum, not far above it. "score" and scoreBreakdown.finalScore cannot fall below that floor for substantive attempts (see below). The server **overwrites** an illegally low grade if needed—do not pad grades above the floor without real merit.

CRITICAL - DETAILED FEEDBACK: Students must understand exactly why they scored what they scored. Provide:
- "feedback": Itemized summary with each issue, location (line/snippet), and fix
- "gradeBreakdown": reasoning, strengths, weaknesses, improvements (reference specific code)
- "itemizedIssues": For each problem: issue, location, fix
- "scoreBreakdown": criteriaScores, rawScore, suspiciousTypingPenalty (if any), penaltyReason, finalScore

KEYSTROKE ANTI-CHEAT: ${
    (questionType || "").toLowerCase() === "code_write_plot"
      ? `This question type is **code_write_plot** (MATLAB + plot). **No keystroke verdict is used.** Set **suspiciousTypingPenalty: 0** and **penaltyReason: null** always. Students often **paste from the MATLAB editor** after running locally—that is **expected and allowed**; do **not** deduct or scold for copy/paste, large bursts of text, or "too fast" typing. Grade only MATLAB correctness, structure, and (when applicable) plot consistency.`
      : `When SUSPICIOUS_TYPING_VERDICT is provided below, follow it. The verdict is pre-computed server-side (we analyze keystrokes; Trailblazer default template is excluded). You do NOT receive raw keystroke data - do NOT infer typos or edits from typing. If verdict says suspicious: apply the specified deduction. If verdict says not suspicious: set suspiciousTypingPenalty: 0. The "score" field must be your FINAL score (after any penalty), and must still obey the MANDATORY MINIMUM SCORE rule below for substantive attempts.`
  }

Evaluation Criteria:`

  if (criteria && criteria.length > 0) {
    criteria.forEach((criterion, index) => {
      basePrompt += `\n${index + 1}. ${criterion.name} (0-${criterion.weight} points): ${criterion.prompt}`
    })
  } else {
    basePrompt += `
1. Correctness (0-40 points): Does the code produce the correct output? Does it solve the problem correctly?
2. Code Quality (0-25 points): Is the code well-structured and readable? NOTE: Do NOT penalize for missing comments or variable naming conventions - these are optional enhancements, not requirements.
3. Efficiency (0-20 points): Is the algorithm efficient? Are there unnecessary operations? Only penalize for significant inefficiencies, not minor optimizations.
4. Completeness (0-15 points): Are all required outputs/functionality implemented? NOTE: Do NOT penalize for missing input validation or edge case handling unless explicitly required by the problem statement.`
  }

  basePrompt += "\n\n"

  if (questionTypeConfig && questionTypeConfig.specific_prompt) {
    basePrompt += `Specific Instructions for ${questionType}:\n${questionTypeConfig.specific_prompt}\n\n`
  } else {
    const typeSpecificPrompts: Record<string, string> = {
      code_write: `For code_write questions - FOCUS ON CORRECTNESS AND FUNCTIONALITY:

CRITICAL: Code must actually SOLVE THE PROBLEM to receive significant points. Partial code (just includes, variable declarations, or incomplete logic) should receive MINIMAL points.

SCORING GUIDELINES (Focus on Functionality):
- Code that ONLY has includes and variable declarations (no actual logic/implementation): Maximum 5-10/100 points
- Code with includes, variables, but incomplete logic (missing main functionality): Maximum 15-25/100 points
- Code with syntax errors that prevent compilation: Maximum 20-30/100 points
- Code that compiles but doesn't solve the problem correctly: Maximum 40-50/100 points
- Code that solves the problem correctly: 85-100/100 points (award high scores for correct solutions)

MANDATORY REQUIREMENTS (CRITICAL CHECKS):
- FIRST check for mandatory C++ boilerplate: #include <iostream>, using namespace std;, and int main()
- VERIFY BEFORE CLAIMING - AVOID FALSE FLAGS: Re-read the student's code character-by-character. If they have "#include <iostream>" (with #), do NOT say "add #" - the # is there. If they have "using namespace std;" (with semicolon), do NOT say "add semicolon" - it is there. Only report ACTUAL missing elements. False claims damage student trust.
- TEMPLATE TYPOS vs MISSING: If student has "include <iostream>" (no #) or "int man()" (typo for main), treat as TYPO not missing - deduct 5-8 pts. Only penalize 20-25 pts when element is COMPLETELY absent.
- USING NAMESPACE STD (REQUIRED): Our class ALWAYS uses "using namespace std;". If missing, deduct 8-12 pts and report: "Add 'using namespace std;' after the #include - our class always uses this. Using std:: is acceptable but we require the using directive."
- MANDATORY BOILERPLATE PENALTIES: Completely missing #include (-20-25 pts), missing using namespace std; (-8-12 pts), missing int main() (-25-30 pts). Typo in boilerplate: -5-8 pts only.
- Code without mandatory boilerplate CANNOT run - penalize heavily (maximum 30-40/100 if all missing)

SYNTAX AND COMPILATION CHECKS:
- Check for syntax errors (missing semicolons, unmatched braces, incorrect keywords, etc.)
- Syntax errors: Deduct 25-35 points (code won't compile)
- Missing required libraries/headers: Deduct 15-20 points
- Code that doesn't compile: Maximum score is 30/100

FUNCTIONALITY REQUIREMENTS (PRIMARY FOCUS):
- Code MUST actually implement the required logic to solve the problem
- Just declaring variables is NOT sufficient - deduct heavily (only 5-10 points)
- Code must produce correct output for the given problem
- Missing core functionality: Maximum 20-30/100 points
- Partial functionality: Maximum 40-60/100 points
- Complete and correct functionality: 85-100/100 points

CODE QUALITY GUIDELINES (DO NOT PENALIZE HEAVILY):
- Variable naming: Do NOT penalize for short variable names (e.g., 'rent', 'total') - these are acceptable. Only penalize if names are completely unclear or misleading.
- Comments: Do NOT penalize for missing comments - students have limited time. Comments are optional enhancements.
- Input validation: Do NOT penalize for missing input validation unless explicitly required by the problem statement. Most problems assume valid inputs.
- Edge cases: Do NOT penalize for missing edge case handling unless explicitly required. Focus on whether the code solves the stated problem correctly.
- SPELLING IN OUTPUT STRINGS: Do NOT penalize for typos in cout/printf strings (e.g. "schollar" vs "scholarship"). This is coding, not grammar. Output string spelling does NOT affect compilation or correctness. Ignore it in all modes.

IMPORTANT: 
- Award 85-100/100 points for code that correctly solves the problem, even if it lacks comments, descriptive names, or input validation
- Focus scoring on correctness and functionality, not on optional code quality enhancements
- Do NOT be generous with partial credit for incomplete code, but DO award full credit for correct solutions`,

      code_explain: `For code_explain questions:
- Evaluate the accuracy of the explanation
- Check if key concepts are understood
- Assess clarity and completeness
- Look for understanding of code flow and logic
- Award partial credit for partially correct explanations`,

      code_problem: `For code_problem questions:
- Evaluate the algorithmic approach
- Check correctness of the solution
- Assess time and space complexity
- Consider alternative approaches
- Award points for correct logic even if implementation has minor issues`,

      debug_code: `For debug_code questions:
- Check if the bug was correctly identified
- Evaluate the proposed fix
- Assess understanding of the error
- Consider if the fix introduces new issues
- Award partial credit for identifying the issue even if fix is incomplete`,

      code_debug: `For code_debug questions:
- Verify all bugs are found
- Check if fixes are appropriate
- Evaluate understanding of debugging process
- Consider code improvements beyond bug fixes
- Award partial credit for finding some bugs`,

      code_write_plot: `For code_write_plot questions (MATLAB + graph/plot, when applicable — NOT C++):

CRITICAL: Do **NOT** apply C++ "mandatory boilerplate" rules to these submissions. There is no #include, int main(), using namespace std, or cout/cin in MATLAB.
- If feedback mentions "expected C++" or "missing iostream" for a MATLAB answer, that is a **grader error** — MATLAB is correct.
- **Expected language: MATLAB** (or Octave-compatible). Evaluate syntax, style, and correctness using MATLAB rules (array operations, .m scripts or functions, end keywords, etc.).
- **Copy/paste from MATLAB is normal:** Students run scripts in MATLAB first, then paste into the quiz. **Do not** penalize or mention suspicious typing, paste bursts, or IDE-style pasted blocks. **suspiciousTypingPenalty must be 0.** Judge the code and plot on merit only.

What to check instead:
- Does the code address the **problem statement** (vectors/matrices, loops, built-ins as required)?
- **Plot / figure:** If a plot image is attached, you MUST connect it to the code and the prompt (see user message for plot-weighting). If the prompt requires a graph, the plot and the code should be consistent.
- Use of plot-related commands where appropriate: plot, fplot, figure, hold, subplot, xlabel, ylabel, title, grid, linspace, mesh, surf, etc.
- **Do NOT** penalize for the absence of C++-specific constructs. **Do** penalize real MATLAB issues (clear logic errors, wrong dimensions, bad indexing) per the problem.

SAMPLE SOLUTIONS in your JSON, when you include them, should be **valid MATLAB** for this type (not C++), unless the question text explicitly required another language.`,

    }
    const genericTypeFallback = `For this code question, evaluate the submission according to the criteria, question text, and EXPECTED PROGRAMMING LANGUAGE in the user message. Do not assume C++ unless that message says C++ or a C-family language.`
    basePrompt += typeSpecificPrompts[questionType] ?? genericTypeFallback
  }

  const sampleSolutionInstruction = isVisionModel
    ? `5. SAMPLE SOLUTIONS: Provide **one** complete working solution that correctly solves the problem. Additional approaches are optional if token limits allow.`
    : `5. SAMPLE SOLUTIONS: Provide 2-3 different working solutions that correctly solve the problem:\n   - Each solution should use a different approach or technique\n   - Progress from basic/simple to more advanced/sophisticated\n   - All solutions must be complete, working code\n   - Use clear, educational variable names\n   - Include comments explaining key concepts where helpful\n   - Solutions should demonstrate best practices`

  basePrompt += `

CRITICAL REQUIREMENTS FOR COMPREHENSIVE FEEDBACK:

1. ITEMIZED FEEDBACK (MANDATORY): You MUST provide specific, itemized feedback. NEVER give vague statements like "logical errors" or "code does not compile" without listing EXACTLY what is wrong.
   - For each issue: state the EXACT problem, cite the line or code snippet from the student's submission, and give the correct fix.
   - Example: "Line 18: 'choice' may be uninitialized when the first if-block is skipped - add 'choice = 0' before the if statements."
   - Do NOT include spelling/grammar in output strings (cout, printf) as issues - see rule 6 below.

2. VERIFY BEFORE CLAIMING - CRITICAL: NEVER claim something is missing or wrong if it EXISTS in the code. Re-read the student's code line-by-line before each claim.
   - If student has "#include <iostream>" - the # is PRESENT. Do NOT say "add #" or "missing #". That is a FALSE FLAG.
   - If student has "using namespace std;" - the semicolon is PRESENT. Do NOT say "add semicolon" or "missing semicolon". That is a FALSE FLAG.
   - If student has "return 0;" - do NOT say "missing return statement."
   - If they have "include <iostream>" (no #) - that IS a typo, say "add # before include". If they have "int man()" - say "typo: man→main".
   - ONLY report issues that you can VERIFY are actually wrong by looking at the exact characters in the code.

3. GRADE BREAKDOWN - each item must be specific:
   - WEAKNESSES: List each issue with location (e.g. "Line 12: ...", "In the switch: ..."). No vague items.
   - IMPROVEMENTS: Give concrete fixes (e.g. "Initialize choice before the if: int choice = 0;")
   - STRENGTHS: Reference specific code that works well

4. ITEMIZED ISSUES: Populate "itemizedIssues" with every distinct problem. Each entry: issue (what's wrong), location (line or snippet), fix (correct approach).
   - NEVER include typos in cout/printf strings (e.g. "schollar ship") as an itemized issue. Do NOT list them in weaknesses, suggestions, or improvements. Zero points deducted for output string spelling.

5. FEEDBACK TONE: Be encouraging and educational. Focus on learning and improvement rather than just pointing out errors.

6. FOCUS ON ERRORS THAT CAUSE CODE TO FAIL - NO SPELLING/GRAMMAR NIT-PICKING:
   - ONLY deduct for: (a) compile errors (syntax that prevents compilation), (b) runtime errors, (c) logic errors that produce wrong output, (d) uninitialized variables (undefined behavior), (e) missing required logic.
   - Do NOT deduct for: spelling in cout/printf strings (e.g. "schollar" vs "scholarship"), grammar in output text, typos in displayed messages. These are cosmetic - the code runs fine.
   - This is a CODING course, not grammar. Output string spelling does NOT cause code to fail. Do NOT penalize it in any mode (relaxed, standard, strict, very_strict).
   - Do NOT flag logic as "redundant" without tracing control flow. Example: else if(gpa >= 3.8) may handle a DIFFERENT case (e.g. high GPA alone qualifies) than the first if. Only flag redundancy when branches are TRULY unreachable.

${sampleSolutionInstruction}

IMPORTANT: You must provide BOTH detailed evaluation of the student's code AND sample solutions. The sample solutions help students learn different approaches after seeing their evaluation.

${getModeSpecificInstructions(aiEvaluationMode)}

${buildMandatoryAttemptFloorInstructionsForPrompt(aiEvaluationMode)}

Remember: Your goal is to help the student learn by (1) evaluating their specific submission with detailed feedback, and (2) showing them correct solutions with different approaches.`

  return basePrompt
}

function getModeSpecificInstructions(mode?: string): string {
  const m = String(mode || "standard").toLowerCase()
  const noSpellingNote = `- Do NOT deduct for spelling/grammar in output strings (cout, printf) - this applies to ALL modes.`
  if (m === "relaxed") {
    const rmin = getMinAttemptScorePercentForPrompt("relaxed")
    return `EVALUATION MODE: RELAXED — ATTEMPT FLOOR, NOT INFLATED SCORING

FEEDBACK vs NUMERIC FINAL:
- FEEDBACK: List ALL problems honestly (typos, syntax errors, missing pieces). Detailed, critical feedback is required.
- NUMERIC GRADE: Substantive attempts **cannot finish below ${rmin}%**. That is **only** a safety net for effort—it does **not** mean be generous. Many significant errors → **set finalScore at ${rmin}%** (or only slightly above if there is clear partial credit). **Do not** hand out 60–80% for broken or mostly-wrong work. Reserve higher scores for real correctness / meaningful partial solutions.
- Describe severity freely in feedback; keep the number honest relative to quality, bounded below by ${rmin}% for substantive attempts.
${noSpellingNote}`
  }
  if (m === "strict") {
    return `EVALUATION MODE: STRICT - HARD GRADING
- FEEDBACK: List all problems. Give detailed itemized feedback.
- SCORING: Be STRICT. Deduct for style issues, edge cases, best-practice violations. Reserve 100 for near-perfect code.
${noSpellingNote}`
  }
  if (m === "very_strict") {
    return `EVALUATION MODE: VERY STRICT - VERY HARD GRADING
- FEEDBACK: List all problems. Give detailed itemized feedback.
- SCORING: Be VERY STRICT. Professional standards. Reserve 100 for exceptional code only. Deduct for any deviation.
${noSpellingNote}`
  }
  return `EVALUATION MODE: STANDARD - MODERATELY STRICT GRADING
- FEEDBACK: List all problems. Give detailed itemized feedback.
- SCORING: A little stricter than relaxed. Moderate deductions for syntax errors and partial solutions. Not as lenient as relaxed, not as harsh as strict.
${noSpellingNote}`
}

function buildEvaluationPrompt(
  questionType: string,
  questionText: string,
  studentAnswer: string,
  correctAnswer?: string,
  rubric?: string,
  criteria?: any[],
  questionTypeConfig?: any,
  plotImage?: string,
  aiEvaluationMode?: string,
  typingVerdict?: { flagged: boolean; suspicionReasons: string[] } | null,
  codeLanguage?: string,
  allowedLangs: string[] = ["cpp"],
): string {
  const primaryRaw = (allowedLangs[0] || codeLanguage || "cpp").toLowerCase().trim()
  const lang = primaryRaw === "c++" ? "cpp" : primaryRaw
  const langLabel =
    lang === "cpp"
      ? "C++"
      : lang === "matlab"
        ? "MATLAB"
        : lang === "python"
          ? "Python"
          : lang === "java"
            ? "Java"
            : lang === "javascript"
              ? "JavaScript"
              : primaryRaw
  const multi = allowedLangs.length > 1
  let prompt = ""
  if (multi) {
    prompt += `ACCEPTED PROGRAMMING LANGUAGES: ${formatLanguageListForPrompt(allowedLangs)}\n`
    prompt += `Students may submit in any ONE of these languages. Identify the language from syntax and grade with that language's rules.\n`
    prompt += `CRITICAL: Do NOT penalize for "wrong language" when the submission clearly matches one of the accepted languages (for example, do not apply C++ mandatory boilerplate rules to MATLAB code).\n`
    prompt += `If the submission is clearly outside all accepted languages, deduct and state which languages were allowed.\n\n`
  } else {
    prompt += `EXPECTED PROGRAMMING LANGUAGE: ${langLabel}\n`
    prompt += `CRITICAL: Evaluate the student's code as ${langLabel}. If the student submitted code in a different language (e.g., Python when ${langLabel} was expected), deduct points and clearly state in feedback: "This assessment expects ${langLabel} code. You submitted [other language]. Please resubmit in ${langLabel}."\n\n`
  }
  prompt += `Question Type: ${questionType}\n\n`
  if ((questionType || "").toLowerCase() === "code_write_plot") {
    prompt += `MANDATORY CONTEXT: This is **code_write_plot** — students submit **MATLAB (or Octave-style)** code and may include a **plot image**. 
- **Do not** use C++ rubrics here: do NOT require or penalize for missing #include, int main(), using namespace, cout, cin, or semicolon rules from C++.
- Evaluate using MATLAB expectations (arrays, built-ins, function/script structure, \`end\` keywords, plot commands when a graph is required, etc.).
- When a plot image is included in the request, you MUST weigh it (see any plot instructions below).
- **Paste-friendly workflow:** Code is often **copied from the MATLAB editor** after the student ran it locally. **Never** treat that as misconduct or apply a typing/copy-paste penalty. **scoreBreakdown.suspiciousTypingPenalty must be 0**; **penaltyReason** must not cite paste or typing.

`
  }
  prompt += `Question:\n${questionText}\n\n`
  prompt += `Student's Code:\n${studentAnswer}\n\n`

  if (typingVerdict) {
    const mode = aiEvaluationMode ?? "standard"
    const deductionByMode: Record<string, number> = { relaxed: 3, standard: 10, strict: 15, very_strict: 20 }
    const maxDeduction = deductionByMode[mode] ?? 10

    if (typingVerdict.flagged && typingVerdict.suspicionReasons.length > 0) {
      prompt += `SUSPICIOUS_TYPING_VERDICT: true\n`
      prompt += `Reasons (pre-computed, do NOT re-analyze): ${typingVerdict.suspicionReasons.join("; ")}\n`
      prompt += `Apply a deduction of up to ${maxDeduction}% (cap 20%). Include in scoreBreakdown: rawScore, suspiciousTypingPenalty, penaltyReason (cite the reason above), finalScore.\n\n`
    } else {
      prompt += `SUSPICIOUS_TYPING_VERDICT: false\n`
      prompt += `No suspicious activity detected. Set suspiciousTypingPenalty: 0. Do NOT apply any typing/copy-paste deduction. Do NOT infer typos or edits from typing - you only see the final code.\n\n`
    }
  }

  if (questionType === "code_write") {
    const looksLikeCppCode =
      studentAnswer.includes("#include") ||
      studentAnswer.includes("using namespace") ||
      studentAnswer.includes("int main") ||
      studentAnswer.includes("cout") ||
      studentAnswer.includes("cin") ||
      studentAnswer.includes("std::")

    const looksLikeMatlabCode =
      /(?:^|\n)\s*%/.test(studentAnswer) ||
      (/\bfunction\b/i.test(studentAnswer) && /\bend\b/i.test(studentAnswer)) ||
      /\bfprintf\s*\(/.test(studentAnswer) ||
      /\bplot\s*\(/.test(studentAnswer) ||
      /\bdisp\s*\(/.test(studentAnswer) ||
      /\bzeros\s*\(/.test(studentAnswer) ||
      /\bclc\s*;?/im.test(studentAnswer)

    const allowedSet = new Set(allowedLangs)
    const expectCppSingle = !multi && (lang === "cpp" || lang === "c++")
    const isCppCode = expectCppSingle && looksLikeCppCode

    const cppBoilerplateBlock = `⚠️ EXPECTED LANGUAGE: C++ - C++ CODE DETECTED - MANDATORY BOILERPLATE REQUIRED:

TEMPLATE CONTEXT (CRITICAL): Trailblazer members receive a pre-filled template (#include <iostream>, using namespace std;, int main()). Scholar members start with an empty editor. If the student has the STRUCTURE but with a TYPO, do NOT treat as "missing":
- "include <iostream>" (no #) = typo, not missing - say "add # before include" (deduct 5-8 pts, not 15-20)
- "int man()" or "int main" (typo) = typo, not missing - say "typo: man should be main" (deduct 5-8 pts, not 20-25)
- "using namespace std" (no semicolon) = typo - say "add ; at end" (deduct 3-5 pts)
- Only penalize as "missing" when the element is COMPLETELY absent (e.g. no include line at all, no main function at all)

USING NAMESPACE STD (CLASS POLICY - CRITICAL):
- Our class ALWAYS uses "using namespace std;" - it is required. If the student uses std:: prefix instead (e.g. std::cout, std::cin) but omits "using namespace std;", FLAG THIS in your feedback.
- Say: "You did not use 'using namespace std;' - our class always uses this. Add it after the #include line. Using std:: prefix is acceptable but we require the using directive in this course."
- Deduct 8-12 points for missing "using namespace std;" when the code is C++ and uses cin/cout - report this clearly so the student knows they need to attend class / follow course conventions.

For C++ code_write questions, the following are MANDATORY and code will NOT run in real-world tests without them:
- MANDATORY: #include <iostream> - Required for input/output operations (cin, cout)
- MANDATORY: using namespace std; - Required for using standard library functions without std:: prefix
- MANDATORY: int main() - Required entry point for C++ programs

PENALTY SYSTEM:
- Completely missing boilerplate: Deduct 15-25 points per missing element
- Typo in boilerplate (include vs #include, man vs main): Deduct 5-8 points - student had the structure
- Clearly state in feedback: "You have the right structure; fix the typo: X" rather than "You're missing X entirely"

CRITICAL: If ANY of these mandatory C++ elements are missing, the code CANNOT run in real-world tests. 
- If ALL THREE are missing: Maximum score is 40/100 (code is non-functional)
- If TWO are missing: Maximum score is 50-55/100
- If ONE is missing: Maximum score is 60-70/100
- If present with minor typo: Deduct 5-8 points only; focus feedback on the fix

⚠️ IMPORTANT: These requirements ONLY apply to C++ code. If the code is in a different language (Python, Java, etc.), skip this step and proceed to STEP 2.`

    const cppWrongLangNote = `NOTE: This does not appear to be C++ code. Student may have submitted wrong language. Check the ACCEPTED / EXPECTED PROGRAMMING LANGUAGE instructions above—if the student used a language that is not allowed, deduct points and proceed to STEP 2.`

    prompt += `CRITICAL EVALUATION STEPS FOR CODE_WRITE QUESTIONS:

STEP 1 - LANGUAGE CHECK:
`

    if (expectCppSingle) {
      prompt += isCppCode ? cppBoilerplateBlock : cppWrongLangNote
    } else if (multi) {
      prompt += `ACCEPTED LANGUAGES FOR THIS ITEM: ${formatLanguageListForPrompt(allowedLangs)}.
- Identify which language the student used. If it is one of the accepted languages, grade with that language's rules.
- Do NOT deduct for "wrong language" when the submission clearly matches one of the accepted languages.
- If the code is clearly not in any accepted language, deduct and say which languages were allowed.

`
      if (allowedSet.has("cpp") && looksLikeCppCode) {
        prompt += cppBoilerplateBlock
      } else if (allowedSet.has("matlab") && looksLikeMatlabCode && !looksLikeCppCode) {
        prompt += `MATLAB-style submission detected. Evaluate with MATLAB syntax and conventions (% comments, end keywords, built-ins). Do NOT apply C++ mandatory boilerplate (#include, int main, using namespace).\n`
      } else if (allowedSet.has("cpp") && !looksLikeCppCode) {
        prompt += cppWrongLangNote
      } else {
        prompt += `Use syntax cues to choose among the accepted languages; proceed to STEP 2 using the inferred language.\n`
      }
    } else {
      prompt += `Expected language is ${langLabel}. Skip C++ boilerplate. Evaluate using ${langLabel} syntax and conventions. If student submitted a different language, deduct points and state in feedback.`
    }

    prompt += `

STEP 2 - SYNTAX ERROR CHECK:
- Check for missing semicolons (;) at end of statements
- Check for unmatched braces { }, parentheses ( ), or brackets [ ]
- Check for incorrect keywords or typos
- Check for missing return statements in functions (especially return 0; in main())
- Check for undeclared variables
- Check for type mismatches
- If syntax errors exist, deduct points (typically 20-30 points) and clearly list all syntax errors

STEP 3 - MISSING LIBRARIES/HEADERS CHECK:
- Check if code uses cin/cout but missing #include <iostream> (already checked in STEP 1, but verify)
- Check if code uses string operations but missing #include <string>
- Check if code uses math functions (sqrt, pow, etc.) but missing #include <cmath>
- Check if code uses arrays/vectors but missing appropriate headers
- Check if code uses other standard library features without proper includes
- If missing includes (beyond the mandatory ones), deduct points (typically 10-15 points) and list what's missing

STEP 4 - COMPILATION CHECK (STRICT):
- Code must compile without errors to receive full credit
- If code doesn't compile due to missing mandatory boilerplate, syntax errors, or missing includes: Maximum score is 20-30/100 points
- Code that doesn't compile cannot solve the problem - penalize heavily
- Clearly explain what prevents compilation
- Emphasize that missing mandatory C++ boilerplate (#include <iostream>, using namespace std;, int main()) will prevent compilation

STEP 5 - FUNCTIONALITY CHECK (STRICT EVALUATION):
- Code MUST actually solve the stated problem to receive significant points
- Just having includes and variable declarations is NOT sufficient - award only 5-10/100 points
- Code with incomplete logic (missing main functionality): Maximum 15-25/100 points
- Code must implement the core algorithm/logic required by the problem
- Check if code produces correct output for the given problem
- Check for logical errors in the implementation
- Check for edge cases (but don't penalize heavily if basic functionality works)
- Missing core functionality: Maximum 20-30/100 points
- Partial functionality: Maximum 40-60/100 points
- Complete functionality with minor issues: 60-80/100 points
- Complete and correct functionality: 80-100/100 points

STEP 6 - CODE QUALITY (LENIENT EVALUATION):
- Only evaluate code quality if code has actual functionality (not just boilerplate)
- Evaluate structure and basic readability
- DO NOT penalize for:
  * Short variable names (e.g., 'rent', 'total', 'avg') - these are acceptable
  * Missing comments - students have limited time, comments are optional
  * Missing input validation - only penalize if explicitly required by problem
  * Missing edge case handling - only penalize if explicitly required
- Code quality points should be minimal (0-5 points) if code doesn't solve the problem
- Code quality points should be high (20-25 points) if code solves the problem correctly, even without comments or descriptive names

SCORING SUMMARY (Focus on Correctness):
- Code with ONLY includes and variables (no logic): 5-10/100 points
- Code with includes, variables, but incomplete logic: 15-25/100 points
- Code with syntax errors (won't compile): Maximum 20-30/100 points
- Code that compiles but doesn't solve problem: Maximum 40-50/100 points
- Code that solves problem correctly: 85-100/100 points (award high scores for correct solutions)

CRITICAL REMINDERS:
- Do NOT award 30/100 for code that only has includes and variable declarations. That is too generous. Such code should receive 5-10/100 maximum.
- DO award 85-100/100 points for code that correctly solves the problem, even without comments, descriptive variable names, or input validation
- Focus scoring on correctness and functionality, not on optional enhancements like comments or input validation
- Students have limited time - do not penalize for missing "nice to have" features that aren't explicitly required

IMPORTANT: 
- Missing mandatory C++ boilerplate (#include <iostream>, using namespace std;, int main()) is a CRITICAL issue that MUST be penalized heavily as the code will NOT run in real-world tests
- Syntax errors and missing includes are CRITICAL issues that must be identified and penalized heavily
- A program that doesn't compile cannot receive full credit (maximum 30/100)
- Code that doesn't solve the problem cannot receive more than 50/100
- Always check for mandatory boilerplate FIRST before evaluating other aspects
- Be STRICT with scoring - incomplete code should receive minimal points\n\n`
  }

  if (correctAnswer) {
    prompt += `${formatCanonicalReferenceAnswerForPrompt(correctAnswer)}\n\n`
  }

  if (rubric) {
    prompt += `Grading Rubric:\n${rubric}\n\n`
  }

  if (questionTypeConfig && questionTypeConfig.evaluation_rubric) {
    prompt += `Evaluation Rubric:\n${questionTypeConfig.evaluation_rubric}\n\n`
  }

  if (plotImage && questionType === 'code_write_plot') {
    prompt += `\n📊 PLOT IMAGE PROVIDED - EVALUATION REQUIRED:\n

⚠️ FIRST: Check if the question REQUIRES a plot/visualization in its requirements.

IF THE QUESTION REQUIRES A PLOT (mentions "plot", "graph", "visualize", "chart", etc.):
You MUST thoroughly analyze the plot and verify it matches the code requirements.

STRICT PLOT EVALUATION CRITERIA:
1. **Plot Relevance** (CRITICAL - 40% of grade):
   - Does the plot DIRECTLY relate to what the code is supposed to generate?
   - Does the plot show the correct type of visualization for this problem?
   - If the plot is IRRELEVANT or shows something completely different, DEDUCT AT LEAST 40 POINTS.

2. **Plot Correctness** (30% of grade):
   - Does the plot accurately represent the data/calculations from the code?
   - Are the data points, curves, or bars correct?
   - Does the plot match the expected output described in the question?

3. **Plot Formatting** (15% of grade):
   - Proper axis labels with units
   - Clear title describing what is plotted
   - Legend if multiple data series
   - Appropriate scale and range

4. **Plot Quality** (15% of grade):
   - Professional appearance
   - Readable labels and text
   - Appropriate colors and markers
   - Grid lines if helpful

⚠️ PENALTIES:
- IRRELEVANT plot (shows wrong thing): -50 points minimum
- Missing/wrong axis labels: -10 points
- No title: -5 points
- Wrong data/calculations: -30 points
- Poor formatting: -10 points

CRITICAL: If the plot is completely irrelevant to the question requirements (e.g., showing a 3D surface when a 2D line plot is required, or showing random data unrelated to the problem), the maximum possible score is 50/100 even if the code is perfect.

Consider BOTH the code AND the plot in your evaluation. The plot is 50% of the grade for code_write_plot questions.

---

IF THE QUESTION DOES NOT REQUIRE A PLOT (no mention of "plot", "graph", "visualize", "chart", etc.):
The student uploaded a plot as BONUS/EXTRA WORK (not required).

BONUS PLOT EVALUATION (Optional - up to +10 bonus points):
- If plot is relevant and helpful: Award up to +10 bonus points
- If plot is irrelevant or wrong: Ignore it, do NOT penalize (it wasn't required)
- Focus mainly on the code since that's what was asked for
- Mention in feedback: "Note: A plot was not required for this question, but you provided one as bonus work. [evaluation of bonus plot]"

IMPORTANT: Only penalize wrong plots if the question explicitly required a plot. Otherwise, treat plots as optional bonus work.\n\n`
  }

  const submissionTrimLen = (studentAnswer || "").trim().length
  prompt += `
${buildMandatoryAttemptFloorInstructionsForPrompt(aiEvaluationMode)}

CONTEXT FOR THIS SUBMISSION: trimmed student code length = ${submissionTrimLen} characters. Use this with the system prompt to decide if the attempt is substantive (≥ ~20 chars of real work, not template-only).

Please evaluate this submission and provide:
1. A score from 0-100 (substantive attempts: **≥** mode minimum; do **not** inflate—many serious problems → **at** the minimum, not high partial credit. Non-substantive work: low scores allowed.)
2. Whether the answer is correct (true/false) - only true if code solves the problem correctly
3. Detailed feedback explaining the score
4. Breakdown of points for each criterion
5. Specific suggestions for improvement
6. Detailed explanation of why this specific grade was given
7. Comprehensive grade breakdown with reasoning, strengths, weaknesses, and improvements

CRITICAL SCORING REMINDERS:
- If the attempt is **substantive**, the **MANDATORY MINIMUM** block above overrides any conflicting **lower** bound below—it does **not** tell you to score above the minimum; weak submissions should often sit **at** the minimum.
- Code with ONLY includes and variable declarations: 5-10/100 points (NOT 30/100) — *non-substantive / stub only*
- Code with incomplete logic: 15-25/100 points (NOT 40/100) — *does not apply below the mandatory minimum if substantive*
- Code with syntax errors: often 20-30/100 in harsh grading — *but if substantive in this mode, floor still applies*
- Code that doesn't solve the problem: Maximum 40-50/100 points
- Code that solves the problem correctly: 85-100/100 points (award high scores)
- Code must demonstrate actual problem-solving implementation to receive meaningful points
- Do NOT be generous with partial credit for incomplete code
- DO award full credit (85-100/100) for correct solutions, even without comments, descriptive names, or input validation
- Do NOT penalize for missing comments, short variable names, or input validation unless explicitly required
- NO FALSE FLAGS: Verify each claim against the actual code. If "#include" or ";" exist, do NOT report them as missing.
- NO SPELLING PENALTIES: Do NOT deduct for typos in cout/printf strings (e.g. "schollar ship"). Do NOT list them in itemizedIssues, suggestions, or weaknesses. Zero deduction.
- NO FALSE REDUNDANCY: Do NOT flag else-if as "redundant" without tracing flow - it may handle a different case (e.g. high GPA alone qualifies).

IMPORTANT: Focus on evaluating the student's specific submission. Provide detailed feedback on their code${plotImage ? ' and plot' : ''}, pointing out what they did well and what could be improved. Be specific about lines, functions, or concepts in their ${plotImage ? 'code and plot elements' : 'code'}.

${plotImage ? '\n⚠️⚠️⚠️ CRITICAL: PLOT EVALUATION LOGIC ⚠️⚠️⚠️\n\nA plot image is attached. FIRST determine if a plot was REQUIRED:\n\nSTEP 1: Read the question requirements carefully\nSTEP 2: Check if it mentions: "plot", "graph", "visualize", "chart", "diagram", "draw", "show graphically"\n\nSTEP 3A - IF PLOT WAS REQUIRED:\n✅ You MUST evaluate the plot strictly (50% of grade)\n✅ Verify plot matches what code should generate\n✅ Check relevance to problem requirements  \n✅ Confirm correct type of visualization\n✅ If plot is WRONG: Deduct 50 points, max score 50/100\n✅ State clearly if plot is irrelevant/incorrect\n\nSTEP 3B - IF PLOT WAS NOT REQUIRED:\n✅ Treat plot as BONUS/EXTRA work (up to +10 points)\n✅ Do NOT penalize wrong/irrelevant plots (they weren\'t asked for)\n✅ Evaluate mainly the code (what was actually required)\n✅ Mention: "A plot was not required, but you provided one as bonus work..."\n✅ If plot is good and relevant: Award up to +10 bonus points\n✅ If plot is irrelevant: Ignore it, focus on code\n\nEXAMPLE:\nQuestion: "Compute and display matrix sums and trace" (no plot mentioned)\n→ Plot is OPTIONAL → Do NOT penalize if wrong → Can give bonus if good\n\nQuestion: "Create a plot showing the matrix data visualization"\n→ Plot is REQUIRED → Strict evaluation → Penalize if wrong\n\nDo NOT penalize students for wrong plots if the question never asked for a plot!\n' : ''}
Remember to respond with valid JSON only, following the exact structure specified in the system prompt.`

  return prompt
}

const DEFAULT_CPP_TEMPLATE = `#include <iostream>
using namespace std;

int main() {
    // Start your code here
    cout << "Hello, world!" << endl;
    return 0;
}`

const DEFAULT_MATLAB_PLOT_STARTER = `% MATLAB Script
% Start your code here

disp('Hello, MATLAB!');
`

type HeuristicParams = {
  questionType: string
  questionText: string
  studentAnswer: string
  correctAnswer?: string
  rubric?: string
  maxPoints: number
  aiEvaluationMode?: string
}

function buildMatlabCodeWritePlotHeuristic({
  questionType,
  studentAnswer,
  maxPoints,
  aiEvaluationMode = "standard",
}: {
  questionType: string
  studentAnswer: string
  maxPoints: number
  aiEvaluationMode?: string
}): EvaluateCodeResult {
  const raw = String(studentAnswer ?? "").trim()
  let code = raw
  try {
    const p = JSON.parse(raw)
    if (p && typeof p.code === "string") code = p.code
  } catch {
    // answer may be raw MATLAB, not JSON
  }
  const matlab = String(code).trim()
  const norm = (s: string) => s.replace(/\s+/g, " ").trim()
  const isMatlabDefaultOnly = norm(matlab) === norm(DEFAULT_MATLAB_PLOT_STARTER)

  if (!matlab) {
    return {
      score: 0,
      isCorrect: false,
      maxPoints,
      pointsEarned: 0,
      feedback: "We didn't detect any MATLAB code for this question. Please provide your code and any required plot so we can grade it.",
      criteria: { correctness: 0, codeQuality: 0, efficiency: 0, completeness: 0 },
      suggestions: [
        "Run your script in MATLAB or Octave and fix errors before submitting",
        "If a plot is required, export the figure and upload it with your code",
      ],
      detailedExplanation:
        "No code was detected in your submission, so we could not award points. Please paste your full MATLAB answer and resubmit.",
      gradeBreakdown: {
        reasoning: "No code was provided to evaluate.",
        strengths: [],
        weaknesses: ["No MATLAB code detected"],
        improvements: ["Provide a complete MATLAB solution in the editor"],
      },
      sampleAnswers: [],
      requiresManualReview: false,
      aiGraded: false,
      status: "Just Beginning",
      statusMessage: "Please provide your full solution.",
    }
  }

  const hasPlotCmd =
    /(?:^|[^A-Za-z_0-9])(?:plot|fplot|ezplot|scatter|bar|stairs|stem|imagesc|contour|surf|mesh|histogram|polarplot)\s*\(/i.test(
      matlab,
    )
  const hasFigure = /\bfigure\s*\(/i.test(matlab)
  const hasLabels = /\b(xlabel|ylabel|title|legend|grid)\s*\(/i.test(matlab)
  const hasLoop = /\bfor\b[\s\S]{0,800}\bend\b/i.test(matlab) || /\bwhile\b/.test(matlab)
  const hasMatrix =
    /\[[^\]]{2,120}\]/.test(matlab) || /\b(?:zeros|ones|linspace|rand|eye)\s*\(/i.test(matlab)
  const hasFunction = /^\s*function(?:\s+\[|\s+\w)/im.test(matlab)
  const hasComment = /^\s*%/m.test(matlab)

  let score = 12
  score += hasPlotCmd || hasFigure ? 25 : 0
  score += hasLabels ? 8 : 0
  score += hasLoop ? 10 : 0
  score += hasMatrix || hasFunction ? 18 : 0
  score += hasComment ? 2 : 0
  score += Math.min(25, Math.floor(matlab.length / 8))

  if (isMatlabDefaultOnly) {
    score = Math.min(score, 5)
  }

  score = Math.max(0, Math.min(100, score))

  let pointsEarned = parseFloat(((score / 100) * maxPoints).toFixed(2))
  const attemptText = extractTextForAttemptFloorCheck(questionType, studentAnswer)
  if (isEligibleForAttemptMinimumFloor(questionType, attemptText)) {
    const mode = String(aiEvaluationMode || "standard").toLowerCase()
    const minFraction = MIN_ATTEMPT_SCORE_FRACTION_BY_MODE[mode] ?? 0.25
    const minPoints = parseFloat((minFraction * maxPoints).toFixed(2))
    if (pointsEarned < minPoints) {
      pointsEarned = minPoints
      score = Math.round((pointsEarned / maxPoints) * 100)
    }
  }
  const passingThreshold = 60
  const strengths: string[] = []
  if (hasPlotCmd || hasFigure) strengths.push("Contains plotting/figure elements typical of the assignment type")
  if (hasMatrix || hasFunction) strengths.push("Uses MATLAB vectors/matrices or a function as appropriate")
  if (hasLoop) strengths.push("Uses control flow (e.g. for/while)")

  return {
    score,
    isCorrect: score >= passingThreshold,
    maxPoints,
    pointsEarned,
    feedback:
      score <= 5
        ? "This still looks like the default MATLAB starter. Add your real solution and any required plot before submitting."
        : "Automatic grading awarded partial credit based on MATLAB structure (this course treats code_write_plot as MATLAB, not C++). Review the guidance below; full feedback requires the AI grader when available.",
    criteria: {
      correctness: Math.min(40, Math.max(0, score - 45)),
      codeQuality: hasFunction || (hasMatrix && hasComment) ? 20 : 10,
      efficiency: hasLoop ? 15 : 8,
      completeness: hasPlotCmd || hasFigure ? 15 : 8,
    },
    suggestions: [
      "Check axis labels, title, and legend when a plot is required",
      "Confirm array dimensions and use clear variable names",
      "If a figure was required, ensure the uploaded image matches the script output",
    ],
    detailedExplanation:
      "This score was generated with a fallback heuristic. Points were based on typical MATLAB and plotting patterns—not on C++ headers or int main().",
    gradeBreakdown: {
      reasoning:
        isMatlabDefaultOnly
          ? "Submission matches the default MATLAB template with no real solution work."
          : "We looked for plotting commands, figure calls, matrix/vector work, and structure consistent with MATLAB for code_write_plot questions.",
      strengths,
      weaknesses: isMatlabDefaultOnly
        ? ["No substantive MATLAB beyond the default template"]
        : ["Heuristic cannot verify correct outputs or image/plot quality without the AI grader"],
      improvements: [
        "Add complete logic to satisfy the problem statement",
        "Include plot/figure code when a graph is required, and keep the displayed figure consistent with the code",
      ],
    },
    sampleAnswers: [],
    requiresManualReview: false,
    aiGraded: false,
    status: score >= 60 ? "Keep Practicing" : "Just Beginning",
    statusMessage:
      score >= 60 ? "Good attempt! You're on the right track." : "Good effort! Keep exploring and learning.",
  }
}

function buildHeuristicEvaluation({
  questionType,
  questionText,
  studentAnswer,
  correctAnswer,
  rubric,
  maxPoints,
  aiEvaluationMode = "standard",
}: HeuristicParams): EvaluateCodeResult {
  const normalizedAnswer = (studentAnswer || "").trim()
  const qt = (questionType || "").toLowerCase()

  if (qt === "code_write_plot") {
    return buildMatlabCodeWritePlotHeuristic({
      questionType,
      studentAnswer,
      maxPoints,
      aiEvaluationMode,
    })
  }

  const isHelloWorldLegacy =
    normalizedAnswer.replace(/\s+/g, " ").trim() === DEFAULT_CPP_TEMPLATE.replace(/\s+/g, " ").trim()
  const isStarterOnly =
    isHelloWorldLegacy || isLikelyUnmodifiedStarterCode(normalizedAnswer)

  if (!normalizedAnswer) {
    return {
      score: 0,
      isCorrect: false,
      maxPoints,
      pointsEarned: 0,
      feedback: "We didn't detect any code for this question. Please provide your full solution so we can grade it.",
      criteria: {
        correctness: 0,
        codeQuality: 0,
        efficiency: 0,
        completeness: 0,
      },
      suggestions: [
        "Ensure your code compiles locally before submitting",
        "Double-check that you pasted the entire solution",
      ],
      detailedExplanation: "No code was detected in your submission, so we could not award points. Please paste your full answer and resubmit.",
      gradeBreakdown: {
        reasoning: "No executable code was provided to evaluate.",
        strengths: [],
        weaknesses: ["No code detected"],
        improvements: ["Provide a complete solution in the editor"],
      },
      sampleAnswers: [],
      requiresManualReview: false,
      aiGraded: false,
      status: "Just Beginning",
      statusMessage: "Please provide your full solution.",
    }
  }

  const hasMain = /int\s+main\s*\(/i.test(normalizedAnswer)
  const hasInclude = /#include\s+[<"]\w+/i.test(normalizedAnswer)
  const hasIostream = /#include\s+[<"]iostream[>"]/i.test(normalizedAnswer)
  const hasLoop = /(for|while)\s*\(/i.test(normalizedAnswer)
  const hasConditionals = /(if\s*\(|switch\s*\()/i.test(normalizedAnswer)
  const hasReturn = /return\s+[^;]+;/i.test(normalizedAnswer)
  const lengthScore = Math.min(40, Math.max(0, normalizedAnswer.length - DEFAULT_CPP_TEMPLATE.length))

  let score = 10
  score += hasInclude ? 10 : 0
  score += hasIostream ? 5 : 0
  score += hasMain ? 15 : 0
  score += hasLoop ? 10 : 0
  score += hasConditionals ? 10 : 0
  score += hasReturn ? 5 : 0
  score += Math.min(35, Math.floor(lengthScore / 10))

  if (isStarterOnly) {
    score = Math.min(score, 5)
  }

  score = Math.max(0, Math.min(100, score))

  let pointsEarned = parseFloat(((score / 100) * maxPoints).toFixed(2))
  const attemptText = extractTextForAttemptFloorCheck(questionType, studentAnswer)
  if (isEligibleForAttemptMinimumFloor(questionType, attemptText)) {
    const mode = String(aiEvaluationMode || "standard").toLowerCase()
    const minFraction = MIN_ATTEMPT_SCORE_FRACTION_BY_MODE[mode] ?? 0.25
    const minPoints = parseFloat((minFraction * maxPoints).toFixed(2))
    if (pointsEarned < minPoints) {
      pointsEarned = minPoints
      score = Math.round((pointsEarned / maxPoints) * 100)
    }
  }
  const passingThreshold = 60

  return {
    score,
    isCorrect: score >= passingThreshold,
    maxPoints,
    pointsEarned,
    feedback:
      score <= 5
        ? "This looks like the starter template. Please add your complete solution before submitting."
        : "Automatic grading awarded partial credit based on structural elements in your code. Review the suggestions below to improve your score.",
    criteria: {
      correctness: Math.min(40, Math.max(0, score - 50)),
      codeQuality: hasInclude && hasMain ? 20 : 5,
      efficiency: hasLoop || hasConditionals ? 15 : 5,
      completeness: hasReturn ? 15 : 5,
    },
    suggestions: [
      "Add comments explaining key parts of your solution",
      "Ensure the code handles all requirements from the prompt",
      "Test with different inputs before submitting",
    ],
    detailedExplanation:
      "This score was generated using a heuristic fallback because the AI grading service is currently unavailable. Points were awarded based on detected structure (includes, main function, loops) and the amount of code provided.",
    gradeBreakdown: {
      reasoning: "We detected standard C++ structure and rewarded features like loops, conditionals, and return statements.",
      strengths: [
        ...(hasInclude ? ["Includes necessary headers"] : []),
        ...(hasMain ? ["Defines a main function"] : []),
        ...(hasLoop ? ["Implements looping constructs"] : []),
      ],
      weaknesses: isStarterOnly
        ? ["Solution matches the starter template or has no real implementation"]
        : ["Unable to verify correctness without full AI grading"],
      improvements: [
        "Add full logic that solves the prompt",
        "Handle edge cases and validate inputs",
        "Include descriptive comments or output",
      ],
    },
    sampleAnswers: [],
    requiresManualReview: false,
    aiGraded: false,
    status: score >= 60 ? "Keep Practicing" : "Just Beginning",
    statusMessage: score >= 60 ? "Good attempt! You're on the right track." : "Good effort! Keep exploring and learning.",
  }
}

/**
 * Evaluates code using AI. Throws only for validation errors (missing required fields).
 * On OpenAI/parse errors, returns heuristic fallback (never throws).
 */
export async function evaluateCode(params: EvaluateCodeParams): Promise<EvaluateCodeResult> {
  const {
    questionType,
    questionText,
    studentAnswer,
    correctAnswer,
    rubric,
    maxPoints = 100,
    plotImage,
    aiEvaluationMode = "standard",
    codeLanguage: codeLanguageParam = "cpp",
    allowedCodeLanguages: allowedCodeLanguagesParam,
    typingReplay,
    aiModel,
    aiModelByTask,
    aiEnableOpusFallback,
    aiOpusConfidenceThreshold,
  } = params

  const aiModelSettings: AiModelSettings = {
    aiModel,
    aiModelByTask,
    aiEnableOpusFallback,
    aiOpusConfidenceThreshold,
  }

  const isPlotQt = (questionType || "").toLowerCase() === "code_write_plot"
  const normalizeLangList = (ids: string[]): string[] => {
    const out: string[] = []
    const seen = new Set<string>()
    for (const raw of ids) {
      const n = normalizeAiCodeLanguage(raw)
      if (n && !seen.has(n)) {
        seen.add(n)
        out.push(n)
      }
    }
    return out
  }

  let allowedNorm: string[]
  if (isPlotQt) {
    allowedNorm = ["matlab"]
  } else if (Array.isArray(allowedCodeLanguagesParam) && allowedCodeLanguagesParam.length > 0) {
    allowedNorm = normalizeLangList(allowedCodeLanguagesParam.map(String))
    if (allowedNorm.length === 0) {
      allowedNorm = [normalizeAiCodeLanguage(codeLanguageParam) || "cpp"]
    }
  } else {
    allowedNorm = [normalizeAiCodeLanguage(codeLanguageParam) || "cpp"]
  }

  const codeLanguage = allowedNorm[0]

  // Validate required fields - throw only for validation errors
  if (!questionType || !questionText || !studentAnswer) {
    throw new Error("Missing required fields: questionType, questionText, and studentAnswer are required")
  }

  const resolvedModel = resolveAiModel({ questionType, ...aiModelSettings, skipEscalation: true })
  const apiKey =
    resolvedModel.provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY

  if (!apiKey?.trim()) {
    console.error(`${EVAL_LOG} AI API key not set for provider=${resolvedModel.provider}, using heuristic fallback`)
    return buildHeuristicEvaluation({
      questionType,
      questionText,
      studentAnswer,
      correctAnswer,
      rubric: typeof rubric === "string" ? rubric : undefined,
      maxPoints,
      aiEvaluationMode,
    })
  }

  let apiStart: number | null = null
  let requestReceivedAt: string | null = null
  let timeoutMs = 180000
  let retryCount = 0
  const retryLog: Array<{ attempt: number; at: string; error?: string }> = []
  let requestSummary: Record<string, unknown> | undefined

  try {
    const configResult = await sql`
      SELECT 
        mc.model_name, mc.temperature, mc.max_tokens, mc.top_p, mc.frequency_penalty, mc.presence_penalty,
        ec.criteria_name, ec.weight, ec.prompt_template, ec.is_enabled,
        qtc.specific_prompt, qtc.evaluation_rubric, qtc.partial_credit_enabled,
        sc.perfect_score_threshold, sc.good_score_threshold, sc.passing_score_threshold
      FROM ai_evaluation_config aec
      LEFT JOIN ai_model_config mc ON aec.id = mc.config_id
      LEFT JOIN ai_evaluation_criteria ec ON aec.id = ec.config_id AND ec.is_enabled = true
      LEFT JOIN ai_question_type_config qtc ON aec.id = qtc.config_id AND qtc.question_type = ${questionType.toLowerCase()}
      LEFT JOIN ai_scoring_config sc ON aec.id = sc.config_id
      WHERE aec.is_active = true
      ORDER BY ec.weight DESC
    `

    const modelConfig = configResult.length > 0 ? {
      model_name: configResult[0].model_name,
      temperature: parseFloat(configResult[0].temperature) || 0.3,
      max_tokens: parseInt(configResult[0].max_tokens) || 4000,
      top_p: parseFloat(configResult[0].top_p) || 1.0,
      frequency_penalty: parseFloat(configResult[0].frequency_penalty) || 0.0,
      presence_penalty: parseFloat(configResult[0].presence_penalty) || 0.0
    } : {
      model_name: "gpt-5-mini",
      temperature: 0.3,
      max_tokens: 4000,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0
    }

    const criteria = configResult.length > 0 ? 
      configResult.filter((row, index, self) => 
        row.criteria_name && index === self.findIndex(r => r.criteria_name === row.criteria_name)
      ).map(row => ({
        name: row.criteria_name,
        weight: row.weight,
        prompt: row.prompt_template
      })) : 
      [
        { name: "Correctness", weight: 40, prompt: "Evaluate correctness" },
        { name: "Code Quality", weight: 25, prompt: "Assess code quality" },
        { name: "Efficiency", weight: 20, prompt: "Evaluate efficiency" },
        { name: "Completeness", weight: 15, prompt: "Check completeness" }
      ]

    const questionTypeConfig = configResult.find(row => row.specific_prompt)
    const scoringConfig = configResult[0] || {
      perfect_score_threshold: 90,
      good_score_threshold: 70,
      passing_score_threshold: 50
    }

    /** MATLAB plot questions: paste from MATLAB IDE is expected — never feed typing/paste suspicion into the model. */
    const typingVerdict =
      (questionType || "").toLowerCase() === "code_write_plot"
        ? null
        : typingReplay?.events?.length
          ? analyzeReplayForSuspicion(typingReplay)
          : null

    const prompt = buildEvaluationPrompt(
      questionType,
      questionText,
      studentAnswer,
      correctAnswer,
      rubric as string | undefined,
      criteria,
      questionTypeConfig,
      typeof plotImage === "string" ? plotImage : undefined,
      aiEvaluationMode,
      typingVerdict,
      codeLanguage,
      allowedNorm
    )

    const useVision = questionType === 'code_write_plot' && !!plotImage
    const model = resolvedModel.modelId
    const fallbackModel = resolveApiFallbackForModel(model, resolvedModel.stack)

    apiStart = Date.now()
    requestReceivedAt = new Date().toISOString()

    requestSummary = {
      questionType,
      questionTextLength: (questionText || "").length,
      studentAnswerLength: (studentAnswer || "").length,
      correctAnswerLength: (correctAnswer || "").length,
      model,
      useVision: !!useVision,
      maxPoints,
      aiEvaluationMode,
    }

    let rawText: string
    const maxEvalAttempts = 2
    let usedFallback = false
    let effectiveModel = model

    const messages: { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }[] = [
      {
        role: "system",
        content: getSystemPrompt(questionType, criteria, questionTypeConfig, useVision, aiEvaluationMode),
      },
    ]

    if (useVision && plotImage) {
      const imageUrl = typeof plotImage === "string" ? plotImage : String(plotImage)
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      })
    } else {
      messages.push({ role: "user", content: prompt })
    }

    for (let attempt = 0; attempt < maxEvalAttempts; attempt++) {
      retryCount = attempt
      if (attempt === 1 && isResponsesModel(model) && !usedFallback) {
        usedFallback = true
        effectiveModel = fallbackModel
        console.warn(`${EVAL_LOG} Primary model failed, trying fallback ${fallbackModel}`)
      } else if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
      }

      try {
        console.log(`${EVAL_LOG} Calling model=${effectiveModel} provider=${resolvedModel.provider} attempt=${attempt + 1}/${maxEvalAttempts}`)

        if (useVision && plotImage) {
          const imageUrl = typeof plotImage === "string" ? plotImage : String(plotImage)
          const userParts = [
            { type: "text" as const, text: prompt },
            { type: "image_url" as const, image_url: { url: imageUrl } },
          ]
          const visionResult = await callVisionModelWithFallback(
            process.env.OPENAI_API_KEY || apiKey,
            effectiveModel,
            getSystemPrompt(questionType, criteria, questionTypeConfig, true, aiEvaluationMode),
            userParts,
            fallbackModel,
          )
          rawText = visionResult.text
          effectiveModel = visionResult.modelUsed
        } else if (isResponsesModel(effectiveModel) && resolvedModel.provider === "openai") {
          const gpt5Tokens = Math.max(modelConfig.max_tokens ?? 4000, 8192)
          rawText = await callGpt5Evaluation(apiKey, effectiveModel, messages, { max_tokens: gpt5Tokens }, timeoutMs)
        } else {
          const chatResult = await chatCompletionWithFallback(apiKey, {
            model: effectiveModel,
            messages: messages as { role: string; content: string }[],
            temperature: modelConfig.temperature,
            max_tokens: modelConfig.max_tokens,
            top_p: modelConfig.top_p,
            frequency_penalty: modelConfig.frequency_penalty,
            presence_penalty: modelConfig.presence_penalty,
            response_format: { type: "json_object" },
          })
          rawText = chatResult.content
          effectiveModel = chatResult.modelUsed
          if (chatResult.usedFallback) usedFallback = true
        }

        if (!rawText?.trim()) {
          throw new Error("Empty or invalid response from model")
        }

        try {
          JSON.parse(rawText)
        } catch {
          console.warn(`${EVAL_LOG} JSON parse failed (will attempt repair). Raw response (first 500 chars):`, rawText?.substring(0, 500))
        }
        break
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        retryLog.push({
          attempt: attempt + 1,
          at: new Date().toISOString(),
          error: errMsg,
        })

        if (attempt === maxEvalAttempts - 1) {
          throw new Error(errMsg)
        }
      }
    }

    const resultText = rawText!

    let aiResult: {
      score?: number
      isCorrect?: boolean
      feedback?: string
      criteria?: unknown
      scoreBreakdown?: { criteriaScores?: unknown; finalScore?: number }
      suggestions?: string[]
      status?: string
      statusMessage?: string
      requiresManualReview?: boolean
      gradeBreakdown?: { reasoning?: string; strengths?: string[]; weaknesses?: string[]; improvements?: string[] }
      itemizedIssues?: { issue: string; location: string; fix: string }[]
      sampleAnswers?: { approach: string; description: string; code: string }[]
      [key: string]: unknown
    }

    // Strip markdown code block wrapper if present (GPT sometimes wraps JSON)
    let parseInput = resultText.replace(/^[\s\S]*?```(?:json)?\s*/, "").replace(/\s*```[\s\S]*$/, "").trim()
    if (!parseInput.startsWith("{")) {
      const startIdx = parseInput.indexOf("{")
      if (startIdx >= 0) parseInput = parseInput.slice(startIdx)
    }

    try {
      aiResult = JSON.parse(parseInput)
    } catch (parseError) {
      try {
        const markdownMatch = resultText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
        const directJsonMatch = resultText.match(/(\{[\s\S]*\})|(\{[\s\S]+)/)
        const jsonMatch = markdownMatch || directJsonMatch
        const extractedJson = jsonMatch ? (jsonMatch[1] || jsonMatch[2] || "").trim() : resultText.replace(/^[\s\S]*?(\{[\s\S]+)/, "$1")

        if (extractedJson && extractedJson.startsWith("{")) {
          try {
            aiResult = JSON.parse(extractedJson)
          } catch (truncationError) {
            const openBraces = (extractedJson.match(/\{/g) || []).length
            const closeBraces = (extractedJson.match(/\}/g) || []).length
            const openBrackets = (extractedJson.match(/\[/g) || []).length
            const closeBrackets = (extractedJson.match(/\]/g) || []).length

            let repairedJson = extractedJson
            const inUnclosedArray = openBrackets > closeBrackets
            const lastChar = repairedJson.slice(-1)
            if (inUnclosedArray && !/["\]}\s,]/.test(lastChar)) {
              repairedJson += '"'
            }
            for (let i = 0; i < openBrackets - closeBrackets; i++) repairedJson += "]"
            for (let i = 0; i < openBraces - closeBraces; i++) repairedJson += "}"

            try {
              aiResult = JSON.parse(repairedJson)
            } catch (repairError) {
              // Fallback: extract fields from truncated JSON (handles GPT truncation / invalid JSON)
              const scoreMatch = extractedJson.match(/"score":\s*(\d+)/)
              const isCorrectMatch = extractedJson.match(/"isCorrect":\s*(true|false)/)
              const feedbackMatch = extractedJson.match(/"feedback":\s*"((?:[^"\\]|\\.)*)"\s*,/)
              const feedbackUnclosedMatch = extractedJson.match(/"feedback":\s*"((?:[^"\\]|\\.)*)/)
              const feedback = feedbackMatch?.[1] ?? feedbackUnclosedMatch?.[1] ?? "Truncated response - manual review recommended"
              const corrMatch = extractedJson.match(/"correctness":\s*(\d+)/)
              const qualMatch = extractedJson.match(/"codeQuality":\s*(\d+)/)
              const effMatch = extractedJson.match(/"efficiency":\s*(\d+)/)
              const compMatch = extractedJson.match(/"completeness":\s*(\d+)/)
              aiResult = {
                score: scoreMatch ? parseInt(scoreMatch[1]) : 0,
                isCorrect: isCorrectMatch ? isCorrectMatch[1] === "true" : false,
                feedback,
                criteria: {
                  correctness: corrMatch ? parseInt(corrMatch[1]) : 0,
                  codeQuality: qualMatch ? parseInt(qualMatch[1]) : 0,
                  efficiency: effMatch ? parseInt(effMatch[1]) : 0,
                  completeness: compMatch ? parseInt(compMatch[1]) : 0,
                },
                suggestions: ["Response was truncated by AI - instructor manual review recommended"],
                status: "Manual Review Required",
                statusMessage: "AI response was incomplete - instructor will review",
              }
            }
          }
        } else {
          throw new Error("No JSON found in response")
        }
      } catch (extractError) {
        aiResult = {
          score: 0,
          isCorrect: false,
          feedback: "Unable to parse the AI evaluation. Your instructor will review this answer manually.",
          criteria: { correctness: 0, codeQuality: 0, efficiency: 0, completeness: 0 },
          suggestions: ["Manual review required"],
          requiresManualReview: true,
          status: "Manual Review Required",
          statusMessage: "The system could not finalize the automatic grade. An instructor will review it.",
          aiGraded: false,
        }
      }
    }

    // Normalize feedback when model returns array/object instead of string
    if (aiResult.feedback != null && typeof aiResult.feedback !== "string") {
      if (Array.isArray(aiResult.feedback)) {
        aiResult.feedback = aiResult.feedback.map((x) => String(x)).join("\n")
      } else if (typeof aiResult.feedback === "object") {
        aiResult.feedback = Object.entries(aiResult.feedback as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
          .join("\n")
      } else {
        aiResult.feedback = String(aiResult.feedback)
      }
    }

    const normalizeCriteria = (c: unknown): EvaluationCriteria => {
      if (!c || typeof c !== "object") return { correctness: 0, codeQuality: 0, efficiency: 0, completeness: 0 }
      const obj = c as Record<string, unknown>
      const get = (keys: string[]) => {
        for (const k of keys) {
          const v = obj[k]
          if (typeof v === "number") return v
        }
        return 0
      }
      return {
        correctness: get(["correctness", "Correctness"]),
        codeQuality: get(["codeQuality", "code_quality", "CodeQuality"]),
        efficiency: get(["efficiency", "Efficiency"]),
        completeness: get(["completeness", "Completeness"]),
      }
    }
    let normalizedCriteria = normalizeCriteria(aiResult.criteria ?? (aiResult.scoreBreakdown as { criteriaScores?: unknown })?.criteriaScores)
    const criteriaSum = normalizedCriteria.correctness + normalizedCriteria.codeQuality + normalizedCriteria.efficiency + normalizedCriteria.completeness

    const isCodeWritePlotQt = (questionType || "").toLowerCase() === "code_write_plot"
    if (isCodeWritePlotQt && aiResult.scoreBreakdown && typeof aiResult.scoreBreakdown === "object") {
      const sb = aiResult.scoreBreakdown as {
        rawScore?: number
        suspiciousTypingPenalty?: number
        finalScore?: number
        penaltyReason?: string | null
      }
      const pen = typeof sb.suspiciousTypingPenalty === "number" ? Math.max(0, sb.suspiciousTypingPenalty) : 0
      let nextScore = Math.max(0, Math.min(100, Number(aiResult.score) || 0))
      if (pen > 0) nextScore = Math.min(100, nextScore + pen)
      if (typeof sb.rawScore === "number" && Number.isFinite(sb.rawScore)) {
        nextScore = Math.max(nextScore, Math.min(100, sb.rawScore))
      }
      sb.suspiciousTypingPenalty = 0
      sb.penaltyReason = null
      sb.finalScore = nextScore
      aiResult.score = nextScore
    }

    // Prefer scoreBreakdown.finalScore first = grade after model deductions (incl. suspicious-typing penalty).
    let score = Math.max(0, Math.min(100, aiResult.score ?? 0))
    if (aiResult.scoreBreakdown?.finalScore != null && typeof aiResult.scoreBreakdown.finalScore === "number") {
      score = Math.max(0, Math.min(100, aiResult.scoreBreakdown.finalScore))
    }
    if (criteriaSum === 0 && score > 0) {
      normalizedCriteria = {
        correctness: Math.round((score / 100) * 40),
        codeQuality: Math.round((score / 100) * 25),
        efficiency: Math.round((score / 100) * 20),
        completeness: Math.round((score / 100) * 15),
      }
      aiResult.criteria = normalizedCriteria
      if (aiResult.scoreBreakdown) {
        (aiResult.scoreBreakdown as Record<string, unknown>).criteriaScores = normalizedCriteria
      }
    } else if (criteriaSum > 0) {
      aiResult.criteria = normalizedCriteria
    }

    aiResult.score = score

    const hasActualFailure = Boolean(aiResult.requiresManualReview)
    if (hasActualFailure) {
      aiResult.requiresManualReview = true
      aiResult.status = aiResult.status || "Manual Review Required"
      aiResult.statusMessage = aiResult.statusMessage || "An instructor will review this submission as soon as possible."
      console.log("[AI Evaluation] ⚠️ Flagging for manual review (actual failure):", { requiresManualReview: true })
    }

    const mode = String(aiEvaluationMode || "standard").toLowerCase()
    const hasMajorProblems = (() => {
      const text = [
        (aiResult.feedback || ""),
        (aiResult.suggestions || []).join(" "),
        ((aiResult.gradeBreakdown as { weaknesses?: string[] })?.weaknesses || []).join(" "),
        ((aiResult.gradeBreakdown as { reasoning?: string })?.reasoning || ""),
      ]
        .join(" ")
        .toLowerCase()
      const majorIndicators = [
        "won't compile", "doesn't compile", "syntax error", "doesn't solve",
        "incorrect output", "wrong output", "missing main", "no logic",
        "incomplete logic", "missing critical", "does not work", "won't run", "cannot compile",
      ]
      return majorIndicators.some((ind) => text.includes(ind))
    })()

    // Post-process scores by mode. Relaxed: no server-side boosts (old +8/+20 bumps inflated weak work above the attempt floor).
    if (mode === "standard") {
      if (!hasMajorProblems && aiResult.score >= 92) {
        aiResult.score = Math.min(100, aiResult.score + 3)
      }
      // No extra leniency - standard is "a little harder"
    } else if (mode === "strict") {
      if (aiResult.score >= 98 && !hasMajorProblems) {
        aiResult.score = 100
      }
      // Otherwise keep model score - strict is hard
    } else if (mode === "very_strict") {
      if (aiResult.score >= 98 && !hasMajorProblems) {
        aiResult.score = Math.min(100, 95 + (aiResult.score - 98))
      } else if (aiResult.score >= 90) {
        aiResult.score = Math.min(aiResult.score, 88)
      } else if (aiResult.score >= 85) {
        aiResult.score = Math.min(aiResult.score, 85)
      }
      // very_strict: cap scores, be very hard
    }

    // Substantive-attempt minimum is applied LAST (backup: overwrites AI if it returned below floor).
    let pointsEarned = parseFloat(((aiResult.score / 100) * maxPoints).toFixed(2))
    const attemptText = extractTextForAttemptFloorCheck(questionType, studentAnswer)
    const eligibleForAttemptFloor = isEligibleForAttemptMinimumFloor(questionType, attemptText)
    let minimumAttemptFloorApplied = false
    if (eligibleForAttemptFloor) {
      const mode = String(aiEvaluationMode || "standard").toLowerCase()
      const minFraction = MIN_ATTEMPT_SCORE_FRACTION_BY_MODE[mode] ?? 0.25
      const minPoints = parseFloat((minFraction * maxPoints).toFixed(2))
      if (pointsEarned < minPoints) {
        pointsEarned = minPoints
        aiResult.score = Math.round((pointsEarned / maxPoints) * 100)
        minimumAttemptFloorApplied = true
      }
    }
    // Keep scoreBreakdown.finalScore aligned with awarded points (canonical for persistence/display).
    if (aiResult.scoreBreakdown && typeof aiResult.scoreBreakdown === "object") {
      const minPct = getMinAttemptScorePercentForPrompt(aiEvaluationMode)
      aiResult.scoreBreakdown = {
        ...aiResult.scoreBreakdown,
        finalScore: aiResult.score,
        ...(minimumAttemptFloorApplied
          ? {
              gradeClampedToCourseMinimum: true,
              courseMinimumPercent: minPct,
            }
          : {}),
      }
    }

    const passingThreshold = scoringConfig.passing_score_threshold ?? 50
    if (hasActualFailure) {
      aiResult.isCorrect = false
    } else {
      aiResult.isCorrect = aiResult.score >= passingThreshold
    }

    if (aiResult.score >= 90) {
      aiResult.status = "Expert"
      aiResult.statusMessage = "Outstanding work! Your code demonstrates mastery."
    } else if (aiResult.score >= 70) {
      aiResult.status = "Very Good"
      aiResult.statusMessage = "Great job! Your solution is well-implemented."
    } else if (aiResult.score >= 50) {
      aiResult.status = "Keep Practicing"
      aiResult.statusMessage = "Good attempt! You're on the right track."
    } else if (aiResult.score >= 25) {
      aiResult.status = "Getting Started"
      aiResult.statusMessage = "Nice try! Every attempt helps you learn."
    } else {
      aiResult.status = "Just Beginning"
      aiResult.statusMessage = "Good effort! Keep exploring and learning."
    }

    const apiEnd = Date.now()
    const durationMs = apiEnd - apiStart

    return {
      ...aiResult,
      maxPoints,
      pointsEarned,
      aiGraded: true,
      requiresManualReview: aiResult.requiresManualReview ?? false,
      criteria: normalizedCriteria,
      evaluationDiagnostics: {
        requestReceivedAt,
        openaiRequestSentAt: requestReceivedAt,
        openaiResponseReceivedAt: new Date(apiEnd).toISOString(),
        durationMs,
        timeoutMs,
        retryCount,
        retryLog: retryLog.length ? retryLog : undefined,
        requestSummary,
        model: effectiveModel ?? model,
        usedFallback: usedFallback || undefined,
        minimumAttemptFloorPercent: eligibleForAttemptFloor
          ? getMinAttemptScorePercentForPrompt(aiEvaluationMode)
          : undefined,
        minimumAttemptFloorApplied,
      },
    } as EvaluateCodeResult

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error("[Evaluate Code] Error:", err.message, err.stack)

    let userMessage = "⚠️ **Technical Issue Detected**\n\n"
    let errorType = "unknown"
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorType = "timeout"
        userMessage += "The AI grading service took too long to respond. This can happen during high traffic periods.\n\n"
      } else if (error.message.includes('Connection') || error.message.includes('network')) {
        errorType = "connection"
        userMessage += "We're experiencing connectivity issues with the AI grading service.\n\n"
      } else if (error.message.includes('API key') || error.message.includes('authentication')) {
        errorType = "config"
        userMessage += "The AI grading service is not properly configured. Please contact your instructor.\n\n"
      } else {
        userMessage += "An unexpected error occurred while processing your submission.\n\n"
      }
    }
    
    userMessage += "**What this means for you:**\n"
    userMessage += "✅ Your answer has been saved successfully\n"
    userMessage += "✅ Your instructor will review and grade it manually\n"
    userMessage += "✅ Your grade will be updated as soon as possible\n\n"
    userMessage += "**No action needed** - we'll handle this automatically!"

    const heuristicFallback = buildHeuristicEvaluation({
      questionType,
      questionText,
      studentAnswer,
      correctAnswer,
      rubric: typeof rubric === "string" ? rubric : undefined,
      maxPoints,
      aiEvaluationMode,
    })

    const errorEnd = Date.now()
    const errorDurationMs = apiStart != null ? errorEnd - apiStart : null

    return {
      ...heuristicFallback,
      fallbackReason: userMessage,
      errorType,
      requiresManualReview: true,
      aiGraded: false,
      evaluationDiagnostics: {
        requestReceivedAt: requestReceivedAt ?? new Date().toISOString(),
        openaiRequestSentAt: requestReceivedAt ?? null,
        openaiResponseReceivedAt: null,
        durationMs: errorDurationMs,
        timeoutMs,
        retryCount,
        retryLog: retryLog?.length ? retryLog : undefined,
        requestSummary,
        errorType,
        errorName: err?.name,
        errorMessage: err?.message,
        errorCause: err?.cause ? String(err.cause) : undefined,
        model: null,
      },
    }
  }
}
