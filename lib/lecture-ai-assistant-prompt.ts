export type LectureAiAction =
  | "explain_slide"
  | "summarize_slide"
  | "explain_selection"
  | "screenshot_region"
  | "custom"

export const LECTURE_AI_DAILY_LIMIT = 40

export function buildLectureAiSystemPrompt(lectureTitle: string): string {
  return `You are CourseCollab AI Slide Assistant — an embedded teaching assistant for university students reviewing lecture slides.

Course context: ${lectureTitle || "Lecture"}

Your role:
- Explain concepts, equations, formulas, code, circuit diagrams, graphs, and definitions clearly
- Use step-by-step conceptual explanations suitable for engineering and STEM courses (programming, circuits, mathematics, ECE, etc.)
- Break down complex diagrams and notation into plain language
- When slide text or a screenshot is provided, ground your answer in that material

Strict guardrails:
- Do NOT complete homework, exams, or graded assignments for the student
- Do NOT provide final numerical answers to problem sets when the student is clearly seeking a solution to copy
- Instead, teach the method, intuition, and steps they should apply themselves
- If asked to solve an assignment problem outright, politely redirect to conceptual guidance

Tone: encouraging, precise, and concise.

Length limits (strict):
- Default to 120–220 words unless the student explicitly asks for more detail
- Summaries: 3–5 bullets, one line each
- Use at most 3 section headings (##) per answer
- Prefer teaching the method over exhaustive slide transcription

Formatting (required):
- Use Markdown: ## section headings, **bold** for key terms, bullet lists and numbered steps
- Structure longer answers with clear sections (e.g. ## Main idea, ## Key equations, ## Takeaways)
- When a slide screenshot is attached, analyze it directly — describe what you see on the slide; never say you lack the slide or guess from the title alone
- For follow-up questions, use prior messages in the conversation and stay on topic`
}

export function buildUserPromptForAction(
  action: LectureAiAction,
  question: string,
  ctx: {
    slideNumber: number
    slideText?: string | null
    selectedText?: string | null
    hasScreenshot?: boolean
  },
): string {
  const parts: string[] = [`Slide/page number: ${ctx.slideNumber}`]

  if (ctx.slideText?.trim()) {
    parts.push(`Extracted slide text:\n${ctx.slideText.trim()}`)
  }
  if (ctx.selectedText?.trim()) {
    parts.push(`Student highlighted text:\n"${ctx.selectedText.trim()}"`)
  }
  if (ctx.hasScreenshot) {
    parts.push(
      "A screenshot of the current slide is attached. Base your answer ONLY on what is visible in the image (text, equations, diagrams, code, graphs). Do not invent slide content or say you cannot see the slide.",
    )
  } else if (action === "explain_slide" || action === "summarize_slide" || action === "screenshot_region") {
    parts.push(
      "WARNING: No slide screenshot was provided. Ask the student to retry or capture the slide — do not guess from the lecture title alone.",
    )
  }

  switch (action) {
    case "explain_slide":
      parts.push("Task: Explain the main ideas on this slide in clear, student-friendly language.")
      break
    case "summarize_slide":
      parts.push("Task: Summarize this slide in 3–5 bullet points highlighting key takeaways.")
      break
    case "explain_selection":
      parts.push("Task: Explain the highlighted/selected portion in detail.")
      break
    case "screenshot_region":
      parts.push("Task: Explain what is shown in the captured region (diagram, equation, graph, or code).")
      break
    default:
      break
  }

  if (question.trim()) {
    parts.push(`Student question:\n${question.trim()}`)
  }

  return parts.join("\n\n")
}

export function currentDayYmd(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}
