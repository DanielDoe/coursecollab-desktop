import {
  CircleDot,
  Code2,
  FileQuestion,
  Layers,
  ListChecks,
  PenLine,
  ToggleLeft,
  Zap,
  type LucideIcon,
} from "lucide-react"

export type QuestionBankTypeId =
  | "mcq"
  | "true_false"
  | "select_all"
  | "fill_blank"
  | "code_problem"
  | "trace_output"
  | "debug_code"
  | "code_write"
  | "code_write_plot"
  | "code_explain"
  | "multi_part"
  | "circuit_submission"

export type QuestionBankTypeCategory = "choice" | "coding" | "structured"

export type QuestionBankTypeMeta = {
  id: QuestionBankTypeId
  label: string
  description: string
  category: QuestionBankTypeCategory
  icon: LucideIcon
  requiresOptions: boolean
  usesCodeEditor: boolean
  usesGradingGuidelines: boolean
}

export const QUESTION_BANK_TYPE_CATEGORIES: { id: QuestionBankTypeCategory; label: string }[] = [
  { id: "choice", label: "Multiple choice & text" },
  { id: "coding", label: "Programming & tracing" },
  { id: "structured", label: "Structured" },
]

export const QUESTION_BANK_TYPES: QuestionBankTypeMeta[] = [
  {
    id: "mcq",
    label: "Multiple Choice",
    description: "One correct answer from several options",
    category: "choice",
    icon: CircleDot,
    requiresOptions: true,
    usesCodeEditor: false,
    usesGradingGuidelines: false,
  },
  {
    id: "true_false",
    label: "True / False",
    description: "Binary statement — True or False",
    category: "choice",
    icon: ToggleLeft,
    requiresOptions: true,
    usesCodeEditor: false,
    usesGradingGuidelines: false,
  },
  {
    id: "select_all",
    label: "Select All That Apply",
    description: "Multiple correct options allowed",
    category: "choice",
    icon: ListChecks,
    requiresOptions: true,
    usesCodeEditor: false,
    usesGradingGuidelines: false,
  },
  {
    id: "fill_blank",
    label: "Fill in the Blank",
    description: "Short text answer with optional blanks",
    category: "choice",
    icon: PenLine,
    requiresOptions: true,
    usesCodeEditor: false,
    usesGradingGuidelines: false,
  },
  {
    id: "code_problem",
    label: "Code Problem",
    description: "Students solve a programming task",
    category: "coding",
    icon: Code2,
    requiresOptions: false,
    usesCodeEditor: true,
    usesGradingGuidelines: true,
  },
  {
    id: "trace_output",
    label: "Trace Output",
    description: "Predict program output from given code",
    category: "coding",
    icon: FileQuestion,
    requiresOptions: false,
    usesCodeEditor: false,
    usesGradingGuidelines: true,
  },
  {
    id: "debug_code",
    label: "Debug Code",
    description: "Find and fix bugs in provided code",
    category: "coding",
    icon: Code2,
    requiresOptions: false,
    usesCodeEditor: true,
    usesGradingGuidelines: true,
  },
  {
    id: "code_write",
    label: "Code Write",
    description: "Write code from scratch (AI-graded)",
    category: "coding",
    icon: Code2,
    requiresOptions: false,
    usesCodeEditor: true,
    usesGradingGuidelines: true,
  },
  {
    id: "code_write_plot",
    label: "Code Write + Plot",
    description: "Code submission with plot/image upload",
    category: "coding",
    icon: Code2,
    requiresOptions: false,
    usesCodeEditor: true,
    usesGradingGuidelines: true,
  },
  {
    id: "code_explain",
    label: "Code Explain",
    description: "Explain what code does or how it works",
    category: "coding",
    icon: Code2,
    requiresOptions: false,
    usesCodeEditor: false,
    usesGradingGuidelines: true,
  },
  {
    id: "multi_part",
    label: "Multi-part",
    description: "Shared stem with multiple sub-questions",
    category: "structured",
    icon: Layers,
    requiresOptions: false,
    usesCodeEditor: false,
    usesGradingGuidelines: false,
  },
  {
    id: "circuit_submission",
    label: "Circuit Submission",
    description: "Circuit figure + upload worked solution (manual grading only)",
    category: "structured",
    icon: Zap,
    requiresOptions: false,
    usesCodeEditor: false,
    usesGradingGuidelines: false,
  },
]

export function getQuestionBankTypeMeta(type: string): QuestionBankTypeMeta | undefined {
  return QUESTION_BANK_TYPES.find((t) => t.id === type)
}

export const QUESTION_BANK_VALID_TYPE_IDS = [
  ...QUESTION_BANK_TYPES.map((t) => t.id),
  "code_output",
  "code_debug",
  "fill_code",
  "trace_logic",
  "scenario_match",
  "multi_output",
  "code_reorder",
] as const
