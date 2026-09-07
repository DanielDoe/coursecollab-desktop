/**
 * Cheap deterministic academic-purpose classifier.
 * Bias toward allowing learning. No subject whitelist.
 */

import type { CoraPrincipalRole } from "@/lib/cora/security/types"
import type {
  CoraPurposeClassification,
  CoraScopeClassificationResult,
  CoraScopeProfile,
} from "@/lib/cora/scope/types"
import { getCoraScopeConfig } from "@/lib/cora/scope/config"

type ClassifyArgs = {
  role: CoraPrincipalRole
  message: string
  conversationHistory?: Array<{ role: string; content: string }>
  profile?: CoraScopeProfile | null
}

const ACADEMIC_VERB =
  /\b(explain|teach|learn|study|understand|help me (with|understand|learn|prepare|write|design|build|debug|review)|walk me through|how (do|does|can|should|to)|what is|what are|define|derive|prove|calculate|solve|analyze|compare|summarize|outline|draft|create flashcards?|make (a )?study|practice|quiz me|tutoring)\b/i

const SUBJECT_OR_SKILL =
  /\b(math|mathematics|algebra|calculus|derivative|integral|differential|linear algebra|probability|statistics|physics|chemistry|biology|photosynthesis|dna|history|empire|economics|supply and demand|programming|python|c\+\+|java|javascript|typescript|code|algorithm|data structure|database|circuit|ohm|voltage|current|semiconductor|machine learning|ai|artificial intelligence|quantum|blockchain|robotics|cybersecurity|networking|embedded|lab report|citation|cite|research paper|presentation|interview|resume|graduate school|internship|conference|abet|accreditation|curriculum|syllabus|lecture|homework|exam|midterm|final|quiz|assessment|flashcard|study plan|stoichiometry|organic chemistry|complex numbers|phasor|signal|system)\b/i

const STUDENT_SUCCESS =
  /\b(study schedule|exam prep|prepare for (an? )?(exam|interview|class)|lab report|cite|citation|presentation|resume|cover letter|email (my |the )?professor|graduate school|career|skills? (to develop|I should)|time management|note[- ]taking)\b/i

const PROFESSIONAL =
  /\b(teaching|lesson|module|rubric|recommendation letter|research (presentation|paper|proposal)|curriculum|accreditation|abet|instructional|analytics|grading|question bank|course design)\b/i

const COURSECOLLAB_OPS =
  /\b(enrollment|section(s)?|instructor(s)?|student(s)?|announcement|platform|system (health|failure|log)|password reset|audit log|institution(al)?|analytics|report|configuration|governance|revenue|security center)\b/i

const DECLARED_EXTERNAL =
  /\b(i('m| am) taking|outside coursecollab|not (on|in) coursecollab|external course|another course)\b/i

/** High-confidence general-purpose abuse — purpose, not keyword alone. */
const UNRELATED_PATTERNS: Array<{ re: RegExp; tag: string }> = [
  {
    re: /\b(plan|planning|help me plan)\b.{0,40}\b(vacation|holiday|trip to|getaway)\b/i,
    tag: "vacation",
  },
  {
    re: /\b(vacation|holiday)\b.{0,40}\b(plan|itinerary|flights?|hotel)\b/i,
    tag: "vacation",
  },
  {
    re: /\b(dating profile|tinder|hinge|bumble)\b/i,
    tag: "dating",
  },
  {
    re: /\b(fantasy football|draft my team|lineup for (this )?week)\b/i,
    tag: "fantasy_sports",
  },
  {
    re: /\b(recipe|cook|dinner tonight|what should I (eat|make) for (dinner|lunch))\b/i,
    tag: "cooking",
  },
  {
    re: /\b(shop for|buy me|recommend|help me choose|choose)\b.{0,40}\b(tv|television|gaming pc|laptop for (gaming|home)|headphones for music)\b/i,
    tag: "shopping",
  },
  {
    re: /\bgaming pc\b.{0,20}\b(for home|for (me|myself))\b/i,
    tag: "shopping",
  },
  {
    re: /\b(stock picks?|which stocks?|crypto (to buy|picks?)|day trad(e|ing))\b/i,
    tag: "investing",
  },
  {
    re: /\b(netflix|youtube channel screenplay|write a screenplay for my youtube)\b/i,
    tag: "entertainment",
  },
  {
    re: /\b(restaurant for (my )?date|romantic dinner reservation)\b/i,
    tag: "dating",
  },
]

/** Academic framing that rescues otherwise-unrelated surface words. */
const ACADEMIC_RESCUE =
  /\b(conference|ieee|internship|interview|engineering|programming|project|class|course|assignment|homework|lab|research|presentation|database|application|app|c\+\+|python|algorithm|economics project|senior design|poster for)\b/i

function recentContextBlob(
  history: Array<{ role: string; content: string }> | undefined,
): string {
  if (!history?.length) return ""
  return history
    .slice(-6)
    .map((m) => String(m.content ?? ""))
    .join("\n")
    .slice(0, 4000)
}

function classifyUnrelated(message: string): { hit: boolean; tag: string | null } {
  for (const { re, tag } of UNRELATED_PATTERNS) {
    if (re.test(message)) {
      // Rescue mixed-intent academic/professional framing
      if (ACADEMIC_RESCUE.test(message)) return { hit: false, tag: null }
      return { hit: true, tag }
    }
  }
  return { hit: false, tag: null }
}

export function classifyCoraPurposeScope(args: ClassifyArgs): CoraScopeClassificationResult {
  const config = getCoraScopeConfig()
  const message = String(args.message ?? "").trim()
  const historyBlob = recentContextBlob(args.conversationHistory)
  const combined = `${historyBlob}\n${message}`.trim()

  if (!message) {
    return {
      classification: "UNCERTAIN",
      confidence: 0.4,
      academicPurpose: true,
      matchedContext: [],
      reasonCode: "BIAS_ALLOW_UNCERTAIN",
    }
  }

  const unrelated = classifyUnrelated(message)
  if (unrelated.hit) {
    // Follow-up after academic thread? Prefer allow.
    if (ACADEMIC_RESCUE.test(historyBlob) && message.length < 180 && !/\b(vacation|dating|fantasy football|stock)\b/i.test(message)) {
      return {
        classification: "ACADEMIC_RELATED",
        confidence: 0.72,
        academicPurpose: true,
        matchedContext: ["conversation_context"],
        reasonCode: "CONVERSATION_ACADEMIC_CONTEXT",
      }
    }
    return {
      classification: "CLEARLY_UNRELATED",
      confidence: 0.92,
      academicPurpose: false,
      matchedContext: unrelated.tag ? [unrelated.tag] : [],
      reasonCode: "CLEARLY_GENERAL_PURPOSE",
    }
  }

  // Prompt-injection “pretend academic but do vacation”
  if (
    /\bpretend\b/i.test(message) &&
    /\b(vacation|dating profile|fantasy football|recipe|stock pick)\b/i.test(message)
  ) {
    return {
      classification: "CLEARLY_UNRELATED",
      confidence: 0.9,
      academicPurpose: false,
      matchedContext: ["prompt_injection_surface"],
      reasonCode: "CLEARLY_GENERAL_PURPOSE",
    }
  }

  if (DECLARED_EXTERNAL.test(message) && (ACADEMIC_VERB.test(message) || SUBJECT_OR_SKILL.test(message))) {
    return {
      classification: "ACADEMIC_RELATED",
      confidence: 0.9,
      academicPurpose: true,
      matchedContext: ["declared_external_course"],
      reasonCode: "DECLARED_EXTERNAL_COURSE",
    }
  }

  const matched: string[] = []
  if (ACADEMIC_VERB.test(combined)) matched.push("academic_intent")
  if (SUBJECT_OR_SKILL.test(combined)) matched.push("subject_or_skill")
  if (config.allowCareerStudentSuccess && STUDENT_SUCCESS.test(combined)) {
    matched.push("student_success")
  }
  if (config.allowProfessionalAcademicTopics && PROFESSIONAL.test(combined)) {
    matched.push("professional_academic")
  }
  if (args.role === "admin" && COURSECOLLAB_OPS.test(combined)) {
    matched.push("coursecollab_ops")
  }
  if (args.profile?.program) matched.push("program_context")
  if ((args.profile?.activeCourses?.length ?? 0) > 0) matched.push("enrolled_courses")

  if (matched.includes("coursecollab_ops")) {
    return {
      classification: "COURSECOLLAB_OPERATION",
      confidence: 0.88,
      academicPurpose: true,
      matchedContext: matched,
      reasonCode: "COURSECOLLAB_OPERATION",
    }
  }

  if (matched.includes("student_success")) {
    return {
      classification: "STUDENT_SUCCESS",
      confidence: 0.88,
      academicPurpose: true,
      matchedContext: matched,
      reasonCode: "STUDENT_SUCCESS_REQUEST",
    }
  }

  if (matched.includes("professional_academic") && (args.role === "faculty" || args.role === "admin")) {
    return {
      classification: "PROFESSIONAL_ACADEMIC",
      confidence: 0.86,
      academicPurpose: true,
      matchedContext: matched,
      reasonCode: "PROFESSIONAL_ACADEMIC_REQUEST",
    }
  }

  if (matched.includes("academic_intent") || matched.includes("subject_or_skill")) {
    const classification: CoraPurposeClassification =
      matched.includes("enrolled_courses") && SUBJECT_OR_SKILL.test(message)
        ? "COURSE_RELATED"
        : "ACADEMIC_RELATED"
    return {
      classification,
      confidence: 0.9,
      academicPurpose: true,
      matchedContext: matched,
      reasonCode: "LEGITIMATE_ACADEMIC_REQUEST",
    }
  }

  // Short follow-ups in an academic thread
  if (ACADEMIC_RESCUE.test(historyBlob) && message.length < 220) {
    return {
      classification: "ACADEMIC_RELATED",
      confidence: 0.75,
      academicPurpose: true,
      matchedContext: ["conversation_context"],
      reasonCode: "CONVERSATION_ACADEMIC_CONTEXT",
    }
  }

  // Uncertain → bias allow learning
  return {
    classification: "UNCERTAIN",
    confidence: 0.45,
    academicPurpose: true,
    matchedContext: matched,
    reasonCode: "BIAS_ALLOW_UNCERTAIN",
  }
}
