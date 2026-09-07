import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  Brain,
  Bug,
  ClipboardList,
  Code2,
  Eye,
  FileText,
  Flame,
  GraduationCap,
  Layers,
  Lightbulb,
  Link2,
  Map,
  Network,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react"
import { CONCEPT_EXPLORER_NODES } from "@/lib/cora/learn-workspace"

export type StudioToolChatModeOption = {
  id: string
  emoji?: string
  label: string
  shortLabel?: string
  tagline: string
}

export type StudioToolChatFollowUp = {
  id: string
  label: string
  icon: LucideIcon
  prompt: string
}

export type StudioToolChatConfig = {
  id: string
  title: string
  subtitle: string
  icon: LucideIcon
  heroTitle: string
  heroBody: string
  placeholder: string
  modeMenuLabel: string
  modes: StudioToolChatModeOption[]
  defaultMode: string
  starters: string[]
  followUps: StudioToolChatFollowUp[]
  /** Build the first-turn system-style user prompt from topic + mode. */
  buildPrompt: (topic: string, mode: string) => string
  learningGoal?: "understand" | "solve_together" | "review" | "prepare" | "create"
  parseRelated?: (content: string) => string[]
  relatedHeading?: string
  /** chat | interactive-plan | interactive-notes */
  drawerKind?: "chat" | "interactive-plan" | "interactive-notes"
  /** Auto-run generation when the drawer opens (quick actions). */
  autoGenerateOnOpen?: boolean
  /** Short label for the workspace chrome */
  workspaceLabel?: string
  /** Primary empty-state CTA */
  primaryCta?: string
}

const TOPIC_STARTERS = CONCEPT_EXPLORER_NODES.filter((n) => n.id !== "root").map((n) => n.label)

function parseBulletSection(content: string, heading: RegExp): string[] {
  const match = content.match(heading)
  if (!match?.[1]) return []
  return match[1]
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").replace(/^\d+\.\s*/, "").trim())
    .map((line) => line.replace(/\*\*/g, "").split(/[—–:-]/)[0]?.trim() ?? "")
    .filter((line) => line.length > 1 && line.length < 64)
    .slice(0, 8)
}

const parseRelatedConcepts = (content: string) =>
  parseBulletSection(content, /##\s*Related concepts\s*\n([\s\S]*?)(?=\n##\s|\n*$)/i)

const DEPTH_MODES: StudioToolChatModeOption[] = [
  { id: "intuitive", emoji: "✨", label: "Intuitive", shortLabel: "Intuitive", tagline: "Plain language + analogy" },
  { id: "course", emoji: "📘", label: "Course", shortLabel: "Course", tagline: "Lecture-style clarity" },
  { id: "exam", emoji: "🎯", label: "Exam-ready", shortLabel: "Exam", tagline: "Precise + testable" },
]

const DIFFICULTY_MODES: StudioToolChatModeOption[] = [
  { id: "beginner", emoji: "🌱", label: "Beginner", shortLabel: "Beginner", tagline: "Foundations first" },
  { id: "intermediate", emoji: "📗", label: "Intermediate", shortLabel: "Intermediate", tagline: "Course pace" },
  { id: "advanced", emoji: "🔥", label: "Advanced", shortLabel: "Advanced", tagline: "Harder stretch" },
]

const NOTE_DEPTH_MODES: StudioToolChatModeOption[] = [
  { id: "outline", emoji: "🧾", label: "Outline", shortLabel: "Outline", tagline: "Headings + bullets" },
  { id: "detailed", emoji: "📝", label: "Detailed", shortLabel: "Detailed", tagline: "Full study notes" },
  { id: "exam", emoji: "🎯", label: "Exam pack", shortLabel: "Exam", tagline: "High-yield only" },
]

const QUIZ_MODES: StudioToolChatModeOption[] = [
  { id: "quick", emoji: "⚡", label: "Quick check", shortLabel: "Quick", tagline: "3–5 questions" },
  { id: "standard", emoji: "📋", label: "Standard", shortLabel: "Standard", tagline: "8–10 questions" },
  { id: "exam", emoji: "🎓", label: "Exam style", shortLabel: "Exam", tagline: "Harder + rubric tips" },
]

const CARD_MODES: StudioToolChatModeOption[] = [
  { id: "core", emoji: "🃏", label: "Core 8", shortLabel: "Core 8", tagline: "Must-know cards" },
  { id: "standard", emoji: "📚", label: "Standard 12", shortLabel: "12 cards", tagline: "Balanced deck" },
  { id: "deep", emoji: "🧠", label: "Deep 20", shortLabel: "20 cards", tagline: "Thorough review" },
]

const LESSON_MODES: StudioToolChatModeOption[] = [
  { id: "express", emoji: "⏱️", label: "2 minutes", shortLabel: "2 min", tagline: "Tight + one check" },
  { id: "standard", emoji: "📘", label: "3 minutes", shortLabel: "3 min", tagline: "Full mini-lesson" },
  { id: "extended", emoji: "🧭", label: "Deep dive", shortLabel: "Deep", tagline: "Longer + practice" },
]

const CODE_MODES: StudioToolChatModeOption[] = [
  { id: "overview", emoji: "👀", label: "Overview", shortLabel: "Overview", tagline: "What's going on" },
  { id: "fix", emoji: "🛠️", label: "Fix it", shortLabel: "Fix", tagline: "Root cause + patch" },
  { id: "teach", emoji: "💡", label: "Teach me", shortLabel: "Teach", tagline: "Why it works" },
]

const CONCEPT_FOLLOW_UPS: StudioToolChatFollowUp[] = [
  { id: "related", label: "Related ideas", icon: Link2, prompt: "What concepts are closely related, and how do they connect?" },
  { id: "analogy", label: "Analogy", icon: Lightbulb, prompt: "Give me a vivid analogy for this." },
  { id: "example", label: "Worked example", icon: BookOpen, prompt: "Walk me through a short worked example." },
  { id: "pitfalls", label: "Common mistakes", icon: Target, prompt: "What mistakes do students usually make here?" },
  { id: "check", label: "Check me", icon: Sparkles, prompt: "Quiz me with one short question. Wait for my answer." },
]

function depthGuide(mode: string): string {
  if (mode === "intuitive") return "Use plain language, one strong analogy, and minimal jargon."
  if (mode === "exam") return "Be precise and exam-ready: definitions, when to use it, and what graders look for."
  return "Match a clear college lecture: intuition first, then the formal idea, then a compact example."
}

export const STUDIO_TOOL_CHAT_CONFIGS: Record<string, StudioToolChatConfig> = {
  "concept-explainer": {
    id: "concept-explainer",
    title: "Concept Explainer",
    subtitle: "Chat-style explanations — intuition, related ideas, and checks",
    icon: Lightbulb,
    heroTitle: "What should I explain?",
    heroBody:
      "Name a concept, import a lecture/problem, or upload a PDF/image. Depth lives in the composer — same place as Cora's mode.",
    placeholder: "e.g. mesh analysis, phasors, recursion…",
    modeMenuLabel: "Explanation depth",
    modes: DEPTH_MODES,
    defaultMode: "course",
    starters: TOPIC_STARTERS,
    followUps: CONCEPT_FOLLOW_UPS,
    learningGoal: "understand",
    relatedHeading: "Related concepts",
    parseRelated: parseRelatedConcepts,
    workspaceLabel: "Explain workspace",
    primaryCta: "Explain this",
    autoGenerateOnOpen: true,
    buildPrompt: (topic, mode) => `Explain the concept: "${topic}".

Depth: ${mode}. ${depthGuide(mode)}

Reply in markdown with these sections (skip any that truly do not apply):
## Intuition
## How it works
## Key terms
## Related concepts
(3–5 short bullet names only — each name alone on a line)
## Watch out for
## Quick check
(One short question; do not answer it yet)

Write like Cora in chat: warm, clear, and focused on understanding — not a textbook dump.`,
  },

  "mini-lesson": {
    id: "mini-lesson",
    title: "Mini Lesson",
    subtitle: "Focused 2–3 minute lessons with a quick check",
    icon: BookOpen,
    heroTitle: "What should we learn?",
    heroBody:
      "Enter a topic or concept. I'll teach a short lesson you can finish in a few minutes, then check understanding.",
    placeholder: "e.g. Kirchhoff's laws, transient response…",
    modeMenuLabel: "Lesson length",
    modes: LESSON_MODES,
    defaultMode: "standard",
    starters: TOPIC_STARTERS,
    learningGoal: "understand",
    relatedHeading: "Next topics",
    parseRelated: (c) => parseBulletSection(c, /##\s*Next topics\s*\n([\s\S]*?)(?=\n##\s|\n*$)/i),
    followUps: [
      { id: "slower", label: "Explain slower", icon: Lightbulb, prompt: "Slow down and re-teach the hardest part more carefully." },
      { id: "example", label: "Another example", icon: BookOpen, prompt: "Give one more worked example at the same level." },
      { id: "quiz", label: "Another check", icon: ClipboardList, prompt: "Give me another quick-check question. Wait for my answer." },
      { id: "notes", label: "Key takeaways", icon: FileText, prompt: "Summarize this mini-lesson into 5 bullet takeaways." },
    ],
    buildPrompt: (topic, mode) => {
      const length =
        mode === "express"
          ? "Keep it to ~2 minutes of reading. One intuition, one example, one check."
          : mode === "extended"
            ? "Aim for a deeper mini-lesson (~5 minutes): intuition, formalism, example, pitfalls, then a check."
            : "Aim for a focused 3-minute lesson: hook, core idea, one example, pitfalls, then a check."
      return `Teach a mini-lesson on: "${topic}".

${length}

Reply in markdown:
## Hook
## Core idea
## Worked mini-example
## Watch out for
## Quick check
(One question; do not answer yet)
## Next topics
(3 short related topic names)

Be conversational like Cora — teach, don't dump notes.`
    },
  },

  "formula-explorer": {
    id: "formula-explorer",
    title: "Formula Explorer",
    subtitle: "Variables, units, rearrangements, and common mistakes",
    icon: Flame,
    heroTitle: "Which formula or topic?",
    heroBody:
      "Name a formula, law, or topic. I'll unpack variables, units, when to use it, and traps students hit.",
    placeholder: "e.g. Ohm's law, complex power, Thevenin…",
    modeMenuLabel: "Focus",
    modes: [
      { id: "decode", emoji: "🔍", label: "Decode", shortLabel: "Decode", tagline: "Variables + units" },
      { id: "use", emoji: "⚙️", label: "When to use", shortLabel: "Use", tagline: "Pick the right formula" },
      { id: "mistakes", emoji: "⚠️", label: "Mistakes", shortLabel: "Mistakes", tagline: "Common traps" },
    ],
    defaultMode: "decode",
    starters: ["Ohm's Law", "KVL / KCL", "Complex Power", "RC Time Constant"],
    learningGoal: "understand",
    relatedHeading: "Related formulas",
    parseRelated: (c) => parseBulletSection(c, /##\s*Related formulas\s*\n([\s\S]*?)(?=\n##\s|\n*$)/i),
    followUps: [
      { id: "rearrange", label: "Rearrange", icon: Wand2, prompt: "Show common rearrangements of this formula for solving different unknowns." },
      { id: "units", label: "Units check", icon: Target, prompt: "Walk through a units / dimensional check for this formula." },
      { id: "example", label: "Plug in numbers", icon: BookOpen, prompt: "Give a short numeric example using this formula." },
      { id: "sheet", label: "Add to sheet", icon: FileText, prompt: "Rewrite this as a clean formula-sheet entry I can save." },
    ],
    buildPrompt: (topic, mode) => `Explore the formula / topic: "${topic}".

Focus mode: ${mode}.
${
  mode === "use"
    ? "Emphasize when to choose this formula vs alternatives."
    : mode === "mistakes"
      ? "Emphasize common student mistakes and how to avoid them."
      : "Emphasize decoding symbols, units, and meaning."
}

Reply in markdown:
## Formula
## Variables & units
## When to use
## Common mistakes
## Related formulas
(3–5 short names)
## Quick check
(One question; do not answer yet)

Write like Cora — clear and practical.`,
  },

  flashcards: {
    id: "flashcards",
    title: "Flashcards",
    subtitle: "Generate review decks from a topic or weak area",
    icon: Layers,
    heroTitle: "Build a deck from what?",
    heroBody:
      "Enter a topic, lecture, or concept. I'll generate Q/A cards you can study — front, back, and a memory tip.",
    placeholder: "e.g. phasors, mesh analysis, op-amps…",
    modeMenuLabel: "Deck size",
    modes: CARD_MODES,
    defaultMode: "standard",
    starters: TOPIC_STARTERS,
    learningGoal: "create",
    workspaceLabel: "Flashcard workspace",
    primaryCta: "Generate deck",
    autoGenerateOnOpen: true,
    followUps: [
      { id: "harder", label: "Harder cards", icon: Target, prompt: "Add 5 harder cards that test application, not recall." },
      { id: "simpler", label: "Simpler cards", icon: Lightbulb, prompt: "Add 5 simpler foundation cards." },
      { id: "quiz", label: "Quiz me", icon: ClipboardList, prompt: "Quiz me with one card at a time. Wait for my answer before revealing." },
      { id: "more", label: "5 more", icon: Sparkles, prompt: "Generate 5 more cards on the same topic." },
    ],
    buildPrompt: (topic, mode) => {
      const n = mode === "core" ? 8 : mode === "deep" ? 20 : 12
      return `Generate ${n} flashcards for: "${topic}".

Format each card in markdown as:
### Card N
**Front:** …
**Back:** …
**Tip:** (optional memory hook)

Cover definitions, when-to-use, and one common mistake card. Keep fronts short enough to self-test.`
    },
  },

  "quiz-generator": {
    id: "quiz-generator",
    title: "Mini Quiz",
    subtitle: "Scored practice questions with explanations",
    icon: ClipboardList,
    heroTitle: "Quiz me on what?",
    heroBody:
      "Name topics or concepts. I'll create a short practice quiz, then score and explain after you answer.",
    placeholder: "e.g. KCL, Thevenin, AC power…",
    modeMenuLabel: "Quiz style",
    modes: QUIZ_MODES,
    defaultMode: "standard",
    starters: TOPIC_STARTERS,
    learningGoal: "prepare",
    workspaceLabel: "Quiz workspace",
    primaryCta: "Generate quiz",
    autoGenerateOnOpen: true,
    followUps: [
      { id: "grade", label: "Grade my answers", icon: GraduationCap, prompt: "Grade my answers so far. Show score, missed ideas, and brief fixes." },
      { id: "harder", label: "Harder set", icon: Target, prompt: "Give me a harder follow-up quiz on the same topics." },
      { id: "review", label: "Review misses", icon: BookOpen, prompt: "Re-teach only what I missed, briefly." },
      { id: "more", label: "3 more Qs", icon: Sparkles, prompt: "Add 3 more questions at the same difficulty." },
    ],
    buildPrompt: (topic, mode) => {
      const count = mode === "quick" ? "3–5" : mode === "exam" ? "8–10 exam-style" : "8–10"
      return `Create a mini quiz on: "${topic}".

Style: ${mode} (${count} questions).

Reply in markdown:
## Quiz
Numbered questions. Mix short answer / conceptual / calculation as appropriate.
Do NOT include answers yet.
## How to submit
Tell me to reply with numbered answers.

After I answer, you will grade with score, brief explanations, and what to review next.`
    },
  },

  "study-notes": {
    id: "study-notes",
    title: "Study Notes",
    subtitle: "Scan CourseCollab · sectioned notes · interactive walkthrough",
    icon: FileText,
    heroTitle: "Build immersive notes",
    heroBody:
      "Cora scans your weak topics and course signals, then plays sectioned study notes you can export.",
    placeholder: "e.g. Chapter 7 AC analysis…",
    modeMenuLabel: "Note style",
    modes: NOTE_DEPTH_MODES,
    defaultMode: "detailed",
    starters: TOPIC_STARTERS,
    learningGoal: "create",
    drawerKind: "interactive-notes",
    workspaceLabel: "Notes workspace",
    primaryCta: "Generate notes",
    autoGenerateOnOpen: false,
    followUps: [
      { id: "flash", label: "Make flashcards", icon: Layers, prompt: "Turn the key points into 8 flashcards." },
      { id: "quiz", label: "Quiz from notes", icon: ClipboardList, prompt: "Make a 5-question quiz from these notes." },
      { id: "condense", label: "Condense", icon: Sparkles, prompt: "Condense these notes into a one-page high-yield version." },
      { id: "expand", label: "Expand a section", icon: BookOpen, prompt: "Expand the weakest / densest section with more explanation and an example." },
    ],
    buildPrompt: (topic, mode) => `Generate study notes for: "${topic}".

Style: ${mode}.
${
  mode === "outline"
    ? "Keep it to headings and tight bullets."
    : mode === "exam"
      ? "High-yield only: must-know facts, formulas, traps."
      : "Detailed notes with headings, key ideas, examples, and misconceptions."
}

Reply in markdown with clear headings:
## Overview
## Key ideas
## Formulas / definitions
## Examples
## Common misconceptions
## Review checklist

Write like Cora — organized and study-ready.`,
  },

  "simplify-topic": {
    id: "simplify-topic",
    title: "Simplify Topic",
    subtitle: "ELI5 → exam-ready layers of the same idea",
    icon: Wand2,
    heroTitle: "What should I simplify?",
    heroBody: "I'll explain the same idea at multiple levels so you can climb from intuition to exam precision.",
    placeholder: "e.g. impedance, recursion, Laplace…",
    modeMenuLabel: "Start level",
    modes: DEPTH_MODES,
    defaultMode: "intuitive",
    starters: TOPIC_STARTERS,
    learningGoal: "understand",
    followUps: CONCEPT_FOLLOW_UPS,
    buildPrompt: (topic, mode) => `Simplify "${topic}" across levels.

Start emphasis: ${mode}.

Reply in markdown:
## ELI5
## High school
## College course
## Exam-ready
## Bridge tip
(How to move up one level)

Keep each layer short and concrete.`,
  },

  "visual-diagrams": {
    id: "visual-diagrams",
    title: "Visual Diagrams",
    subtitle: "Concept maps, flowcharts, and visual explanations",
    icon: Network,
    heroTitle: "Visualize what?",
    heroBody: "I'll sketch a concept map or flowchart in text/markdown and explain each node.",
    placeholder: "e.g. how to solve a mesh circuit…",
    modeMenuLabel: "Diagram type",
    modes: [
      { id: "map", emoji: "🗺️", label: "Concept map", shortLabel: "Map", tagline: "How ideas connect" },
      { id: "flow", emoji: "➡️", label: "Flowchart", shortLabel: "Flow", tagline: "Step process" },
      { id: "compare", emoji: "⚖️", label: "Compare", shortLabel: "Compare", tagline: "Side-by-side" },
    ],
    defaultMode: "map",
    starters: TOPIC_STARTERS,
    learningGoal: "understand",
    followUps: CONCEPT_FOLLOW_UPS,
    buildPrompt: (topic, mode) => `Create a ${mode} visual explanation for: "${topic}".

Use markdown (lists, nested bullets, or a simple ASCII/mermaid-friendly structure if helpful).
Then briefly explain each node/step.
End with ## Quick check (one question, unanswered).`,
  },

  "study-guide": {
    id: "study-guide",
    title: "Study Guide",
    subtitle: "One cohesive guide for a chapter or exam unit",
    icon: BookOpen,
    heroTitle: "Guide for what unit?",
    heroBody: "Name a chapter, exam unit, or set of topics. I'll build a study guide with checkpoints.",
    placeholder: "e.g. Midterm 2 — AC power & phasors…",
    modeMenuLabel: "Guide depth",
    modes: NOTE_DEPTH_MODES,
    defaultMode: "detailed",
    starters: ["Midterm review", "AC analysis unit", "Transient circuits"],
    learningGoal: "prepare",
    followUps: [
      { id: "plan", label: "Study plan", icon: Target, prompt: "Turn this guide into a 3-day study plan." },
      { id: "quiz", label: "Practice quiz", icon: ClipboardList, prompt: "Make a practice quiz from the must-know list." },
      { id: "weak", label: "Weak spots", icon: Bug, prompt: "Ask me 5 diagnostic questions to find weak spots." },
    ],
    buildPrompt: (topic, mode) => `Create a study guide for: "${topic}".

Depth: ${mode}.

Include:
## Learning goals
## Must-know topics
## Formulas & definitions
## Practice checkpoints
## Common traps
## Day-of exam tips`,
  },

  "formula-sheet": {
    id: "formula-sheet",
    title: "Formula Sheet",
    subtitle: "Clean formula sheet ready for review or print",
    icon: Flame,
    heroTitle: "Formulas for what?",
    heroBody: "I'll build a concise formula sheet for your topic or upcoming quiz.",
    placeholder: "e.g. Chapter 8 AC power…",
    modeMenuLabel: "Sheet style",
    modes: [
      { id: "compact", emoji: "📄", label: "Compact", shortLabel: "Compact", tagline: "Formulas only" },
      { id: "annotated", emoji: "✏️", label: "Annotated", shortLabel: "Annotated", tagline: "Notes + units" },
      { id: "exam", emoji: "🎯", label: "Exam pack", shortLabel: "Exam", tagline: "High-yield + traps" },
    ],
    defaultMode: "annotated",
    starters: TOPIC_STARTERS,
    learningGoal: "create",
    workspaceLabel: "Formula workspace",
    primaryCta: "Generate sheet",
    autoGenerateOnOpen: true,
    followUps: [
      { id: "more", label: "Add more", icon: Sparkles, prompt: "Add any missing must-have formulas for this topic." },
      { id: "mistakes", label: "Trap notes", icon: Bug, prompt: "Add a 'don't mess up' note under each formula." },
    ],
    buildPrompt: (topic, mode) => `Generate a formula sheet for: "${topic}".

Style: ${mode}.
Use clear markdown headings and bullet formulas with symbols defined briefly.`,
  },

  "cheat-sheet": {
    id: "cheat-sheet",
    title: "Cheat Sheet",
    subtitle: "One-page high-yield reference for exams",
    icon: FileText,
    heroTitle: "Cheat sheet for what?",
    heroBody: "I'll compress the highest-yield facts, formulas, and traps onto one tight page.",
    placeholder: "e.g. quiz 3, final exam unit…",
    modeMenuLabel: "Density",
    modes: DIFFICULTY_MODES,
    defaultMode: "intermediate",
    starters: TOPIC_STARTERS,
    learningGoal: "prepare",
    followUps: CONCEPT_FOLLOW_UPS.slice(0, 3),
    buildPrompt: (topic, mode) => `Create a one-page cheat sheet for: "${topic}" at ${mode} level.
Max density, still readable. Sections: Must know · Formulas · Traps · Last-minute checks.`,
  },

  summary: {
    id: "summary",
    title: "Summary",
    subtitle: "Condense a lecture, chapter, or PDF into essentials",
    icon: Sparkles,
    heroTitle: "Summarize what?",
    heroBody: "Paste a topic, import a lecture, or upload material. I'll extract the essentials.",
    placeholder: "e.g. today's lecture on phasors…",
    modeMenuLabel: "Length",
    modes: [
      { id: "brief", emoji: "⚡", label: "Brief", shortLabel: "Brief", tagline: "Half page" },
      { id: "standard", emoji: "📝", label: "Standard", shortLabel: "Standard", tagline: "Key sections" },
      { id: "detailed", emoji: "📚", label: "Detailed", shortLabel: "Detailed", tagline: "Richer digest" },
    ],
    defaultMode: "standard",
    starters: TOPIC_STARTERS,
    learningGoal: "create",
    followUps: [
      { id: "notes", label: "Expand to notes", icon: FileText, prompt: "Expand this summary into full study notes." },
      { id: "cards", label: "Flashcards", icon: Layers, prompt: "Make flashcards from this summary." },
      { id: "quiz", label: "Quiz me", icon: ClipboardList, prompt: "Quiz me on this summary." },
    ],
    buildPrompt: (topic, mode) => `Summarize: "${topic}".

Length: ${mode}.
Include key ideas, formulas, and misconceptions to avoid.`,
  },

  "mind-map": {
    id: "mind-map",
    title: "Mind Map",
    subtitle: "Map how concepts connect and a learning order",
    icon: Map,
    heroTitle: "Map which topic?",
    heroBody: "I'll map related concepts and suggest an order to learn them.",
    placeholder: "e.g. AC circuit analysis…",
    modeMenuLabel: "Map style",
    modes: [
      { id: "overview", emoji: "🗺️", label: "Overview", shortLabel: "Overview", tagline: "Big picture" },
      { id: "deep", emoji: "🧠", label: "Deep", shortLabel: "Deep", tagline: "More nodes" },
      { id: "path", emoji: "🛤️", label: "Learn path", shortLabel: "Path", tagline: "Order to study" },
    ],
    defaultMode: "overview",
    starters: TOPIC_STARTERS,
    learningGoal: "understand",
    relatedHeading: "Suggested order",
    parseRelated: (c) => parseBulletSection(c, /##\s*Suggested order\s*\n([\s\S]*?)(?=\n##\s|\n*$)/i),
    followUps: CONCEPT_FOLLOW_UPS,
    buildPrompt: (topic, mode) => `Build a mind map for: "${topic}" (${mode}).
Use nested markdown bullets. Include ## Suggested order with 4–7 steps.`,
  },

  "example-generator": {
    id: "example-generator",
    title: "Example Generator",
    subtitle: "Worked examples at the level you need",
    icon: Sparkles,
    heroTitle: "Examples of what?",
    heroBody: "I'll generate worked examples matched to your difficulty, with clear steps.",
    placeholder: "e.g. mesh analysis with dependent sources…",
    modeMenuLabel: "Difficulty",
    modes: DIFFICULTY_MODES,
    defaultMode: "intermediate",
    starters: TOPIC_STARTERS,
    learningGoal: "understand",
    followUps: [
      { id: "another", label: "Another example", icon: BookOpen, prompt: "Give another example at the same difficulty." },
      { id: "harder", label: "Harder", icon: Target, prompt: "Give a harder example." },
      { id: "try", label: "Let me try", icon: ClipboardList, prompt: "Give me a similar problem without the solution first." },
    ],
    buildPrompt: (topic, mode) => `Generate a worked example for: "${topic}" at ${mode} difficulty.
Show setup → steps → final answer → common mistake.`,
  },

  "wrong-code-simulator": {
    id: "wrong-code-simulator",
    title: "Wrong Code Simulator",
    subtitle: "Common mistakes and why they fail",
    icon: Code2,
    heroTitle: "Which concept's mistakes?",
    heroBody: "I'll show buggy patterns for a concept, why they fail, and the correct approach.",
    placeholder: "e.g. off-by-one loops, null pointers…",
    modeMenuLabel: "Difficulty",
    modes: DIFFICULTY_MODES,
    defaultMode: "intermediate",
    starters: ["Pointers", "Recursion", "Off-by-one", "Memory leaks"],
    learningGoal: "review",
    followUps: [
      { id: "fix", label: "Show fix", icon: Wand2, prompt: "Show the corrected version and explain the fix." },
      { id: "more", label: "More bugs", icon: Bug, prompt: "Show two more common mistakes for this concept." },
      { id: "quiz", label: "Spot the bug", icon: Eye, prompt: "Give me a short snippet and ask me to find the bug." },
    ],
    buildPrompt: (topic, mode) => `For concept "${topic}" at ${mode} level, show 2–3 common wrong approaches.
For each: buggy idea/code, why it fails, correct pattern.`,
  },

  "smart-debugger": {
    id: "smart-debugger",
    title: "Smart Debugger",
    subtitle: "Find bugs, explain root causes, show fixes",
    icon: Bug,
    heroTitle: "Paste code or describe the bug",
    heroBody: "Upload/paste code or describe the failure. I'll find likely bugs and explain the root cause.",
    placeholder: "Paste code or describe the error…",
    modeMenuLabel: "Debug focus",
    modes: CODE_MODES,
    defaultMode: "fix",
    starters: ["Segmentation fault", "Wrong output", "Infinite loop"],
    learningGoal: "review",
    followUps: [
      { id: "trace", label: "Trace it", icon: Eye, prompt: "Trace execution step by step for the failing path." },
      { id: "test", label: "Test cases", icon: ClipboardList, prompt: "Suggest tests that would catch this bug." },
      { id: "prevent", label: "Prevent", icon: Target, prompt: "How do I prevent this class of bug next time?" },
    ],
    buildPrompt: (topic, mode) => `Debug help for: "${topic}".

Focus: ${mode}.
Structure: Suspected cause · Evidence · Fix · Why it works · Prevention tip.`,
  },

  "execution-visualizer": {
    id: "execution-visualizer",
    title: "Execution Visualizer",
    subtitle: "Variables and control flow step by step",
    icon: Eye,
    heroTitle: "What should we trace?",
    heroBody: "Paste code or describe an algorithm. I'll walk execution step by step.",
    placeholder: "Paste code to visualize…",
    modeMenuLabel: "Trace style",
    modes: [
      { id: "steps", emoji: "1️⃣", label: "Step trace", shortLabel: "Steps", tagline: "Line by line" },
      { id: "memory", emoji: "🧠", label: "Memory", shortLabel: "Memory", tagline: "Variables / stack" },
      { id: "why", emoji: "💡", label: "Why", shortLabel: "Why", tagline: "Intent of each step" },
    ],
    defaultMode: "steps",
    starters: ["Recursive factorial", "Two-pointer scan", "DFS vs BFS"],
    learningGoal: "understand",
    followUps: [
      { id: "next", label: "Continue", icon: Sparkles, prompt: "Continue the trace from where you left off." },
      { id: "bug", label: "Find bug", icon: Bug, prompt: "Highlight where a bug would appear in this flow." },
    ],
    buildPrompt: (topic, mode) => `Visualize execution for: "${topic}".

Style: ${mode}.
Use numbered steps with variable state snapshots.`,
  },

  "doc-generator": {
    id: "doc-generator",
    title: "Documentation Builder",
    subtitle: "README, comments, and clear explanations of code",
    icon: FileText,
    heroTitle: "Document what?",
    heroBody: "Paste code or describe a project. I'll generate clear documentation.",
    placeholder: "Paste code or describe the module…",
    modeMenuLabel: "Doc type",
    modes: [
      { id: "readme", emoji: "📘", label: "README", shortLabel: "README", tagline: "Project overview" },
      { id: "comments", emoji: "💬", label: "Comments", shortLabel: "Comments", tagline: "Inline docs" },
      { id: "api", emoji: "🔌", label: "API notes", shortLabel: "API", tagline: "Functions / interfaces" },
    ],
    defaultMode: "readme",
    starters: ["Explain this module", "Document my functions"],
    learningGoal: "create",
    followUps: [
      { id: "shorter", label: "Shorter", icon: Sparkles, prompt: "Make the documentation more concise." },
      { id: "examples", label: "Add examples", icon: BookOpen, prompt: "Add usage examples." },
    ],
    buildPrompt: (topic, mode) => `Generate ${mode} documentation for: "${topic}".`,
  },

  "code-quality": {
    id: "code-quality",
    title: "Code Review",
    subtitle: "Style, maintainability, correctness, and refactors",
    icon: Code2,
    heroTitle: "Review what code?",
    heroBody: "Paste code for a quality review — strengths, issues, and concrete improvements.",
    placeholder: "Paste code to review…",
    modeMenuLabel: "Review focus",
    modes: CODE_MODES,
    defaultMode: "overview",
    starters: ["Review my function", "Refactor this"],
    learningGoal: "review",
    workspaceLabel: "Code review workspace",
    primaryCta: "Start review",
    autoGenerateOnOpen: false,
    followUps: [
      { id: "refactor", label: "Refactor", icon: Wand2, prompt: "Propose a cleaner refactor of the weakest part." },
      { id: "tests", label: "Tests", icon: ClipboardList, prompt: "Suggest unit tests for this code." },
    ],
    buildPrompt: (topic, mode) => `Code quality review (${mode}) for: "${topic}".
Cover: strengths, issues (severity), refactors, and a short checklist.`,
  },

  "exam-mode": {
    id: "exam-mode",
    title: "Exam Simulator",
    subtitle: "Exam-style questions and rubrics under pressure",
    icon: GraduationCap,
    heroTitle: "Exam on what?",
    heroBody: "I'll generate exam-style questions with timing guidance and rubric hints.",
    placeholder: "e.g. Midterm topics: phasors, power…",
    modeMenuLabel: "Exam intensity",
    modes: QUIZ_MODES,
    defaultMode: "exam",
    starters: ["Midterm practice", "Final review set"],
    learningGoal: "prepare",
    followUps: [
      { id: "grade", label: "Grade me", icon: GraduationCap, prompt: "Grade my answers with a rubric and partial credit notes." },
      { id: "more", label: "Another set", icon: Sparkles, prompt: "Generate another exam-style set on the same topics." },
    ],
    buildPrompt: (topic, mode) => `Create an exam simulation for: "${topic}" (${mode}).
Include timing guidance, numbered questions, and wait for answers before grading.`,
  },

  "mock-interviewer": {
    id: "mock-interviewer",
    title: "Mock Interviewer",
    subtitle: "Practice interviews with hints and feedback",
    icon: Brain,
    heroTitle: "What kind of interview?",
    heroBody: "I'll run a mock interview: prompt, follow-ups, and feedback — not just a solution dump.",
    placeholder: "e.g. arrays & two pointers, system design lite…",
    modeMenuLabel: "Interview style",
    modes: [
      { id: "warmup", emoji: "🌱", label: "Warm-up", shortLabel: "Warm-up", tagline: "Gentle start" },
      { id: "standard", emoji: "💼", label: "Standard", shortLabel: "Standard", tagline: "Realistic pace" },
      { id: "hard", emoji: "🔥", label: "Hard", shortLabel: "Hard", tagline: "Stretch round" },
    ],
    defaultMode: "standard",
    starters: ["Coding interview", "Explain a project", "Behavioral STAR"],
    learningGoal: "prepare",
    followUps: [
      { id: "hint", label: "Hint", icon: Lightbulb, prompt: "Give a small hint without spoiling the solution." },
      { id: "feedback", label: "Feedback", icon: Target, prompt: "Give interview feedback on my last answer." },
      { id: "next", label: "Next question", icon: Sparkles, prompt: "Ask the next interview question." },
    ],
    buildPrompt: (topic, mode) => `Start a mock interview on: "${topic}" (${mode}).
Ask one question at a time. Stay in interviewer mode. After answers, give concise feedback.`,
  },

  "quiz-analysis": {
    id: "quiz-analysis",
    title: "Quiz Analysis",
    subtitle: "Where points leak and what to fix",
    icon: ClipboardList,
    heroTitle: "Which quiz / results?",
    heroBody: "Describe your quiz results or import a quiz. I'll find leak patterns and a fix plan.",
    placeholder: "e.g. scored 62% on AC power quiz…",
    modeMenuLabel: "Analysis focus",
    modes: [
      { id: "leaks", emoji: "💧", label: "Point leaks", shortLabel: "Leaks", tagline: "Where points go" },
      { id: "concepts", emoji: "🧩", label: "Concepts", shortLabel: "Concepts", tagline: "Weak ideas" },
      { id: "plan", emoji: "🗺️", label: "Fix plan", shortLabel: "Plan", tagline: "What to do next" },
    ],
    defaultMode: "leaks",
    starters: ["Last quiz", "Midterm mistakes"],
    learningGoal: "review",
    followUps: [
      { id: "drill", label: "Drill weak", icon: Target, prompt: "Give me a short drill on my weakest concept." },
      { id: "cards", label: "Flashcards", icon: Layers, prompt: "Make flashcards for the missed concepts." },
    ],
    buildPrompt: (topic, mode) => `Analyze quiz performance: "${topic}". Focus: ${mode}.
Give patterns, likely misconceptions, and a short remediation plan.`,
  },

  "homework-review": {
    id: "homework-review",
    title: "Homework Review",
    subtitle: "Approach, gaps, and a redo strategy",
    icon: FileText,
    heroTitle: "Which homework?",
    heroBody: "Import or describe homework. I'll review approach, gaps, and how to redo smarter.",
    placeholder: "Describe homework or paste a problem…",
    modeMenuLabel: "Review mode",
    modes: [
      { id: "approach", emoji: "🧭", label: "Approach", shortLabel: "Approach", tagline: "Method check" },
      { id: "gaps", emoji: "🧩", label: "Gaps", shortLabel: "Gaps", tagline: "Missing pieces" },
      { id: "redo", emoji: "🔁", label: "Redo plan", shortLabel: "Redo", tagline: "What next" },
    ],
    defaultMode: "gaps",
    starters: ["This week's HW", "Stuck on problem 3"],
    learningGoal: "review",
    workspaceLabel: "Homework workspace",
    primaryCta: "Analyze homework",
    autoGenerateOnOpen: true,
    followUps: CONCEPT_FOLLOW_UPS.slice(2),
    buildPrompt: (topic, mode) => `Homework review for: "${topic}". Focus: ${mode}.
Be constructive. End with a short redo checklist.`,
  },

  "mistake-analysis": {
    id: "mistake-analysis",
    title: "Mistake Analysis",
    subtitle: "Pattern-level mistakes — not just wrong answers",
    icon: Bug,
    heroTitle: "What mistakes are repeating?",
    heroBody: "Describe errors or paste work. I'll find patterns and how to stop repeating them.",
    placeholder: "e.g. I keep dropping signs / mixing peak vs RMS…",
    modeMenuLabel: "Depth",
    modes: DIFFICULTY_MODES,
    defaultMode: "intermediate",
    starters: ["Sign errors", "Unit mistakes", "Formula mix-ups"],
    learningGoal: "review",
    followUps: [
      { id: "drill", label: "Micro-drill", icon: Target, prompt: "Give me a 3-question micro-drill targeting this mistake pattern." },
      { id: "rule", label: "Memory rule", icon: Lightbulb, prompt: "Give me a sticky rule or checklist to avoid this mistake." },
    ],
    buildPrompt: (topic, mode) => `Mistake-pattern analysis for: "${topic}" (${mode}).
Identify patterns, triggers, and a prevention checklist.`,
  },

  "weekly-review": {
    id: "weekly-review",
    title: "Weekly Review",
    subtitle: "Progress recap and next-week priorities",
    icon: Target,
    heroTitle: "Review this week",
    heroBody: "Tell me what you worked on (or leave it general). I'll recap and prioritize next week.",
    placeholder: "e.g. finished Ch7, weak on power factor…",
    modeMenuLabel: "Review style",
    modes: [
      { id: "recap", emoji: "📅", label: "Recap", shortLabel: "Recap", tagline: "What happened" },
      { id: "priorities", emoji: "🎯", label: "Priorities", shortLabel: "Priorities", tagline: "Next week focus" },
      { id: "balance", emoji: "⚖️", label: "Balance", shortLabel: "Balance", tagline: "Time + energy" },
    ],
    defaultMode: "priorities",
    starters: ["This week", "Before midterm week"],
    learningGoal: "prepare",
    followUps: [
      { id: "plan", label: "Build plan", icon: Target, prompt: "Turn priorities into a concrete 5-day plan." },
      { id: "session", label: "Tonight's session", icon: Sparkles, prompt: "Design a 45-minute study session for tonight." },
    ],
    buildPrompt: (topic, mode) => `Weekly review based on: "${topic}". Focus: ${mode}.
Give wins, gaps, and top 3 priorities for next week.`,
  },

  "study-plan-builder": {
    id: "study-plan-builder",
    title: "Study Plan",
    subtitle: "Interactive daily coach — journey, deadlines, and sessions",
    icon: Target,
    heroTitle: "Your plan is ready",
    heroBody: "Personalized from your weak topics and upcoming work.",
    placeholder: "",
    modeMenuLabel: "Plan horizon",
    modes: [
      { id: "week", emoji: "📅", label: "This week", shortLabel: "Week", tagline: "5–7 day plan" },
    ],
    defaultMode: "week",
    starters: [],
    learningGoal: "prepare",
    drawerKind: "interactive-plan",
    workspaceLabel: "Study plan workspace",
    primaryCta: "Open plan",
    autoGenerateOnOpen: true,
    followUps: [],
    buildPrompt: (topic) => `Build a study plan for: "${topic}".`,
  },
}

export function getStudioToolChatConfig(toolId: string): StudioToolChatConfig | null {
  return STUDIO_TOOL_CHAT_CONFIGS[toolId] ?? null
}

export function isStudioToolChat(toolId: string): boolean {
  return toolId in STUDIO_TOOL_CHAT_CONFIGS
}
