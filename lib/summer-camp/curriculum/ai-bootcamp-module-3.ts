/**
 * AI Bootcamp Module 3 — Prompt Engineering (shared across pathways).
 * Merged curriculum: revised enterprise structure + best of prior module activities.
 */

import type { CurriculumBlock, CurriculumModule } from "./ai-edge-2026"
import { AI_BOOTCAMP_MODULE_3_PART_BLOCKS } from "./ai-bootcamp-module-3-parts"
import { AI_BOOTCAMP_MODULE_3_QUIZ } from "./ai-bootcamp-module-3-quiz"

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
      title: "Prompt Engineering",
      subtitle: "Module 3 · Communicating Effectively with Artificial Intelligence",
      tags: ["Prompts", "R-T-C-A-C-F", "Prompt Canvas", "Iteration", "Verification"],
      variant: "cover",
    },
  },
  callout(
    "**Duration:** 2.5–3 hours · **Level:** High School (Grades 9–12) & Freshman · **Difficulty:** Beginner → Intermediate · **XP:** 200 · **Badge:** 🎯 Prompt Engineer",
    1,
    "info",
  ),
  text(
    `## Module Overview

Knowing which AI tool to use is only the beginning. The quality of an AI result often depends on how clearly you communicate the **goal, task, context, audience, constraints, examples, and format**.

This process is **prompt engineering** — not discovering magic words, but **designing, testing, evaluating, and improving instructions** so AI can better understand what you are trying to accomplish.

> **How do I communicate a goal clearly, guide the AI effectively, evaluate what it produces, and improve the result responsibly?**

Signature tools: **R-T-C-A-C-F**, the **CourseCollab Prompt Canvas**, iterative refinement, and knowing **when better prompting is not the solution**.`,
    2,
  ),
  text(
    `## Module Outcomes

By the end of Module 3, you will be able to:

1. Define a prompt and prompt engineering
2. Explain why prompt quality influences AI output
3. Apply **R-T-C-A-C-F** and the **Prompt Canvas**
4. Distinguish vague from well-specified prompts; use roles, context, audience, constraints, and formats
5. Use zero-shot, one-shot, few-shot, and **grounded** prompting
6. Decompose complex tasks; iterate; prompt AI to critique, revise, and check its work
7. Prompt for learning, research, images, presentations, coding, data, and multimodal inputs
8. Recognize prompt limits, privacy risks, and prompt injection; build reusable templates`,
    3,
  ),
  {
    block_type: "mission_objectives",
    sort_order: 4,
    content: {
      title: "Your Learning Journey",
      missions: [
        { title: "Master R-T-C-A-C-F + Prompt Canvas", xp: 30 },
        { title: "Practice components, examples & grounded prompts", xp: 25 },
        { title: "Tutor, research, image, code & data prompting", xp: 30 },
        { title: "Complete Hands-On Lab (6 challenges) + Prompt Battle", xp: 30 },
        { title: "V1→V3 Challenge + Personal Prompt Library", xp: 25 },
        { title: "Pass knowledge check (20 questions)", xp: 60 },
      ],
    },
  },
  {
    block_type: "interactive",
    sort_order: 5,
    content: { variant: "start_journey", title: "Begin Module 3: Prompt Engineering" },
  },
  callout(
    "Tip: Enable **Fullscreen** (top right) for a distraction-free presentation experience.",
    6,
    "tip",
  ),
]

const CLOSING = AI_BOOTCAMP_MODULE_3_PART_BLOCKS.filter(
  (block) =>
    block.block_type === "reflection" ||
    block.block_type === "module_completion" ||
    block.sort_order >= 360,
)

const PARTS = AI_BOOTCAMP_MODULE_3_PART_BLOCKS.filter(
  (block) =>
    block.block_type !== "reflection" &&
    block.block_type !== "module_completion" &&
    block.sort_order < 360,
)

export const AI_BOOTCAMP_MODULE_3: CurriculumModule & { pathway: "shared" } = {
  title: "Module 3: Prompt Engineering",
  description:
    "Communicating effectively with AI: R-T-C-A-C-F, Prompt Canvas, grounded & multimodal prompting, iteration, verification, hands-on lab, and a personal prompt library.",
  sort_order: 4,
  pathway: "shared",
  blocks: [
    ...PREAMBLE,
    ...PARTS,
    kc("Module 3 Knowledge Check — Prompt Engineer (20 questions)", AI_BOOTCAMP_MODULE_3_QUIZ, 355),
    ...CLOSING,
  ],
}
