import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  Brain,
  Bug,
  CheckCircle2,
  Code2,
  FileSearch,
  Lightbulb,
  PenLine,
  Puzzle,
  Rocket,
  ScanSearch,
  Search,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react"
import type { CoraLearningGoal } from "@/lib/cora/learning-goals"

export type CoraThinkingMode =
  | CoraLearningGoal
  | "debug"
  | "suggest_fix"
  | "explain"
  | "improve"
  | "pseudocode"
  | "evaluate"
  | "general"

export type CoraThinkingStep = {
  id: string
  label: string
  icon: LucideIcon
}

export const CORA_THINKING_HEADLINE: Record<CoraThinkingMode, string> = {
  understand: "Building a clear explanation…",
  solve_together: "Working through this with you…",
  review: "Reviewing your work…",
  prepare: "Preparing your study plan…",
  create: "Drafting your resource…",
  debug: "Debugging your code…",
  suggest_fix: "Analyzing the compiler error…",
  explain: "Explaining your program…",
  improve: "Reviewing code quality…",
  pseudocode: "Translating logic to pseudocode…",
  evaluate: "Preparing comprehension questions…",
  general: "Cora is thinking…",
}

const CODEBENCH_DEBUG_STEPS: CoraThinkingStep[] = [
  { id: "read-code", label: "Reading your code", icon: Code2 },
  { id: "fetch-error", label: "Retrieving the compiler output", icon: FileSearch },
  { id: "parse-error", label: "Parsing the error message", icon: ScanSearch },
  { id: "locate", label: "Pinpointing the problem area", icon: Bug },
  { id: "diagnose", label: "Noticed what went wrong", icon: Lightbulb },
  { id: "fix-plan", label: "Preparing a teaching-friendly fix", icon: Wrench },
]

const CODEBENCH_SUGGEST_FIX_STEPS: CoraThinkingStep[] = [
  { id: "read-code", label: "Analyzing your submission", icon: Code2 },
  { id: "fetch-error", label: "Pulling the build error details", icon: FileSearch },
  { id: "parse-error", label: "Reading the fault line by line", icon: ScanSearch },
  { id: "root-cause", label: "Tracing the root cause", icon: Bug },
  { id: "insight", label: "Noticed the likely mistake", icon: Lightbulb },
  { id: "guidance", label: "Crafting guidance without spoiling the answer", icon: PenLine },
]

const CODEBENCH_EXPLAIN_STEPS: CoraThinkingStep[] = [
  { id: "scan", label: "Scanning program structure", icon: Search },
  { id: "trace", label: "Tracing execution flow", icon: Brain },
  { id: "concepts", label: "Highlighting key concepts", icon: Sparkles },
  { id: "explain", label: "Writing a clear explanation", icon: BookOpen },
]

const CODEBENCH_IMPROVE_STEPS: CoraThinkingStep[] = [
  { id: "read", label: "Reviewing your implementation", icon: Code2 },
  { id: "style", label: "Checking readability and structure", icon: ScanSearch },
  { id: "patterns", label: "Spotting improvement opportunities", icon: Lightbulb },
  { id: "suggest", label: "Drafting focused suggestions", icon: PenLine },
]

const CODEBENCH_PSEUDOCODE_STEPS: CoraThinkingStep[] = [
  { id: "abstract", label: "Abstracting logic from syntax", icon: Brain },
  { id: "flow", label: "Mapping control flow", icon: Puzzle },
  { id: "outline", label: "Building step-by-step outline", icon: BookOpen },
  { id: "polish", label: "Polishing pseudocode wording", icon: PenLine },
]

const CODEBENCH_EVALUATE_STEPS: CoraThinkingStep[] = [
  { id: "read", label: "Reading your code submission", icon: Code2 },
  { id: "comprehension", label: "Identifying concepts to probe", icon: Target },
  { id: "questions", label: "Drafting comprehension questions", icon: Brain },
  { id: "calibrate", label: "Calibrating difficulty for your level", icon: CheckCircle2 },
]

const GENERAL_STEPS: CoraThinkingStep[] = [
  { id: "context", label: "Gathering context", icon: BookOpen },
  { id: "analyze", label: "Analyzing your request", icon: Brain },
  { id: "respond", label: "Composing a helpful response", icon: PenLine },
]

const GOAL_STEPS: Record<CoraLearningGoal, CoraThinkingStep[]> = {
  understand: [
    { id: "context", label: "Reading your course context", icon: BookOpen },
    { id: "simplify", label: "Building a clear explanation", icon: Brain },
    { id: "check", label: "Preparing a comprehension check", icon: PenLine },
  ],
  solve_together: [
    { id: "analyze", label: "Analyzing the problem", icon: Puzzle },
    { id: "plan", label: "Breaking into guided steps", icon: Brain },
    { id: "hint", label: "Crafting your first hint", icon: PenLine },
  ],
  review: [
    { id: "read", label: "Reviewing your submission", icon: Search },
    { id: "gaps", label: "Identifying improvements", icon: Brain },
    { id: "feedback", label: "Writing constructive feedback", icon: PenLine },
  ],
  prepare: [
    { id: "scope", label: "Scoping what to prepare for", icon: Target },
    { id: "weak", label: "Finding weak spots", icon: Brain },
    { id: "plan", label: "Building your practice plan", icon: PenLine },
  ],
  create: [
    { id: "format", label: "Choosing the best format", icon: Rocket },
    { id: "outline", label: "Outlining your resource", icon: Brain },
    { id: "draft", label: "Drafting content", icon: PenLine },
  ],
}

export function resolveCoraThinkingSteps(mode: CoraThinkingMode = "general"): CoraThinkingStep[] {
  switch (mode) {
    case "debug":
      return CODEBENCH_DEBUG_STEPS
    case "suggest_fix":
      return CODEBENCH_SUGGEST_FIX_STEPS
    case "explain":
      return CODEBENCH_EXPLAIN_STEPS
    case "improve":
      return CODEBENCH_IMPROVE_STEPS
    case "pseudocode":
      return CODEBENCH_PSEUDOCODE_STEPS
    case "evaluate":
      return CODEBENCH_EVALUATE_STEPS
    case "understand":
    case "solve_together":
    case "review":
    case "prepare":
    case "create":
      return GOAL_STEPS[mode]
    default:
      return GENERAL_STEPS
  }
}

export function mapCodebenchToolToThinkingMode(
  tool: string | null | undefined,
  options?: { fromCompilerError?: boolean },
): CoraThinkingMode {
  if (options?.fromCompilerError) return "suggest_fix"
  switch (tool) {
    case "debug":
      return "debug"
    case "explain":
    case "walkthrough":
      return "explain"
    case "improve":
      return "improve"
    case "pseudocode":
      return "pseudocode"
    case "evaluate":
      return "evaluate"
    case "tutor":
      return "understand"
    default:
      return "general"
  }
}
