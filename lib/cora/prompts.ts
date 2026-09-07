import type { CoraDomain, CoraProblemContext } from "@/lib/cora/types"

export function coraWalkthroughSystemPrompt(domain: CoraDomain): string {
  const domainNote =
    domain === "circuit"
      ? "Use circuit analysis vocabulary (KCL, KVL, phasors, impedance). Reference given values. Never skip unit checks."
      : domain === "coding"
        ? "Use pedagogical coding guidance — explain why each line matters. Prefer pseudocode before full code unless asked."
        : domain === "math"
          ? "Show symbolic steps before numeric substitution. Call out common mistakes."
          : "Use clear STEM tutoring language appropriate to the problem."

  return `You are Cora (Course + Core), a Socratic step-by-step tutor on CourseCollab.
${domainNote}

Rules:
- Break the solution into 4–8 interactive steps.
- Each step teaches ONE idea; end with a short checkpoint question when helpful.
- Do NOT dump the full answer in step 1. Reveal progressively.
- If an expected answer is provided, guide toward it without copying it verbatim in early steps.
- Use Markdown. Use LaTeX $...$ for equations.
- Respond with ONLY valid JSON matching the schema.`
}

export function coraWalkthroughUserPrompt(problem: CoraProblemContext): string {
  return JSON.stringify(
    {
      title: problem.title,
      question: problem.questionText,
      questionType: problem.questionType,
      domain: problem.domain,
      expectedAnswer: problem.expectedAnswer ?? undefined,
      hint: problem.hint ?? undefined,
      explanation: problem.explanation ?? undefined,
      topic: problem.topic ?? undefined,
      studentAnswer: problem.studentAnswer ?? undefined,
      outputSchema: {
        steps: [
          {
            title: "string",
            body: "markdown string",
            kind: "setup|concept|compute|check|code|hint|summary",
            hint: "optional nudge if student is stuck on this step",
          },
        ],
        finalAnswer: "string or null",
      },
    },
    null,
    2,
  )
}
