/**
 * Five for-loop classroom questions for every Fall 2026 ELEG section.
 * Submittable on the live site. Does not start a broadcast and does not
 * reset created_at. Worked solutions stay locked.
 *
 *   npx tsx scripts/add-fall-2026-for-loop-classroom-questions.ts
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

const QUESTIONS: { title: string; description: string; solution: string }[] = [
  {
    title: "Weekly Temperature Tracker",
    description: `### Scenario

The temperature is recorded once a day for a week.

### Task

Write a C++ program. Use a for loop for the 7 days.

- Ask \`Enter temperature for Day 1:\` through \`Day 7:\` and read each temperature.
- Add each temperature to a total.
- After the loop, display \`Average Temperature:\` followed by the total divided by 7.

### Sample input

\`\`\`text
75
78
80
74
76
82
79
\`\`\`

### Expected output

\`\`\`text
Enter temperature for Day 1: 75
Enter temperature for Day 2: 78
Enter temperature for Day 3: 80
Enter temperature for Day 4: 74
Enter temperature for Day 5: 76
Enter temperature for Day 6: 82
Enter temperature for Day 7: 79

Average Temperature: 77.71
\`\`\``,
    solution: `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double temperature;
    double total = 0;
    for (int day = 1; day <= 7; day++) {
        cout << "Enter temperature for Day " << day << ": ";
        cin >> temperature;
        total = total + temperature;
    }
    cout << endl;
    cout << fixed << setprecision(2);
    cout << "Average Temperature: " << total / 7 << endl;
    return 0;
}`,
  },
  {
    title: "Student Quiz Score Tracker",
    description: `### Scenario

A class takes one quiz. The program reads a score for every student and then reports the class average.

### Task

Write a C++ program. Use a for loop.

- Ask \`Enter number of students:\` and read how many students are in the class.
- For each student, ask \`Enter score for Student 1:\` and read the score.
- After the loop, display \`Class Average:\` followed by the total divided by the number of students.

### Sample input

\`\`\`text
4
85
92
78
95
\`\`\`

### Expected output

\`\`\`text
Enter number of students: 4

Enter score for Student 1: 85
Enter score for Student 2: 92
Enter score for Student 3: 78
Enter score for Student 4: 95

Class Average: 87.50
\`\`\``,
    solution: `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    int students;
    cout << "Enter number of students: ";
    cin >> students;
    cout << endl;
    double total = 0;
    for (int student = 1; student <= students; student++) {
        double score;
        cout << "Enter score for Student " << student << ": ";
        cin >> score;
        total = total + score;
    }
    cout << endl;
    cout << fixed << setprecision(2);
    cout << "Class Average: " << total / students << endl;
    return 0;
}`,
  },
  {
    title: "Monthly Savings Tracker",
    description: `### Scenario

A student records how much money they save each month.

### Task

Write a C++ program. Use a for loop.

- Ask \`Enter number of months:\` and read the number of months.
- For each month, ask \`Enter savings for Month 1: $\` and read the amount saved.
- Add each amount to a running total.
- After the loop, display \`Total Savings:\` followed by the total.

### Sample input

\`\`\`text
4
100
150
125
200
\`\`\`

### Expected output

\`\`\`text
Enter number of months: 4

Enter savings for Month 1: $100
Enter savings for Month 2: $150
Enter savings for Month 3: $125
Enter savings for Month 4: $200

Total Savings: $575.00
\`\`\``,
    solution: `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    int months;
    cout << "Enter number of months: ";
    cin >> months;
    cout << endl;
    double total = 0;
    cout << fixed << setprecision(2);
    for (int month = 1; month <= months; month++) {
        double saved;
        cout << "Enter savings for Month " << month << ": $";
        cin >> saved;
        total = total + saved;
    }
    cout << endl;
    cout << "Total Savings: $" << total << endl;
    return 0;
}`,
  },
  {
    title: "Online Store Order Total",
    description: `### Scenario

A customer buys several items. The program adds the price of each item.

### Task

Write a C++ program. Use a for loop.

- Ask \`Enter number of items:\` and read how many items are being purchased.
- For each item, ask \`Enter price of Item 1: $\` and read the price.
- Add each price to a running total.
- After the loop, display \`Final Order Total:\` followed by the total.

### Sample input

\`\`\`text
5
12.50
8.75
20.00
5.25
10.00
\`\`\`

### Expected output

\`\`\`text
Enter number of items: 5

Enter price of Item 1: $12.50
Enter price of Item 2: $8.75
Enter price of Item 3: $20.00
Enter price of Item 4: $5.25
Enter price of Item 5: $10.00

Final Order Total: $56.50
\`\`\``,
    solution: `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    int items;
    cout << "Enter number of items: ";
    cin >> items;
    cout << endl;
    double total = 0;
    cout << fixed << setprecision(2);
    for (int item = 1; item <= items; item++) {
        double price;
        cout << "Enter price of Item " << item << ": $";
        cin >> price;
        total = total + price;
    }
    cout << endl;
    cout << "Final Order Total: $" << total << endl;
    return 0;
}`,
  },
  {
    title: "Vehicle Fuel Consumption Tracker",
    description: `### Scenario

An engineer records the fuel used on several trips and then reports the total and the average per trip.

### Task

Write a C++ program. Use a for loop.

- Ask \`Enter number of trips:\` and read the number of trips.
- For each trip, ask \`Enter fuel used for Trip 1 (gallons):\` and read the gallons used.
- After the loop, display \`Total Fuel Used:\` and \`Average Fuel Per Trip:\`.

### Sample input

\`\`\`text
4
3.5
4.2
3.8
4.5
\`\`\`

### Expected output

\`\`\`text
Enter number of trips: 4

Enter fuel used for Trip 1 (gallons): 3.5
Enter fuel used for Trip 2 (gallons): 4.2
Enter fuel used for Trip 3 (gallons): 3.8
Enter fuel used for Trip 4 (gallons): 4.5

Total Fuel Used: 16.00 gallons
Average Fuel Per Trip: 4.00 gallons
\`\`\``,
    solution: `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    int trips;
    cout << "Enter number of trips: ";
    cin >> trips;
    cout << endl;
    double total = 0;
    for (int trip = 1; trip <= trips; trip++) {
        double gallons;
        cout << "Enter fuel used for Trip " << trip << " (gallons): ";
        cin >> gallons;
        total = total + gallons;
    }
    cout << endl;
    cout << fixed << setprecision(2);
    cout << "Total Fuel Used: " << total << " gallons" << endl;
    cout << "Average Fuel Per Trip: " << total / trips << " gallons" << endl;
    return 0;
}`,
  },
]

type SectionRow = {
  session_code: string
  instructor_id: number
}

function assertQuestionShape(question: { title: string; description: string }) {
  const cards = syntaxCardsForClassroomPrompt(question.title, question.description).map((card) => card.id)
  if (!cards.includes("for")) {
    throw new Error(`${question.title} is missing the for-loop syntax reference.`)
  }
  if (cards.includes("nested-for")) {
    throw new Error(`${question.title} should not use a nested for loop.`)
  }
  if (!cards.includes("variables") || !cards.includes("input-output")) {
    throw new Error(`${question.title} is missing the variable or input/output syntax reference.`)
  }
  if (structureClassroomPrompt(question.description).length < 2) {
    throw new Error(`${question.title} is still one block of text.`)
  }
}

async function loadFallSections(): Promise<SectionRow[]> {
  const fallTermId = await getFall2026ElegTermId(sql)
  const rows = (await sql`
    SELECT
      TRIM(sess.code) AS session_code,
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
    ORDER BY sess.code ASC
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

async function main() {
  for (const question of QUESTIONS) assertQuestionShape(question)

  const sections = await loadFallSections()
  if (sections.length !== FALL_2026_ELEG_SESSION_CODES.length) {
    throw new Error(`Expected ${FALL_2026_ELEG_SESSION_CODES.length} Fall 2026 sections, found ${sections.length}.`)
  }

  await sql`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS question_config JSONB`

  const related = (await sql`
    SELECT id, TRIM(session) AS session, title
    FROM classroom_point_submissions
    WHERE TRIM(session) = ANY(${FALL_2026_ELEG_SESSION_CODES})
      AND (
        title = ANY(${QUESTIONS.map((question) => question.title)})
        OR title ILIKE '%Temperature%'
        OR title ILIKE '%Quiz Score%'
        OR title ILIKE '%Savings%'
        OR title ILIKE '%Order Total%'
        OR title ILIKE '%Fuel%'
      )
    ORDER BY title, session, id
  `) as { id: number; session: string; title: string }[]
  console.log("related classroom titles already stored:")
  for (const row of related) console.log(`  ${row.session} #${row.id} ${row.title}`)

  let created = 0
  let updated = 0
  for (const section of sections) {
    for (const question of QUESTIONS) {
      const existing = (await sql`
        SELECT id, question_config
        FROM classroom_point_submissions
        WHERE TRIM(session) = ${section.session_code}
          AND title = ${question.title}
          AND LOWER(COALESCE(submission_kind, 'code')) = ${CLASSROOM_SUBMISSION_KIND_CODE}
        ORDER BY id ASC
        LIMIT 1
      `) as { id: number; question_config: unknown }[]

      const prior =
        existing[0]?.question_config &&
        typeof existing[0].question_config === "object" &&
        !Array.isArray(existing[0].question_config)
          ? { ...(existing[0].question_config as Record<string, unknown>) }
          : {}
      prior.reference_answer = question.solution
      if (prior.solution_unlocked !== true) prior.solution_unlocked = false
      const config = JSON.stringify(prior)

      if (existing.length > 0) {
        const id = Number(existing[0]!.id)
        await sql`
          UPDATE classroom_point_submissions
          SET
            description = ${question.description},
            due_at = NULL,
            duration_hours = ${OPEN_HOURS},
            hidden_from_students = false,
            question_config = ${config}::jsonb
          WHERE id = ${id}
        `
        updated += 1
        console.log(`updated ${section.session_code} #${id} · ${question.title}`)
        continue
      }

      const inserted = (await sql`
        INSERT INTO classroom_point_submissions (
          title, description, session, created_by, created_at,
          duration_hours, due_at, submission_kind, hidden_from_students, question_config
        ) VALUES (
          ${question.title},
          ${question.description},
          ${section.session_code},
          ${section.instructor_id},
          NOW(),
          ${OPEN_HOURS},
          NULL,
          ${CLASSROOM_SUBMISSION_KIND_CODE},
          false,
          ${config}::jsonb
        )
        RETURNING id
      `) as { id: number }[]
      created += 1
      console.log(`created ${section.session_code} #${inserted[0]!.id} · ${question.title}`)
    }
  }

  const open = (await sql`
    SELECT COUNT(*)::int AS n FROM codebench_live_sessions WHERE ended_at IS NULL
  `) as { n: number }[]
  console.log(`created ${created}, updated ${updated}`)
  console.log(`live sessions still open: ${open[0]?.n ?? 0}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
