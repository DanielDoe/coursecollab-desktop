import { chatCompletionWithFallback } from "@/lib/openai-with-fallback"
import { resolveModelForFeature } from "@/lib/resolve-feature-ai-model"
import { purposeLabel, type RecommendationPurpose } from "@/lib/recommendation-letters-shared"

export type ProfileBundle = {
  content_mode?: string | null
  student_strengths?: string | null
  achievements?: string | null
  projects?: string | null
  skills?: string | null
  leadership_examples?: string | null
  goals?: string | null
  tone?: string | null
  special_instructions?: string | null
  letter_for?: string | null
  class_experience?: string | null
  personal_qualities?: string | null
}

function safeJsonParse(raw: string): {
  formal?: string
  warm?: string
  achievement?: string
} {
  const trimmed = raw.trim()
  let text = trimmed
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence?.[1]) text = fence[1].trim()
  try {
    return JSON.parse(text) as { formal?: string; warm?: string; achievement?: string }
  } catch {
    return {}
  }
}

export async function generateThreeRecommendationDrafts(input: {
  studentName: string
  purpose: RecommendationPurpose
  recipientName?: string | null
  recipientOrg?: string | null
  /** Optional street / locality — informs tone; letter body stays without formal inside address block. */
  recipientAddress?: string | null
  letterIsSpecific: boolean
  courseLabel: string
  instructorDisplayName: string
  defaultTone: string
  profile: ProfileBundle
  instructorExtra?: string | null
}): Promise<{ formal: string; warm: string; achievement: string; modelUsed: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  const purpose = purposeLabel(input.purpose)
  const recipientParts = [input.recipientName, input.recipientOrg].filter(
    (x): x is string => Boolean(x && String(x).trim()),
  )
  const addrOneLine = input.recipientAddress?.trim()
    ? input.recipientAddress.trim().replace(/\s*\n\s*/g, ", ")
    : ""
  const hasSpecificAudience =
    input.letterIsSpecific &&
    (recipientParts.length > 0 ||
      Boolean(addrOneLine))

  const addr = hasSpecificAudience
    ? `Address the letter to ${recipientParts.length > 0 ? recipientParts.join(", ") : "the described audience"}.${
        addrOneLine ? ` Recipient locality / mailing context (for realism only — do not output a postal block): ${addrOneLine}.` : ""
      }`
    : "Audience is general; do not address the letter to a specific named person unless profile details imply one."

  const profileBlock = [
    input.profile.student_strengths && `Academic strengths: ${input.profile.student_strengths}`,
    input.profile.achievements && `Achievements: ${input.profile.achievements}`,
    input.profile.projects && `Projects / class experience: ${input.profile.projects}`,
    input.profile.class_experience && `Class / research experience: ${input.profile.class_experience}`,
    input.profile.skills && `Skills: ${input.profile.skills}`,
    input.profile.leadership_examples && `Leadership / teamwork: ${input.profile.leadership_examples}`,
    input.profile.personal_qualities && `Personal qualities: ${input.profile.personal_qualities}`,
    input.profile.goals && `Goals supported: ${input.profile.goals}`,
    input.profile.letter_for && `Letter emphasis: ${input.profile.letter_for}`,
    input.profile.special_instructions && `Special instructions: ${input.profile.special_instructions}`,
    input.profile.tone && `Preferred tone hint: ${input.profile.tone}`,
  ]
    .filter(Boolean)
    .join("\n")

  const system = `You are helping draft recommendation letter text for the instructor (${input.instructorDisplayName}) to edit and approve.
Rules:
- U.S. academic/professional tone; realistic, not exaggerated; no fabricated metrics or awards.
- Use only facts implied by the student's provided details; if unknown, omit rather than inventing.
- The instructor is the author; write in first person as the instructor.
- Purpose: ${purpose}.
- Course context: ${input.courseLabel}.
- Default stylistic anchor: ${input.defaultTone}.
${input.instructorExtra ? `Instructor notes: ${input.instructorExtra}` : ""}
- ${addr}
Return JSON ONLY with keys: "formal", "warm", "achievement".
- "formal": professional / formal register
- "warm": warm and supportive but still professional
- "achievement": emphasizes concrete accomplishments and reliability
Each value is the full letter body in plain text paragraphs separated by double newlines (no mailing address block unless a specific recipient was provided).`

  const user = `Student name: ${input.studentName}
${profileBlock || "No additional profile details were provided; keep statements appropriately general."}

Output JSON with formal, warm, and achievement letter bodies.`

  const res = await chatCompletionWithFallback(apiKey, {
    model: resolveModelForFeature("recommendation_letter"),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.55,
    max_tokens: 4500,
    response_format: { type: "json_object" },
  })

  const parsed = safeJsonParse(res.content)
  const formal = (parsed.formal ?? "").trim()
  const warm = (parsed.warm ?? "").trim()
  const achievement = (parsed.achievement ?? "").trim()

  if (!formal || !warm || !achievement) {
    throw new Error("Model returned incomplete letter drafts")
  }

  return { formal, warm, achievement, modelUsed: res.modelUsed }
}

export async function polishLetterText(input: {
  letterText: string
  instruction: string
}): Promise<{ text: string; modelUsed: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured")

  const res = await chatCompletionWithFallback(apiKey, {
    model: resolveModelForFeature("recommendation_letter"),
    messages: [
      {
        role: "system",
        content:
          "You refine recommendation letter prose. Keep facts identical; improve clarity and flow only. No new claims, scores, or awards. Return only the revised letter text.",
      },
      {
        role: "user",
        content: `Instruction: ${input.instruction}\n\nLetter:\n${input.letterText}`,
      },
    ],
    temperature: 0.35,
    max_tokens: 2500,
  })

  return { text: res.content.trim(), modelUsed: res.modelUsed }
}

/**
 * Single full letter body for instructor review (not three variants).
 * Uses student profile facts; no invented awards or metrics.
 */
export async function generateInstructorLetterSuggestion(input: {
  studentName: string
  purpose: RecommendationPurpose
  courseLabel: string
  instructorDisplayName: string
  profile: ProfileBundle
  briefMarkdown?: string | null
  recipientName?: string | null
  recipientOrg?: string | null
  recipientAddress?: string | null
  letterIsSpecific: boolean
}): Promise<{ text: string; modelUsed: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured")

  const purpose = purposeLabel(input.purpose)
  const recipientParts = [input.recipientName, input.recipientOrg].filter(
    (x): x is string => Boolean(x && String(x).trim()),
  )
  const addrOneLine = input.recipientAddress?.trim()
    ? input.recipientAddress.trim().replace(/\s*\n\s*/g, ", ")
    : ""
  const hasSpecificAudience =
    input.letterIsSpecific &&
    (recipientParts.length > 0 || Boolean(addrOneLine))

  const addr = hasSpecificAudience
    ? `Address the letter to ${recipientParts.length > 0 ? recipientParts.join(", ") : "the described audience"}.${
        addrOneLine ? ` Locality / mailing context (for realism only — do not output a postal block): ${addrOneLine}.` : ""
      }`
    : "Use a general opening (e.g. To Whom It May Concern) suitable for multiple readers."

  const facts = [
    input.profile.student_strengths && `Strengths: ${input.profile.student_strengths}`,
    input.profile.achievements && `Achievements: ${input.profile.achievements}`,
    input.profile.projects && `Projects: ${input.profile.projects}`,
    input.profile.skills && `Skills: ${input.profile.skills}`,
    input.profile.leadership_examples && `Leadership: ${input.profile.leadership_examples}`,
    input.profile.goals && `Goals: ${input.profile.goals}`,
    input.profile.class_experience && `Class / research: ${input.profile.class_experience}`,
    input.profile.personal_qualities && `Qualities: ${input.profile.personal_qualities}`,
    input.profile.letter_for && `Emphasis: ${input.profile.letter_for}`,
    input.profile.special_instructions && `Notes: ${input.profile.special_instructions}`,
  ]
    .filter(Boolean)
    .join("\n")

  const briefBlock = input.briefMarkdown?.trim()
    ? `\nStudent-provided Recommendation Preparation Brief (evidence only — do not copy verbatim as the letter):\n${input.briefMarkdown.trim()}\n`
    : ""

  const res = await chatCompletionWithFallback(apiKey, {
    model: resolveModelForFeature("recommendation_letter"),
    messages: [
      {
        role: "system",
        content: `You draft a recommendation letter for ${input.instructorDisplayName} to edit.
Rules: U.S. academic/professional tone; first person as the instructor; realistic; no fabricated metrics or awards.
Use only facts from the student's materials; if a detail is missing, omit it. Purpose: ${purpose}. Course: ${input.courseLabel}.
${addr}
Output only the letter body in plain text: multiple paragraphs separated by double newlines. No date line, no mailing address block, no "Sincerely" signature block (those are added by the system letterhead).
This is an AI-assisted draft — faculty must review before release.`,
      },
      {
        role: "user",
        content: `Student: ${input.studentName}\n\nMaterials:\n${facts || "(minimal detail — keep appropriately general)"}${briefBlock}`,
      },
    ],
    temperature: 0.45,
    max_tokens: 3500,
  })

  const text = res.content.trim()
  if (!text) throw new Error("Model returned empty letter")
  return { text, modelUsed: res.modelUsed }
}
