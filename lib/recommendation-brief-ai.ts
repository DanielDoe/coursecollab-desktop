import { chatCompletionWithFallback } from "@/lib/openai-with-fallback"
import { resolveModelForFeature } from "@/lib/resolve-feature-ai-model"
import type { ProfileBundle } from "@/lib/recommendation-letters-ai"

/** Student-side evidence package for faculty — not a recommendation letter. */
export async function generateRecommendationBriefMarkdown(input: {
  studentName: string
  purposeLabel: string
  deadline?: string | null
  instructorName: string
  courseLabel: string
  profile: ProfileBundle
  attachments: { file_type: string; file_name: string | null }[]
  opportunityTitle?: string | null
  programName?: string | null
  highlightTopics?: string | null
  relationshipContext?: string | null
}): Promise<{ markdown: string; modelUsed: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured")

  const profileBlock = [
    input.profile.student_strengths && `Strengths: ${input.profile.student_strengths}`,
    input.profile.achievements && `Achievements: ${input.profile.achievements}`,
    input.profile.projects && `Projects: ${input.profile.projects}`,
    input.profile.class_experience && `Class / research: ${input.profile.class_experience}`,
    input.profile.skills && `Skills: ${input.profile.skills}`,
    input.profile.leadership_examples && `Leadership: ${input.profile.leadership_examples}`,
    input.profile.goals && `Goals: ${input.profile.goals}`,
    input.profile.personal_qualities && `Qualities: ${input.profile.personal_qualities}`,
    input.profile.letter_for && `Emphasis: ${input.profile.letter_for}`,
    input.profile.special_instructions && `Notes: ${input.profile.special_instructions}`,
  ]
    .filter(Boolean)
    .join("\n")

  const attachmentList =
    input.attachments.length > 0
      ? input.attachments.map((a) => `- ${a.file_type}: ${a.file_name ?? "file"}`).join("\n")
      : "- (none uploaded yet)"

  const res = await chatCompletionWithFallback(apiKey, {
    model: resolveModelForFeature("recommendation_letter"),
    messages: [
      {
        role: "system",
        content: `You prepare a Recommendation Preparation Brief for a faculty member (${input.instructorName}).
This is NOT a recommendation letter. Do not write salutations, signatures, or letter prose.
Output markdown sections only. Use facts from student materials; do not invent grades, awards, or metrics.
Sections required:
## Opportunity
## Program / context
## Deadline
## Student would like highlighted
## Relevant work with recommender
## Uploaded materials
## Summary for faculty`,
      },
      {
        role: "user",
        content: `Student: ${input.studentName}
Purpose: ${input.purposeLabel}
Course: ${input.courseLabel}
Deadline: ${input.deadline ?? "Not specified"}
Opportunity title: ${input.opportunityTitle ?? input.purposeLabel}
Program: ${input.programName ?? "—"}
Highlight topics requested: ${input.highlightTopics ?? "—"}
Relationship with recommender: ${input.relationshipContext ?? "—"}

Student questionnaire:
${profileBlock || "(minimal details provided)"}

Attachments:
${attachmentList}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 2200,
  })

  return { markdown: res.content.trim(), modelUsed: res.modelUsed }
}

/** Faculty Cora uses brief + profile — still not student-authored letter text. */
export function formatBriefForFacultyPrompt(briefMarkdown: string): string {
  const trimmed = briefMarkdown.trim()
  if (!trimmed) return ""
  return `\n\n---\nRecommendation Preparation Brief (student-provided evidence package):\n${trimmed}\n---\n`
}
