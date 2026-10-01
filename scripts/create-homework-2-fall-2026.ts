/**
 * Homework 2 Fall 2026 for ELEG 1301 and ELEG 1304.
 * Section I: random Selection Criteria items from the question bank (same mix as Homework 1).
 * Section II: if / else classroom-point problems almost nobody submitted.
 *
 *   npx tsx scripts/create-homework-2-fall-2026.ts
 *   DRY_RUN=1 npx tsx scripts/create-homework-2-fall-2026.ts
 */
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const DRY_RUN = /^(1|true|yes)$/i.test(String(process.env.DRY_RUN ?? ""))
const TITLE = "Homework 2 Fall 2026"
const TOPIC = "Homework 2 — Selection Criteria (Fall 2026)"
const SEED = 20260929

const SECTION_CONFIG = [
  {
    title: "Section I: Concept Review",
    timer_mode: "section_timer",
    question_types: ["mcq", "true_false", "select_all", "fill_blank", "multiple_choice"],
    weight_percent: 40,
    allow_backtracking: false,
    question_order_start: 1,
    question_order_end: 20,
    total_time_seconds: 3600,
    auto_submit_on_expire: true,
    exam_shared_timer_seconds: 3600,
  },
  {
    title: "Section II: Programming",
    timer_mode: "section_timer",
    question_types: ["code_write"],
    weight_percent: 60,
    allow_backtracking: true,
    question_order_start: 21,
    question_order_end: 26,
    total_time_seconds: 3600,
    auto_submit_on_expire: true,
  },
]

const AVAILABLE_FROM = "2026-09-29T13:00:00.000Z"
const AVAILABLE_UNTIL = "2026-10-21T04:59:59.999Z"

type BankRow = {
  id: number
  question_text: string
  question_type: string
  difficulty: string | null
  topic: string | null
  options: unknown
  correct_answer: unknown
  hint: string | null
  explanation: string | null
}

type Option = { id: string; text: string }

const CODE_PROBLEMS: Array<{
  title: string
  difficulty: "easy" | "medium"
  questionText: string
  sampleAnswer: string
}> = [
  {
    title: "Package Weight Surcharge",
    difficulty: "easy",
    questionText: `A delivery company charges a standard shipping fee of $8.00. If a package weighs more than 20 kg, an additional $12.00 surcharge is added.

Write a C++ program that asks for the package weight and calculates the total shipping cost.

Requirements:
- Read the package weight in kilograms.
- Start with a shipping cost of $8.00.
- Add $12.00 if the package weighs more than 20 kg.
- Display the final shipping cost with two decimal places, in the form \`Shipping Cost: $20.00\`.

Sample input:
27
Expected output:
Shipping Cost: $20.00

If the weight is 20 kg or less, display:
Shipping Cost: $8.00`,
    sampleAnswer: `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double weight;
    cout << "Enter package weight (kg): ";
    cin >> weight;
    double cost = 8.00;
    if (weight > 20)
        cost += 12.00;
    cout << fixed << setprecision(2);
    cout << "Shipping Cost: $" << cost << endl;
    return 0;
}`,
  },
  {
    title: "Free Delivery Eligibility",
    difficulty: "easy",
    questionText: `An online store provides free delivery for orders of $50 or more.

Write a C++ program that asks for the order total and uses the ternary operator to determine whether the customer receives free delivery.

Requirements:
- Read the order total.
- Use the ternary operator.
- Display \`Free Delivery\` when the total is $50 or more.
- Otherwise display \`No Free Delivery\`.

Sample input:
72.50
Expected output:
Free Delivery`,
    sampleAnswer: `#include <iostream>
using namespace std;

int main() {
    double total;
    cout << "Enter order total: ";
    cin >> total;
    cout << (total >= 50 ? "Free Delivery" : "No Free Delivery") << endl;
    return 0;
}`,
  },
  {
    title: "Warehouse Package Acceptance",
    difficulty: "medium",
    questionText: `A shipping warehouse accepts a package only if its weight is 50 kg or less. If the weight is acceptable, the package must also have a valid shipping label.

Write a C++ program that asks for the package weight and whether it has a valid label (1 for Yes, 0 for No).

Requirements:
- First check whether the package weighs 50 kg or less.
- Only if the weight is acceptable, check the shipping label.
- Display the appropriate result.

If the weight is acceptable and the label is valid, display:
Package Accepted

If the weight is acceptable but the label is invalid, display:
Package Rejected: Invalid shipping label.

If the package exceeds the weight limit, display:
Package Rejected: Weight limit exceeded.

Sample input:
35
1
Expected output:
Package Accepted`,
    sampleAnswer: `#include <iostream>
using namespace std;

int main() {
    double weight;
    int label;
    cout << "Enter package weight (kg): ";
    cin >> weight;
    if (weight <= 50) {
        cout << "Valid shipping label (1 = Yes, 0 = No): ";
        cin >> label;
        if (label == 1)
            cout << "Package Accepted" << endl;
        else
            cout << "Package Rejected: Invalid shipping label." << endl;
    } else {
        cout << "Package Rejected: Weight limit exceeded." << endl;
    }
    return 0;
}`,
  },
  {
    title: "Laboratory Equipment Access",
    difficulty: "medium",
    questionText: `A university laboratory allows a student to operate specialized equipment only if the student has completed the required safety training. If training has been completed, the student must also have instructor authorization.

Write a C++ program that asks whether the student has completed safety training and whether they have instructor authorization (1 for Yes, 0 for No).

Requirements:
- First check the safety-training status.
- Only if training is complete, check instructor authorization.
- Display the appropriate access decision.

If training is complete and the instructor has authorized the student, display:
Access Granted

If training is complete but there is no instructor authorization, display:
Access Denied: Instructor authorization required.

If safety training is not complete, display:
Access Denied: Safety training required.

Sample input:
1
0
Expected output:
Access Denied: Instructor authorization required.`,
    sampleAnswer: `#include <iostream>
using namespace std;

int main() {
    int training;
    int authorization;
    cout << "Safety training completed (1 = Yes, 0 = No): ";
    cin >> training;
    if (training == 1) {
        cout << "Instructor authorization (1 = Yes, 0 = No): ";
        cin >> authorization;
        if (authorization == 1)
            cout << "Access Granted" << endl;
        else
            cout << "Access Denied: Instructor authorization required." << endl;
    } else {
        cout << "Access Denied: Safety training required." << endl;
    }
    return 0;
}`,
  },
  {
    title: "Engineering Unit Converter Menu",
    difficulty: "medium",
    questionText: `Create a simple engineering conversion program. The user enters a menu option and a value:

- 1 → Convert meters to centimeters (centimeters = meters × 100)
- 2 → Convert kilograms to grams (grams = kilograms × 1000)
- 3 → Convert hours to minutes (minutes = hours × 60)

Use a switch statement to perform the selected conversion.

Requirements:
- Read the menu option and the value.
- Use a switch statement.
- Display the converted result, or \`Invalid option.\` when the option is not 1, 2, or 3.

Display the result in this form:
- option 1: \`250 centimeters\`
- option 2: \`4500 grams\`
- option 3: \`90 minutes\`

Sample input:
2
4.5
Expected output:
4500 grams`,
    sampleAnswer: `#include <iostream>
using namespace std;

int main() {
    int option;
    double value;
    cout << "Select conversion (1-3): ";
    cin >> option;
    cout << "Enter value: ";
    cin >> value;
    switch (option) {
        case 1:
            cout << value * 100 << " centimeters" << endl;
            break;
        case 2:
            cout << value * 1000 << " grams" << endl;
            break;
        case 3:
            cout << value * 60 << " minutes" << endl;
            break;
        default:
            cout << "Invalid option." << endl;
            break;
    }
    return 0;
}`,
  },
  {
    title: "Smart Home Device Controller",
    difficulty: "medium",
    questionText: `A smart-home controller allows a user to select a device:

- 1 → Living Room Lights
- 2 → Air Conditioner
- 3 → Security System
- 4 → Garage Door

Write a C++ program that reads the selected device number and displays the corresponding action. If the user enters any other number, display \`Invalid device selection\`.

Requirements:
- Read the selected device number.
- Use a switch statement.
- Display the matching action or \`Invalid device selection\`.

Display:
- 1 → \`Living Room Lights Selected\`
- 2 → \`Air Conditioner Selected\`
- 3 → \`Security System Selected\`
- 4 → \`Garage Door Selected\`

Sample input:
3
Expected output:
Security System Selected`,
    sampleAnswer: `#include <iostream>
using namespace std;

int main() {
    int device;
    cout << "Select device (1-4): ";
    cin >> device;
    switch (device) {
        case 1:
            cout << "Living Room Lights Selected" << endl;
            break;
        case 2:
            cout << "Air Conditioner Selected" << endl;
            break;
        case 3:
            cout << "Security System Selected" << endl;
            break;
        case 4:
            cout << "Garage Door Selected" << endl;
            break;
        default:
            cout << "Invalid device selection" << endl;
            break;
    }
    return 0;
}`,
  },
]

function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = copy[i]
    copy[i] = copy[j]!
    copy[j] = swap!
  }
  return copy
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value
  const text = value.trim()
  if (!text) return value
  if (text.startsWith("[") || text.startsWith("{") || text.startsWith('"')) {
    try {
      return JSON.parse(text)
    } catch {
      return value
    }
  }
  return value
}

function parseOptions(raw: unknown): Option[] {
  const parsed = parseJson(raw)
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item, index) => {
      if (item && typeof item === "object" && "text" in item) {
        const record = item as { id?: unknown; text?: unknown }
        const id = String(record.id ?? String.fromCharCode(65 + index)).trim()
        return { id, text: String(record.text ?? "") }
      }
      return { id: String.fromCharCode(65 + index), text: String(item ?? "") }
    })
    .filter((option) => option.text.trim().length > 0)
}

function correctAnswerForQuiz(questionType: string, options: Option[], raw: unknown): string {
  const parsed = parseJson(raw)
  const items = Array.isArray(parsed) ? parsed.map((item) => String(item)) : [String(parsed ?? "")]
  const letters = items.map((item) => {
    if (/^[A-E]$/i.test(item)) return item.toUpperCase()
    const match = options.find((option) => option.text === item || option.id === item)
    return match?.id.toUpperCase() ?? item
  })
  if (questionType === "select_all") return JSON.stringify(letters)
  return letters[0] ?? ""
}

function timeLimitFor(questionType: string): number {
  if (questionType === "true_false") return 30
  if (questionType === "code_write") return 420
  if (questionType === "select_all") return 40
  return 40
}

function pointsFor(questionType: string): number {
  if (questionType === "select_all") return 2
  if (questionType === "code_write") return 5
  return 1
}

async function main() {
  const { sql } = await import("@/lib/db")

  const existing = (await sql`
    SELECT id, course_id FROM quizzes
    WHERE deleted_at IS NULL AND title = ${TITLE}
  `) as { id: number; course_id: number }[]
  if (existing.length > 0) {
    throw new Error(
      `${TITLE} already exists (${existing.map((row) => `#${row.id} course ${row.course_id}`).join(", ")}).`,
    )
  }

  const bank = (await sql`
    SELECT id, question_text, question_type, difficulty, topic, options, correct_answer, hint, explanation
    FROM question_bank
    WHERE deleted_at IS NULL
      AND course_id = 6
      AND topic ILIKE 'Selection Criteria%'
      AND question_type IN ('mcq', 'true_false', 'select_all')
      AND COALESCE(question_text, '') <> ''
    ORDER BY id
  `) as BankRow[]

  const random = mulberry32(SEED)
  const picked: BankRow[] = []
  for (const [type, count] of [
    ["mcq", 8],
    ["true_false", 6],
    ["select_all", 6],
  ] as const) {
    const pool = shuffle(
      bank.filter((row) => row.question_type === type),
      random,
    )
    const chosen: BankRow[] = []
    for (const row of pool) {
      const options = parseOptions(row.options)
      if (options.length < 2 || options.length > 5) continue
      const answer = correctAnswerForQuiz(row.question_type, options, row.correct_answer)
      if (!answer || answer === "undefined") continue
      chosen.push(row)
      if (chosen.length === count) break
    }
    if (chosen.length < count) {
      throw new Error(`Only found ${chosen.length} ${type} selection questions; needed ${count}.`)
    }
    picked.push(...chosen)
  }

  console.log("Section I")
  picked.forEach((row, index) => {
    console.log(`${index + 1}. [${row.question_type}] #${row.id} ${row.question_text.replace(/\s+/g, " ").slice(0, 90)}`)
  })
  console.log("Section II")
  CODE_PROBLEMS.forEach((problem, index) => console.log(`${21 + index}. ${problem.title}`))

  if (DRY_RUN) {
    console.log("Dry run — no homework created.")
    return
  }

  const sessions = (await sql`
    SELECT id, code, course_id
    FROM sessions
    WHERE academic_term_id = 70
      AND TRIM(code) IN ('ELEG1301P01', 'ELEG1301P02', 'ELEG1304P03')
    ORDER BY code
  `) as { id: number; code: string; course_id: number }[]
  if (sessions.length !== 3) {
    throw new Error(`Expected 3 Fall 2026 ELEG sections, found ${sessions.length}.`)
  }

  const codeBankIds: number[] = []
  for (const problem of CODE_PROBLEMS) {
    const inserted = (await sql`
      INSERT INTO question_bank (
        question_text, question_type, difficulty, topic, options, correct_answer,
        evaluation_mode, sample_answer, explanation, created_by, max_points,
        course_id, expected_answer, anti_cheat_exempt, created_at, updated_at
      ) VALUES (
        ${problem.questionText},
        'code_write',
        ${problem.difficulty},
        ${TOPIC},
        ${JSON.stringify([])}::jsonb,
        ${JSON.stringify("")}::jsonb,
        'auto',
        ${problem.sampleAnswer},
        ${`Classroom points problem: ${problem.title}`},
        1,
        5,
        6,
        ${problem.sampleAnswer},
        true,
        NOW(),
        NOW()
      )
      RETURNING id
    `) as { id: number }[]
    codeBankIds.push(Number(inserted[0]?.id))
  }

  const targets = [
    {
      courseId: 5,
      description:
        "Section I (40%): C++ selection criteria — if, else-if, and switch (20 questions). Section II (60%): six C++ if-else programs from classroom points. Sessions: ELEG1301P01, ELEG1301P02.",
      sessionCodes: ["ELEG1301P01", "ELEG1301P02"],
    },
    {
      courseId: 6,
      description:
        "Section I (40%): C++ selection criteria — if, else-if, and switch (20 questions). Section II (60%): six C++ if-else programs from classroom points. Sessions: ELEG1304P03.",
      sessionCodes: ["ELEG1304P03"],
    },
  ]

  for (const target of targets) {
    const quizRows = (await sql`
      INSERT INTO quizzes (
        title, description, created_by, course_id, is_public, time_per_question,
        available_from, available_until, retake_enabled, retake_limit, retake_policy,
        assessment_type, max_tab_switches, max_gemini_strikes, geo_radius_meters,
        rollover_hours, ai_evaluation_mode, forfeit_retake_on_report_view,
        section_config, keystroke_playback_enforced, code_language,
        counts_toward_course_grade, ai_model, coverage, created_at, updated_at
      ) VALUES (
        ${TITLE},
        ${target.description},
        1,
        ${target.courseId},
        true,
        60,
        ${AVAILABLE_FROM},
        ${AVAILABLE_UNTIL},
        false,
        0,
        'best',
        'homework',
        5,
        5,
        100,
        1,
        'relaxed',
        true,
        ${JSON.stringify(SECTION_CONFIG)}::jsonb,
        true,
        'cpp',
        true,
        'auto',
        'Selection criteria (if, else-if, switch)',
        NOW(),
        NOW()
      )
      RETURNING id
    `) as { id: number }[]
    const quizId = Number(quizRows[0]?.id)
    console.log(`Created quiz ${quizId} for course ${target.courseId}`)

    for (let i = 0; i < picked.length; i++) {
      const row = picked[i]!
      const options = parseOptions(row.options)
      const byId = new Map(options.map((option) => [option.id.toUpperCase(), option.text]))
      const answer = correctAnswerForQuiz(row.question_type, options, row.correct_answer)
      const inserted = (await sql`
        INSERT INTO quiz_questions (
          quiz_id, question_text, question_type, option_a, option_b, option_c, option_d, option_e,
          correct_answer, question_order, time_limit, bank_question_id, hint, points, max_points,
          explanation, topic, difficulty, evaluation_mode, anti_cheat_exempt, grading_type,
          ai_code_language, created_at
        ) VALUES (
          ${quizId},
          ${row.question_text},
          ${row.question_type},
          ${byId.get("A") ?? null},
          ${byId.get("B") ?? null},
          ${byId.get("C") ?? null},
          ${byId.get("D") ?? null},
          ${byId.get("E") ?? null},
          ${answer},
          ${i + 1},
          ${timeLimitFor(row.question_type)},
          ${row.id},
          ${row.hint},
          ${pointsFor(row.question_type)},
          ${pointsFor(row.question_type)},
          ${row.explanation},
          ${TOPIC},
          ${row.difficulty ?? "medium"},
          'auto',
          false,
          'auto',
          'cpp',
          NOW()
        )
        RETURNING id
      `) as { id: number }[]
      const questionId = Number(inserted[0]?.id)
      await sql`
        INSERT INTO question_bank_usage (quiz_id, bank_question_id, question_id, used_at)
        VALUES (${quizId}, ${row.id}, ${questionId}, NOW())
      `
    }

    for (let i = 0; i < CODE_PROBLEMS.length; i++) {
      const problem = CODE_PROBLEMS[i]!
      const bankId = codeBankIds[i]!
      const inserted = (await sql`
        INSERT INTO quiz_questions (
          quiz_id, question_text, question_type, correct_answer, question_order, time_limit,
          bank_question_id, points, max_points, explanation, topic, difficulty, evaluation_mode,
          sample_answer, anti_cheat_exempt, grading_type, ai_code_language, expected_answer, created_at
        ) VALUES (
          ${quizId},
          ${problem.questionText},
          'code_write',
          ${""},
          ${21 + i},
          420,
          ${bankId},
          5,
          5,
          ${`Classroom points problem: ${problem.title}`},
          ${TOPIC},
          ${problem.difficulty},
          'auto',
          ${problem.sampleAnswer},
          true,
          'auto',
          'cpp',
          ${problem.sampleAnswer},
          NOW()
        )
        RETURNING id
      `) as { id: number }[]
      const questionId = Number(inserted[0]?.id)
      await sql`
        INSERT INTO question_bank_usage (quiz_id, bank_question_id, question_id, used_at)
        VALUES (${quizId}, ${bankId}, ${questionId}, NOW())
      `
    }

    for (const session of sessions.filter((row) => target.sessionCodes.includes(row.code))) {
      await sql`
        INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
        VALUES (${quizId}, ${session.id}, true, CURRENT_TIMESTAMP)
        ON CONFLICT (quiz_id, session_id) DO NOTHING
      `
      console.log(`  session ${session.code} (#${session.id})`)
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
