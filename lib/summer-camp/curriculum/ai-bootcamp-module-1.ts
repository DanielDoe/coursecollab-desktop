/**
 * AI Bootcamp Module 1 — What Is Artificial Intelligence?
 * High School pathway · presentation-style instructional package.
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"
import { AI_BOOTCAMP_MODULE_1_PART_BLOCKS } from "./ai-bootcamp-module-1-parts"
import { AI_BOOTCAMP_MODULE_1_QUIZ } from "./ai-bootcamp-module-1-quiz"

function text(markdown: string, sort: number): CurriculumBlock {
  return { block_type: "text", content: { markdown }, sort_order: sort }
}

function callout(textContent: string, sort: number, variant = "tip"): CurriculumBlock {
  return { block_type: "callout", content: { variant, text: textContent }, sort_order: sort }
}

function kc(title: string, questions: Array<Record<string, unknown>>, sort: number): CurriculumBlock {
  return { block_type: "quiz", content: { title, questions }, sort_order: sort }
}

const PREAMBLE: CurriculumBlock[] = [
  {
    block_type: "hero",
    sort_order: 0,
    content: {
      title: "What Is Artificial Intelligence?",
      subtitle: "Module 1 · Foundations for High School & Freshman Pathways",
      tags: ["AI", "Machine Learning", "Generative AI", "Responsible AI"],
      /** Visual 1 — full-slide opening cover behind the module title */
      variant: "cover",
      imageUrl: "/summer-camp/ai-bootcamp/m1-opening-hero.png",
    },
  },
  callout(
    "**Duration:** 2.5–3 hours · **Level:** High School (Grades 9–12) & Freshman beginners · **XP:** 150 · **Badge:** AI Foundations Explorer",
    1,
    "info",
  ),
  text(
    `## Module Overview

Welcome to Module 1 of the Foundational AI Workshop. This module is designed like an interactive presentation: move slide-by-slide through each **Part**, read the explanations, try the activities, and finish with a knowledge check.

### Module outcomes

By the end of this module, you will be able to:

- Explain Artificial Intelligence in simple language
- Differentiate AI from traditional programming
- Understand Machine Learning, Deep Learning, and Generative AI conceptually
- Identify everyday AI applications and understand AI limitations
- Recognize common AI misconceptions and appreciate responsible AI usage
- Prepare to use AI tools effectively in Module 2

### How to learn in this module

1. Use **Next / Previous** (or arrow keys) to move through each Part.
2. Read the examples — they connect abstract ideas to apps you already use.
3. Complete interactives and reflections before the final quiz.
4. Ask questions in Discussion if anything feels unclear.`,
    2,
  ),
  {
    block_type: "mission_objectives",
    sort_order: 3,
    content: {
      title: "Your Learning Journey",
      missions: [
        { title: "Discover AI already in your daily life", xp: 15 },
        { title: "Define intelligence and Artificial Intelligence", xp: 20 },
        { title: "Compare traditional programming with AI", xp: 20 },
        { title: "Explore ML, Deep Learning, and Generative AI", xp: 25 },
        { title: "Investigate LLMs, applications, and limits", xp: 25 },
        { title: "Separate myths from facts & practice responsible use", xp: 25 },
        { title: "Pass the Module 1 knowledge check (22 questions)", xp: 20 },
      ],
    },
  },
  {
    block_type: "interactive",
    sort_order: 4,
    content: { variant: "start_journey", title: "Begin Module 1: What Is Artificial Intelligence?" },
  },
  callout(
    "Tip: Enable **Fullscreen** (top right) for a distraction-free presentation experience.",
    5,
    "tip",
  ),
]

const CLOSING = AI_BOOTCAMP_MODULE_1_PART_BLOCKS.filter(
  (block) =>
    block.block_type === "reflection" ||
    block.block_type === "module_completion" ||
    block.sort_order >= 65,
)

const PARTS = AI_BOOTCAMP_MODULE_1_PART_BLOCKS.filter(
  (block) =>
    block.block_type !== "reflection" &&
    block.block_type !== "module_completion" &&
    block.sort_order < 65,
)

export const AI_BOOTCAMP_MODULE_1_HS: CurriculumModule & {
  pathway: "high-school"
} = {
  title: "Module 1: What Is Artificial Intelligence?",
  description:
    "A presentation-style foundations module: intelligence, AI history, ML & Generative AI, LLMs, applications, limits, myths, responsible use, and hands-on activities.",
  sort_order: 1,
  pathway: "high-school",
  blocks: [
    ...PREAMBLE,
    ...PARTS,
    kc("Module 1 Knowledge Check — AI Foundations (22 questions)", AI_BOOTCAMP_MODULE_1_QUIZ, 64),
    ...CLOSING,
  ],
}
