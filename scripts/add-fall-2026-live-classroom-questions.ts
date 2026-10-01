/**
 * Live classroom questions for every Fall 2026 ELEG section.
 * Nested if, switch, and ternary. No due date. Timing booster starts at post time.
 *
 *   npx tsx scripts/add-fall-2026-live-classroom-questions.ts
 *   DRY_RUN=1 npx tsx scripts/add-fall-2026-live-classroom-questions.ts
 */
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { sql } from "@/lib/db"
import { startLiveClassroomSession } from "@/lib/codebench-live-classroom"
import { ensureCodebenchLiveSessionsSchema } from "@/lib/codebench-live-session-schema"
import { CLASSROOM_SUBMISSION_KIND_CODE } from "@/lib/classroom-solution-submission"
import {
  FALL_2026_ELEG_SESSION_CODES,
  getFall2026ElegTermId,
} from "@/lib/eleg-fall-2026-student-scope"

const DRY_RUN = /^(1|true|yes)$/i.test(String(process.env.DRY_RUN ?? ""))

const QUESTIONS: { title: string; description: string }[] = [
  {
    title: "Nested If — Loan Approval with Income and Credit Score",
    description: `### Scenario

A bank approves a loan only if:

1. The customer's income is at least $40,000.
2. If the income is sufficient, the credit score must be at least 650.

If the income is too low, the credit score should not even be checked.

### Task

Write a C++ program that reads the income and the credit score. Use a nested if statement.

- If income is below $40,000, display Denied.
- Only when the income is high enough, check the credit score.
- If the credit score is at least 650, display Approved. Otherwise display Denied.

### Sample input

\`\`\`text
45000
700
\`\`\`

### Expected output

\`\`\`text
Approved
\`\`\``,
  },
  {
    title: "Nested If — Exam Grade with Attendance Requirement",
    description: `### Scenario

A student passes a course only if:

1. The final exam score is 60 or higher.
2. If the exam score is sufficient, attendance must be at least 75%.

Failing either condition results in failure, but the reason matters.

### Task

Write a C++ program that reads the exam score and the attendance percent. Use a nested if statement.

- If the exam score is below 60, display Failed: exam score.
- Only when the exam score is high enough, check attendance.
- If attendance is below 75%, display Failed: attendance.
- If both conditions pass, display Passed.

### Sample input

\`\`\`text
72
80
\`\`\`

### Expected output

\`\`\`text
Passed
\`\`\``,
  },
  {
    title: "Nested If — Shipping Cost with Weight and Destination",
    description: `### Scenario

A shipping company calculates cost based on:

1. Whether the package is domestic or international.
2. If the package is international, the weight determines the cost tier.

### Rules

- Domestic shipping → $10 flat
- International, 10 lbs or less → $25
- International, above 10 lbs → $40

### Task

Write a C++ program that reads the destination (1 for domestic, 2 for international) and the weight in pounds. Use a nested if statement. Check the weight only when the shipment is international. Display the shipping cost.

### Sample input

\`\`\`text
2
12
\`\`\`

### Expected output

\`\`\`text
Shipping Cost: $40
\`\`\``,
  },
  {
    title: "Switch — Cafeteria Meal Price",
    description: `### Scenario

A university cafeteria charges different prices based on the meal type selected by a student.

### Meal codes

- 1 → Breakfast → $5.50
- 2 → Lunch → $8.75
- 3 → Dinner → $10.25

If the student enters any other number, the input is invalid.

### Task

Write a C++ program that reads the meal code and uses a switch statement. Display the meal name and price, or Invalid meal.

### Sample input

\`\`\`text
2
\`\`\`

### Expected output

\`\`\`text
Lunch: $8.75
\`\`\``,
  },
  {
    title: "Switch — Mobile Data Plans",
    description: `### Scenario

A mobile company offers three data plans. Each plan has a different monthly base cost.

### Plan codes

- B → Basic → $30
- S → Standard → $50
- P → Premium → $70

The user enters the plan code. Any other code is invalid.

### Task

Write a C++ program that reads the plan code and uses a switch statement. Display the plan name and monthly cost, or Invalid plan.

### Sample input

\`\`\`text
S
\`\`\`

### Expected output

\`\`\`text
Standard: $50
\`\`\``,
  },
  {
    title: "Switch — ATM Transaction Menu",
    description: `### Scenario

An ATM allows a user to choose a transaction.

### Options

- 1 → Check Balance
- 2 → Withdraw Money
- 3 → Deposit Money

The ATM prints a message based on the user's choice. Any other number is invalid.

### Task

Write a C++ program that reads the menu choice and uses a switch statement. Display the matching action, or Invalid transaction.

### Sample input

\`\`\`text
1
\`\`\`

### Expected output

\`\`\`text
Check Balance
\`\`\``,
  },
  {
    title: "Ternary — Passing Score",
    description: `### Scenario

A student passes if the score is 60 or higher.

### Task

Write a C++ program that reads one score and uses a ternary operator to choose Passed or Failed. Display that result.

### Sample input

\`\`\`text
60
\`\`\`

### Expected output

\`\`\`text
Passed
\`\`\``,
  },
  {
    title: "Ternary — Extra Data Charge",
    description: `### Scenario

A phone plan includes 10 GB of data. Extra data costs $10 per GB.

### Task

Write a C++ program that reads the number of gigabytes used. Use a ternary operator to decide the extra gigabytes: 0 when the student used 10 GB or less, otherwise the amount over 10. Display the extra charge in dollars.

### Sample input

\`\`\`text
14
\`\`\`

### Expected output

\`\`\`text
Extra Charge: $40
\`\`\``,
  },
]

type SectionRow = {
  session_id: number
  session_code: string
  course_id: number
  instructor_id: number
}

async function loadFallSections(): Promise<SectionRow[]> {
  const fallTermId = await getFall2026ElegTermId(sql)
  const rows = (await sql`
    SELECT
      sess.id AS session_id,
      TRIM(sess.code) AS session_code,
      sess.course_id,
      c.instructor_id,
      (
        SELECT COUNT(*)::int
        FROM students st
        WHERE st.session_id = sess.id
          AND st.deleted_at IS NULL
      ) AS student_count
    FROM sessions sess
    INNER JOIN courses c ON c.id = sess.course_id
    WHERE TRIM(sess.code) = ANY(${FALL_2026_ELEG_SESSION_CODES})
      AND sess.academic_term_id = ${fallTermId}
      AND c.instructor_id IS NOT NULL
    ORDER BY sess.code ASC, sess.id ASC
  `) as (SectionRow & { student_count: number })[]

  const byCode = new Map<string, SectionRow & { student_count: number }>()
  for (const row of rows) {
    const existing = byCode.get(row.session_code)
    if (!existing || row.student_count > existing.student_count) byCode.set(row.session_code, row)
  }
  return FALL_2026_ELEG_SESSION_CODES.map((code) => byCode.get(code)).filter(
    (row): row is SectionRow & { student_count: number } => Boolean(row),
  )
}

async function upsertAssignment(section: SectionRow, question: { title: string; description: string }) {
  const existing = (await sql`
    SELECT id
    FROM classroom_point_submissions
    WHERE TRIM(session) = ${section.session_code}
      AND title = ${question.title}
      AND LOWER(COALESCE(submission_kind, 'code')) = ${CLASSROOM_SUBMISSION_KIND_CODE}
    ORDER BY id DESC
    LIMIT 1
  `) as { id: number }[]

  if (existing.length > 0) {
    const id = Number(existing[0]!.id)
    if (!DRY_RUN) {
      await sql`
        UPDATE classroom_point_submissions
        SET
          description = ${question.description},
          due_at = NULL,
          duration_hours = NULL,
          hidden_from_students = false
        WHERE id = ${id}
      `
    }
    return id
  }

  if (DRY_RUN) return -1

  const inserted = (await sql`
    INSERT INTO classroom_point_submissions (
      title,
      description,
      session,
      created_by,
      created_at,
      duration_hours,
      due_at,
      submission_kind,
      hidden_from_students
    ) VALUES (
      ${question.title},
      ${question.description},
      ${section.session_code},
      ${section.instructor_id},
      NOW(),
      NULL,
      NULL,
      ${CLASSROOM_SUBMISSION_KIND_CODE},
      false
    )
    RETURNING id
  `) as { id: number }[]
  return Number(inserted[0]!.id)
}

async function main() {
  await ensureCodebenchLiveSessionsSchema()
  const sections = await loadFallSections()
  if (sections.length !== FALL_2026_ELEG_SESSION_CODES.length) {
    throw new Error(`Expected ${FALL_2026_ELEG_SESSION_CODES.length} Fall 2026 sections, found ${sections.length}.`)
  }

  console.log(`${DRY_RUN ? "[dry-run] " : ""}${QUESTIONS.length} questions × ${sections.length} sections`)
  for (const section of sections) {
    for (const question of QUESTIONS) {
      const assignmentId = await upsertAssignment(section, question)
      if (DRY_RUN) {
        console.log(`[dry-run] ${section.session_code} · ${question.title}`)
        continue
      }
      const session = await startLiveClassroomSession({
        assignmentId,
        courseId: section.course_id,
        instructorId: section.instructor_id,
      })
      console.log(`✓ ${section.session_code} · #${assignmentId} live #${session.sessionId} · ${question.title}`)
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
