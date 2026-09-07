/** Static content for the Foundational AI Workshop landing experience. */

export const AI_BOOTCAMP_SLUG = "ai-bootcamp"
/** Public display name (slug stays `ai-bootcamp` for stable URLs). */
export const AI_BOOTCAMP_DISPLAY_TITLE = "Foundational AI Workshop"
export const AI_BOOTCAMP_AGREEMENT_VERSION = "2026.1"

export type AiBootcampPathwayId = "high-school" | "freshman"

export const AI_BOOTCAMP_FLASHCARDS = [
  {
    id: "ai",
    front: "Artificial Intelligence",
    back: "Technology that enables computers to perform tasks that normally require human intelligence.",
  },
  {
    id: "generative",
    front: "Generative AI",
    back: "AI that creates new content such as text, images, audio, code, or presentations.",
  },
  {
    id: "prompt",
    front: "Prompt",
    back: "The instruction or question given to an AI system.",
  },
  {
    id: "hallucination",
    front: "Hallucination",
    back: "An AI-generated response that sounds convincing but is inaccurate or unsupported.",
  },
  {
    id: "bias",
    front: "Bias",
    back: "An unfair pattern or preference that may appear in AI data, outputs, or decisions.",
  },
  {
    id: "responsible",
    front: "Responsible AI",
    back: "Designing and using AI in ways that are safe, fair, transparent, and respectful of people.",
  },
] as const

export const AI_USED_TODAY_OPTIONS = [
  { id: "video", label: "Watched a recommended video" },
  { id: "nav", label: "Used a navigation application" },
  { id: "voice", label: "Asked a voice assistant a question" },
  { id: "face", label: "Used face unlock" },
  { id: "chatbot", label: "Used an AI chatbot" },
  { id: "music", label: "Received music recommendations" },
  { id: "filter", label: "Used an image filter" },
  { id: "predictive", label: "Used predictive text" },
  { id: "unsure", label: "I am not sure" },
] as const

export const AI_BOOTCAMP_PATHWAYS: Record<
  AiBootcampPathwayId,
  {
    id: AiBootcampPathwayId
    title: string
    theme: string
    audience: string
    duration: string
    difficulty: string
    learnTo: string[]
    finalChallenge: string
    exampleProjects: string[]
    cta: string
    session1Title: string
  }
> = {
  "high-school": {
    id: "high-school",
    title: "High School Foundational AI Workshop",
    theme: "Discovering Artificial Intelligence: Learn, Create, and Think Responsibly",
    audience: "Students in Grades 9–12",
    duration: "Two Days",
    difficulty: "Beginner",
    learnTo: [
      "Explain basic AI concepts",
      "Recognize AI in everyday life",
      "Compare popular AI tools",
      "Write effective prompts",
      "Generate text, images, and presentations",
      "Evaluate AI-generated information",
      "Recognize ethical and privacy concerns",
      "Build a creative AI-powered solution",
    ],
    finalChallenge: "Design an AI solution for a school or community problem.",
    exampleProjects: [
      "Homework assistant",
      "School navigation chatbot",
      "Recycling assistant",
      "Student event assistant",
      "Creative storytelling tool",
    ],
    cta: "Enter High School Workshop",
    session1Title: "Session 1: What Is Artificial Intelligence?",
  },
  freshman: {
    id: "freshman",
    title: "Freshman Foundational AI Workshop",
    theme: "Using AI to Succeed in College",
    audience: "Incoming University Freshmen",
    duration: "Two Days",
    difficulty: "Beginner–Intermediate",
    learnTo: [
      "Use AI responsibly in college",
      "Understand academic integrity expectations",
      "Turn notes into study guides and flashcards",
      "Create practice questions",
      "Improve professional emails",
      "Support research and source verification",
      "Use AI for coding and problem solving",
      "Build a resume and career roadmap",
    ],
    finalChallenge: "Design an AI solution that improves university life.",
    exampleProjects: [
      "Freshman study planner",
      "Campus navigation assistant",
      "Academic advising chatbot",
      "Event recommendation assistant",
      "AI roommate assistant",
    ],
    cta: "Enter Freshman Workshop",
    session1Title: "Session 1: AI in College and Responsible Use",
  },
}

export const AI_BOOTCAMP_FEATURES = [
  {
    id: "tools",
    title: "AI Tool Exploration",
    description: "Compare the strengths and limitations of several AI assistants.",
  },
  {
    id: "prompts",
    title: "Prompt Engineering Lab",
    description: "Turn weak prompts into precise, effective instructions.",
  },
  {
    id: "creativity",
    title: "AI Creativity Studio",
    description: "Generate images, stories, presentations, and original ideas.",
  },
  {
    id: "factcheck",
    title: "Fact-Checking Challenge",
    description: "Identify inaccurate or unsupported AI responses.",
  },
  {
    id: "responsible",
    title: "Responsible AI Lab",
    description: "Explore privacy, bias, copyright, deepfakes, and academic integrity.",
  },
  {
    id: "capstone",
    title: "Team Capstone",
    description: "Design and present an AI-powered solution to a real problem.",
  },
] as const

export const AI_BOOTCAMP_JOURNEY = {
  day1: {
    title: "Day 1 — Explore and Understand AI",
    items: [
      "Learn what AI is",
      "Identify AI applications",
      "Compare different AI tools",
      "Learn prompt engineering",
      "Examine AI limitations",
      "Discuss responsible AI",
    ],
    milestone: "Create a useful AI-generated product using effective prompting.",
  },
  day2: {
    title: "Day 2 — Create and Apply AI",
    items: [
      "Generate images and creative content",
      "Build presentations or study resources",
      "Apply AI to real-world problems",
      "Work with a team",
      "Complete a capstone challenge",
      "Present your solution",
    ],
    milestone: "Present an original AI-powered solution.",
  },
} as const

export const AI_BOOTCAMP_AGREEMENT_ITEMS = [
  "Avoid sharing private or sensitive information with AI tools",
  "Verify important AI-generated information",
  "Clearly identify when AI helped create my work",
  "Follow workshop and school academic-integrity rules",
  "Treat AI output as a starting point, not automatic truth",
  "Use AI respectfully and responsibly",
] as const

export const AI_BOOTCAMP_INTERESTS = [
  "AI basics",
  "Prompt writing",
  "Image generation",
  "Presentations",
  "Studying",
  "Research",
  "Coding",
  "Career preparation",
] as const

export const AI_BOOTCAMP_EXPECTATIONS = {
  expect: [
    "Participate actively",
    "Ask questions",
    "Test ideas",
    "Verify AI-generated information",
    "Respect classmates",
    "Protect personal information",
    "Follow instructor guidance",
    "Contribute to the team project",
  ],
  notExpect: [
    "Previous AI experience",
    "Programming experience",
    "Advanced mathematics",
    "Experience with every AI tool",
  ],
} as const

export type AiBootcampLandingState = {
  pathwayId: AiBootcampPathwayId | null
  assignedPathwayId: AiBootcampPathwayId | null
  allowSelfEnrollment: boolean
  usedAiToday: string[]
  readiness: {
    familiarity: string | null
    interests: string[]
    confidence: number | null
    question: string
  }
  agreementAccepted: boolean
  agreementVersion: string | null
  agreementAcceptedAt: string | null
  landingComplete: boolean
  flashcardsUnderstood: string[]
  firstSessionUnlocked: boolean
  trainingId: number | null
  /** Module 0 orientation — first learning module after Begin Workshop */
  module0Id: number | null
  /** Pathway-specific Module 1 after orientation */
  session1ModuleId: number | null
  modules: Array<{
    id: number
    title: string
    pathway: AiBootcampPathwayId | "shared" | null
    sort_order: number
  }>
}
