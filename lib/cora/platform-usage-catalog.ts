/** Where Cora Student and Cora Faculty actually run on CourseCollab. */

export type CoraPlatformSurface = {
  id: string
  label: string
  portal: "student" | "faculty"
  where: string
  uses: string
  sourceKeys: string[]
  modules: string[]
}

export const CORA_STUDENT_SURFACES: CoraPlatformSurface[] = [
  {
    id: "assistant",
    label: "Cora Assistant",
    portal: "student",
    where: "Student portal → Cora Assistant",
    uses: "Home, Workspace, Solve, Learn, Code, Insights, Study Plan, and Studio — step-by-step help, exam prep, and study plans.",
    sourceKeys: ["chat", "cora", "assistant", "workspace"],
    modules: ["cora-agent", "workspace", "solve", "learn", "code", "insights", "study-plan", "tools"],
  },
  {
    id: "lectures",
    label: "Lectures",
    portal: "student",
    where: "Student lectures / slide viewer",
    uses: "Ask Cora about the current slide, summarize lectures, and build glossaries from course materials.",
    sourceKeys: ["lecture"],
    modules: ["lectures"],
  },
  {
    id: "practice",
    label: "Practice Hub",
    portal: "student",
    where: "Student Practice Hub",
    uses: "Hints, worked examples, and extra practice generation aligned to weak topics.",
    sourceKeys: ["practice"],
    modules: ["practice"],
  },
  {
    id: "assessments",
    label: "Assessments",
    portal: "student",
    where: "Quizzes, homework, and exams (supported question types)",
    uses: "In-exam help on code write, multi-part, and circuit items — never a full-solution dump when hints mode is on.",
    sourceKeys: ["quiz", "assessment", "exam"],
    modules: ["quizzes", "quiz-history"],
  },
  {
    id: "codebench",
    label: "CodeBench",
    portal: "student",
    where: "Student CodeBench / coding workspace",
    uses: "Debug, trace, and explain student code without replacing the assignment.",
    sourceKeys: ["codebench"],
    modules: ["code", "codebench"],
  },
  {
    id: "notes-flashcards",
    label: "Notes & flashcards",
    portal: "student",
    where: "Digital notes and flashcard studio",
    uses: "Turn lectures and weak topics into notes and decks the student owns.",
    sourceKeys: ["flashcards", "notes"],
    modules: ["flashcards", "notes"],
  },
]

export const CORA_FACULTY_SURFACES: CoraPlatformSurface[] = [
  {
    id: "copilot",
    label: "Cora Copilot",
    portal: "faculty",
    where: "Faculty portal → Cora Copilot",
    uses: "Create, Improve, Analyze, Explain, Automate, Review, and Insights — teaching actions with confirmation cards.",
    sourceKeys: ["copilot", "faculty"],
    modules: ["cora-agent", "dashboard", "workspace"],
  },
  {
    id: "question-bank",
    label: "Question Bank",
    portal: "faculty",
    where: "Assessments → Question Bank",
    uses: "Draft items, solutions, and rubrics from topics, slides, or PDFs.",
    sourceKeys: ["question-bank"],
    modules: ["question-bank"],
  },
  {
    id: "assessments-author",
    label: "Assessment authoring",
    portal: "faculty",
    where: "Quizzes, homework, mid-semester, finals",
    uses: "Build assessments from the bank, remediation quizzes, and coverage checks.",
    sourceKeys: ["quizzes", "homework"],
    modules: ["quizzes"],
  },
  {
    id: "lectures-author",
    label: "Lectures & syllabus",
    portal: "faculty",
    where: "Content → Lectures / Syllabus",
    uses: "Lecture shells, section drafts, and post-lecture flashcard offers.",
    sourceKeys: ["lectures", "syllabus"],
    modules: ["lectures", "syllabus"],
  },
  {
    id: "class-comms",
    label: "Class communications",
    portal: "faculty",
    where: "Announcements and messages",
    uses: "Propose whole-class announcements or a single-student DM, then confirm before send.",
    sourceKeys: ["announcements", "messages"],
    modules: ["announcements", "messages"],
  },
  {
    id: "analytics",
    label: "Results & struggles",
    portal: "faculty",
    where: "Analytics, results, and student Cora chats",
    uses: "Read assessment results, attendance, and student Cora signals to find gaps — never change billing or membership.",
    sourceKeys: ["results", "analytics"],
    modules: ["results", "dashboard"],
  },
]

export const CORA_FEATURE_LABELS: Record<string, string> = {
  CHAT: "Chat",
  STEP_BY_STEP: "Step-by-step",
  QUESTION_GENERATION: "Question drafts",
  QUIZ_GENERATION: "Quiz generation",
  HOMEWORK_GENERATION: "Homework generation",
  EXAM_GENERATION: "Exam generation",
  FLASHCARDS: "Flashcards",
  LECTURE_GENERATION: "Lecture drafts",
  CODE_HELP: "Code help",
  CODE_DEBUG: "Code debug",
  GRADING: "Grading",
  FEEDBACK: "Feedback",
  ANALYTICS: "Analytics",
  DOCUMENT_ANALYSIS: "Document analysis",
  STUDY_PLAN: "Study plan",
  NOTETAKER: "Notes",
  RAG: "Course search",
  AGENT_TOOL_CALL: "Tool action",
  VISION: "Vision",
  OTHER: "Other",
}

export function coraFeatureLabel(feature: string) {
  return CORA_FEATURE_LABELS[feature] ?? feature.replace(/_/g, " ").toLowerCase()
}

export function coraSourceLabel(source: string) {
  const map: Record<string, string> = {
    chat: "Cora Assistant chat",
    cora: "Cora Assistant",
    assistant: "Cora Assistant",
    workspace: "Workspace",
    lecture: "Lectures",
    practice: "Practice Hub",
    quiz: "Quizzes",
    assessment: "Assessments",
    exam: "Exams",
    codebench: "CodeBench",
    flashcards: "Flashcards",
    notes: "Notes",
  }
  return map[source] ?? source.replace(/[-_]/g, " ")
}
