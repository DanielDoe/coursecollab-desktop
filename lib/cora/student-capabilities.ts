import { CORA_HOME_ACTIONS, type CoraPlatformTab } from "@/lib/cora/platform-nav"
import type { CoraStudentContextPayload } from "@/lib/cora/fetch-student-context"

export type StudentCoraCapabilityId = string

export type StudentCoraCapability = {
  id: StudentCoraCapabilityId
  title: string
  description: string
  tab: CoraPlatformTab
  toolId?: string
  examplePrompts: string[]
}

const QUICK_ACTION_PROMPTS: Record<string, string[]> = {
  explain: [
    "Explain this homework problem step by step",
    "Why is my answer wrong for this question?",
    "Break down the key concepts I need before I can solve this",
    "Show me a similar worked example I can follow",
    "What common mistakes should I watch for on problems like this?",
    "Help me check my reasoning without giving away the final answer",
  ],
  circuit: [
    "Walk me through this circuit analysis step by step",
    "Explain the voltage and current in each branch",
    "Set up nodal or mesh equations for this circuit",
    "Find the equivalent resistance seen by the source",
    "Explain how changing one resistor affects the rest of the circuit",
    "Check my circuit analysis and point out where I went wrong",
  ],
  "code-help": [
    "Help me debug this code and explain what's going wrong",
    "Trace through this program and show me the output",
    "Explain this algorithm line by line",
    "Suggest a cleaner way to structure this solution",
    "Walk through a sample input and show variable values at each step",
    "Review my code for logic errors and edge cases",
  ],
  exam: [
    "Help me prepare for my upcoming exam with a focused review plan",
    "Quiz me on the topics most likely to appear on the exam",
    "What should I review first based on my weak areas?",
    "Give me a 30-minute warm-up drill before the exam",
    "Summarize the must-know formulas and definitions for this exam",
    "Build a last-week checklist so I don't miss anything important",
  ],
  homework: [
    "Review my homework and point out gaps in my reasoning",
    "Check my work and suggest concrete improvements",
    "Compare my approach to the method my instructor expects",
    "Tell me which steps are correct and which need rework",
    "Help me rewrite my explanation more clearly",
    "Flag anything that would lose partial credit",
  ],
  flashcards: [
    "Generate flashcards from my latest lecture material",
    "Create flashcards for the concepts I'm struggling with most",
    "Make cards focused on definitions I keep mixing up",
    "Build a deck from this week's practice problems",
    "Turn my lecture notes into front/back flashcard pairs",
    "Prioritize flashcards for topics that show up on assessments",
  ],
  lecture: [
    "Summarize the key ideas from my latest lecture",
    "Build a glossary of important terms from this week's lectures",
    "Turn this lecture into a short outline I can review tonight",
    "List the formulas and when to use each one",
    "Highlight common exam traps from this material",
    "Create a one-page cheat sheet from the lecture",
  ],
  plan: [
    "Create a daily study plan for the next two weeks",
    "Build an exam countdown schedule with daily focus topics",
    "Balance lectures, practice, and flashcards for this week",
    "Plan study blocks around my upcoming deadlines",
    "Suggest what to review each day before my next exam",
    "Adjust my plan if I'm behind on practice and readings",
  ],
}

export const STUDENT_CORA_CAPABILITIES: StudentCoraCapability[] = CORA_HOME_ACTIONS.map((action) => ({
  id: action.id,
  title: action.title,
  description: action.description,
  tab: action.tab,
  toolId: action.toolId,
  examplePrompts: QUICK_ACTION_PROMPTS[action.id] ?? [`Help me with ${action.title.toLowerCase()}`],
}))

function tailorCapabilityPrompts(
  capabilityId: string,
  base: StudentCoraCapability,
  payload: CoraStudentContextPayload,
): string[] {
  const courseCode = payload.account?.courseCode ?? "your course"
  const upcoming = payload.upcomingAssessments?.[0]?.title ?? "your next exam"
  const struggling =
    payload.strugglingTopics?.[0] ??
    payload.topicMastery?.find((row) => row.status === "weak" || row.mastery < 0.55)?.topic ??
    "key topics"
  const strength = payload.strengths?.[0] ?? payload.topicMastery?.[0]?.topic ?? "recent material"
  const lecture =
    payload.knowledgeGraph?.lectures?.[0]?.title ??
    payload.digitalNotes?.[0]?.title ??
    "your latest lecture"

  switch (capabilityId) {
    case "explain":
      return [
        `Explain this ${courseCode} homework problem step by step`,
        `Why is my answer wrong for this ${courseCode} question?`,
        `Walk me through ${struggling} with a worked example`,
        `Break down the concepts I need before solving this ${courseCode} problem`,
        `Show me a similar ${courseCode} problem and talk through the method`,
        `Check my reasoning without giving me the final answer`,
      ]
    case "circuit":
      return [
        `Walk me through this circuit analysis step by step`,
        `Explain voltage and current in each branch of this circuit`,
        `Help me analyze a circuit problem from ${courseCode}`,
        `Set up nodal or mesh equations for this circuit`,
        `Find the equivalent resistance and explain each simplification`,
        `Check my ${courseCode} circuit work and point out errors`,
      ]
    case "code-help":
      return [
        `Help me debug this code and explain what's going wrong`,
        `Trace through this program and show me the output`,
        `Review my ${courseCode} programming assignment approach`,
        `Explain this algorithm line by line with a sample input`,
        `Suggest a cleaner structure for this ${courseCode} solution`,
        `Find edge cases my code might fail on`,
      ]
    case "exam":
      return [
        `Help me prepare for ${upcoming} in ${courseCode}`,
        `Quiz me on topics most likely to appear on ${upcoming}`,
        `Build a focused review plan for ${upcoming}`,
        `What should I review first for ${upcoming} based on my weak areas?`,
        `Give me a 30-minute warm-up drill for ${upcoming}`,
        `Summarize must-know ideas for ${upcoming} in ${courseCode}`,
      ]
    case "homework":
      return [
        `Review my ${courseCode} homework and point out gaps in my reasoning`,
        `Check my work on ${struggling} and suggest concrete improvements`,
        `Compare my solution approach to the expected method`,
        `Tell me which steps are correct and which need rework`,
        `Help me rewrite my explanation more clearly`,
        `Flag anything that would lose partial credit on this assignment`,
      ]
    case "flashcards":
      return [
        `Generate flashcards from ${lecture}`,
        `Create flashcards for ${struggling} in ${courseCode}`,
        `Build a deck covering ${strength} and weak areas`,
        `Make cards for definitions I keep mixing up in ${courseCode}`,
        `Turn ${lecture} into front/back flashcard pairs`,
        `Prioritize flashcards for topics likely on ${upcoming}`,
      ]
    case "lecture":
      return [
        `Summarize the key ideas from ${lecture}`,
        `Build a glossary of important terms from this week's ${courseCode} lectures`,
        `Turn ${lecture} into a short study outline`,
        `List formulas from ${lecture} and when to use each`,
        `Highlight common exam traps from ${lecture}`,
        `Create a one-page cheat sheet from ${lecture}`,
      ]
    case "plan":
      return [
        `Create a daily study plan for ${upcoming} in ${courseCode}`,
        `Build an exam countdown schedule focused on ${struggling}`,
        `Plan my next two weeks around ${courseCode} deadlines`,
        `Balance lectures, practice, and flashcards for this week`,
        `Suggest daily review blocks before ${upcoming}`,
        `Adjust my plan if I'm behind on ${struggling}`,
      ]
    default:
      return base.examplePrompts
  }
}

export function tailorStudentCoraCapabilities(
  payload: CoraStudentContextPayload | null | undefined,
): StudentCoraCapability[] {
  if (!payload) return STUDENT_CORA_CAPABILITIES
  return STUDENT_CORA_CAPABILITIES.map((capability) => ({
    ...capability,
    examplePrompts: tailorCapabilityPrompts(capability.id, capability, payload),
  }))
}

export function studentCoraCapability(id: string): StudentCoraCapability {
  return (
    STUDENT_CORA_CAPABILITIES.find((c) => c.id === id) ?? {
      id,
      title: id,
      description: "",
      tab: "workspace",
      examplePrompts: [],
    }
  )
}
