/**
 * Canonical topic merge map for ELEG 130X programming question banks.
 * Numbered quiz splits and tiny code-write subfolders fold into parent topics.
 */
export const ELEG130X_TOPIC_MERGE_MAP: Record<string, string> = {
  // C++ Functions family
  "C++ Functions 1": "C++ Functions",
  "C++ Functions 2": "C++ Functions",
  "C++ Functions 3": "C++ Functions",
  "Functions - Array Parameters": "C++ Functions",
  "Functions - Basic": "C++ Functions",
  "Functions - Complex Recursion": "C++ Functions",
  "Functions - Multiple Functions": "C++ Functions",
  "Functions - Multiple Parameters": "C++ Functions",
  "Functions - Parameters": "C++ Functions",
  "Functions - Recursion": "C++ Functions",
  "Functions - Reference Parameters": "C++ Functions",

  // Loops family
  "Performing Repetitions: Loops 1": "Performing Repetitions: Loops",
  "Performing Repetitions: Loops 2": "Performing Repetitions: Loops",
  "Performing Repetitions: Loops 3": "Performing Repetitions: Loops",
  "Loops - Do-While": "Performing Repetitions: Loops",
  "Loops - For": "Performing Repetitions: Loops",
  "Loops - Nested For": "Performing Repetitions: Loops",
  "Loops - Nested While": "Performing Repetitions: Loops",
  "Loops - While": "Performing Repetitions: Loops",

  // Selection criteria family
  "Selection Criteria (if, else-if, switch) 1": "Selection Criteria (if, else-if, switch)",
  "Selection Criteria (if, else-if, switch) 2": "Selection Criteria (if, else-if, switch)",
  "Selection Criteria (if, else-if, switch) 3": "Selection Criteria (if, else-if, switch)",
  "Selection Criteria - Complex Conditions": "Selection Criteria (if, else-if, switch)",
  "Selection Criteria - If/Else": "Selection Criteria (if, else-if, switch)",
  "Selection Criteria - Nested If": "Selection Criteria (if, else-if, switch)",
  "Selection Criteria - Nested If & Switch": "Selection Criteria (if, else-if, switch)",
  "Selection Criteria - Switch": "Selection Criteria (if, else-if, switch)",

  // MATLAB family
  "MATLAB 1": "MATLAB",
  "MATLAB 2": "MATLAB",
}

/** Course codes whose question banks use the ELEG130X topic layout. */
export const ELEG130X_QUESTION_BANK_COURSE_CODES = [
  "ELEG1304",
  "ELEG1304P03",
  "ELEG1301",
  "ELEG1301P01",
  "ELEG1301P02",
  "CCREVIEW1304",
  "LEGACY",
] as const
