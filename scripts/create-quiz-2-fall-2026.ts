/**
 * Hide imported ELEG quizzes (keep Quiz 1 Fall 2026 and all homework),
 * then publish Quiz 2 Fall 2026 for the Fall sections and notify students.
 *
 *   npx tsx scripts/create-quiz-2-fall-2026.ts
 */
import { config } from "dotenv"
import { readFileSync } from "fs"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const TITLE = "Quiz 2 Fall 2026"
const TOPIC = "C++ Selection Criteria"
const ANNOUNCE_TITLE = "Quiz 2 Fall 2026 is available"
const DUE_LABEL = "Friday, October 2, 2026 at 11:59 PM Central"
const AVAILABLE_FROM = "2026-09-29T15:00:00.000Z"
const AVAILABLE_UNTIL = "2026-10-03T04:59:59.999Z"
const KEEP_QUIZ_IDS = [534, 535]
const INSTRUCTOR_ID = 1

const SECTION_CONFIG = [
  {
    title: "Section I: Concept Review",
    timer_mode: "section_timer",
    question_types: ["mcq", "true_false", "select_all", "fill_blank", "multiple_choice"],
    weight_percent: 30,
    allow_backtracking: false,
    question_order_start: 1,
    question_order_end: 30,
    total_time_seconds: 3600,
    auto_submit_on_expire: true,
    exam_shared_timer_seconds: 3600,
  },
  {
    title: "Section II: Programming",
    timer_mode: "section_timer",
    question_types: ["code_write"],
    weight_percent: 70,
    allow_backtracking: true,
    question_order_start: 31,
    question_order_end: 35,
    total_time_seconds: 3600,
    auto_submit_on_expire: true,
  },
]

type Objective = {
  title: string
  question_type: "mcq" | "true_false" | "select_all"
  difficulty: string
  points: number
  question_text: string
  options: { id: string; text: string }[]
  correct_answer?: string
  correct_answers?: string[]
  explanation: string
}

const CODE_PROBLEMS: Array<{
  title: string
  difficulty: string
  questionText: string
  sampleAnswer: string
}> = [
  {
    title: "Student Movie Ticket Price",
    difficulty: "easy",
    questionText: `A movie theater offers different ticket prices based on a customer's age. Write a complete C++ program that asks the user to enter their age and determines the ticket price using if/else statements.

Use the following rules:
- Age 12 or younger: $6
- Age 13 through 64: $10
- Age 65 or older: $7
- A negative age is invalid.

The program must display either the ticket price or INVALID AGE.

Sample input:
20
Expected output:
Ticket Price: $10`,
    sampleAnswer: `#include <iostream>
using namespace std;

int main() {
    int age;
    cout << "Age: ";
    cin >> age;
    if (age < 0)
        cout << "INVALID AGE" << endl;
    else if (age <= 12)
        cout << "Ticket Price: $6" << endl;
    else if (age <= 64)
        cout << "Ticket Price: $10" << endl;
    else
        cout << "Ticket Price: $7" << endl;
    return 0;
}`,
  },
  {
    title: "University Scholarship Eligibility",
    difficulty: "medium",
    questionText: `A university uses GPA and completed credit hours to determine scholarship eligibility. Write a complete C++ program that asks the student to enter their GPA and number of completed credit hours.

Apply these rules:
- If GPA is below 0.0 or above 4.0, or completed credit hours are negative, display INVALID DATA.
- A student receives a FULL SCHOLARSHIP if GPA is at least 3.75 AND the student has completed at least 60 credit hours.
- Otherwise, the student receives a PARTIAL SCHOLARSHIP if GPA is at least 3.25 AND the student has completed at least 30 credit hours.
- Otherwise, display NOT ELIGIBLE.

Use comparison operators, logical operators, and an if/else if/else structure.

Sample input:
3.60
45
Expected output:
PARTIAL SCHOLARSHIP`,
    sampleAnswer: `#include <iostream>
using namespace std;

int main() {
    double gpa;
    int hours;
    cout << "GPA: ";
    cin >> gpa;
    cout << "Completed Credit Hours: ";
    cin >> hours;
    if (gpa < 0.0 || gpa > 4.0 || hours < 0)
        cout << "INVALID DATA" << endl;
    else if (gpa >= 3.75 && hours >= 60)
        cout << "FULL SCHOLARSHIP" << endl;
    else if (gpa >= 3.25 && hours >= 30)
        cout << "PARTIAL SCHOLARSHIP" << endl;
    else
        cout << "NOT ELIGIBLE" << endl;
    return 0;
}`,
  },
  {
    title: "Restaurant Order and Delivery Charge",
    difficulty: "hard",
    questionText: `A restaurant wants a C++ program to calculate a customer's food order and delivery charge.

Ask the user to enter:
- meal choice: 1 for Burger, 2 for Pizza, 3 for Chicken
- quantity ordered
- whether delivery is required: 1 for Yes, 0 for No

Use a switch statement to determine the price of ONE meal:
- Burger: $8.50
- Pizza: $12.00
- Chicken: $10.00

Apply these additional rules:
1. Any meal choice other than 1, 2, or 3 is invalid.
2. Quantity must be greater than 0.
3. If the meal choice or quantity is invalid, display INVALID ORDER and stop.
4. Calculate the food subtotal as price * quantity.
5. If delivery is requested and the food subtotal is less than $30, add a $5 delivery charge.
6. If delivery is requested and the food subtotal is at least $30, delivery is free.
7. If delivery is not requested, the delivery charge is $0.
8. Use a ternary operator to determine whether the order is DELIVERY or PICKUP.
9. Display the order type, food subtotal, delivery charge, and final total, with money shown to two decimal places.

Sample input:
2
3
1
Expected output:
Order Type: DELIVERY
Food Subtotal: $36.00
Delivery Charge: $0.00
Final Total: $36.00`,
    sampleAnswer: `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    int choice, quantity, delivery;
    cout << "Meal Choice: ";
    cin >> choice;
    cout << "Quantity: ";
    cin >> quantity;
    cout << "Delivery: ";
    cin >> delivery;

    double price = 0;
    bool validMeal = true;
    switch (choice) {
        case 1: price = 8.50; break;
        case 2: price = 12.00; break;
        case 3: price = 10.00; break;
        default: validMeal = false; break;
    }
    if (!validMeal || quantity <= 0) {
        cout << "INVALID ORDER" << endl;
        return 0;
    }

    double subtotal = price * quantity;
    double charge = 0;
    if (delivery == 1 && subtotal < 30)
        charge = 5;
    double total = subtotal + charge;

    cout << fixed << setprecision(2);
    cout << "Order Type: " << (delivery == 1 ? "DELIVERY" : "PICKUP") << endl;
    cout << "Food Subtotal: $" << subtotal << endl;
    cout << "Delivery Charge: $" << charge << endl;
    cout << "Final Total: $" << total << endl;
    return 0;
}`,
  },
  {
    title: "Employee Overtime and Performance Bonus",
    difficulty: "very_hard",
    questionText: `A company needs a C++ program to calculate an employee's weekly pay and determine whether the employee receives a performance bonus.

Ask the user to enter:
- number of hours worked
- hourly pay rate
- performance rating from 1 through 3, where 1 = Satisfactory, 2 = Good, and 3 = Excellent

Apply the following rules:
1. Hours worked cannot be negative or greater than 80, the hourly pay rate must be greater than 0, and the rating must be 1, 2, or 3. Invalid input must display INVALID DATA.
2. For the first 40 hours, the employee receives the normal hourly rate.
3. Any hours above 40 are paid at 1.5 times the hourly rate.
4. Use a switch statement to process the performance rating.
5. A Satisfactory employee receives no bonus.
6. A Good employee receives a 5% bonus ONLY if the employee worked at least 35 hours.
7. An Excellent employee receives a 10% bonus if the employee worked at least 35 hours. If an Excellent employee worked fewer than 35 hours, the bonus is only 5%.
8. The bonus is calculated from the employee's weekly pay AFTER overtime has been included.
9. Final pay equals weekly pay plus the bonus.
10. Use a ternary operator to display OVERTIME if the employee worked more than 40 hours and REGULAR otherwise.
11. Display money with two decimal places.

Sample input:
45
20
3
Expected output:
Pay Type: OVERTIME
Weekly Pay: $950.00
Bonus: $95.00
Final Pay: $1045.00`,
    sampleAnswer: `#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    double hours, rate;
    int rating;
    cout << "Hours Worked: ";
    cin >> hours;
    cout << "Hourly Rate: ";
    cin >> rate;
    cout << "Performance Rating: ";
    cin >> rating;

    if (hours < 0 || hours > 80 || rate <= 0) {
        cout << "INVALID DATA" << endl;
        return 0;
    }

    double weekly = hours <= 40 ? hours * rate : 40 * rate + (hours - 40) * rate * 1.5;
    double bonusRate = 0;
    switch (rating) {
        case 1:
            bonusRate = 0;
            break;
        case 2:
            bonusRate = hours >= 35 ? 0.05 : 0;
            break;
        case 3:
            bonusRate = hours >= 35 ? 0.10 : 0.05;
            break;
        default:
            cout << "INVALID DATA" << endl;
            return 0;
    }

    double bonus = weekly * bonusRate;
    double finalPay = weekly + bonus;
    cout << fixed << setprecision(2);
    cout << "Pay Type: " << (hours > 40 ? "OVERTIME" : "REGULAR") << endl;
    cout << "Weekly Pay: $" << weekly << endl;
    cout << "Bonus: $" << bonus << endl;
    cout << "Final Pay: $" << finalPay << endl;
    return 0;
}`,
  },
  {
    title: "Autonomous Delivery Robot Mission Authorization",
    difficulty: "extremely_hard",
    questionText: `A campus autonomous delivery robot must determine whether it can safely begin a delivery mission. Write a complete C++ program using comparison operators, if/else, nested decisions, switch, and a ternary operator.

Ask the operator to enter:
- battery percentage from 0 through 100
- payload weight in kilograms
- weather condition: 1 for Clear, 2 for Rain, 3 for High Wind, 4 for Severe Weather
- mission distance in kilometers
- whether the delivery is an emergency: 1 for Yes, 0 for No

Apply these rules carefully:
1. Battery must be between 0 and 100, payload must be greater than 0, and distance must be greater than 0. Invalid values, including any weather value other than 1 through 4, produce INVALID MISSION DATA.
2. A payload above 20 kg automatically produces MISSION DENIED.
3. Use a switch statement to apply weather restrictions:
   - Clear: no additional restriction.
   - Rain: battery must be at least 50%.
   - High Wind: payload must be 10 kg or less AND battery must be at least 60%.
   - Severe Weather: ordinary missions are denied. An emergency mission may continue only when battery is at least 80% AND payload is 5 kg or less.
4. A mission that passes the weather rules must also satisfy the distance requirement:
   - 2 km or less requires at least 30% battery.
   - More than 2 km but no more than 5 km requires at least 45%.
   - More than 5 km but no more than 10 km requires at least 65%.
   - More than 10 km requires at least 85%.
5. The mission is approved only if ALL applicable restrictions are satisfied.
6. For an approved mission, use a ternary operator to classify it as LONG RANGE when distance is greater than 5 km and LOCAL otherwise.
7. Display MISSION APPROVED on one line and LONG RANGE or LOCAL on the next line, or display MISSION DENIED.

Sample input:
82
4
4
12
1
Expected output:
MISSION DENIED

Even though this example satisfies the Severe Weather emergency exception, a 12 km mission still requires at least 85% battery.`,
    sampleAnswer: `#include <iostream>
using namespace std;

int main() {
    int battery, weather, emergency;
    double payload, distance;
    cout << "Battery: ";
    cin >> battery;
    cout << "Payload: ";
    cin >> payload;
    cout << "Weather: ";
    cin >> weather;
    cout << "Distance: ";
    cin >> distance;
    cout << "Emergency: ";
    cin >> emergency;

    if (battery < 0 || battery > 100 || payload <= 0 || distance <= 0) {
        cout << "INVALID MISSION DATA" << endl;
        return 0;
    }
    if (payload > 20) {
        cout << "MISSION DENIED" << endl;
        return 0;
    }

    bool weatherOk = false;
    switch (weather) {
        case 1:
            weatherOk = true;
            break;
        case 2:
            weatherOk = battery >= 50;
            break;
        case 3:
            weatherOk = payload <= 10 && battery >= 60;
            break;
        case 4:
            weatherOk = emergency == 1 && battery >= 80 && payload <= 5;
            break;
        default:
            cout << "INVALID MISSION DATA" << endl;
            return 0;
    }
    if (!weatherOk) {
        cout << "MISSION DENIED" << endl;
        return 0;
    }

    bool distanceOk = false;
    if (distance <= 2) distanceOk = battery >= 30;
    else if (distance <= 5) distanceOk = battery >= 45;
    else if (distance <= 10) distanceOk = battery >= 65;
    else distanceOk = battery >= 85;

    if (!distanceOk) {
        cout << "MISSION DENIED" << endl;
        return 0;
    }

    cout << "MISSION APPROVED" << endl;
    cout << (distance > 5 ? "LONG RANGE" : "LOCAL") << endl;
    return 0;
}`,
  },
]

function loadObjectives(): Objective[] {
  const read = (name: string) =>
    JSON.parse(readFileSync(resolve(process.cwd(), "scripts", name), "utf8")) as Objective[]
  const rows = [
    ...read("quiz-2-fall-2026-section1.json"),
    ...read("quiz-2-fall-2026-tf.json"),
    ...read("quiz-2-fall-2026-select.json"),
  ]
  if (rows.length !== 30) throw new Error(`Expected 30 Section I questions, found ${rows.length}.`)
  return rows
}

function answerFor(row: Objective): string {
  if (row.question_type === "select_all") {
    const letters = row.correct_answers ?? []
    if (letters.length < 1) throw new Error(`Missing select-all answers for ${row.title}`)
    return JSON.stringify(letters)
  }
  const letter = String(row.correct_answer ?? "").trim().toUpperCase()
  if (!/^[A-E]$/.test(letter)) throw new Error(`Bad answer for ${row.title}`)
  return letter
}

function timeLimit(type: string): number {
  if (type === "true_false") return 30
  if (type === "code_write") return 420
  return 40
}

function homeworkUrl(): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://course-collab.com").replace(/\/$/, "")
  return `${base}/student/dashboard-v2/quizzes`
}

async function notifyStudents(sql: Awaited<typeof import("@/lib/db")>["sql"]) {
  const { createCourseAnnouncement } = await import("@/lib/cora/services/create-announcement")
  const { loadFall2026ElegStudents } = await import("@/lib/eleg-fall-2026-student-scope")
  const { isValidStudentEmail } = await import("@/lib/email/send-notification-email")
  const { sendEmail } = await import("@/lib/email/sendEmail")
  const { sendStudentPushToMany } = await import("@/lib/push-notifications")

  const students = await loadFall2026ElegStudents(sql)
  const href = homeworkUrl().replace(/"/g, "&quot;")
  const html = `<p>Quiz 2 Fall 2026 is now open for your section. It covers selection criteria: if, else-if, switch, and nested decisions.</p>
<p><strong>Due:</strong> ${DUE_LABEL}.</p>
<ul>
<li>Section I (30%) is a concept review. You cannot go back to earlier questions.</li>
<li>Section II (70%) is five C++ programming problems.</li>
</ul>
<p><a href="${href}"><strong>Open Quizzes</strong></a></p>
<p>Best,<br/>Daniel Doe</p>`

  const sections = [
    { courseId: 5, code: "ELEG1301P01" },
    { courseId: 5, code: "ELEG1301P02" },
    { courseId: 6, code: "ELEG1304P03" },
  ]
  for (const section of sections) {
    const existing = (await sql`
      SELECT id FROM announcements
      WHERE title = ${ANNOUNCE_TITLE}
        AND course_id = ${section.courseId}
        AND TRIM(target_session) = ${section.code}
      LIMIT 1
    `) as { id: number }[]
    if (existing.length > 0) continue
    await createCourseAnnouncement({
      instructorId: INSTRUCTOR_ID,
      courseId: section.courseId,
      title: ANNOUNCE_TITLE,
      content: html,
      pinned: true,
      priority: "high",
      type: "info",
      targetSession: section.code,
      allowComments: false,
      waitForSideEffects: false,
    })
  }

  const message = `Quiz 2 on selection criteria is open. Due ${DUE_LABEL}.`
  const link = "/student/dashboard-v2/quizzes"
  const inserted = (await sql`
    INSERT INTO notifications (student_id, type, title, message, link, ai_summary, is_read, created_at)
    SELECT s.id, 'quiz', ${ANNOUNCE_TITLE}, ${message}, ${link}, ${message}, false, NOW()
    FROM students s
    WHERE s.id = ANY(${students.map((student) => student.id)})
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.student_id = s.id AND n.type = 'quiz' AND n.title = ${ANNOUNCE_TITLE}
      )
    RETURNING student_id
  `) as { student_id: number }[]
  const fresh = new Set(inserted.map((row) => Number(row.student_id)))
  const recipients = students.filter((student) => fresh.has(student.id))
  console.log(`Quiz notifications created: ${recipients.length}`)
  if (recipients.length === 0) return

  await sendStudentPushToMany({
    studentInternalIds: recipients.map((student) => student.id),
    type: "quiz",
    title: ANNOUNCE_TITLE,
    body: message,
    link,
    route: "/quizzes",
  })

  let sent = 0
  let skipped = 0
  const queue = recipients.filter((student) => isValidStudentEmail(student.email))
  skipped += recipients.length - queue.length
  for (let i = 0; i < queue.length; i += 5) {
    const batch = queue.slice(i, i + 5)
    const results = await Promise.all(
      batch.map(async (student) => {
        const first = student.full_name.trim().split(/\s+/)[0] || "there"
        const result = await sendEmail("announcement", student.email!.trim(), {
          title: ANNOUNCE_TITLE,
          message,
          link: homeworkUrl(),
          messageHtml: `<p>Hi ${first.replace(/[<>&]/g, "")},</p>${html}`,
        })
        return result.success
      }),
    )
    sent += results.filter(Boolean).length
    skipped += results.filter((ok) => !ok).length
  }
  console.log(`Quiz email sent ${sent}, skipped ${skipped}`)
}

async function main() {
  const { sql } = await import("@/lib/db")
  const objectives = loadObjectives()

  const removed = (await sql`
    UPDATE quizzes
    SET deleted_at = NOW(), updated_at = NOW(), is_public = false
    WHERE deleted_at IS NULL
      AND course_id IN (5, 6)
      AND assessment_type = 'quiz'
      AND id <> ALL(${KEEP_QUIZ_IDS}::int[])
      AND title <> 'Quiz 1 Fall 2026'
    RETURNING id, course_id, title
  `) as { id: number; course_id: number; title: string }[]
  if (removed.length > 0) {
    await sql`
      UPDATE quiz_session_access
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE quiz_id = ANY(${removed.map((row) => row.id)})
    `
  }
  console.log(`Hidden imported quizzes: ${removed.length}`)
  for (const row of removed) console.log(`  #${row.id} course ${row.course_id} ${row.title}`)

  const existing = (await sql`
    SELECT id, course_id FROM quizzes
    WHERE deleted_at IS NULL AND title = ${TITLE}
  `) as { id: number; course_id: number }[]
  if (existing.length === 0) {
    const sessions = (await sql`
      SELECT id, code, course_id
      FROM sessions
      WHERE academic_term_id = 70
        AND TRIM(code) IN ('ELEG1301P01', 'ELEG1301P02', 'ELEG1304P03')
    `) as { id: number; code: string; course_id: number }[]

    const targets = [
      { courseId: 5, codes: ["ELEG1301P01", "ELEG1301P02"] },
      { courseId: 6, codes: ["ELEG1304P03"] },
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
          ${"Section I (30%): 30 selection-criteria questions. Section II (70%): five C++ programs. Sessions for this course."},
          ${INSTRUCTOR_ID},
          ${target.courseId},
          true,
          45,
          ${AVAILABLE_FROM},
          ${AVAILABLE_UNTIL},
          false,
          0,
          'best',
          'quiz',
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

      for (let i = 0; i < objectives.length; i++) {
        const row = objectives[i]!
        const byId = new Map(row.options.map((option) => [option.id.toUpperCase(), option.text]))
        await sql`
          INSERT INTO quiz_questions (
            quiz_id, question_text, question_type, option_a, option_b, option_c, option_d, option_e,
            correct_answer, question_order, time_limit, points, max_points, explanation, topic,
            difficulty, evaluation_mode, anti_cheat_exempt, grading_type, ai_code_language, created_at
          ) VALUES (
            ${quizId},
            ${row.question_text},
            ${row.question_type},
            ${byId.get("A") ?? null},
            ${byId.get("B") ?? null},
            ${byId.get("C") ?? null},
            ${byId.get("D") ?? null},
            ${byId.get("E") ?? null},
            ${answerFor(row)},
            ${i + 1},
            ${timeLimit(row.question_type)},
            ${row.points},
            ${row.points},
            ${row.explanation},
            ${TOPIC},
            ${row.difficulty},
            'auto',
            false,
            'auto',
            'cpp',
            NOW()
          )
        `
      }

      for (let i = 0; i < CODE_PROBLEMS.length; i++) {
        const problem = CODE_PROBLEMS[i]!
        await sql`
          INSERT INTO quiz_questions (
            quiz_id, question_text, question_type, correct_answer, question_order, time_limit,
            points, max_points, explanation, topic, difficulty, evaluation_mode, sample_answer,
            anti_cheat_exempt, grading_type, ai_code_language, expected_answer, created_at
          ) VALUES (
            ${quizId},
            ${problem.questionText},
            'code_write',
            ${""},
            ${31 + i},
            420,
            10,
            10,
            ${problem.title},
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
        `
      }

      for (const session of sessions.filter((row) => target.codes.includes(row.code))) {
        await sql`
          INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
          VALUES (${quizId}, ${session.id}, true, CURRENT_TIMESTAMP)
          ON CONFLICT (quiz_id, session_id) DO NOTHING
        `
        console.log(`  session ${session.code}`)
      }
    }
  } else {
    console.log("Quiz 2 already exists", existing.map((row) => `#${row.id}`).join(", "))
  }

  await notifyStudents(sql)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})
