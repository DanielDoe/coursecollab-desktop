import type { QuestionBankTypeId } from "@/lib/question-bank-type-config"

const COURSE_PLACEHOLDER = "{{COURSE_ID}}"

function dollarQuote(text: string): string {
  const tag = "q"
  return `$${tag}$${text}$${tag}$`
}

/** Example INSERT templates instructors/AI should follow (PostgreSQL). */
export function getQuestionBankSqlTemplate(questionType: string): string {
  const cid = COURSE_PLACEHOLDER
  const t = questionType.trim().toLowerCase()

  switch (t) {
    case "mcq":
      return `INSERT INTO question_bank (
  question_text, question_type, difficulty, topic, options, correct_answer,
  evaluation_mode, explanation, hint, course_id
)
VALUES (
  ${dollarQuote("What is the unit of resistance?")},
  'mcq',
  'medium',
  ${dollarQuote("Circuit Fundamentals")},
  '["Ohm","Volt","Ampere","Watt"]'::jsonb,
  '"A"'::jsonb,
  'auto',
  ${dollarQuote("Resistance is measured in ohms.")},
  NULL,
  ${cid}
)
RETURNING id;`

    case "true_false":
      return `INSERT INTO question_bank (
  question_text, question_type, difficulty, topic, options, correct_answer,
  evaluation_mode, explanation, course_id
)
VALUES (
  ${dollarQuote("Kirchhoff's current law states that current is conserved at a node.")},
  'true_false',
  'easy',
  ${dollarQuote("Circuit Laws")},
  '["True","False"]'::jsonb,
  '"A"'::jsonb,
  'auto',
  ${dollarQuote("KCL: sum of currents into a node equals sum leaving.")},
  ${cid}
)
RETURNING id;`

    case "select_all":
      return `INSERT INTO question_bank (
  question_text, question_type, difficulty, topic, options, correct_answer,
  evaluation_mode, explanation, course_id
)
VALUES (
  ${dollarQuote("Which are passive circuit elements? (Select all that apply)")},
  'select_all',
  'medium',
  ${dollarQuote("Circuit Fundamentals")},
  '["Resistor","Battery","Capacitor","Inductor"]'::jsonb,
  '["A","C","D"]'::jsonb,
  'auto',
  ${dollarQuote("Battery is an active source.")},
  ${cid}
)
RETURNING id;`

    case "fill_blank":
      return `INSERT INTO question_bank (
  question_text, question_type, difficulty, topic, options, correct_answer,
  evaluation_mode, explanation, course_id
)
VALUES (
  ${dollarQuote("The SI prefix for 10^-3 is _____.")},
  'fill_blank',
  'easy',
  ${dollarQuote("SI Units")},
  '["milli","kilo","mega"]'::jsonb,
  '"A"'::jsonb,
  'auto',
  ${dollarQuote("milli = m")},
  ${cid}
)
RETURNING id;`

    case "code_write":
    case "code_problem":
    case "debug_code":
      return `INSERT INTO question_bank (
  question_text, question_type, difficulty, topic, options, correct_answer,
  evaluation_mode, sample_answer, answer_guidelines, hint, course_id
)
VALUES (
  ${dollarQuote("Write a C++ program that reads N integers and prints their sum.")},
  '${t}',
  'medium',
  ${dollarQuote("Loops and Arrays")},
  '[]'::jsonb,
  '"// Rubric reference — graded by AI using answer_guidelines"'::jsonb,
  'auto',
  ${dollarQuote("#include <iostream>\\nusing namespace std;\\nint main() { /* solution */ return 0; }")},
  '["Uses a loop","Correct sum","Handles input format"]'::jsonb,
  ${dollarQuote("Use a for-loop over N values.")},
  ${cid}
)
RETURNING id;`

    case "code_write_plot":
      return `INSERT INTO question_bank (
  question_text, question_type, difficulty, topic, options, correct_answer,
  evaluation_mode, sample_answer, answer_guidelines, hint, course_id
)
VALUES (
  ${dollarQuote("Plot the I-V curve for the given resistor and upload your plot.")},
  'code_write_plot',
  'medium',
  ${dollarQuote("Circuit Analysis")},
  '[]'::jsonb,
  ${dollarQuote("// AI grades code + plot image")},
  'auto',
  NULL,
  '["Correct plot axes","Code produces data","Labels units"]'::jsonb,
  NULL,
  ${cid}
)
RETURNING id;`

    case "trace_output":
    case "code_explain":
      return `INSERT INTO question_bank (
  question_text, question_type, difficulty, topic, options, correct_answer,
  evaluation_mode, sample_answer, answer_guidelines, course_id
)
VALUES (
  ${dollarQuote("What is the output of the following code?\\n\\n\\`\\`\\`cpp\\nint x = 3; cout << x * 2;\\n\\`\\`\\`")},
  '${t}',
  'medium',
  ${dollarQuote("C++ Basics")},
  '[]'::jsonb,
  ${dollarQuote("6")},
  'auto',
  ${dollarQuote("x * 2 = 6")},
  '["Correct numeric output","Shows understanding"]'::jsonb,
  ${cid}
)
RETURNING id;`

    case "multi_part":
      return `INSERT INTO question_bank (
  question_text, question_type, difficulty, topic, options, correct_answer,
  evaluation_mode, question_media, subquestions, course_id
)
VALUES (
  ${dollarQuote("Refer to the circuit diagram and answer parts (a)–(d).")},
  'multi_part',
  'medium',
  ${dollarQuote("Circuit Fundamentals")},
  '[]'::jsonb,
  NULL,
  'auto',
  '{"media_enabled":false}'::jsonb,
  '[
    {"id":"a","label":"(a)","question_type":"mcq","question_text":"Find R_eq","options":["1Ω","2Ω","3Ω"],"correct_answer":"B","points":2},
    {"id":"b","label":"(b)","question_type":"true_false","question_text":"Current splits equally.","options":["True","False"],"correct_answer":"A","points":1}
  ]'::jsonb,
  ${cid}
)
RETURNING id;`

    default:
      return `INSERT INTO question_bank (
  question_text, question_type, difficulty, topic, options, correct_answer,
  evaluation_mode, course_id
)
VALUES (
  ${dollarQuote("Your question text")},
  '${t}',
  'medium',
  NULL,
  '[]'::jsonb,
  NULL,
  'auto',
  ${cid}
)
RETURNING id;`
  }
}

export function buildAiSqlGenerationSystemPrompt(questionType: QuestionBankTypeId | string): string {
  const template = getQuestionBankSqlTemplate(questionType)
  return `You are a PostgreSQL expert helping instructors seed the \`question_bank\` table.

Rules:
- Output exactly ONE \`INSERT INTO question_bank (...)\` statement ending with \`RETURNING id;\`
- Use PostgreSQL dollar-quoting for all text fields (e.g. $q$...$q$) to avoid escape issues
- Always set \`course_id\` to the literal placeholder ${COURSE_PLACEHOLDER} (no other course id)
- \`question_type\` must be exactly: ${questionType}
- \`options\`, \`correct_answer\`, \`answer_guidelines\`, \`subquestions\`, and \`question_media\` must be valid JSONB literals using single-quoted JSON plus \`::jsonb\` (e.g. '["A","B"]'::jsonb). Never use dollar-quoting for JSONB columns.
- For mcq, true_false, select_all, and fill_blank: omit \`answer_guidelines\`, \`sample_answer\`, and \`subquestions\` (or set them to NULL). Only include columns shown in the template for that type.
- For true_false: options are '["True","False"]'::jsonb and correct_answer is '"A"' (True) or '"B"' (False)
- For coding types: options are often '[]'::jsonb; use answer_guidelines JSON array for rubric items
- Do not include markdown fences or commentary — SQL only

Template for this question type:
${template}`
}

export const QUESTION_BANK_SQL_COURSE_PLACEHOLDER = COURSE_PLACEHOLDER
