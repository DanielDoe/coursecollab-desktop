/**
 * While-loop live classroom questions for every Fall 2026 ELEG section.
 * Slide examples plus the extra practice problems. Submittable on the live site
 * through a long open window. Does not start a broadcast.
 *
 *   npx tsx scripts/add-fall-2026-while-loop-classroom-questions.ts
 *   DRY_RUN=1 npx tsx scripts/add-fall-2026-while-loop-classroom-questions.ts
 */
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { sql } from "@/lib/db"
import { CLASSROOM_SUBMISSION_KIND_CODE } from "@/lib/classroom-solution-submission"
import { structureClassroomPrompt } from "@/lib/classroom-question-layout"
import { syntaxCardsForClassroomPrompt } from "@/lib/classroom-syntax-reference"
import {
  FALL_2026_ELEG_SESSION_CODES,
  getFall2026ElegTermId,
} from "@/lib/eleg-fall-2026-student-scope"

const DRY_RUN = /^(1|true|yes)$/i.test(String(process.env.DRY_RUN ?? ""))
/** About 120 days. Production treats a null due date and null duration as closed. */
const OPEN_HOURS = 2880

const QUESTIONS: { title: string; description: string }[] = [
  {
    title: "While Loop — Countdown Timer",
    description: `### Scenario

A timer counts down from 10 to 0 for a rocket launch.

### Task

Write a C++ program. Use a while loop. Start time at 10 and keep going while time is greater than or equal to 0.

- Each pass displays \`T-minus\` followed by the current time and \`seconds\`.
- Decrease time by 1 after each line.
- After the loop, display \`Liftoff!\`.

### Expected output

\`\`\`text
T-minus 10 seconds
T-minus 9 seconds
T-minus 8 seconds
T-minus 7 seconds
T-minus 6 seconds
T-minus 5 seconds
T-minus 4 seconds
T-minus 3 seconds
T-minus 2 seconds
T-minus 1 seconds
T-minus 0 seconds
Liftoff!
\`\`\``,
  },
  {
    title: "While Loop — Password Attempt",
    description: `### Scenario

The user must enter the correct password within three attempts. The correct password is \`correctpass\`.

### Task

Write a C++ program. Use a while loop while attempts are greater than 0 and the password is not equal to \`correctpass\`.

- Start attempts at 3.
- Each pass asks \`Enter password:\` and reads the password.
- Decrease attempts by 1 after each try.
- If the password is equal to \`correctpass\`, display \`Access granted\`.
- Otherwise display \`Access denied\`.

### Sample input

\`\`\`text
nope
wrong
correctpass
\`\`\`

### Expected output

\`\`\`text
Enter password: Access granted
\`\`\``,
  },
  {
    title: "While Loop — Monitoring Battery Life",
    description: `### Scenario

A device monitors battery life and stops working if the battery level falls below 20%.

### Task

Write a C++ program. Use a while loop. Start the battery at 100 and keep going while the battery is greater than 20.

- Each pass displays \`Battery level:\` followed by the current percent.
- Decrease the battery by 10 after each line.
- After the loop, display \`Battery too low, shutting down!\`.

### Expected output

\`\`\`text
Battery level: 100%
Battery level: 90%
Battery level: 80%
Battery level: 70%
Battery level: 60%
Battery level: 50%
Battery level: 40%
Battery level: 30%
Battery too low, shutting down!
\`\`\``,
  },
  {
    title: "While Loop — Shopping Cart",
    description: `### Scenario

A user can keep adding items to a cart until they type \`checkout\`.

### Task

Write a C++ program. Use a while loop while the item is not equal to \`checkout\`.

- Each pass displays \`Add item to cart (type 'checkout' to finish):\` and reads the item.
- After the loop, display \`Proceeding to checkout.\`.

### Sample input

\`\`\`text
milk
bread
checkout
\`\`\`

### Expected output

\`\`\`text
Add item to cart (type 'checkout' to finish):
Add item to cart (type 'checkout' to finish):
Add item to cart (type 'checkout' to finish):
Proceeding to checkout.
\`\`\``,
  },
  {
    title: "While Loop — Entering Scores",
    description: `### Scenario

Students input test scores, and the program calculates the average once they are done. The user enters \`-1\` to finish.

### Task

Write a C++ program. Use a while loop while the score is not equal to \`-1\`.

- Start total and count at 0.
- Each pass asks \`Enter test score (-1 to finish):\` and reads the score.
- If the score is not equal to \`-1\`, add it to the total and increase the count.
- After the loop, display \`Average score:\` followed by total divided by count.

### Sample input

\`\`\`text
80
90
-1
\`\`\`

### Expected output

\`\`\`text
Enter test score (-1 to finish):
Enter test score (-1 to finish):
Enter test score (-1 to finish):
Average score: 85
\`\`\``,
  },
  {
    title: "While Loop — ATM PIN Attempts",
    description: `### Scenario

An ATM keeps asking for a PIN until the user enters the correct one. The correct PIN is \`1234\`.

### Task

Write a C++ program. Use a while loop while the PIN is not equal to \`1234\`.

- Ask \`Enter PIN:\` the first time.
- If the PIN is incorrect, display \`Incorrect PIN. Try again:\` and read another PIN.
- When the PIN is equal to \`1234\`, display \`Access Granted!\`.

### Sample input

\`\`\`text
1111
2222
1234
\`\`\`

### Expected output

\`\`\`text
Enter PIN: 1111
Incorrect PIN. Try again: 2222
Incorrect PIN. Try again: 1234
Access Granted!
\`\`\``,
  },
  {
    title: "While Loop — Filling a Water Tank",
    description: `### Scenario

A water tank starts empty and is filled with 10 liters of water at a time until it reaches 50 liters.

### Task

Write a C++ program. Use a while loop. Start the water level at 0 and keep going while the level is less than 50.

- Add 10 liters on each pass.
- Display \`Water level:\` followed by the current liters after each fill.
- After the loop, display \`Tank is full!\`.

### Expected output

\`\`\`text
Water level: 10 liters
Water level: 20 liters
Water level: 30 liters
Water level: 40 liters
Water level: 50 liters
Tank is full!
\`\`\``,
  },
  {
    title: "While Loop — Savings Goal Tracker",
    description: `### Scenario

A student wants to save $500 for a laptop. Each deposit is added to the total until the savings are at least $500.

### Task

Write a C++ program. Use a while loop while the total savings are less than 500.

- Each pass asks \`Enter amount saved:\` and reads the deposit.
- Add the deposit to the total.
- Display \`Total savings:\` followed by the new total.
- When the total is at least 500, display \`Congratulations! You reached your savings goal.\`.

### Sample input

\`\`\`text
200
150
150
\`\`\`

### Expected output

\`\`\`text
Enter amount saved: 200
Total savings: $200

Enter amount saved: 150
Total savings: $350

Enter amount saved: 150
Total savings: $500

Congratulations! You reached your savings goal.
\`\`\``,
  },
  {
    title: "While Loop — Rocket Launch Countdown",
    description: `### Scenario

A rocket counts down from 10 to 1, then launches.

### Task

Write a C++ program. Use a while loop. Start at 10 and keep going while the count is greater than 0.

- Display the current number on its own line.
- Decrease the count by 1 after each line.
- After the loop, display \`LIFTOFF!\`.

### Expected output

\`\`\`text
10
9
8
7
6
5
4
3
2
1
LIFTOFF!
\`\`\``,
  },
  {
    title: "While Loop — Battery Charging Monitor",
    description: `### Scenario

A device starts with a battery level of 20%. Each charging cycle increases the battery by 10% until it reaches 100%.

### Task

Write a C++ program. Use a while loop. Start the battery at 20 and keep going while the battery is less than or equal to 100.

- Display \`Battery:\` followed by the current percent.
- If the battery is less than 100, increase it by 10.
- When the battery is equal to 100, display \`Fully Charged!\` and stop.

### Expected output

\`\`\`text
Battery: 20%
Battery: 30%
Battery: 40%
Battery: 50%
Battery: 60%
Battery: 70%
Battery: 80%
Battery: 90%
Battery: 100%
Fully Charged!
\`\`\``,
  },
]

type SectionRow = {
  session_id: number
  session_code: string
  course_id: number
  instructor_id: number
}

function assertQuestionShape(question: { title: string; description: string }) {
  const cards = syntaxCardsForClassroomPrompt(question.title, question.description).map((card) => card.id)
  if (!cards.includes("while")) {
    throw new Error(`${question.title} is missing the while-loop syntax reference.`)
  }
  if (!cards.includes("variables") || !cards.includes("input-output")) {
    throw new Error(`${question.title} is missing the variable or input/output syntax reference.`)
  }
  const blocks = structureClassroomPrompt(question.description)
  if (blocks.length < 2) {
    throw new Error(`${question.title} is still one block of text.`)
  }
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
          duration_hours = ${OPEN_HOURS},
          hidden_from_students = false
        WHERE id = ${id}
      `
    }
    return { id, created: false }
  }

  if (DRY_RUN) return { id: -1, created: true }

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
      ${OPEN_HOURS},
      NULL,
      ${CLASSROOM_SUBMISSION_KIND_CODE},
      false
    )
    RETURNING id
  `) as { id: number }[]
  return { id: Number(inserted[0]!.id), created: true }
}

async function main() {
  for (const question of QUESTIONS) assertQuestionShape(question)

  const sections = await loadFallSections()
  if (sections.length !== FALL_2026_ELEG_SESSION_CODES.length) {
    throw new Error(`Expected ${FALL_2026_ELEG_SESSION_CODES.length} Fall 2026 sections, found ${sections.length}.`)
  }

  let created = 0
  let updated = 0
  console.log(`${DRY_RUN ? "[dry-run] " : ""}${QUESTIONS.length} questions × ${sections.length} sections`)
  for (const section of sections) {
    for (const question of QUESTIONS) {
      const result = await upsertAssignment(section, question)
      if (result.created) created += 1
      else updated += 1
      const cards = syntaxCardsForClassroomPrompt(question.title, question.description)
        .map((card) => card.id)
        .join(", ")
      console.log(
        `${DRY_RUN ? "[dry-run] " : ""}${result.created ? "created" : "updated"} ${section.session_code} #${result.id} · ${question.title} · ${cards}`,
      )
    }
  }
  console.log(`created ${created}, updated ${updated}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
