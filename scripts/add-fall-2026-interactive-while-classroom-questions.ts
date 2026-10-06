/**
 * Five interactive while-loop classroom questions for Fall 2026 ELEG sections,
 * plus locked worked solutions for the while-loop set. Does not start a broadcast
 * and does not reset created_at.
 *
 *   npx tsx scripts/add-fall-2026-interactive-while-classroom-questions.ts
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

const OPEN_HOURS = 2880

const NEW_QUESTIONS: { title: string; description: string }[] = [
  {
    title: "Password Login System",
    description: `### Scenario

A program asks for a password and keeps asking until the password is correct. The correct password is \`2026\`.

### Task

Write a C++ program. Use a while loop.

- Ask \`Enter password:\` and read the password.
- While the password is not \`2026\`, display \`Incorrect password. Try again.\` and ask again.
- When the password is \`2026\`, display \`Login Successful!\`.

### Sample input

\`\`\`text
1234
5555
2026
\`\`\`

### Expected output

\`\`\`text
Enter password: 1234
Incorrect password. Try again.

Enter password: 5555
Incorrect password. Try again.

Enter password: 2026
Login Successful!
\`\`\``,
  },
  {
    title: "Student Score Entry",
    description: `### Scenario

Scores are entered one at a time. The user enters \`-1\` when there are no more scores. The program reports the total, not the average.

### Task

Write a C++ program. Use a while loop.

- Ask \`Enter score (-1 to stop):\` and read a score.
- While the score is not \`-1\`, add it to a running total and ask for another score.
- When \`-1\` is entered, stop and display \`Total of Scores:\` followed by the total.

### Sample input

\`\`\`text
85
90
78
-1
\`\`\`

### Expected output

\`\`\`text
Enter score (-1 to stop): 85
Enter score (-1 to stop): 90
Enter score (-1 to stop): 78
Enter score (-1 to stop): -1

Total of Scores: 253
\`\`\``,
  },
  {
    title: "Store Shopping Cart",
    description: `### Scenario

A customer adds item prices to a cart. They enter \`0\` when they are ready to check out.

### Task

Write a C++ program. Use a while loop.

- Ask \`Enter item price ($0 to checkout):\` and read a price.
- While the price is not \`0\`, add it to the running total and display \`Current Total:\` with the new total.
- When \`0\` is entered, stop and display \`Final Purchase Total:\` followed by the total.

### Sample input

\`\`\`text
25.50
14.25
10.00
0
\`\`\`

### Expected output

\`\`\`text
Enter item price ($0 to checkout): 25.50
Current Total: $25.50

Enter item price ($0 to checkout): 14.25
Current Total: $39.75

Enter item price ($0 to checkout): 10.00
Current Total: $49.75

Enter item price ($0 to checkout): 0

Final Purchase Total: $49.75
\`\`\``,
  },
  {
    title: "Daily Step Goal Tracker",
    description: `### Scenario

A person wants to walk at least 10,000 steps in a day. Each walking session is entered until the total reaches that goal.

### Task

Write a C++ program. Use a while loop while the total is less than 10000.

- Ask \`Enter steps completed:\` and read the steps for that session.
- Add the steps to the total and display \`Total Steps:\`.
- When the total is at least 10,000, display \`Daily Step Goal Reached!\` and the final total.

### Sample input

\`\`\`text
2500
3200
2800
1800
\`\`\`

### Expected output

\`\`\`text
Enter steps completed: 2500
Total Steps: 2500

Enter steps completed: 3200
Total Steps: 5700

Enter steps completed: 2800
Total Steps: 8500

Enter steps completed: 1800
Total Steps: 10300

Daily Step Goal Reached!
Total Steps: 10300
\`\`\``,
  },
  {
    title: "Bank Account Deposit Goal",
    description: `### Scenario

A bank account starts with $250. The user wants the balance to reach at least $1,000.

### Task

Write a C++ program. Use a while loop while the balance is less than 1000.

- Display \`Starting Balance: $250.00\`.
- Ask \`Enter deposit amount:\` and add each deposit to the balance.
- Display \`Current Balance:\` after each deposit.
- When the balance is at least $1,000, display \`Savings Target Reached!\`.

### Sample input

\`\`\`text
300
250
200
\`\`\`

### Expected output

\`\`\`text
Starting Balance: $250.00

Enter deposit amount: 300
Current Balance: $550.00

Enter deposit amount: 250
Current Balance: $800.00

Enter deposit amount: 200
Current Balance: $1000.00

Savings Target Reached!
\`\`\``,
  },
]

const SOLUTIONS: Record<string, string> = {
  "While Loop — Countdown Timer": `#include <iostream>
using namespace std;

int main() {
    int time = 10;
    while (time >= 0) {
        cout << "T-minus " << time << " seconds" << endl;
        time = time - 1;
    }
    cout << "Liftoff!" << endl;
    return 0;
}`,
  "While Loop — Password Attempt": `#include <iostream>
#include <string>
using namespace std;

int main() {
    int attempts = 3;
    string password = "";
    while (attempts > 0 && password != "correctpass") {
        cout << "Enter password: ";
        cin >> password;
        attempts = attempts - 1;
    }
    if (password == "correctpass") {
        cout << "Access granted" << endl;
    } else {
        cout << "Access denied" << endl;
    }
    return 0;
}`,
  "While Loop — Monitoring Battery Life": `#include <iostream>
using namespace std;

int main() {
    int battery = 100;
    while (battery > 20) {
        cout << "Battery level: " << battery << "%" << endl;
        battery = battery - 10;
    }
    cout << "Battery too low, shutting down!" << endl;
    return 0;
}`,
  "While Loop — Shopping Cart": `#include <iostream>
#include <string>
using namespace std;

int main() {
    string item = "";
    while (item != "checkout") {
        cout << "Add item to cart (type 'checkout' to finish): ";
        cin >> item;
    }
    cout << "Proceeding to checkout." << endl;
    return 0;
}`,
  "While Loop — Entering Scores": `#include <iostream>
using namespace std;

int main() {
    int score = 0;
    int total = 0;
    int count = 0;
    while (score != -1) {
        cout << "Enter test score (-1 to finish): ";
        cin >> score;
        if (score != -1) {
            total = total + score;
            count = count + 1;
        }
    }
    cout << "Average score: " << total / count << endl;
    return 0;
}`,
  "While Loop — ATM PIN Attempts": `#include <iostream>
#include <string>
using namespace std;

int main() {
    string pin = "";
    cout << "Enter PIN: ";
    cin >> pin;
    while (pin != "1234") {
        cout << "Incorrect PIN. Try again: ";
        cin >> pin;
    }
    cout << "Access Granted!" << endl;
    return 0;
}`,
  "While Loop — Filling a Water Tank": `#include <iostream>
using namespace std;

int main() {
    int water = 0;
    while (water < 50) {
        water = water + 10;
        cout << "Water level: " << water << " liters" << endl;
    }
    cout << "Tank is full!" << endl;
    return 0;
}`,
  "While Loop — Savings Goal Tracker": `#include <iostream>
using namespace std;

int main() {
    int total = 0;
    while (total < 500) {
        int deposit = 0;
        cout << "Enter amount saved: ";
        cin >> deposit;
        total = total + deposit;
        cout << "Total savings: $" << total << endl << endl;
    }
    cout << "Congratulations! You reached your savings goal." << endl;
    return 0;
}`,
  "While Loop — Rocket Launch Countdown": `#include <iostream>
using namespace std;

int main() {
    int count = 10;
    while (count > 0) {
        cout << count << endl;
        count = count - 1;
    }
    cout << "LIFTOFF!" << endl;
    return 0;
}`,
  "While Loop — Battery Charging Monitor": `#include <iostream>
using namespace std;

int main() {
    int battery = 20;
    while (battery <= 100) {
        cout << "Battery: " << battery << "%" << endl;
        if (battery == 100) {
            cout << "Fully Charged!" << endl;
            break;
        }
        battery = battery + 10;
    }
    return 0;
}`,
  "Password Login System": `#include <iostream>
#include <string>
using namespace std;

int main() {
    string password;
    cout << "Enter password: ";
    cin >> password;
    while (password != "2026") {
        cout << "Incorrect password. Try again." << endl << endl;
        cout << "Enter password: ";
        cin >> password;
    }
    cout << "Login Successful!" << endl;
    return 0;
}`,
  "Student Score Entry": `#include <iostream>
using namespace std;

int main() {
    int score = 0;
    int total = 0;
    cout << "Enter score (-1 to stop): ";
    cin >> score;
    while (score != -1) {
        total = total + score;
        cout << "Enter score (-1 to stop): ";
        cin >> score;
    }
    cout << endl;
    cout << "Total of Scores: " << total << endl;
    return 0;
}`,
  "Store Shopping Cart": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double price = 0;
    double total = 0;
    cout << fixed << setprecision(2);
    cout << "Enter item price ($0 to checkout): ";
    cin >> price;
    while (price != 0) {
        total = total + price;
        cout << "Current Total: $" << total << endl << endl;
        cout << "Enter item price ($0 to checkout): ";
        cin >> price;
    }
    cout << endl;
    cout << "Final Purchase Total: $" << total << endl;
    return 0;
}`,
  "Daily Step Goal Tracker": `#include <iostream>
using namespace std;

int main() {
    int total = 0;
    while (total < 10000) {
        int steps = 0;
        cout << "Enter steps completed: ";
        cin >> steps;
        total = total + steps;
        cout << "Total Steps: " << total << endl << endl;
    }
    cout << "Daily Step Goal Reached!" << endl;
    cout << "Total Steps: " << total << endl;
    return 0;
}`,
  "Bank Account Deposit Goal": `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double balance = 250;
    cout << fixed << setprecision(2);
    cout << "Starting Balance: $" << balance << endl << endl;
    while (balance < 1000) {
        double deposit = 0;
        cout << "Enter deposit amount: ";
        cin >> deposit;
        balance = balance + deposit;
        cout << "Current Balance: $" << balance << endl << endl;
    }
    cout << "Savings Target Reached!" << endl;
    return 0;
}`,
}

type SectionRow = {
  session_id: number
  session_code: string
  course_id: number
  instructor_id: number
}

function assertQuestionShape(question: { title: string; description: string }) {
  const cards = syntaxCardsForClassroomPrompt(question.title, question.description)
  if (!cards.some((card) => card.id === "while")) {
    throw new Error(`${question.title} is missing the while-loop syntax card.`)
  }
  if (structureClassroomPrompt(question.description).length < 2) {
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
    ORDER BY id ASC
    LIMIT 1
  `) as { id: number }[]

  if (existing.length > 0) {
    const id = Number(existing[0]!.id)
    await sql`
      UPDATE classroom_point_submissions
      SET
        description = ${question.description},
        due_at = NULL,
        duration_hours = ${OPEN_HOURS},
        hidden_from_students = false
      WHERE id = ${id}
    `
    return { id, created: false }
  }

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

function mergeSolution(existing: unknown, code: string): Record<string, unknown> {
  const record =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {}
  record.reference_answer = code
  if (record.solution_unlocked !== true) record.solution_unlocked = false
  return record
}

async function attachSolutions() {
  const titles = Object.keys(SOLUTIONS)
  const rows = (await sql`
    SELECT id, title, question_config, solution_unlocked_flag.unlocked
    FROM classroom_point_submissions cps
    LEFT JOIN LATERAL (
      SELECT (cps.question_config ->> 'solution_unlocked') = 'true' AS unlocked
    ) solution_unlocked_flag ON true
    WHERE TRIM(cps.session) = ANY(${FALL_2026_ELEG_SESSION_CODES})
      AND cps.title = ANY(${titles})
    ORDER BY cps.id ASC
  `) as { id: number; title: string; question_config: unknown; unlocked: boolean }[]

  let attached = 0
  for (const row of rows) {
    const code = SOLUTIONS[row.title]
    if (!code) continue
    const next = mergeSolution(row.question_config, code)
    if (row.unlocked === true) next.solution_unlocked = true
    const payload = JSON.stringify(next)
    await sql`
      UPDATE classroom_point_submissions
      SET question_config = ${payload}::jsonb
      WHERE id = ${row.id}
    `
    attached += 1
  }
  console.log(`attached locked solutions on ${attached} assignments`)
}

async function removeExactDuplicates() {
  const rows = (await sql`
    SELECT id, TRIM(session) AS session, title
    FROM classroom_point_submissions
    WHERE TRIM(session) = ANY(${FALL_2026_ELEG_SESSION_CODES})
    ORDER BY id ASC
  `) as { id: number; session: string; title: string }[]

  const groups = new Map<string, number[]>()
  for (const row of rows) {
    const key = `${row.session}::${row.title}`
    const list = groups.get(key) ?? []
    list.push(Number(row.id))
    groups.set(key, list)
  }

  let removed = 0
  for (const [key, ids] of groups) {
    if (ids.length < 2) continue
    const pointRows = (await sql`
      SELECT submission_id, COUNT(*)::int AS n
      FROM classroom_points
      WHERE submission_id = ANY(${ids})
      GROUP BY submission_id
    `) as { submission_id: number; n: number }[]
    const points = new Map(pointRows.map((row) => [Number(row.submission_id), Number(row.n)]))
    const keeper =
      [...ids].sort((a, b) => (points.get(b) ?? 0) - (points.get(a) ?? 0) || a - b)[0] ?? ids[0]!
    for (const id of ids) {
      if (id === keeper) continue
      if ((points.get(id) ?? 0) > 0) {
        console.log(`kept duplicate ${key} #${id} because students already have points`)
        continue
      }
      try {
        await sql`DELETE FROM codebench_live_sessions WHERE assignment_id = ${id}`
        await sql`DELETE FROM classroom_point_submissions WHERE id = ${id}`
        removed += 1
        console.log(`removed duplicate ${key} #${id}, kept #${keeper}`)
      } catch (error) {
        await sql`
          UPDATE classroom_point_submissions
          SET hidden_from_students = true
          WHERE id = ${id}
        `
        console.log(
          `hid duplicate ${key} #${id} (${error instanceof Error ? error.message : "delete blocked"})`,
        )
      }
    }
  }
  console.log(`removed ${removed} exact duplicate assignments`)
}

async function main() {
  for (const question of NEW_QUESTIONS) assertQuestionShape(question)
  const sections = await loadFallSections()
  if (sections.length !== FALL_2026_ELEG_SESSION_CODES.length) {
    throw new Error(`Expected ${FALL_2026_ELEG_SESSION_CODES.length} Fall 2026 sections, found ${sections.length}.`)
  }

  await sql`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS question_config JSONB`

  const existing = (await sql`
    SELECT id, TRIM(session) AS session, title
    FROM classroom_point_submissions
    WHERE TRIM(session) = ANY(${FALL_2026_ELEG_SESSION_CODES})
      AND (
        title = ANY(${NEW_QUESTIONS.map((question) => question.title)})
        OR title ILIKE '%Password%'
        OR title ILIKE '%Score%'
        OR title ILIKE '%Cart%'
        OR title ILIKE '%Step%'
        OR title ILIKE '%Deposit%'
        OR title ILIKE '%Savings%'
      )
    ORDER BY session, title, id
  `) as { id: number; session: string; title: string }[]
  console.log("related classroom titles already stored:")
  for (const row of existing) console.log(`  ${row.session} #${row.id} ${row.title}`)

  let created = 0
  let updated = 0
  for (const section of sections) {
    for (const question of NEW_QUESTIONS) {
      const result = await upsertAssignment(section, question)
      if (result.created) created += 1
      else updated += 1
      console.log(`${result.created ? "created" : "updated"} ${section.session_code} #${result.id} · ${question.title}`)
    }
  }
  console.log(`new questions created ${created}, updated ${updated}`)

  await removeExactDuplicates()
  await attachSolutions()

  const open = (await sql`
    SELECT COUNT(*)::int AS n
    FROM codebench_live_sessions
    WHERE ended_at IS NULL
  `) as { n: number }[]
  console.log(`live sessions still open: ${open[0]?.n ?? 0}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
