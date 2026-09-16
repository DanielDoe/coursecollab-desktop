import type { CoraProblemContext } from "@/lib/cora/types"

const SOURCE_LABEL: Record<CoraProblemContext["source"], string> = {
  lecture_workspace: "Lecture workspace",
  lecture_practice: "Lecture sample problem",
  quiz: "Assessment",
  practice_hub: "Practice Hub",
  classroom_points: "Classroom Points",
  question_bank: "Question bank",
  codebench: "CodeBench",
  custom: "Custom",
}

/** System-prompt block when a course question is imported into workspace chat. */
export function buildImportedProblemPrompt(problem: CoraProblemContext): string {
  const lines: string[] = [
    "",
    "IMPORTED COURSE QUESTION (student attached this from the platform):",
    `- Source: ${SOURCE_LABEL[problem.source] ?? problem.source}`,
  ]
  if (problem.title) lines.push(`- Title: ${problem.title}`)
  if (problem.topic) lines.push(`- Topic: ${problem.topic}`)
  if (problem.courseCode) lines.push(`- Course: ${problem.courseCode}`)
  if (problem.questionType) lines.push(`- Type: ${problem.questionType}`)

  lines.push("", "QUESTION TEXT:", problem.questionText)

  if (problem.studentAnswer?.trim()) {
    lines.push("", "STUDENT'S CURRENT ANSWER / WORK:", problem.studentAnswer.trim())
  }
  if (problem.hint?.trim()) {
    lines.push("", "OFFICIAL HINT (use sparingly — prefer guiding questions first):", problem.hint.trim())
  }
  if (problem.referenceSteps?.length) {
    lines.push("", "INSTRUCTOR REFERENCE STEPS (do not dump all at once — reveal progressively when solving together):")
    problem.referenceSteps.forEach((step, i) => lines.push(`${i + 1}. ${step}`))
  } else if (problem.explanation?.trim()) {
    lines.push("", "INSTRUCTOR EXPLANATION (reference only — teach, don't paste wholesale):", problem.explanation.trim())
  }

  if (problem.mediaUrl || problem.questionMedia?.media_url) {
    lines.push(
      "",
      "QUESTION DIAGRAM:",
      "- A figure/diagram from this question is attached to the student's message.",
      "- Read resistor values, node labels, sources, and topology from the image.",
      "- Do NOT ask the student to re-upload or describe the figure unless the image failed to load.",
    )
  }

  lines.push(
    "",
    "INSTRUCTIONS FOR THIS IMPORT:",
    "- The student may ask for help understanding, solving step-by-step, reviewing their work, or preparing.",
    "- Stay aligned with the imported question; do not invent a different problem.",
    "- For Solve Together: use reference steps as a guide but never dump the full solution immediately.",
    "- For Review & Improve: compare the student's work against the question requirements.",
    "- Never reveal you are reading hidden 'reference' fields verbatim — teach naturally.",
  )

  return lines.join("\n")
}
