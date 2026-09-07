/** Shared Cora Quick Action intents — conversational starters (faculty + future student). */

export type CoraIntentId =
  | "create-content"
  | "transform-content"
  | "review-content"
  | "analyze-data"
  | "brainstorm-ideas"
  | "explain-concepts"
  | "generate-feedback"
  | "summarize-content"
  | "automate-task"

export type CoraIntentDefinition = {
  id: CoraIntentId
  label: string
  starterPrompt: string
  examples: string[]
}

export const FACULTY_CORA_INTENTS: CoraIntentDefinition[] = [
  {
    id: "create-content",
    label: "Create content",
    examples: ["Quiz", "Homework", "Flashcards", "Announcement", "Rubric"],
    starterPrompt:
      "I want to create something for my course. Ask what I'd like to create — quiz, homework, flashcards, lecture, rubric, study guide, practice problems, coding exercise, project, discussion prompt, or something else — then guide me step by step.",
  },
  {
    id: "transform-content",
    label: "Transform content",
    examples: ["Rewrite", "Improve", "Convert PDF → quiz", "Change difficulty"],
    starterPrompt:
      "I want to transform existing course material. Ask what content I have and what I'd like to do — rewrite, improve, simplify, expand, convert format, translate, change difficulty, Bloom's taxonomy, etc. — then guide me.",
  },
  {
    id: "review-content",
    label: "Review content",
    examples: ["Review quiz", "Review syllabus", "Check fairness"],
    starterPrompt:
      "I want to review course content. Ask what I want reviewed — quiz, lecture, syllabus, rubric, fairness, learning objectives, clarity, consistency, grammar — then guide me through the review.",
  },
  {
    id: "analyze-data",
    label: "Analyze data",
    examples: ["Quiz statistics", "Grade distributions", "Attendance"],
    starterPrompt:
      "I want to analyze course data. Ask what data I have or want to explore — quiz stats, grade distributions, CSV, attendance, classroom points, student progress, assessment analytics, submission trends — then guide me.",
  },
  {
    id: "brainstorm-ideas",
    label: "Brainstorm ideas",
    examples: ["Project ideas", "Lab activities", "Discussion prompts"],
    starterPrompt:
      "I want to brainstorm teaching ideas. Ask what I'm planning for — projects, labs, discussions, lectures, assessments — then help me generate options.",
  },
  {
    id: "explain-concepts",
    label: "Explain concepts",
    examples: ["Why students miss this", "Misconceptions", "Grading trends"],
    starterPrompt:
      "I want help explaining a concept or trend. Ask what I need clarified — student misconceptions, why a question is hard, grading trends, circuit/code concepts — then explain clearly.",
  },
  {
    id: "generate-feedback",
    label: "Generate feedback",
    examples: ["Rubric comments", "Student email reply", "Review notes"],
    starterPrompt:
      "I want to generate feedback. Ask who it's for and the context — quiz comment, homework rubric note, student email reply, progress review — then draft it with me.",
  },
  {
    id: "summarize-content",
    label: "Summarize content",
    examples: ["Lecture", "PDF", "Discussion", "Weekly recap"],
    starterPrompt:
      "I want to summarize content. Ask what I need summarized — lecture, PDF, paper, meeting notes, discussion, student responses — and how detailed the summary should be.",
  },
  {
    id: "automate-task",
    label: "Automate task",
    examples: ["Weekly announcement", "Post-lecture flashcards", "Reminder"],
    starterPrompt:
      "I want to automate a teaching task. Ask what I'd like to automate — announcement, reminder, weekly recap, office hour reminder, follow-up email, checklist, workflow — then help me set it up.",
  },
]

export function dispatchFacultyCoraIntent(intentId: CoraIntentId) {
  const intent = FACULTY_CORA_INTENTS.find((entry) => entry.id === intentId)
  if (!intent) return null
  return { intent, starterPrompt: intent.starterPrompt }
}
