/**
 * AI Bootcamp Module 6 — AI Learning Accelerator (shared).
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"
import { AI_BOOTCAMP_MODULE_6_PART_BLOCKS } from "./ai-bootcamp-module-6-parts"
import { AI_BOOTCAMP_MODULE_6_QUIZ } from "./ai-bootcamp-module-6-quiz"

function callout(textContent: string, sort: number, variant = "tip"): CurriculumBlock {
  return { block_type: "callout", content: { variant, text: textContent }, sort_order: sort }
}

function interactive(content: Record<string, unknown>, sort: number): CurriculumBlock {
  return { block_type: "interactive", content, sort_order: sort }
}

function kc(title: string, questions: Array<Record<string, unknown>>, sort: number): CurriculumBlock {
  return { block_type: "quiz", content: { title, questions }, sort_order: sort }
}

const PREAMBLE: CurriculumBlock[] = [
  {
    block_type: "hero",
    sort_order: 0,
    content: {
      title: "AI Learning Accelerator",
      subtitle: "Module 6 · Study Smarter. Learn Faster. Achieve More.",
      tags: ["Learn", "L-E-A-R-N", "Tutor", "Exam Prep"],
      variant: "cover",
      imageUrl: "/summer-camp/ai-bootcamp/assets/module-6/m6-hero.png",
    },
  },
  callout(
    "**Duration:** 3–4 hours · **Alt title:** AI Learning & Productivity Studio · **Level:** High School & Freshman · **Difficulty:** Beginner → Intermediate · **XP:** 300 · **Badge:** 🚀 AI-Powered Learner",
    1,
    "info",
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Module Overview",
      subtitle: "Build an AI-powered learning system — not \"do my schoolwork for me.\"",
      columns: 2,
      cards: [
        {
          icon: "brain",
          title: "Core question",
          body: "How can AI help me become a stronger, faster, more independent learner?",
        },
        {
          icon: "book",
          title: "What you'll build",
          body: "Tutor workflows, smart notes, exam prep, research, writing feedback, productivity, and a personal AI Study Toolkit.",
        },
      ],
    },
    2,
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Module Outcomes",
      columns: 2,
      cards: [
        { icon: "message", title: "AI tutor & notes", body: "Configure a tutor; convert notes into study materials." },
        { icon: "target", title: "Exam prep", body: "Active recall, diagnostics, and targeted review." },
        { icon: "wand", title: "Research & writing", body: "Credible sources; improve drafts while keeping authorship." },
        { icon: "shield", title: "Integrity & toolkit", body: "Green/yellow/red zones, PAUSE, and reusable study templates." },
      ],
    },
    3,
  ),
  {
    block_type: "mission_objectives",
    sort_order: 4,
    content: {
      title: "Your Learning Accelerator Journey",
      missions: [
        { title: "Build personal AI tutor + smart notes", xp: 45 },
        { title: "Explanation ladder + exam prep labs", xp: 50 },
        { title: "Productivity + research + writing studio", xp: 50 },
        { title: "Responsible academic AI + learning stack", xp: 40 },
        { title: "Premium workshops + study toolkit", xp: 45 },
        { title: "Capstone + knowledge check (22 Q)", xp: 70 },
      ],
    },
  },
  {
    block_type: "interactive",
    sort_order: 5,
    content: { variant: "start_journey", title: "Start Mission: AI Learning Accelerator" },
  },
  callout(
    "**Free tools only for labs:** ChatGPT Free, Gemini Free, or Perplexity Free — instructor picks one per cohort. **Privacy:** type short anonymized notes; do not upload PDFs, graded work, or IDs. Save portfolio artifacts to CourseCollab (private to your class), not public web.",
    6,
    "warning",
  ),
]

const CLOSING = AI_BOOTCAMP_MODULE_6_PART_BLOCKS.filter(
  (b) => b.block_type === "reflection" || b.block_type === "module_completion" || b.sort_order >= 400,
)
const PARTS = AI_BOOTCAMP_MODULE_6_PART_BLOCKS.filter(
  (b) => b.block_type !== "reflection" && b.block_type !== "module_completion" && b.sort_order < 400,
)

export const AI_BOOTCAMP_MODULE_6: CurriculumModule & { pathway: "shared" } = {
  title: "Module 6: AI Learning Accelerator",
  description:
    "Build an AI-powered learning system: personal tutor, smart notes, exam prep, productivity, research, writing coach, academic integrity, and a reusable study toolkit.",
  sort_order: 7,
  pathway: "shared",
  blocks: [
    ...PREAMBLE,
    ...PARTS,
    kc("Module 6 Knowledge Check — AI Learning Accelerator (22 questions)", AI_BOOTCAMP_MODULE_6_QUIZ, 395),
    ...CLOSING,
  ],
}
