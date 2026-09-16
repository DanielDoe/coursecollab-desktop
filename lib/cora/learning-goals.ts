import type { LucideIcon } from "lucide-react"
import {
  Lightbulb,
  Puzzle,
  Search,
  Target,
  Rocket,
} from "lucide-react"

/** What the student is trying to accomplish — not an AI personality. */
export type CoraLearningGoal =
  | "understand"
  | "solve_together"
  | "review"
  | "prepare"
  | "create"

export type CoraLearningGoalMeta = {
  id: CoraLearningGoal
  emoji: string
  label: string
  shortLabel: string
  tagline: string
  description: string
  icon: LucideIcon
  starterPrompt: string
  featured?: boolean
}

export const CORA_LEARNING_GOALS: CoraLearningGoalMeta[] = [
  {
    id: "understand",
    emoji: "💡",
    label: "Understand",
    shortLabel: "Understand",
    tagline: "Teach and explain concepts",
    description: "Learn new topics, lectures, definitions, and difficult ideas.",
    icon: Lightbulb,
    starterPrompt:
      "Help me understand a concept from my course. Ask what topic I'm on, then explain it clearly with intuition and a simple example.",
  },
  {
    id: "solve_together",
    emoji: "🧩",
    label: "Solve Together",
    shortLabel: "Solve",
    tagline: "Work through problems step by step",
    description: "Interactive problem-solving — hints and questions, not instant answers.",
    icon: Puzzle,
    starterPrompt:
      "Let's solve a problem together. I'll share the problem — guide me step by step with questions and hints, but don't give the full answer right away.",
    featured: true,
  },
  {
    id: "review",
    emoji: "🔍",
    label: "Review & Improve",
    shortLabel: "Review",
    tagline: "Get feedback on your work",
    description: "Homework, essays, code, lab reports — constructive feedback and improvements.",
    icon: Search,
    starterPrompt:
      "I want to review and improve my work. I'll paste or describe what I have — identify mistakes, explain improvements, and highlight strengths.",
  },
  {
    id: "prepare",
    emoji: "🎯",
    label: "Prepare",
    shortLabel: "Prepare",
    tagline: "Get ready for assessments",
    description: "Practice questions, mock quizzes, study plans, and readiness tracking.",
    icon: Target,
    starterPrompt:
      "Help me prepare for an upcoming assessment. Ask what I'm studying for, then build a focused practice plan with questions and weak-spot review.",
  },
  {
    id: "create",
    emoji: "🚀",
    label: "Create",
    shortLabel: "Create",
    tagline: "Generate learning resources",
    description: "Summaries, flashcards, study guides, concept maps, and worksheets.",
    icon: Rocket,
    starterPrompt:
      "Help me create a learning resource — ask what topic and format I need (summary, flashcards, study guide, etc.), then build it from my course context.",
  },
]

export const DEFAULT_LEARNING_GOAL: CoraLearningGoal = "understand"

export function getLearningGoalMeta(id: CoraLearningGoal): CoraLearningGoalMeta {
  return CORA_LEARNING_GOALS.find((g) => g.id === id) ?? CORA_LEARNING_GOALS[0]
}

export function normalizeLearningGoal(raw: unknown): CoraLearningGoal {
  if (typeof raw === "string" && CORA_LEARNING_GOALS.some((g) => g.id === raw)) {
    return raw as CoraLearningGoal
  }
  return DEFAULT_LEARNING_GOAL
}

/** Map legacy chatConfig fields to a learning goal (backward compat). */
/** Assessment GUIDED_ONLY must not use workflows that walk toward a full solution. */
export function clampLearningGoalForAssessmentPolicy(
  goal: CoraLearningGoal,
  mode: CoraAssessmentMode | null | undefined,
): CoraLearningGoal {
  if (mode !== "GUIDED_ONLY" && mode !== "DISABLED") return goal
  if (goal === "solve_together" || goal === "create" || goal === "prepare") return "understand"
  return goal
}

export const ASSESSMENT_GUIDED_LEARNING_GOAL_OVERRIDE = `
ASSESSMENT GUARDRAIL (overrides any learning-goal workflow above):
- You are coaching during a protected quiz, homework, or practice attempt.
- Do NOT produce numbered steps that complete the task, final code, plots, circuits, or letter/numeric answers.
- Do NOT confirm or deny the student's proposed answer — redirect to reasoning checks instead.
- Use hints, concepts, guiding questions, and one small next step only.`

export function learningGoalFromLegacyChatConfig(chatConfig?: {
  tutorMode?: string
  examPrepMode?: boolean
  mode?: string
  learningGoal?: string
}): CoraLearningGoal {
  if (chatConfig?.learningGoal) return normalizeLearningGoal(chatConfig.learningGoal)
  if (chatConfig?.examPrepMode) return "prepare"
  if (chatConfig?.mode === "debug") return "review"
  if (chatConfig?.tutorMode === "socratic") return "solve_together"
  return DEFAULT_LEARNING_GOAL
}

const GOAL_WORKFLOW_PROMPTS: Record<CoraLearningGoal, string> = {
  understand: `
LEARNING GOAL: Understand
- Teach and explain concepts clearly; build intuition before formalism.
- Simplify without dumbing down; use analogies, diagrams (ASCII when helpful), and connections to prior ideas.
- Check understanding with a short question before moving on.
- Default experience when no other goal is specified.`,

  solve_together: `
LEARNING GOAL: Solve Together (flagship workflow)
- NEVER reveal the full answer immediately.
- Analyze the problem; identify knowns and unknowns.
- Break the solution into numbered steps; animate/explain each step.
- Ask the student questions; offer hints before solutions.
- Verify their reasoning at each step; summarize what was learned at the end.
- Works identically across all disciplines — adapt content, keep the workflow.`,

  review: `
LEARNING GOAL: Review & Improve
- Review the student's submission (homework, essay, code, lab report, diagram, etc.).
- Identify mistakes and gaps; explain improvements constructively.
- Compare against instructor expectations when course context is available.
- Highlight strengths and weaknesses; suggest specific next edits.`,

  prepare: `
LEARNING GOAL: Prepare
- Help the student get ready for quizzes, exams, presentations, or certifications.
- Generate practice questions; conduct mock questioning when appropriate.
- Identify weak concepts from their history; recommend lectures and practice.
- Build study plans and create allowed learning resources via tools (flashcards, notes, practice quizzes). Never claim you changed grades or membership.`,

  create: `
LEARNING GOAL: Create
- Generate learning resources in chat: summaries, flashcards, study guides, concept maps, quizzes, worksheets, formula sheets.
- Ask what format they need; tailor output to their course and current chapter.
- The student copies or creates resources in the app themselves — you do not write to My Notes or Flashcards.`,
}

const CORA_CORE_IDENTITY = `
You are Cora — CourseCollab's personal learning intelligence.

CORE BEHAVIOR (always):
- Professional, patient, encouraging, adaptive, and intelligent.
- Never ask the student to pick an "AI mode" or "personality."
- Automatically infer the academic subject from: current course, lecture, assignment, Practice Hub, Question Bank, uploaded material, page context, and message content.
- Adapt teaching strategy to the inferred discipline (engineering, math, biology, business, history, languages, nursing, etc.) without the student naming the subject.
- Continuously adapt based on student progress, misconceptions, assessment history, and instructor content.
- Keep responses focused (roughly 120–250 words unless depth is requested); use markdown, bullets, and code blocks when relevant.`

import type { CoraAssessmentMode } from "@/lib/cora/assessment-policy"
import type { AiFeature } from "@/lib/resolve-feature-ai-model"
import type { AiModelPreset } from "@/lib/ai-model-catalog"
import {
  resolveCoraDynamicRoute,
  type CoraDynamicRoute,
  type CoraTaskComplexity,
  type CoraTaskDomain,
} from "@/lib/cora/ai/dynamic-router"

const CODE_SIGNAL =
  /```[\s\S]*?```|#include\b|def \w+\(|function\s+\w+|class\s+\w+|int\s+main\s*\(|console\.(log|error)|public\s+static\s+void|\b(std::|using namespace)|\{\s*\n\s*(return|if|for|while)/i

/** Detect code blocks or programming syntax in student text. */
export function messageContainsCode(text: string): boolean {
  if (!text?.trim()) return false
  return CODE_SIGNAL.test(text)
}

export function conversationContainsCode(
  message: string,
  history?: { content?: string }[],
): boolean {
  if (messageContainsCode(message)) return true
  return (history ?? []).some((m) => messageContainsCode(String(m.content ?? "")))
}

export type CoraAiRouting = {
  feature: AiFeature
  aiModelPreset: AiModelPreset
  modelId: string
  agentModelId: string
  provider: "openai" | "anthropic"
  domain: CoraTaskDomain
  complexity: CoraTaskComplexity
  temperature: number
  maxTokens: number
  reason: string
  route: CoraDynamicRoute
  profile?: CoraDynamicRoute["profile"]
}

/** Route Cora by capability profile. Faculty course policy can cap Advanced Reasoning. */
export function resolveCoraAiRouting(opts: {
  learningGoal: CoraLearningGoal
  message: string
  conversationHistory?: { content?: string }[]
  forAgentTools?: boolean
  domainHint?: CoraTaskDomain | null
  courseId?: number | null
  courseRoutingPolicy?: import("@/lib/cora/models/types").CoraModelRequestContext["courseRoutingPolicy"]
  userRole?: import("@/lib/cora/models/types").CoraUserRole
  portal?: import("@/lib/cora/models/types").CoraPortal
  coraLiteMode?: boolean
}): CoraAiRouting {
  const goal = normalizeLearningGoal(opts.learningGoal)
  const route = resolveCoraDynamicRoute({
    message: opts.message,
    conversationHistory: opts.conversationHistory,
    learningGoal: goal,
    forAgentTools: opts.forAgentTools,
    domainHint: opts.domainHint,
    courseId: opts.courseId,
    courseRoutingPolicy: opts.courseRoutingPolicy,
    userRole: opts.userRole,
    portal: opts.portal,
    coraLiteMode: opts.coraLiteMode,
  })
  return {
    feature: route.feature,
    aiModelPreset: route.aiModelPreset,
    modelId: route.modelId,
    agentModelId: route.agentModelId,
    provider: route.provider,
    domain: route.domain,
    complexity: route.complexity,
    temperature: route.temperature,
    maxTokens: route.maxTokens,
    reason: route.reason,
    route,
    profile: route.profile,
  }
}

export function buildLearningGoalSystemPrompt(opts: {
  learningGoal: CoraLearningGoal
  lectureContext?: string
  studentProfileContext?: string
  recentPerformance?: string
  memoryPrompt?: string
  weaknessPrompt?: string
  courseHint?: string
}): string {
  const goal = normalizeLearningGoal(opts.learningGoal)
  const meta = getLearningGoalMeta(goal)

  return `${CORA_CORE_IDENTITY}

ACTIVE LEARNING GOAL: ${meta.emoji} ${meta.label}
${GOAL_WORKFLOW_PROMPTS[goal]}
${opts.courseHint ? `\nCOURSE CONTEXT: ${opts.courseHint}` : ""}
${opts.lectureContext ?? ""}
${opts.recentPerformance ?? ""}
${opts.studentProfileContext ?? ""}
${opts.memoryPrompt ?? ""}
${opts.weaknessPrompt ?? ""}`
}
