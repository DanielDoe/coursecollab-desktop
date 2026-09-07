/**
 * Default time settings per question type (in seconds)
 * These values are automatically applied when creating assessments
 * and can be overridden by instructors in the assessment editor
 */
export const DEFAULT_TIME_PER_TYPE = {
  true_false: 30,    // 30 seconds — quick recall
  mcq: 40,           // 40 seconds — single-choice reasoning
  select_all: 40,    // 40 seconds — multi-choice reasoning
  fill_blank: 45,    // 45 seconds — recall typing
  code_write: 420,   // 420 seconds (7 minutes) — coding logic & syntax (avg 7–8 min; reduces cheating)
  code_write_plot: 420, // 420 seconds (7 minutes) — code with plot upload
  code_explain: 180, // 180 seconds (3 minutes) — code explanation
  code_problem: 420, // 420 seconds (7 minutes) — problem solving
  debug_code: 240,   // 240 seconds (4 minutes) — debugging
  code_debug: 240,   // 240 seconds (4 minutes) — debugging
  fill_code: 120,    // 120 seconds (2 minutes) — fill in code
  trace_logic: 90,   // 90 seconds (1.5 minutes) — trace logic
  scenario_match: 60, // 60 seconds (1 minute) — scenario matching
  multi_output: 90,  // 90 seconds (1.5 minutes) — multiple outputs
  code_reorder: 120, // 120 seconds (2 minutes) — reorder code
  trace_output: 90,  // 90 seconds (1.5 minutes) — trace output
  code_output: 60,   // 60 seconds (1 minute) — predict output
  multi_part: 300,
  circuit_numeric: 120,
  circuit_worked_solution: 480,
  circuit_diagram_analysis: 420,
  circuit_multi_part: 540,
  circuit_fill_equation: 180,
  circuit_transfer_function: 480,
  circuit_phasor_power: 420,
  circuit_transient_response: 420,
  circuit_upload_work: 600,
  /** Handwritten / upload circuit problems — 10 minutes per question */
  circuit_submission: 600,
} as const

/** Standard per-question limit for circuit submission (10 minutes). */
export const CIRCUIT_SUBMISSION_TIME_LIMIT_SECONDS = DEFAULT_TIME_PER_TYPE.circuit_submission

/**
 * Get the default time limit for a question type
 * @param questionType - The type of question
 * @returns Time limit in seconds (defaults to 60 if type not found)
 */
export function getDefaultTimeLimit(questionType: string): number {
  return DEFAULT_TIME_PER_TYPE[questionType as keyof typeof DEFAULT_TIME_PER_TYPE] || 60
}

/**
 * Question type metadata for UI display
 */
export const QUESTION_TYPE_METADATA = {
  true_false: {
    label: "True/False",
    description: "Quick recall question",
    icon: "✓/✗",
    difficulty: "easy"
  },
  mcq: {
    label: "Multiple Choice",
    description: "Concept recognition",
    icon: "○",
    difficulty: "easy"
  },
  select_all: {
    label: "Select All",
    description: "Multi-answer reasoning",
    icon: "☑",
    difficulty: "medium"
  },
  fill_blank: {
    label: "Fill in Blank",
    description: "Short text recall",
    icon: "___",
    difficulty: "medium"
  },
  code_write: {
    label: "Code Write",
    description: "Full code writing question",
    icon: "</>",
    difficulty: "hard"
  },
  code_write_plot: {
    label: "Code Write + Plot",
    description: "Code writing with plot/image upload",
    icon: "📊",
    difficulty: "hard"
  },
  code_explain: {
    label: "Code Explain",
    description: "Explain code functionality",
    icon: "💬",
    difficulty: "medium"
  },
  code_problem: {
    label: "Code Problem",
    description: "Solve coding problem",
    icon: "🧩",
    difficulty: "hard"
  },
  debug_code: {
    label: "Debug Code",
    description: "Find and fix bugs",
    icon: "🐛",
    difficulty: "hard"
  },
  code_debug: {
    label: "Code Debug",
    description: "Debug code snippet",
    icon: "🔧",
    difficulty: "hard"
  },
  fill_code: {
    label: "Fill Code",
    description: "Complete code snippet",
    icon: "📝",
    difficulty: "medium"
  },
  trace_logic: {
    label: "Trace Logic",
    description: "Follow code execution",
    icon: "🔍",
    difficulty: "medium"
  },
  scenario_match: {
    label: "Scenario Match",
    description: "Match scenarios to concepts",
    icon: "🔗",
    difficulty: "medium"
  },
  multi_output: {
    label: "Multiple Output",
    description: "Predict multiple outputs",
    icon: "📊",
    difficulty: "medium"
  },
  code_reorder: {
    label: "Code Reorder",
    description: "Arrange code in correct order",
    icon: "↕",
    difficulty: "medium"
  },
  trace_output: {
    label: "Trace Output",
    description: "Trace code output",
    icon: "📤",
    difficulty: "medium"
  },
  code_output: {
    label: "Code Output",
    description: "Predict code output",
    icon: "🖥",
    difficulty: "easy"
  },
  circuit_numeric: {
    label: "Circuit Numeric Answer",
    description: "Numeric answer with tolerance and units",
    icon: "Ω",
    difficulty: "medium"
  },
  circuit_worked_solution: {
    label: "Circuit Worked Solution",
    description: "Show steps and final answer; AI or manual grading",
    icon: "∑",
    difficulty: "hard"
  },
  circuit_diagram_analysis: {
    label: "Circuit Diagram Analysis",
    description: "Analyze a circuit from a schematic",
    icon: "⎍",
    difficulty: "hard"
  },
  circuit_multi_part: {
    label: "Circuit Multi-Part",
    description: "Multiple related sub-questions",
    icon: "(a–d)",
    difficulty: "hard"
  },
  circuit_fill_equation: {
    label: "Circuit Equation Fill",
    description: "Fill missing terms in equations",
    icon: "□",
    difficulty: "medium"
  },
  circuit_transfer_function: {
    label: "Transfer Function",
    description: "H(s) derivation and interpretation",
    icon: "H(s)",
    difficulty: "hard"
  },
  circuit_phasor_power: {
    label: "AC Phasor / Power Analysis",
    description: "Phasors, complex power, PF",
    icon: "∠",
    difficulty: "hard"
  },
  circuit_transient_response: {
    label: "Transient Response",
    description: "RLC natural/forced response",
    icon: "τ",
    difficulty: "hard"
  },
  circuit_upload_work: {
    label: "Upload Written Work",
    description: "Handwritten or external work submission",
    icon: "📎",
    difficulty: "medium"
  },
  circuit_submission: {
    label: "Circuit Submission",
    description: "Upload complete worked solution for manual grading",
    icon: "⚡",
    difficulty: "hard"
  },
} as const

/**
 * Format time in seconds to human-readable format
 * @param seconds - Time in seconds
 * @returns Formatted time string (e.g., "5m", "1m 30s", "45s")
 */
export function formatTimeLimit(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (remainingSeconds === 0) {
    return `${minutes}m`
  }
  
  return `${minutes}m ${remainingSeconds}s`
}

/**
 * Calculate total estimated time for an assessment
 * @param questions - Array of questions with their types
 * @returns Total time in seconds
 */
export function calculateTotalAssessmentTime(
  questions: Array<{ question_type: string; time_limit?: number }>
): number {
  return questions.reduce((total, question) => {
    const timeLimit = question.time_limit || getDefaultTimeLimit(question.question_type)
    return total + timeLimit
  }, 0)
}
