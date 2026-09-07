/**
 * AI Bootcamp Module 7 — AI Career Accelerator (shared).
 * Composer file: ai-bootcamp-module-8.ts
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"
import { AI_BOOTCAMP_MODULE_8_PART_BLOCKS } from "./ai-bootcamp-module-8-parts"
import { AI_BOOTCAMP_MODULE_8_QUIZ } from "./ai-bootcamp-module-8-quiz"

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
      title: "AI Career Accelerator",
      subtitle: "Module 7 · Build Your Future with Artificial Intelligence",
      tags: ["Career", "B-U-I-L-D", "Resume", "Portfolio"],
      variant: "cover",
    },
  },
  callout(
    "**Theme:** Become AI-ready, career-ready, and opportunity-ready · **Duration:** 3–4 hours · **Level:** High School & Freshman · **Difficulty:** Beginner → Intermediate · **XP:** 350 · **Badge:** 💼 AI Career Accelerator",
    1,
    "info",
  ),
  interactive(
    {
      variant: "feature_cards",
      title: "Module Overview",
      subtitle: "Future professionals succeed by combining human expertise, communication, creativity, and AI fluency.",
      columns: 2,
      cards: [
        {
          icon: "target",
          title: "Core question",
          body: "How can AI help me become a stronger candidate, communicator, learner, and problem solver?",
        },
        {
          icon: "brain",
          title: "Not shortcuts",
          body: "Build evidence and skills — not \"How can AI get me a job?\"",
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
        { icon: "book", title: "Resume & brand", body: "Achievement bullets, cover letters, LinkedIn, personal brand studio." },
        { icon: "message", title: "Pitch & interview", body: "Networking, elevator pitch, STAR mock interviews." },
        { icon: "wand", title: "Research & startup", body: "Executive briefs, Lean AI Canvas, productivity stack." },
        { icon: "shield", title: "Career toolkit", body: "Portfolio, roadmap, 90-day blueprint, responsible workplace AI." },
      ],
    },
    3,
  ),
  {
    block_type: "mission_objectives",
    sort_order: 4,
    content: {
      title: "Your Career Accelerator Journey",
      missions: [
        { title: "Future of work + AI career profile", xp: 40 },
        { title: "Resume, cover letter, personal brand", xp: 55 },
        { title: "Networking, pitch, mock interview", xp: 55 },
        { title: "Research brief + entrepreneurship lab", xp: 50 },
        { title: "Portfolio + career blueprint", xp: 50 },
        { title: "Toolkit + knowledge check (24 Q)", xp: 100 },
      ],
    },
  },
  {
    block_type: "interactive",
    sort_order: 5,
    content: { variant: "start_journey", title: "Start Mission: AI Career Accelerator" },
  },
  callout(
    "Use instructor-approved external AI tools. Walkthroughs use free ChatGPT, Gemini, and Perplexity — typed facts only. Never invent experience or upload confidential employer data. Verify every resume claim.",
    6,
    "tip",
  ),
]

const CLOSING = AI_BOOTCAMP_MODULE_8_PART_BLOCKS.filter(
  (b) => b.block_type === "reflection" || b.block_type === "module_completion" || b.sort_order >= 400,
)
const PARTS = AI_BOOTCAMP_MODULE_8_PART_BLOCKS.filter(
  (b) => b.block_type !== "reflection" && b.block_type !== "module_completion" && b.sort_order < 400,
)

export const AI_BOOTCAMP_MODULE_8: CurriculumModule & { pathway: "shared" } = {
  title: "Module 7: AI Career Accelerator",
  description:
    "Become AI-ready and career-ready: resume, brand, networking, interviews, research, entrepreneurship, productivity, portfolio, and a personal AI Career Toolkit.",
  sort_order: 8,
  pathway: "shared",
  blocks: [
    ...PREAMBLE,
    ...PARTS,
    kc("Module 7 Knowledge Check — AI Career Accelerator (24 questions)", AI_BOOTCAMP_MODULE_8_QUIZ, 395),
    ...CLOSING,
  ],
}
